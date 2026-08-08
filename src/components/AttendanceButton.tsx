'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { Day } from '@/lib/date';

interface Props {
  day: Day;
  present: boolean;
  /** Only the person viewing as themselves can mark their own attendance. */
  editable: boolean;
  name: string;
}

export default function AttendanceButton({ day, present, editable, name }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const marked = optimistic ?? present;

  async function toggle() {
    const next = !marked;
    setOptimistic(next);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ day, present: next }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `Failed (${res.status})`);
      startTransition(() => router.refresh());
    } catch (err) {
      setOptimistic(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  // The other person's attendance is information, not a control.
  if (!editable) {
    return (
      <span className="badge" data-tone={marked ? 'good' : 'pending'} title={`${name}'s attendance today`}>
        <span className="badge-icon" aria-hidden="true">
          {marked ? '✓' : '○'}
        </span>
        {marked ? 'Present' : 'Not marked'}
      </span>
    );
  }

  return (
    <span className="attendance">
      <button
        type="button"
        className="btn attendance-btn"
        data-marked={marked}
        onClick={toggle}
        disabled={busy}
        aria-pressed={marked}
      >
        <span className="badge-icon" aria-hidden="true">
          {marked ? '✓' : '○'}
        </span>
        {busy ? 'Saving…' : marked ? 'Present today' : 'Mark attendance'}
      </button>
      {error && <span className="attendance-error">{error}</span>}
    </span>
  );
}
