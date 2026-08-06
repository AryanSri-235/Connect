import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { syncAll } from '@/lib/sync';

export const maxDuration = 60;

export async function POST() {
  const denied = await requireAuth();
  if (denied) return denied;

  try {
    const report = await syncAll();
    const warnings = report.people.flatMap((p) => p.errors.map((e) => `${p.name} — ${e.message}`));
    return NextResponse.json({ ok: true, syncedAt: report.syncedAt, warnings });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
