import { NextResponse } from 'next/server';
import { syncAll } from '@/lib/sync';

export const maxDuration = 60;

/**
 * Nightly snapshot (see vercel.json). Its real job is capturing each person's
 * lifetime LeetCode total before the day rolls over, so tomorrow's "solved
 * today" delta is exact.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const report = await syncAll();
    return NextResponse.json({ ok: true, syncedAt: report.syncedAt, people: report.people });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
