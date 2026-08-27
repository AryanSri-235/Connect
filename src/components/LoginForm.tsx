'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export default function LoginForm({ needsSetup }: { needsSetup: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/session', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(needsSetup ? { password, confirm } : { password }),
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(body.error ?? 'Sign-in failed');
        router.replace('/');
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <form className="card panel" onSubmit={submit}>
      <div className="brand" style={{ marginBottom: 14 }}>
        <span className="dot" aria-hidden="true" />
        <span className="dot" aria-hidden="true" />
        <h1>Connect</h1>
      </div>

      {needsSetup ? (
        <p>
          Nobody has set a password yet. Choose one now and share it with the person you&apos;re tracking alongside —
          you&apos;ll both use it to get in.
        </p>
      ) : (
        <p>This dashboard is shared between two people. Enter the password you both agreed on</p>
      )}

      <div className="form-grid">
        <label className="field">
          <span>{needsSetup ? 'Choose a password' : 'Password'}</span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            autoComplete={needsSetup ? 'new-password' : 'current-password'}
          />
          {needsSetup && <span className="field-hint">At least 6 characters. Stored hashed, never in plain text.</span>}
        </label>

        {needsSetup && (
          <label className="field">
            <span>Confirm password</span>
            <input
              className="input"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </label>
        )}

        {error && <p className="error-text">{error}</p>}

        <button className="btn btn-primary" type="submit" disabled={pending || !password}>
          {pending ? 'Checking…' : needsSetup ? 'Set password and continue' : 'Enter'}
        </button>
      </div>
    </form>
  );
}
