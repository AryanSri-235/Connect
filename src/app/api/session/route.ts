import { NextResponse } from 'next/server';
import {
  AUTH_COOKIE,
  getPasswordHash,
  matchesPassword,
  MIN_PASSWORD_LENGTH,
  SESSION_COOKIE_OPTIONS,
  sessionTokenFor,
  setPassword,
} from '@/lib/auth';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { password?: unknown; confirm?: unknown };
  const password = typeof body.password === 'string' ? body.password : '';
  const confirm = typeof body.confirm === 'string' ? body.confirm : '';

  try {
    const existing = await getPasswordHash();

    // First run: the pair chooses the shared password here. Only reachable while
    // none is set — otherwise this would be a password reset for anyone.
    if (!existing) {
      if (password.length < MIN_PASSWORD_LENGTH) {
        return NextResponse.json(
          { error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` },
          { status: 400 },
        );
      }
      if (password !== confirm) {
        return NextResponse.json({ error: 'The two entries do not match.' }, { status: 400 });
      }

      const hash = await setPassword(password);
      const res = NextResponse.json({ ok: true, created: true });
      res.cookies.set(AUTH_COOKIE, await sessionTokenFor(hash), SESSION_COOKIE_OPTIONS);
      return res;
    }

    if (!(await matchesPassword(password, existing))) {
      return NextResponse.json({ error: 'That password is not right.' }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(AUTH_COOKIE, await sessionTokenFor(existing), SESSION_COOKIE_OPTIONS);
    return res;
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

/** Sign out. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(AUTH_COOKIE);
  return res;
}
