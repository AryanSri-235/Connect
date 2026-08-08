import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { ME_COOKIE } from '@/lib/auth';
import { getStore } from '@/lib/store';
import { MAX_GOAL_TITLE, MAX_GOALS_PER_DAY } from '@/lib/types';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Whose goals this request may touch. Both people share one password, so this
 * is not an authentication boundary — it is the app's ownership rule, enforced
 * here rather than only hidden in the UI, so a stray request can't edit the
 * other person's list.
 */
async function currentPersonId(): Promise<string | null> {
  const id = (await cookies()).get(ME_COOKIE)?.value;
  if (!id) return null;
  const people = await getStore().listPeople();
  return people.some((p) => p.id === id) ? id : null;
}

const notYou = () =>
  NextResponse.json({ error: 'Pick who you are in the top bar before editing goals.' }, { status: 403 });

/** Create a goal for today (or any given day) for the current person. */
export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  const me = await currentPersonId();
  if (!me) return notYou();

  const body = (await request.json().catch(() => ({}))) as { day?: unknown; title?: unknown };
  const day = typeof body.day === 'string' ? body.day : '';
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, MAX_GOAL_TITLE) : '';

  if (!DAY_PATTERN.test(day)) return NextResponse.json({ error: 'day must be YYYY-MM-DD' }, { status: 400 });
  if (!title) return NextResponse.json({ error: 'Write something first.' }, { status: 400 });

  try {
    const goal = await getStore().addGoal(me, day, title);
    if (!goal) {
      return NextResponse.json({ error: `That's ${MAX_GOALS_PER_DAY} goals for one day — plenty.` }, { status: 400 });
    }
    return NextResponse.json({ ok: true, goal });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

/** Rename a goal, or tick/untick it. */
export async function PATCH(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  const me = await currentPersonId();
  if (!me) return notYou();

  const body = (await request.json().catch(() => ({}))) as { id?: unknown; title?: unknown; done?: unknown };
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const patch: { title?: string; done?: boolean } = {};
  if (typeof body.title === 'string') {
    const title = body.title.trim().slice(0, MAX_GOAL_TITLE);
    if (!title) return NextResponse.json({ error: 'A goal needs some text.' }, { status: 400 });
    patch.title = title;
  }
  if (typeof body.done === 'boolean') patch.done = body.done;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });
  }

  try {
    const goal = await getStore().updateGoal(id, me, patch);
    // Null means no row matched id AND owner — either it's gone, or it's theirs.
    if (!goal) return NextResponse.json({ error: 'That goal is not yours to edit.' }, { status: 403 });
    return NextResponse.json({ ok: true, goal });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  const me = await currentPersonId();
  if (!me) return notYou();

  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  try {
    const removed = await getStore().deleteGoal(id, me);
    if (!removed) return NextResponse.json({ error: 'That goal is not yours to delete.' }, { status: 403 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
