import { dayOf, type Day } from '../date';
import type { ActivityItem, GithubProfile } from '../types';

const API = 'https://api.github.com';
const GRAPHQL = 'https://api.github.com/graphql';

export interface GithubResult {
  profile: GithubProfile;
  /** day -> contribution count, covering the requested window. */
  daily: Map<Day, number>;
}

function headers(token?: string): Record<string, string> {
  const h: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': 'connect-accountability-dashboard',
  };
  if (token) h.authorization = `Bearer ${token}`;
  return h;
}

async function githubFetch(url: string, token?: string): Promise<Response> {
  const res = await fetch(url, { headers: headers(token), cache: 'no-store' });
  if (res.status === 404) throw new Error(`GitHub user not found`);
  if (res.status === 403 || res.status === 429) {
    const reset = res.headers.get('x-ratelimit-reset');
    const when = reset ? new Date(Number(reset) * 1000).toISOString().slice(11, 16) + ' UTC' : 'shortly';
    throw new Error(
      token
        ? `GitHub rate limit hit, resets ~${when}`
        : `GitHub rate limit hit (60/hr unauthenticated), resets ~${when}. Set GITHUB_TOKEN to raise it.`,
    );
  }
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return res;
}

/** Exact daily contribution counts. Needs a token; covers a full trailing year. */
async function fetchCalendar(
  login: string,
  from: Date,
  to: Date,
  token: string,
): Promise<{ daily: Map<Day, number>; total: number }> {
  const query = `
    query($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            totalContributions
            weeks { contributionDays { date contributionCount } }
          }
        }
      }
    }`;

  const res = await fetch(GRAPHQL, {
    method: 'POST',
    headers: { ...headers(token), 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables: { login, from: from.toISOString(), to: to.toISOString() } }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}`);

  const json = (await res.json()) as {
    data?: {
      user: {
        contributionsCollection: {
          contributionCalendar: {
            totalContributions: number;
            weeks: { contributionDays: { date: string; contributionCount: number }[] }[];
          };
        };
      } | null;
    };
    errors?: { message: string }[];
  };

  if (json.errors?.length) throw new Error(json.errors[0].message);
  if (!json.data?.user) throw new Error('GitHub user not found');

  const cal = json.data.user.contributionsCollection.contributionCalendar;
  const daily = new Map<Day, number>();
  for (const week of cal.weeks) {
    for (const d of week.contributionDays) daily.set(d.date, d.contributionCount);
  }
  return { daily, total: cal.totalContributions };
}

const COUNTED_EVENTS = new Set([
  'PushEvent',
  'PullRequestEvent',
  'IssuesEvent',
  'CreateEvent',
  'PullRequestReviewEvent',
]);

interface GhEvent {
  type: string;
  created_at: string;
  repo: { name: string };
  payload: {
    size?: number;
    action?: string;
    ref_type?: string;
    commits?: { message: string }[];
    pull_request?: { html_url: string; title: string; number: number };
    issue?: { html_url: string; title: string; number: number };
  };
}

/** How many contributions one event represents, GitHub-calendar style. */
function eventWeight(e: GhEvent): number {
  switch (e.type) {
    case 'PushEvent':
      return e.payload.size ?? 1;
    case 'PullRequestEvent':
    case 'IssuesEvent':
      return e.payload.action === 'opened' ? 1 : 0;
    case 'CreateEvent':
      return e.payload.ref_type === 'repository' ? 1 : 0;
    case 'PullRequestReviewEvent':
      return 1;
    default:
      return 0;
  }
}

function eventToActivity(e: GhEvent): ActivityItem | null {
  const repo = e.repo?.name ?? '';
  const base = { provider: 'github' as const, at: e.created_at };
  switch (e.type) {
    case 'PushEvent': {
      const n = e.payload.size ?? 0;
      if (n === 0) return null;
      const msg = e.payload.commits?.[e.payload.commits.length - 1]?.message?.split('\n')[0] ?? '';
      return {
        ...base,
        title: `${n} commit${n === 1 ? '' : 's'} to ${repo}`,
        detail: msg || null,
        url: `https://github.com/${repo}`,
      };
    }
    case 'PullRequestEvent': {
      const pr = e.payload.pull_request;
      if (!pr) return null;
      return {
        ...base,
        title: `${e.payload.action} PR #${pr.number} in ${repo}`,
        detail: pr.title,
        url: pr.html_url,
      };
    }
    case 'IssuesEvent': {
      const issue = e.payload.issue;
      if (!issue) return null;
      return {
        ...base,
        title: `${e.payload.action} issue #${issue.number} in ${repo}`,
        detail: issue.title,
        url: issue.html_url,
      };
    }
    case 'CreateEvent':
      return {
        ...base,
        title: `created ${e.payload.ref_type} ${repo}`,
        detail: null,
        url: `https://github.com/${repo}`,
      };
    case 'WatchEvent':
      return { ...base, title: `starred ${repo}`, detail: null, url: `https://github.com/${repo}` };
    default:
      return null;
  }
}

/** Public events: no token needed, but only ~90 days and 300 events deep. */
async function fetchEvents(login: string, token?: string): Promise<GhEvent[]> {
  const all: GhEvent[] = [];
  for (let page = 1; page <= 3; page++) {
    const res = await githubFetch(`${API}/users/${encodeURIComponent(login)}/events/public?per_page=100&page=${page}`, token);
    const batch = (await res.json()) as GhEvent[];
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

export async function fetchGithub(
  login: string,
  from: Day,
  to: Day,
  timezone: string,
  token?: string,
): Promise<GithubResult> {
  const userRes = await githubFetch(`${API}/users/${encodeURIComponent(login)}`, token);
  const user = (await userRes.json()) as {
    login: string;
    name: string | null;
    avatar_url: string;
    html_url: string;
    followers: number;
    public_repos: number;
  };

  // Events power the activity feed in both modes; they're also the daily-count
  // fallback when no token is configured.
  let events: GhEvent[] = [];
  let eventsError: string | null = null;
  try {
    events = await fetchEvents(login, token);
  } catch (err) {
    eventsError = err instanceof Error ? err.message : String(err);
  }

  let daily = new Map<Day, number>();
  let total: number | null = null;
  let precise = false;

  if (token) {
    const fromDate = new Date(`${from}T00:00:00Z`);
    const toDate = new Date(`${to}T23:59:59Z`);
    const cal = await fetchCalendar(login, fromDate, toDate, token);
    daily = cal.daily;
    total = cal.total;
    precise = true;
  } else {
    if (eventsError) throw new Error(eventsError);
    for (const e of events) {
      if (!COUNTED_EVENTS.has(e.type)) continue;
      const w = eventWeight(e);
      if (w === 0) continue;
      const day = dayOf(new Date(e.created_at), timezone);
      daily.set(day, (daily.get(day) ?? 0) + w);
    }
  }

  const recent = events
    .map(eventToActivity)
    .filter((a): a is ActivityItem => a !== null)
    .slice(0, 15);

  return {
    profile: {
      login: user.login,
      name: user.name,
      avatarUrl: user.avatar_url,
      htmlUrl: user.html_url,
      followers: user.followers,
      publicRepos: user.public_repos,
      totalContributions: total,
      precise,
      recent,
    },
    daily,
  };
}
