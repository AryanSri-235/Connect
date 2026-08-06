import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { ME_COOKIE } from '@/lib/auth';
import { getStore } from '@/lib/store';

/**
 * Records which of the two people is using this browser. This is a UI
 * preference, not an identity check — both people share one password, so it
 * only decides whose check-in box is editable.
 */
export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as { personId?: unknown };
  const personId = typeof body.personId === 'string' ? body.personId : '';

  const res = NextResponse.json({ ok: true, personId: personId || null });

  if (!personId) {
    res.cookies.delete(ME_COOKIE);
    return res;
  }

  const people = await getStore().listPeople();
  if (!people.some((p) => p.id === personId)) {
    return NextResponse.json({ error: 'Unknown person' }, { status: 400 });
  }

  res.cookies.set(ME_COOKIE, personId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
