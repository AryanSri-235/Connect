import { addDays, APP_TIMEZONE, lastNDays, today as todayIn, type Day } from './date';
import { buildPersonView } from './metrics';
import { fetchGithub } from './providers/github';
import { fetchLeetcode } from './providers/leetcode';
import { getStore } from './store';
import type { DashboardData, DailyStat, Person, Profile, ProviderError } from './types';
import { DEFAULT_WINDOW, type WindowDays } from './window';

/** How far back we ask the providers for history. */
const FETCH_WINDOW_DAYS = 365;
/** GitHub's public-events fallback only reaches ~90 days. */
const EVENTS_WINDOW_DAYS = 90;
/** Skip a re-sync if the last one was this recent. */
export const SYNC_TTL_MS = 10 * 60 * 1000;

const LAST_SYNC_KEY = 'last_sync';

export interface SyncReport {
  syncedAt: string;
  people: { personId: string; name: string; errors: ProviderError[] }[];
}

async function syncPerson(person: Person, from: Day, to: Day, existing: Map<Day, DailyStat>): Promise<{
  profile: Profile;
  rows: DailyStat[];
}> {
  const errors: ProviderError[] = [];
  const token = process.env.GITHUB_TOKEN?.trim() || undefined;

  let ghDaily: Map<Day, number> | null = null;
  let ghProfile: Profile['github'] = null;
  let ghFrom = from;

  if (person.githubUsername) {
    try {
      const res = await fetchGithub(person.githubUsername, from, to, APP_TIMEZONE, token);
      ghDaily = res.daily;
      ghProfile = res.profile;
      // Without a token we only saw ~90 days; don't zero out anything older.
      if (!res.profile.precise) {
        const cutoff = addDays(to, -(EVENTS_WINDOW_DAYS - 1));
        ghFrom = cutoff > from ? cutoff : from;
      }
    } catch (err) {
      errors.push({ provider: 'github', message: err instanceof Error ? err.message : String(err) });
    }
  }

  let lcDaily: Map<Day, number> | null = null;
  let lcProfile: Profile['leetcode'] = null;

  if (person.leetcodeUsername) {
    try {
      const res = await fetchLeetcode(person.leetcodeUsername, from, to);
      lcDaily = res.daily;
      lcProfile = res.profile;
    } catch (err) {
      errors.push({ provider: 'leetcode', message: err instanceof Error ? err.message : String(err) });
    }
  }

  // Merge over the window. A provider that failed (or didn't cover a day) leaves
  // the stored value untouched rather than blanking it to zero.
  const rows: DailyStat[] = [];
  for (const day of lastNDays(FETCH_WINDOW_DAYS, to)) {
    const prev = existing.get(day);
    const github = ghDaily && day >= ghFrom ? (ghDaily.get(day) ?? 0) : (prev?.github ?? 0);
    const leetcode = lcDaily ? (lcDaily.get(day) ?? 0) : (prev?.leetcode ?? 0);
    // The lifetime solved count is only meaningful as of now, so stamp it on today.
    const leetcodeTotal = day === to && lcProfile ? lcProfile.solved.total : (prev?.leetcodeTotal ?? null);

    if (github === 0 && leetcode === 0 && leetcodeTotal == null && !prev) continue;
    rows.push({ personId: person.id, day, github, leetcode, leetcodeTotal });
  }

  return {
    profile: {
      personId: person.id,
      fetchedAt: new Date().toISOString(),
      github: ghProfile,
      leetcode: lcProfile,
      errors,
    },
    rows,
  };
}

/** Refetch both people from both providers and persist the results. */
export async function syncAll(): Promise<SyncReport> {
  const store = getStore();
  const people = await store.listPeople();
  const to = todayIn();
  const from = addDays(to, -(FETCH_WINDOW_DAYS - 1));

  const existingRows = await store.getStats(from, to);
  const existingByPerson = new Map<string, Map<Day, DailyStat>>();
  for (const row of existingRows) {
    let m = existingByPerson.get(row.personId);
    if (!m) existingByPerson.set(row.personId, (m = new Map()));
    m.set(row.day, row);
  }

  const results = await Promise.all(
    people.map((p) => syncPerson(p, from, to, existingByPerson.get(p.id) ?? new Map())),
  );

  for (const { profile, rows } of results) {
    await store.saveStats(rows);
    await store.saveProfile(profile);
  }

  const syncedAt = new Date().toISOString();
  await store.setMeta(LAST_SYNC_KEY, syncedAt);

  return {
    syncedAt,
    people: people.map((p, i) => ({ personId: p.id, name: p.name, errors: results[i].profile.errors })),
  };
}

/** Sync only if the cached data has gone stale. */
export async function syncIfStale(): Promise<boolean> {
  const store = getStore();
  const last = await store.getMeta(LAST_SYNC_KEY);
  if (last && Date.now() - new Date(last).getTime() < SYNC_TTL_MS) return false;
  const people = await store.listPeople();
  if (!people.length) return false;
  await syncAll();
  return true;
}

export async function getDashboardData(windowDays: WindowDays = DEFAULT_WINDOW): Promise<DashboardData> {
  const store = getStore();
  const people = await store.listPeople();
  const to = todayIn();
  const days = lastNDays(windowDays, to);
  const from = days[0];

  const [stats, checkins, goals, profiles, lastSync] = await Promise.all([
    store.getStats(from, to),
    store.getCheckins(from, to),
    store.getGoals(from, to),
    store.getProfiles(),
    store.getMeta(LAST_SYNC_KEY),
  ]);

  const profileById = new Map(profiles.map((p) => [p.personId, p]));

  return {
    people: people.map((person) =>
      buildPersonView(
        person,
        stats.filter((s) => s.personId === person.id),
        checkins.filter((c) => c.personId === person.id),
        goals.filter((g) => g.personId === person.id),
        days,
        to,
        profileById.get(person.id) ?? null,
      ),
    ),
    today: to,
    timezone: APP_TIMEZONE,
    windowDays,
    lastSync,
    storeKind: store.kind,
    githubPrecise: Boolean(process.env.GITHUB_TOKEN?.trim()),
  };
}
