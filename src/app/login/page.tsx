import { redirect } from 'next/navigation';
import LoginForm from '@/components/LoginForm';
import { authState, type AuthState } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  let state: AuthState | null = null;
  let error: string | null = null;

  try {
    state = await authState();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  // redirect() signals by throwing — keep it out of the try above.
  if (state === 'ok') redirect('/');

  return (
    <main className="centered">
      {error ? (
        <div className="card panel">
          <h1>connect can&apos;t reach its database</h1>
          <p>{error}</p>
          <p className="subtle">
            Set <code>DATABASE_URL</code> to a Postgres connection string, then reload. Locally you can leave it unset
            and the app keeps its data in <code>.data/connect.json</code>.
          </p>
        </div>
      ) : (
        <LoginForm needsSetup={state === 'needs-setup'} />
      )}
    </main>
  );
}
