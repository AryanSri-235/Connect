'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { WINDOW_LABEL, WINDOW_OPTIONS } from '@/lib/window';

interface Props {
  people: { id: string; name: string; slot: number }[];
  me: string | null;
  windowDays: number;
  lastSync: string | null;
}

type Theme = 'light' | 'dark' | 'system';

export default function Toolbar({ people, me, windowDays, lastSync }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    const stored = localStorage.getItem('connect-theme');
    if (stored === 'light' || stored === 'dark') setTheme(stored);
  }, []);

  function applyTheme(next: Theme) {
    setTheme(next);
    if (next === 'system') {
      localStorage.removeItem('connect-theme');
      document.documentElement.removeAttribute('data-theme');
    } else {
      localStorage.setItem('connect-theme', next);
      document.documentElement.setAttribute('data-theme', next);
    }
  }

  function setWindow(days: number) {
    const next = new URLSearchParams(params.toString());
    next.set('window', String(days));
    router.push(`${pathname}?${next.toString()}`);
  }

  function selectMe(id: string) {
    startTransition(async () => {
      await fetch('/api/me', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ personId: id }),
      });
      router.refresh();
    });
  }

  function refresh() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/refresh', { method: 'POST' });
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(body.error ?? `Refresh failed (${res.status})`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  const syncedLabel = lastSync
    ? `synced ${new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'never synced';

  return (
    <>
      <header className="navbar-container">
        <div className="topbar">
          <div className="brand">
            <span className="dot" aria-hidden="true" />
            <span className="dot" aria-hidden="true" />
            <h1>connect</h1>
            <span className="brand-date">{syncedLabel}</span>
          </div>

          <nav className="nav-links" aria-label="Main Navigation">
            <a href="#cards" className="nav-link">👥 Cards</a>
            <a href="#weekly-recap" className="nav-link">🏆 Recap</a>
            <a href="#head-to-head" className="nav-link">⚔️ Head to Head</a>
            <a href="#stakes" className="nav-link">🍕 Penalties</a>
            <a href="#goals" className="nav-link">🎯 Goals</a>
            <a href="#activity" className="nav-link">⚡ Activity</a>
          </nav>

          <div className="nav-controls">
            <label className="sr-only" htmlFor="whoami">
              Who are you?
            </label>
            <select
              id="whoami"
              className="input"
              style={{ width: 'auto', minWidth: 120 }}
              value={me ?? ''}
              onChange={(e) => selectMe(e.target.value)}
              disabled={pending}
            >
              <option value="">I am…</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <div className="segmented" role="group" aria-label="Time range">
              {WINDOW_OPTIONS.map((d) => (
                <button key={d} type="button" aria-pressed={windowDays === d} onClick={() => setWindow(d)}>
                  {WINDOW_LABEL[d]}
                </button>
              ))}
            </div>

            <button
              className="btn"
              type="button"
              onClick={() => applyTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark')}
              title={`Theme: ${theme}`}
            >
              <span aria-hidden="true">{theme === 'dark' ? '◐' : theme === 'light' ? '○' : '◑'}</span>
              <span className="sr-only">Theme: {theme}. Click to change.</span>
            </button>

            <Link className="btn" href="/settings">
              Settings
            </Link>

            <button className="btn btn-primary" type="button" onClick={refresh} disabled={pending}>
              {pending ? 'Syncing…' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="notice" data-tone="critical" style={{ marginBottom: 20 }}>
          <span className="notice-icon" aria-hidden="true">
            !
          </span>
          <span>{error}</span>
        </div>
      )}
    </>
  );
}
