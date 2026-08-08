import postgres from 'postgres';
import type { Day } from '../date';
import { MAX_GOALS_PER_DAY, type Checkin, type DailyStat, type Goal, type Person, type PersonInput, type Profile } from '../types';
import { newId, type Store } from './types';

type Sql = ReturnType<typeof postgres>;

const globalForPg = globalThis as unknown as { __connectSql?: Sql; __connectReady?: Promise<void> };

function client(url: string): Sql {
  if (globalForPg.__connectSql) return globalForPg.__connectSql;
  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])/.test(url);
  const sql = postgres(url, {
    // Serverless: many short-lived isolates, so one connection each and a short idle.
    max: 1,
    idle_timeout: 20,
    connect_timeout: 15,
    // Transaction-mode poolers (Supabase :6543, pgbouncer) reject prepared statements.
    prepare: false,
    ssl: isLocal ? undefined : 'require',
  });
  globalForPg.__connectSql = sql;
  return sql;
}

async function ensureSchema(sql: Sql): Promise<void> {
  await sql`
    create table if not exists people (
      id text primary key,
      name text not null,
      github_username text,
      leetcode_username text,
      slot int not null default 0,
      goal_github int not null default 1,
      goal_leetcode int not null default 1,
      sort_order int not null default 0
    )`;
  await sql`
    create table if not exists daily_stats (
      person_id text not null references people(id) on delete cascade,
      day date not null,
      github int not null default 0,
      leetcode int not null default 0,
      leetcode_total int,
      primary key (person_id, day)
    )`;
  await sql`
    create table if not exists checkins (
      person_id text not null references people(id) on delete cascade,
      day date not null,
      note text not null default '',
      done boolean not null default false,
      updated_at timestamptz not null default now(),
      primary key (person_id, day)
    )`;
  await sql`
    create table if not exists daily_goals (
      id text primary key,
      person_id text not null references people(id) on delete cascade,
      day date not null,
      title text not null,
      done boolean not null default false,
      sort_order int not null default 0,
      created_at timestamptz not null default now()
    )`;
  await sql`create index if not exists daily_goals_person_day on daily_goals (person_id, day)`;
  await sql`
    create table if not exists profiles (
      person_id text primary key references people(id) on delete cascade,
      fetched_at timestamptz not null default now(),
      data jsonb not null
    )`;
  await sql`
    create table if not exists meta (
      key text primary key,
      value text not null
    )`;
}

function ready(sql: Sql): Promise<void> {
  if (!globalForPg.__connectReady) {
    globalForPg.__connectReady = ensureSchema(sql).catch((err) => {
      // Let the next request retry rather than caching a failed migration.
      globalForPg.__connectReady = undefined;
      throw err;
    });
  }
  return globalForPg.__connectReady;
}

interface PersonRow {
  id: string;
  name: string;
  github_username: string | null;
  leetcode_username: string | null;
  slot: number;
  goal_github: number;
  goal_leetcode: number;
  sort_order: number;
}

interface GoalRow {
  id: string;
  person_id: string;
  day: string;
  title: string;
  done: boolean;
  sort_order: number;
  created_at: Date;
}

const toGoal = (r: GoalRow): Goal => ({
  id: r.id,
  personId: r.person_id,
  day: r.day as Day,
  title: r.title,
  done: r.done,
  sortOrder: r.sort_order,
  createdAt: r.created_at.toISOString(),
});

const toPerson = (r: PersonRow): Person => ({
  id: r.id,
  name: r.name,
  githubUsername: r.github_username,
  leetcodeUsername: r.leetcode_username,
  slot: r.slot,
  goalGithub: r.goal_github,
  goalLeetcode: r.goal_leetcode,
  sortOrder: r.sort_order,
});

export function createPostgresStore(url: string): Store {
  const sql = client(url);
  const db = async <T>(fn: () => Promise<T>): Promise<T> => {
    await ready(sql);
    return fn();
  };

  return {
    kind: 'postgres',

    listPeople: () =>
      db(async () => {
        const rows = await sql<PersonRow[]>`select * from people order by sort_order, name`;
        return rows.map(toPerson);
      }),

    savePeople: (people) =>
      db(async () => {
        const withIds = people.map((p, i) => ({ ...p, id: p.id || newId(), sortOrder: p.sortOrder ?? i }));
        const keep = withIds.map((p) => p.id);

        await sql.begin(async (tx) => {
          for (const p of withIds) {
            await tx`
              insert into people (id, name, github_username, leetcode_username, slot, goal_github, goal_leetcode, sort_order)
              values (${p.id}, ${p.name}, ${p.githubUsername}, ${p.leetcodeUsername}, ${p.slot},
                      ${p.goalGithub}, ${p.goalLeetcode}, ${p.sortOrder})
              on conflict (id) do update set
                name = excluded.name,
                github_username = excluded.github_username,
                leetcode_username = excluded.leetcode_username,
                slot = excluded.slot,
                goal_github = excluded.goal_github,
                goal_leetcode = excluded.goal_leetcode,
                sort_order = excluded.sort_order`;
          }
          if (keep.length) await tx`delete from people where id <> all(${keep})`;
          else await tx`delete from people`;
        });

        const rows = await sql<PersonRow[]>`select * from people order by sort_order, name`;
        return rows.map(toPerson);
      }),

    getStats: (from, to) =>
      db(async () => {
        const rows = await sql<
          { person_id: string; day: string; github: number; leetcode: number; leetcode_total: number | null }[]
        >`select person_id, to_char(day, 'YYYY-MM-DD') as day, github, leetcode, leetcode_total
            from daily_stats where day between ${from} and ${to}`;
        return rows.map((r) => ({
          personId: r.person_id,
          day: r.day as Day,
          github: r.github,
          leetcode: r.leetcode,
          leetcodeTotal: r.leetcode_total,
        }));
      }),

    saveStats: (rows) =>
      db(async () => {
        if (!rows.length) return;
        await sql.begin(async (tx) => {
          for (const r of rows) {
            await tx`
              insert into daily_stats (person_id, day, github, leetcode, leetcode_total)
              values (${r.personId}, ${r.day}, ${r.github}, ${r.leetcode}, ${r.leetcodeTotal})
              on conflict (person_id, day) do update set
                github = excluded.github,
                leetcode = excluded.leetcode,
                -- never overwrite a known total with null
                leetcode_total = coalesce(excluded.leetcode_total, daily_stats.leetcode_total)`;
          }
        });
      }),

    getCheckins: (from, to) =>
      db(async () => {
        const rows = await sql<
          { person_id: string; day: string; note: string; done: boolean; updated_at: Date }[]
        >`select person_id, to_char(day, 'YYYY-MM-DD') as day, note, done, updated_at
            from checkins where day between ${from} and ${to}`;
        return rows.map((r) => ({
          personId: r.person_id,
          day: r.day as Day,
          note: r.note,
          done: r.done,
          updatedAt: r.updated_at.toISOString(),
        }));
      }),

    saveCheckin: (c) =>
      db(async () => {
        const [row] = await sql<{ updated_at: Date }[]>`
          insert into checkins (person_id, day, note, done, updated_at)
          values (${c.personId}, ${c.day}, ${c.note}, ${c.done}, now())
          on conflict (person_id, day) do update set
            note = excluded.note, done = excluded.done, updated_at = now()
          returning updated_at`;
        return { ...c, updatedAt: row.updated_at.toISOString() };
      }),

    getGoals: (from, to) =>
      db(async () => {
        const rows = await sql<GoalRow[]>`
          select id, person_id, to_char(day, 'YYYY-MM-DD') as day, title, done, sort_order, created_at
            from daily_goals where day between ${from} and ${to}
            order by day, sort_order, created_at`;
        return rows.map(toGoal);
      }),

    addGoal: (personId, day, title) =>
      db(async () => {
        const [{ count }] = await sql<{ count: string }[]>`
          select count(*)::text as count from daily_goals where person_id = ${personId} and day = ${day}`;
        if (Number(count) >= MAX_GOALS_PER_DAY) return null;

        const [{ next }] = await sql<{ next: number }[]>`
          select coalesce(max(sort_order), -1) + 1 as next
            from daily_goals where person_id = ${personId} and day = ${day}`;

        const [row] = await sql<GoalRow[]>`
          insert into daily_goals (id, person_id, day, title, done, sort_order)
          values (${newId()}, ${personId}, ${day}, ${title}, false, ${next})
          returning id, person_id, to_char(day, 'YYYY-MM-DD') as day, title, done, sort_order, created_at`;
        return toGoal(row);
      }),

    updateGoal: (id, personId, patch) =>
      db(async () => {
        // person_id in the WHERE clause is the authorisation check: a request
        // naming someone else's goal id simply matches no row.
        const [row] = await sql<GoalRow[]>`
          update daily_goals set
            title = coalesce(${patch.title ?? null}, title),
            done  = coalesce(${patch.done ?? null}, done)
          where id = ${id} and person_id = ${personId}
          returning id, person_id, to_char(day, 'YYYY-MM-DD') as day, title, done, sort_order, created_at`;
        return row ? toGoal(row) : null;
      }),

    deleteGoal: (id, personId) =>
      db(async () => {
        const rows = await sql`delete from daily_goals where id = ${id} and person_id = ${personId} returning id`;
        return rows.length > 0;
      }),

    getProfiles: () =>
      db(async () => {
        const rows = await sql<{ person_id: string; fetched_at: Date; data: Omit<Profile, 'personId' | 'fetchedAt'> }[]>`
          select person_id, fetched_at, data from profiles`;
        return rows.map((r) => ({
          personId: r.person_id,
          fetchedAt: r.fetched_at.toISOString(),
          github: r.data.github ?? null,
          leetcode: r.data.leetcode ?? null,
          errors: r.data.errors ?? [],
        }));
      }),

    saveProfile: (p) =>
      db(async () => {
        const data = { github: p.github, leetcode: p.leetcode, errors: p.errors };
        await sql`
          insert into profiles (person_id, fetched_at, data)
          values (${p.personId}, ${p.fetchedAt}, ${sql.json(data as never)})
          on conflict (person_id) do update set fetched_at = excluded.fetched_at, data = excluded.data`;
      }),

    getMeta: (key) =>
      db(async () => {
        const rows = await sql<{ value: string }[]>`select value from meta where key = ${key}`;
        return rows[0]?.value ?? null;
      }),

    setMeta: (key, value) =>
      db(async () => {
        await sql`
          insert into meta (key, value) values (${key}, ${value})
          on conflict (key) do update set value = excluded.value`;
      }),
  };
}
