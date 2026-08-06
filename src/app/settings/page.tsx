import Link from 'next/link';
import { redirect } from 'next/navigation';
import SettingsForm from '@/components/SettingsForm';
import SignOutButton from '@/components/SignOutButton';
import { authState, type AuthState } from '@/lib/auth';
import { getStore } from '@/lib/store';
import type { Person } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  let people: Person[] = [];
  let error: string | null = null;
  let state: AuthState | null = null;

  try {
    state = await authState();
    if (state === 'ok') people = await getStore().listPeople();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  // redirect() signals by throwing — keep it out of the try above.
  if (!error && state !== 'ok') redirect('/login');

  return (
    <main className="shell">
      <div className="topbar">
        <div className="brand">
          <span className="dot" aria-hidden="true" />
          <span className="dot" aria-hidden="true" />
          <h1>Settings</h1>
        </div>
        {people.length > 0 && (
          <Link className="btn" href="/">
            Back to dashboard
          </Link>
        )}
        {state === 'ok' && <SignOutButton />}
      </div>

      {error ? (
        <div className="notice" data-tone="critical">
          <span className="notice-icon" aria-hidden="true">
            !
          </span>
          <span>
            <strong>Database unavailable.</strong> {error}
          </span>
        </div>
      ) : (
        <>
          {people.length === 0 && (
            <div className="notice" style={{ marginBottom: 20 }}>
              <span className="notice-icon" aria-hidden="true">
                i
              </span>
              <span>
                <strong>Almost there.</strong> Paste each person&apos;s GitHub and LeetCode profile URLs below, set a
                daily goal for each, and connect will fetch both histories. Profiles must be public — connect only ever
                reads public data, and never asks for your password to either service.
              </span>
            </div>
          )}
          <SettingsForm people={people} />
        </>
      )}
    </main>
  );
}
