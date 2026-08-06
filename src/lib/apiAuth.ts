import { NextResponse } from 'next/server';
import { authState } from './auth';

/**
 * Guard for route handlers: returns a response to send back, or null to proceed.
 *
 * This lives in the route handlers rather than in edge middleware because the
 * password hash can come from the database, which the edge runtime can't reach.
 */
export async function requireAuth(): Promise<NextResponse | null> {
  try {
    const state = await authState();
    if (state === 'ok') return null;
    return NextResponse.json(
      { error: state === 'needs-setup' ? 'No password has been set yet' : 'Not authenticated' },
      { status: 401 },
    );
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
