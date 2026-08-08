import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import ActivityFeed from '@/components/ActivityFeed';
import GoalTracker from '@/components/GoalTracker';
import HeadToHead from '@/components/HeadToHead';
import PersonCard from '@/components/PersonCard';
import Toolbar from '@/components/Toolbar';
import { authState, ME_COOKIE, type AuthState } from '@/lib/auth';
import { formatFullDay } from '@/lib/date';
import { getStore } from '@/lib/store';
import { getDashboardData, syncIfStale } from '@/lib/sync';
import { normalizeWindow } from '@/lib/window';

export const dynamic = 'force-dynamic';

function SetupError({ message }: { message: string }) {
  return (
    <main className="centered">
      <div className="card panel">
        <h1>connect can&apos;t reach its database</h1>
        <p>{message}</p>
        <p className="subtle">
          Set <code>DATABASE_URL</code> to a Postgres connection string (Neon and Supabase both have a free tier), then
          reload. Locally you can leave it unset and the app will keep its data in <code>.data/connect.json</code>.
        </p>
      </div>
    </main>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.window) ? sp.window[0] : sp.window;
  const windowDays = normalizeWindow(raw);

  let state: AuthState | null = null;
  let peopleCount = 0;
  let setupError: string | null = null;

  try {
    state = await authState();
    if (state === 'ok') peopleCount = (await getStore().listPeople()).length;
  } catch (err) {
    setupError = err instanceof Error ? err.message : String(err);
  }

  if (setupError) return <SetupError message={setupError} />;

  // redirect() signals via a thrown value — keep it outside the try above.
  if (state !== 'ok') redirect('/login');
  if (peopleCount === 0) redirect('/settings');

  // A provider outage shouldn't take the dashboard down; stale data still renders.
  await syncIfStale().catch(() => undefined);

  const data = await getDashboardData(windowDays);
  const me = (await cookies()).get(ME_COOKIE)?.value ?? null;
  const meIsValid = data.people.some((p) => p.person.id === me);

  return (
    <main className="shell">
      <Toolbar
        people={data.people.map((p) => ({ id: p.person.id, name: p.person.name, slot: p.person.slot }))}
        me={meIsValid ? me : null}
        windowDays={data.windowDays}
        lastSync={data.lastSync}
      />

      <div className="stack">
        {!data.githubPrecise && (
          <div className="notice" data-tone="warning">
            <span className="notice-icon" aria-hidden="true">
              !
            </span>
            <span>
              <strong>GitHub history is approximate.</strong> Without <code>GITHUB_TOKEN</code> the app reads the public
              events feed, which only reaches back ~90 days and misses older activity. Add a token to get the exact
              contribution calendar for a full year.
            </span>
          </div>
        )}

        {data.storeKind === 'file' && (
          <div className="notice">
            <span className="notice-icon" aria-hidden="true">
              i
            </span>
            <span>
              Local mode — data is stored in <code>.data/connect.json</code>. Set <code>DATABASE_URL</code> before
              deploying.
            </span>
          </div>
        )}

        {data.people.length === 1 && (
          <div className="notice">
            <span className="notice-icon" aria-hidden="true">
              i
            </span>
            <span>
              Only one person is set up. <Link href="/settings">Add the second</Link> to unlock the head-to-head
              comparison.
            </span>
          </div>
        )}

        <div className="person-grid">
          {data.people.map((view) => (
            <PersonCard key={view.person.id} view={view} me={meIsValid ? me : null} />
          ))}
        </div>

        <HeadToHead people={data.people} />

        <GoalTracker
          people={data.people}
          today={data.today}
          timezone={data.timezone}
          me={meIsValid ? me : null}
        />

        <ActivityFeed people={data.people} />

        <p className="subtle" style={{ textAlign: 'center', marginTop: 8 }}>
          {formatFullDay(data.today)} · days are counted in {data.timezone}
        </p>
      </div>
    </main>
  );
}
