import { addDays, type Day } from './date';
import type { Checkin, DailyStat, Goal, MetricKey, Person, PersonView } from './types';

export const EMPTY_STAT = (personId: string, day: Day): DailyStat => ({
  personId,
  day,
  github: 0,
  leetcode: 0,
  leetcodeTotal: null,
});

/** A goal of 0 means "not tracking this metric", so it is always satisfied. */
export function goalMet(stat: DailyStat, person: Person, metric: MetricKey): boolean {
  const target = metric === 'github' ? person.goalGithub : person.goalLeetcode;
  if (target <= 0) return true;
  return stat[metric] >= target;
}

/** A day counts toward the streak when every active goal is met. */
export function dayMet(stat: DailyStat, person: Person): boolean {
  if (person.goalGithub <= 0 && person.goalLeetcode <= 0) {
    // No goals set: any activity at all counts.
    return stat.github > 0 || stat.leetcode > 0;
  }
  return goalMet(stat, person, 'github') && goalMet(stat, person, 'leetcode');
}

export interface StreakResult {
  current: number;
  longest: number;
  activeToday: boolean;
}

/**
 * Current streak counts back from today. A today that hasn't been earned yet
 * doesn't break the streak — the day isn't over — so counting resumes from
 * yesterday; it only breaks once a *completed* day is missed.
 */
export function computeStreak(
  byDay: Map<Day, DailyStat>,
  person: Person,
  days: Day[],
  today: Day,
): StreakResult {
  const met = (day: Day) => dayMet(byDay.get(day) ?? EMPTY_STAT(person.id, day), person);

  const activeToday = met(today);
  let current = 0;
  let cursor = activeToday ? today : addDays(today, -1);
  const earliest = days[0] ?? today;
  while (cursor >= earliest && met(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  let longest = 0;
  let run = 0;
  for (const day of days) {
    if (met(day)) {
      run++;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }

  return { current, longest: Math.max(longest, current), activeToday };
}

export function sumWindow(
  byDay: Map<Day, DailyStat>,
  person: Person,
  days: Day[],
): { github: number; leetcode: number; daysMet: number } {
  let github = 0;
  let leetcode = 0;
  let daysMet = 0;
  for (const day of days) {
    const stat = byDay.get(day) ?? EMPTY_STAT(person.id, day);
    github += stat.github;
    leetcode += stat.leetcode;
    if (dayMet(stat, person)) daysMet++;
  }
  return { github, leetcode, daysMet };
}

/**
 * Exact problems solved today, from the change in lifetime accepted count.
 * Needs an observation on both days; returns null when we can't be sure.
 */
export function solvedToday(byDay: Map<Day, DailyStat>, today: Day): number | null {
  const now = byDay.get(today)?.leetcodeTotal;
  const prev = byDay.get(addDays(today, -1))?.leetcodeTotal;
  if (now == null || prev == null) return null;
  return Math.max(0, now - prev);
}

export function buildPersonView(
  person: Person,
  stats: DailyStat[],
  checkins: Checkin[],
  goals: Goal[],
  days: Day[],
  today: Day,
  profile: PersonView['profile'],
): PersonView {
  const byDay = new Map<Day, DailyStat>(stats.map((s) => [s.day, s]));
  const todayStat = byDay.get(today) ?? EMPTY_STAT(person.id, today);
  const weekDays = days.slice(-7);
  const checkinsByDay = Object.fromEntries(checkins.map((c) => [c.day, c]));

  return {
    person,
    profile,
    days: days.map((day) => byDay.get(day) ?? EMPTY_STAT(person.id, day)),
    checkins: checkinsByDay,
    goals,
    goalsToday: goals.filter((g) => g.day === today),
    presentToday: checkinsByDay[today]?.done ?? false,
    today: todayStat,
    solvedToday: solvedToday(byDay, today),
    streak: computeStreak(byDay, person, days, today),
    week: sumWindow(byDay, person, weekDays),
    goalsMetToday: {
      github: goalMet(todayStat, person, 'github'),
      leetcode: goalMet(todayStat, person, 'leetcode'),
      all: dayMet(todayStat, person),
    },
  };
}

/** Bin a value onto the 0–4 heatmap scale, relative to the window's own maximum. */
export function heatLevel(value: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (value <= 0) return 0;
  if (max <= 1) return 4;
  const ratio = value / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}
