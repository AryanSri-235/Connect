import type { Day } from '../date';
import type { ActivityItem, LeetcodeProfile } from '../types';

const ENDPOINT = 'https://leetcode.com/graphql/';

export interface LeetcodeResult {
  profile: LeetcodeProfile;
  /** day -> submission count for the requested window. */
  daily: Map<Day, number>;
}

/**
 * LeetCode has no documented public API. This is the same GraphQL endpoint the
 * profile page itself calls, and it serves public profiles without auth. It can
 * change without notice, and it rejects requests that don't look browser-ish —
 * hence the Referer/Origin/User-Agent headers below.
 */
const PROFILE_QUERY = `
  query connectUserProfile($username: String!, $year: Int) {
    matchedUser(username: $username) {
      username
      profile { realName userAvatar ranking }
      submitStats: submitStatsGlobal {
        acSubmissionNum { difficulty count }
      }
      userCalendar(year: $year) {
        streak
        totalActiveDays
        submissionCalendar
      }
    }
    recentAcSubmissionList(username: $username, limit: 15) {
      id
      title
      titleSlug
      timestamp
    }
  }`;

const CALENDAR_QUERY = `
  query connectUserCalendar($username: String!, $year: Int) {
    matchedUser(username: $username) {
      userCalendar(year: $year) { submissionCalendar }
    }
  }`;

interface MatchedUser {
  username: string;
  profile: { realName: string | null; userAvatar: string | null; ranking: number | null } | null;
  submitStats: { acSubmissionNum: { difficulty: string; count: number }[] } | null;
  userCalendar: {
    streak: number | null;
    totalActiveDays: number | null;
    submissionCalendar: string | null;
  } | null;
}

async function graphql<T>(query: string, variables: Record<string, unknown>, username: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        referer: `https://leetcode.com/u/${encodeURIComponent(username)}/`,
        origin: 'https://leetcode.com',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      },
      body: JSON.stringify({ query, variables }),
      cache: 'no-store',
    });
  } catch (err) {
    throw new Error(`LeetCode unreachable: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (res.status === 403) throw new Error('LeetCode blocked the request (403) — it rate-limits server IPs');
  if (res.status === 429) throw new Error('LeetCode rate limit hit (429) — try again in a few minutes');
  if (!res.ok) throw new Error(`LeetCode API ${res.status}`);

  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  if (!json.data) throw new Error('LeetCode returned no data');
  return json.data;
}

/** submissionCalendar is a JSON string of { "<utc-midnight-seconds>": count }. */
function parseCalendar(raw: string | null | undefined, into: Map<Day, number>): void {
  if (!raw) return;
  let obj: Record<string, number>;
  try {
    obj = JSON.parse(raw) as Record<string, number>;
  } catch {
    return;
  }
  for (const [seconds, count] of Object.entries(obj)) {
    const day = new Date(Number(seconds) * 1000).toISOString().slice(0, 10);
    into.set(day, (into.get(day) ?? 0) + Number(count));
  }
}

export async function fetchLeetcode(username: string, from: Day, to: Day): Promise<LeetcodeResult> {
  const toYear = Number(to.slice(0, 4));
  const fromYear = Number(from.slice(0, 4));

  const data = await graphql<{
    matchedUser: MatchedUser | null;
    recentAcSubmissionList: { id: string; title: string; titleSlug: string; timestamp: string }[] | null;
  }>(PROFILE_QUERY, { username, year: toYear }, username);

  const user = data.matchedUser;
  if (!user) throw new Error(`LeetCode user "${username}" not found`);

  const daily = new Map<Day, number>();
  parseCalendar(user.userCalendar?.submissionCalendar, daily);

  // A window that straddles New Year needs the previous year's calendar too.
  for (let year = fromYear; year < toYear; year++) {
    try {
      const extra = await graphql<{ matchedUser: { userCalendar: { submissionCalendar: string | null } | null } | null }>(
        CALENDAR_QUERY,
        { username, year },
        username,
      );
      parseCalendar(extra.matchedUser?.userCalendar?.submissionCalendar, daily);
    } catch {
      // A missing prior year just means a shorter heatmap, not a failed sync.
    }
  }

  const counts = new Map((user.submitStats?.acSubmissionNum ?? []).map((s) => [s.difficulty, s.count]));
  const solved = {
    easy: counts.get('Easy') ?? 0,
    medium: counts.get('Medium') ?? 0,
    hard: counts.get('Hard') ?? 0,
    total: counts.get('All') ?? 0,
  };
  if (!solved.total) solved.total = solved.easy + solved.medium + solved.hard;

  const recent: ActivityItem[] = (data.recentAcSubmissionList ?? []).map((s) => ({
    provider: 'leetcode' as const,
    title: `solved ${s.title}`,
    detail: null,
    url: `https://leetcode.com/problems/${s.titleSlug}/`,
    at: new Date(Number(s.timestamp) * 1000).toISOString(),
  }));

  return {
    profile: {
      username: user.username,
      realName: user.profile?.realName ?? null,
      avatarUrl: user.profile?.userAvatar ?? null,
      ranking: user.profile?.ranking ?? null,
      solved,
      totalActiveDays: user.userCalendar?.totalActiveDays ?? null,
      providerStreak: user.userCalendar?.streak ?? null,
      recent,
    },
    daily,
  };
}
