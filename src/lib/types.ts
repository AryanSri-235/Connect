import type { Day } from './date';

export type MetricKey = 'github' | 'leetcode';

export interface Person {
  id: string;
  name: string;
  githubUsername: string | null;
  leetcodeUsername: string | null;
  /** 0 = first slot (blue), 1 = second slot (orange). Fixed per person, never by rank. */
  slot: number;
  goalGithub: number;
  goalLeetcode: number;
  sortOrder: number;
}

export type PersonInput = Omit<Person, 'id'> & { id?: string };

/** One person's counts for one day. */
export interface DailyStat {
  personId: string;
  day: Day;
  /** GitHub contributions that day. */
  github: number;
  /** LeetCode submissions that day (LeetCode's calendar counts submissions, not unique solves). */
  leetcode: number;
  /**
   * Lifetime accepted-problem count as of that day's sync, or null for days we
   * never observed. Consecutive observations give an exact "problems solved
   * that day" delta, which `leetcode` alone cannot provide.
   */
  leetcodeTotal: number | null;
}

/**
 * Attendance for one person on one day — "I showed up". Distinct from the
 * numeric GitHub/LeetCode targets, which are measured automatically.
 */
export interface Checkin {
  personId: string;
  day: Day;
  note: string;
  done: boolean;
  updatedAt: string;
}

/**
 * A goal someone wrote for themselves for a given day. Only its owner can add,
 * edit, complete, or delete it; the other person sees it read-only.
 */
export interface Goal {
  id: string;
  personId: string;
  day: Day;
  title: string;
  done: boolean;
  sortOrder: number;
  createdAt: string;
}

export const MAX_GOAL_TITLE = 200;
export const MAX_GOALS_PER_DAY = 30;

/** Cached provider profile data — avatars, totals, recent activity. */
export interface Profile {
  personId: string;
  fetchedAt: string;
  github: GithubProfile | null;
  leetcode: LeetcodeProfile | null;
  /** Non-fatal provider errors from the last sync, shown in the UI. */
  errors: ProviderError[];
}

export interface ProviderError {
  provider: MetricKey;
  message: string;
}

export interface GithubProfile {
  login: string;
  name: string | null;
  avatarUrl: string | null;
  htmlUrl: string;
  followers: number | null;
  publicRepos: number | null;
  /** Contributions in the trailing year. Null when only the events fallback ran. */
  totalContributions: number | null;
  /** True when the full contribution calendar was used (token present). */
  precise: boolean;
  recent: ActivityItem[];
}

export interface LeetcodeProfile {
  username: string;
  realName: string | null;
  avatarUrl: string | null;
  ranking: number | null;
  solved: { easy: number; medium: number; hard: number; total: number };
  totalActiveDays: number | null;
  providerStreak: number | null;
  recent: ActivityItem[];
}

export interface ActivityItem {
  provider: MetricKey;
  title: string;
  detail: string | null;
  url: string | null;
  /** ISO timestamp. */
  at: string;
}

/** Everything the dashboard renders for one person. */
export interface PersonView {
  person: Person;
  profile: Profile | null;
  days: DailyStat[];
  checkins: Record<Day, Checkin>;
  /** Every goal in the loaded window, oldest day first. */
  goals: Goal[];
  /** Just today's goals, in display order. */
  goalsToday: Goal[];
  /** Attendance marked for today. */
  presentToday: boolean;
  today: DailyStat;
  /** Exact problems solved today, when two consecutive totals were observed. */
  solvedToday: number | null;
  streak: { current: number; longest: number; activeToday: boolean };
  week: { github: number; leetcode: number; daysMet: number };
  goalsMetToday: { github: boolean; leetcode: boolean; all: boolean };
}

export interface DashboardData {
  people: PersonView[];
  today: Day;
  timezone: string;
  windowDays: number;
  lastSync: string | null;
  storeKind: 'postgres' | 'file';
  githubPrecise: boolean;
}
