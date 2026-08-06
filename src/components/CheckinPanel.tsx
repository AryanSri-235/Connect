'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { addDays, formatDay, relativeDay, type Day } from '@/lib/date';
import type { PersonView } from '@/lib/types';

interface Props {
  people: PersonView[];
  today: Day;
  me: string | null;
}

export default function CheckinPanel({ people, today, me }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const mine = people.find((p) => p.person.id === me) ?? null;
  const existing = mine?.checkins[today];

  const [note, setNote] = useState(existing?.note ?? '');
  const [done, setDone] = useState(existing?.done ?? false);
  const [saved, setSaved] = useState(false);

  // Re-seed when the server sends fresh data or the viewer switches identity.
  useEffect(() => {
    setNote(existing?.note ?? '');
    setDone(existing?.done ?? false);
    setSaved(false);
  }, [me, today, existing?.note, existing?.done]);

  function save() {
    if (!mine) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/checkin', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ personId: mine.person.id, day: today, note, done }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Save failed (${res.status})`);
        setSaved(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  const historyDays: Day[] = Array.from({ length: 7 }, (_, i) => addDays(today, -(i + 1)));

  return (
    <section className="card">
      <div className="section-head">
        <h2>Daily check-in — {formatDay(today)}</h2>
        <div className="spacer" />
        {!me && <span className="subtle">Pick who you are in the top bar to write yours</span>}
      </div>

      <div className="checkin-grid">
        {people.map((p) => {
          const isMe = p.person.id === me;
          const checkin = p.checkins[today];
          return (
            <div className="checkin-box person" data-slot={p.person.slot} key={p.person.id}>
              <header>
                <span className="swatch" aria-hidden="true" />
                {p.person.name}
                {isMe && <span className="subtle">(you)</span>}
                <span className="spacer" />
                {checkin?.done && (
                  <span className="badge" data-tone="good">
                    <span className="badge-icon" aria-hidden="true">
                      ✓
                    </span>
                    checked in
                  </span>
                )}
              </header>

              {isMe ? (
                <>
                  <label>
                    <span className="sr-only">What did you do today?</span>
                    <textarea
                      className="textarea"
                      value={note}
                      placeholder="What did you get done today?"
                      onChange={(e) => {
                        setNote(e.target.value);
                        setSaved(false);
                      }}
                      maxLength={2000}
                    />
                  </label>
                  <div className="checkin-actions">
                    <label className="check-toggle">
                      <input
                        type="checkbox"
                        checked={done}
                        onChange={(e) => {
                          setDone(e.target.checked);
                          setSaved(false);
                        }}
                      />
                      Mark the day done
                    </label>
                    <span className="spacer" />
                    {saved && !pending && <span className="subtle">Saved</span>}
                    <button className="btn btn-primary" onClick={save} disabled={pending}>
                      {pending ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                  {error && <p className="error-text" style={{ marginTop: 8 }}>{error}</p>}
                </>
              ) : checkin?.note ? (
                <p className="checkin-note">{checkin.note}</p>
              ) : (
                <p className="checkin-empty">No check-in yet today.</p>
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
          const entries = people.filter((p) => p.checkins[day]?.note || p.checkins[day]?.done);
          return (
            <div className="history-row" key={day}>
              <div className="history-day">{relativeDay(day, today)}</div>
              <div>
                {entries.length === 0 ? (
                  <span className="checkin-empty">— neither of you checked in</span>
                ) : (
                  entries.map((p) => (
                    <div key={p.person.id} className="person" data-slot={p.person.slot} style={{ marginBottom: 4 }}>
                      <span className="swatch" aria-hidden="true" style={{ marginRight: 7 }} />
                      <strong style={{ fontWeight: 560 }}>{p.person.name}</strong>{' '}
                      <span style={{ color: 'var(--ink-secondary)' }}>
                        {p.checkins[day]?.note || (p.checkins[day]?.done ? 'marked the day done' : '')}
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
