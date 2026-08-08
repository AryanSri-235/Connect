import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { ME_COOKIE } from '@/lib/auth';
import { getStore } from '@/lib/store';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Marks "I showed up today" for the current person.
 *
 * Attendance is deliberately separate from the GitHub/LeetCode targets: those
 * are measured for you, this one you assert. Stored on the checkins row so a
 * day has a single record.
 */
export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  const meId = (await cookies()).get(ME_COOKIE)?.value ?? '';

  const body = (await request.json().catch(() => ({}))) as { day?: unknown; present?: unknown };
  const day = typeof body.day === 'string' ? body.day : '';
  const present = body.present !== false; // default to marking present

  if (!DAY_PATTERN.test(day)) return NextResponse.json({ error: 'day must be YYYY-MM-DD' }, { status: 400 });

  try {
    const store = getStore();
    const people = await store.listPeople();
    if (!people.some((p) => p.id === meId)) {
      return NextResponse.json({ error: 'Pick who you are in the top bar first.' }, { status: 403 });
    }

    // Preserve any existing note on that day — attendance only owns `done`.
    const existing = (await store.getCheckins(day, day)).find((c) => c.personId === meId);
    const saved = await store.saveCheckin({ personId: meId, day, note: existing?.note ?? '', done: present });

    return NextResponse.json({ ok: true, present: saved.done });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
