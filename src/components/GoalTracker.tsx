'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { addDays, formatDay, relativeDay, type Day } from '@/lib/date';
import { MAX_GOAL_TITLE, type Goal, type PersonView } from '@/lib/types';
import { useDayRollover } from './useDayRollover';

interface Props {
  people: PersonView[];
  today: Day;
  timezone: string;
  me: string | null;
}

export default function GoalTracker({ people, today, timezone, me }: Props) {
  const router = useRouter();
  // At midnight the list must empty itself and the heading roll over.
  useDayRollover(today, timezone);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Mirror the server's list so a tick feels instant; re-seeded whenever the
  // server sends new data.
  const [goals, setGoals] = useState<Goal[]>(() => people.flatMap((p) => p.goalsToday));
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const editRef = useRef<HTMLInputElement>(null);

  const serverGoals = people.flatMap((p) => p.goalsToday);
  const serverKey = serverGoals.map((g) => `${g.id}:${g.done}:${g.title}`).join('|');
  useEffect(() => {
    setGoals(serverGoals);
    // serverKey collapses the list into a comparable string so this only fires
    // when the data actually changed, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey]);

  useEffect(() => {
    if (editingId) editRef.current?.focus();
  }, [editingId]);

  /** Run a mutation, roll the optimistic state back if the server rejects it. */
  async function mutate(optimistic: Goal[], run: () => Promise<Response>) {
    const previous = goals;
    setGoals(optimistic);
    setError(null);
    setBusy(true);
    try {
      const res = await run();
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
      startTransition(() => router.refresh());
    } catch (err) {
      setGoals(previous);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    const title = draft.trim();
    if (!title || !me) return;
    setDraft('');

    const temp: Goal = {
      id: `temp-${Math.random().toString(36).slice(2)}`,
      personId: me,
      day: today,
      title,
      done: false,
      sortOrder: goals.filter((g) => g.personId === me).length,
      createdAt: new Date().toISOString(),
    };
    mutate([...goals, temp], () =>
      // No day sent — the server stamps it, so a stale tab can't misfile a goal.
      fetch('/api/goals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title }),
      }),
    );
  }

  function toggle(goal: Goal) {
    mutate(
      goals.map((g) => (g.id === goal.id ? { ...g, done: !g.done } : g)),
      () =>
        fetch('/api/goals', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: goal.id, done: !goal.done }),
        }),
    );
  }

  function commitEdit(goal: Goal) {
    const title = editingText.trim();
    setEditingId(null);
    if (!title || title === goal.title) return;

    mutate(
      goals.map((g) => (g.id === goal.id ? { ...g, title } : g)),
      () =>
        fetch('/api/goals', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: goal.id, title }),
        }),
    );
  }

  function remove(goal: Goal) {
    mutate(
      goals.filter((g) => g.id !== goal.id),
      () => fetch(`/api/goals?id=${encodeURIComponent(goal.id)}`, { method: 'DELETE' }),
    );
  }

  const historyDays: Day[] = Array.from({ length: 7 }, (_, i) => addDays(today, -(i + 1)));

  return (
    <section className="card">
      <div className="section-head">
        <h2>Goals — {formatDay(today)}</h2>
        <div className="spacer" />
        {!me && <span className="subtle">Pick who you are in the top bar to add yours</span>}
      </div>

      {error && (
        <div className="notice" data-tone="critical" style={{ marginBottom: 14 }}>
          <span className="notice-icon" aria-hidden="true">
            !
          </span>
          <span>{error}</span>
        </div>
      )}

      <div className="checkin-grid">
        {people.map((p) => {
          const isMe = p.person.id === me;
          const mine = goals.filter((g) => g.personId === p.person.id);
          const done = mine.filter((g) => g.done).length;

          return (
            <div className="checkin-box person" data-slot={p.person.slot} key={p.person.id}>
              <header>
                <span className="swatch" aria-hidden="true" />
                {p.person.name}
                {isMe && <span className="subtle">(you)</span>}
                <span className="spacer" />
                <span className="subtle" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {mine.length ? `${done} / ${mine.length} done` : 'no goals yet'}
                </span>
              </header>

              {mine.length > 0 && (
                <div className="goal-progress" aria-hidden="true">
                  <div
                    className="goal-progress-fill"
                    style={{ width: `${mine.length ? (done / mine.length) * 100 : 0}%` }}
                  />
                </div>
              )}

              <ul className="goal-list">
                {mine.map((goal) => (
                  <li className="goal-item" key={goal.id} data-done={goal.done}>
                    <input
                      type="checkbox"
                      className="goal-check"
                      checked={goal.done}
                      disabled={!isMe || busy}
                      onChange={() => toggle(goal)}
                      aria-label={`${goal.title} — mark ${goal.done ? 'not done' : 'done'}`}
                    />

                    {editingId === goal.id ? (
                      <input
                        ref={editRef}
                        className="input goal-edit"
                        value={editingText}
                        maxLength={MAX_GOAL_TITLE}
                        onChange={(e) => setEditingText(e.target.value)}
                        onBlur={() => commitEdit(goal)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit(goal);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                      />
                    ) : (
                      <span className="goal-title">{goal.title}</span>
                    )}

                    {isMe && editingId !== goal.id && (
                      <span className="goal-actions">
                        <button
                          type="button"
                          className="goal-action"
                          onClick={() => {
                            setEditingId(goal.id);
                            setEditingText(goal.title);
                          }}
                          aria-label={`Edit "${goal.title}"`}
                          title="Edit"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="goal-action"
                          onClick={() => remove(goal)}
                          aria-label={`Delete "${goal.title}"`}
                          title="Delete"
                        >
                          Delete
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>

              {mine.length === 0 && !isMe && <p className="checkin-empty">No goals set today.</p>}

              {isMe && (
                <form className="goal-add" onSubmit={add}>
                  <input
                    className="input"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Add a goal for today…"
                    maxLength={MAX_GOAL_TITLE}
                    aria-label="New goal"
                  />
                  <button className="btn btn-primary" type="submit" disabled={!draft.trim() || busy}>
                    Add
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>

      <div className="history">
        <div className="subtle" style={{ marginBottom: 8 }}>
          Previous week
        </div>
        {historyDays.map((day) => {
          const rows = people.map((p) => {
            const dayGoals = p.goals.filter((g) => g.day === day);
            return { person: p.person, dayGoals, present: p.checkins[day]?.done ?? false };
          });
          const anything = rows.some((r) => r.dayGoals.length > 0 || r.present);

          return (
            <div className="history-row" key={day}>
              <div className="history-day">{relativeDay(day, today)}</div>
              <div>
                {!anything ? (
                  <span className="checkin-empty">— nothing logged</span>
                ) : (
                  rows.map((r) => (
                    <div key={r.person.id} className="person" data-slot={r.person.slot} style={{ marginBottom: 4 }}>
                      <span className="swatch" aria-hidden="true" style={{ marginRight: 7 }} />
                      <strong style={{ fontWeight: 560 }}>{r.person.name}</strong>{' '}
                      <span style={{ color: 'var(--ink-secondary)' }}>
                        {r.dayGoals.length > 0
                          ? `${r.dayGoals.filter((g) => g.done).length}/${r.dayGoals.length} goals`
                          : 'no goals'}
                        {r.present && ' · present'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
