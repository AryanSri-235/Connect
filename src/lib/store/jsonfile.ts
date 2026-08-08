import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Day } from '../date';
import { MAX_GOALS_PER_DAY, type Checkin, type DailyStat, type Goal, type Person, type Profile } from '../types';
import { newId, type Store } from './types';

/**
 * Zero-setup local driver: the whole dataset in one JSON file. Fine for two
 * people and a year of days (a few hundred KB). Not for production — serverless
 * filesystems are read-only and per-instance, which is why `store/index.ts`
 * refuses to select this driver when deployed.
 */

interface FileShape {
  people: Person[];
  stats: Record<string, DailyStat>; // `${personId}|${day}`
  checkins: Record<string, Checkin>; // `${personId}|${day}`
  goals: Record<string, Goal>; // keyed by goal id
  profiles: Record<string, Profile>;
  meta: Record<string, string>;
}

const EMPTY: FileShape = { people: [], stats: {}, checkins: {}, goals: {}, profiles: {}, meta: {} };

const key = (personId: string, day: Day) => `${personId}|${day}`;

export function createFileStore(file: string): Store {
  let cache: FileShape | null = null;
  // Serialize all access so concurrent requests can't interleave read/modify/write.
  let queue: Promise<unknown> = Promise.resolve();

  async function load(): Promise<FileShape> {
    if (cache) return cache;
    try {
      const raw = await readFile(file, 'utf8');
      const parsed = JSON.parse(raw) as Partial<FileShape>;
      cache = { ...EMPTY, ...parsed };
    } catch {
      cache = structuredClone(EMPTY);
    }
    return cache;
  }

  async function flush(data: FileShape): Promise<void> {
    await mkdir(dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
    await rename(tmp, file); // atomic swap, so a crash can't leave a half-written file
  }

  /** Run `fn` against the dataset with exclusive access; persist when it writes. */
  function tx<T>(fn: (data: FileShape) => T | Promise<T>, writes: boolean): Promise<T> {
    const run = queue.then(async () => {
      const data = await load();
      const result = await fn(data);
      if (writes) await flush(data);
      return result;
    });
    queue = run.catch(() => undefined);
    return run;
  }

  const inRange = (day: Day, from: Day, to: Day) => day >= from && day <= to;

  return {
    kind: 'file',

    listPeople: () => tx((d) => [...d.people].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)), false),

    savePeople: (people) =>
      tx((d) => {
        const next: Person[] = people.map((p, i) => ({
          id: p.id || newId(),
          name: p.name,
          githubUsername: p.githubUsername,
          leetcodeUsername: p.leetcodeUsername,
          slot: p.slot,
          goalGithub: p.goalGithub,
          goalLeetcode: p.goalLeetcode,
          sortOrder: p.sortOrder ?? i,
        }));
        const keep = new Set(next.map((p) => p.id));

        // Cascade: drop rows belonging to removed people.
        for (const store of [d.stats, d.checkins, d.goals] as Record<string, { personId: string }>[]) {
          for (const k of Object.keys(store)) {
            if (!keep.has(store[k].personId)) delete store[k];
          }
        }
        for (const id of Object.keys(d.profiles)) {
          if (!keep.has(id)) delete d.profiles[id];
        }

        d.people = next;
        return [...next].sort((a, b) => a.sortOrder - b.sortOrder);
      }, true),

    getStats: (from, to) => tx((d) => Object.values(d.stats).filter((s) => inRange(s.day, from, to)), false),

    saveStats: (rows) =>
      tx((d) => {
        for (const r of rows) {
          const k = key(r.personId, r.day);
          const prev = d.stats[k];
          d.stats[k] = { ...r, leetcodeTotal: r.leetcodeTotal ?? prev?.leetcodeTotal ?? null };
        }
      }, true),

    getCheckins: (from, to) => tx((d) => Object.values(d.checkins).filter((c) => inRange(c.day, from, to)), false),

    saveCheckin: (c) =>
      tx((d) => {
        const saved: Checkin = { ...c, updatedAt: new Date().toISOString() };
        d.checkins[key(c.personId, c.day)] = saved;
        return saved;
      }, true),

    getGoals: (from, to) =>
      tx(
        (d) =>
          Object.values(d.goals)
            .filter((g) => inRange(g.day, from, to))
            .sort((a, b) => a.day.localeCompare(b.day) || a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)),
        false,
      ),

    addGoal: (personId, day, title) =>
      tx((d) => {
        const mine = Object.values(d.goals).filter((g) => g.personId === personId && g.day === day);
        if (mine.length >= MAX_GOALS_PER_DAY) return null;

        const goal: Goal = {
          id: newId(),
          personId,
          day,
          title,
          done: false,
          sortOrder: mine.reduce((max, g) => Math.max(max, g.sortOrder), -1) + 1,
          createdAt: new Date().toISOString(),
        };
        d.goals[goal.id] = goal;
        return goal;
      }, true),

    updateGoal: (id, personId, patch) =>
      tx((d) => {
        const goal = d.goals[id];
        // Ownership check: a goal belonging to the other person is untouchable.
        if (!goal || goal.personId !== personId) return null;
        if (patch.title !== undefined) goal.title = patch.title;
        if (patch.done !== undefined) goal.done = patch.done;
        return goal;
      }, true),

    deleteGoal: (id, personId) =>
      tx((d) => {
        const goal = d.goals[id];
        if (!goal || goal.personId !== personId) return false;
        delete d.goals[id];
        return true;
      }, true),

    getProfiles: () => tx((d) => Object.values(d.profiles), false),

    saveProfile: (p) =>
      tx((d) => {
        d.profiles[p.personId] = p;
      }, true),

    getMeta: (k) => tx((d) => d.meta[k] ?? null, false),

    setMeta: (k, v) =>
      tx((d) => {
        d.meta[k] = v;
      }, true),
  };
}

export const DEFAULT_FILE = join(process.cwd(), '.data', 'connect.json');
