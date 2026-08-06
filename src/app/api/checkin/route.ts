import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { getStore } from '@/lib/store';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_NOTE = 2000;

export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    personId?: unknown;
    day?: unknown;
    note?: unknown;
    done?: unknown;
  };

  const personId = typeof body.personId === 'string' ? body.personId : '';
  const day = typeof body.day === 'string' ? body.day : '';
  const note = typeof body.note === 'string' ? body.note.slice(0, MAX_NOTE) : '';
  const done = body.done === true;

  if (!personId) return NextResponse.json({ error: 'personId is required' }, { status: 400 });
  if (!DAY_PATTERN.test(day)) return NextResponse.json({ error: 'day must be YYYY-MM-DD' }, { status: 400 });

  try {
    const store = getStore();
    const people = await store.listPeople();
    if (!people.some((p) => p.id === personId)) {
      return NextResponse.json({ error: 'Unknown person' }, { status: 400 });
    }

    const saved = await store.saveCheckin({ personId, day, note, done });
    return NextResponse.json({ ok: true, checkin: saved });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
