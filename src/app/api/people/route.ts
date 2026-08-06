import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { parseGithubUsername, parseLeetcodeUsername } from '@/lib/profileUrls';
import { getStore } from '@/lib/store';
import { syncAll } from '@/lib/sync';
import type { PersonInput } from '@/lib/types';

function parsePerson(raw: unknown, index: number): PersonInput | string {
  if (typeof raw !== 'object' || raw === null) return `Entry ${index + 1} is not an object`;
  const r = raw as Record<string, unknown>;

  const name = typeof r.name === 'string' ? r.name.trim() : '';
  if (!name) return `Entry ${index + 1} needs a name`;
  if (name.length > 60) return `"${name.slice(0, 20)}…" is too long a name`;

  const githubRaw = typeof r.githubUrl === 'string' ? r.githubUrl.trim() : '';
  const leetcodeRaw = typeof r.leetcodeUrl === 'string' ? r.leetcodeUrl.trim() : '';

  const githubUsername = githubRaw ? parseGithubUsername(githubRaw) : null;
  const leetcodeUsername = leetcodeRaw ? parseLeetcodeUsername(leetcodeRaw) : null;

  if (githubRaw && !githubUsername) {
    return `${name}: "${githubRaw}" isn't a GitHub profile. Paste the profile URL, e.g. https://github.com/octocat`;
  }
  if (leetcodeRaw && !leetcodeUsername) {
    return `${name}: "${leetcodeRaw}" isn't a LeetCode profile. Paste the profile URL, e.g. https://leetcode.com/u/octocat`;
  }
  if (!githubUsername && !leetcodeUsername) return `${name} needs at least a GitHub or a LeetCode profile`;

  const clampGoal = (v: unknown) => Math.min(100, Math.max(0, Math.trunc(Number(v) || 0)));

  return {
    id: typeof r.id === 'string' && r.id ? r.id : undefined,
    name,
    githubUsername,
    leetcodeUsername,
    slot: index === 1 ? 1 : 0,
    sortOrder: index,
    goalGithub: clampGoal(r.goalGithub),
    goalLeetcode: clampGoal(r.goalLeetcode),
  };
}

export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as { people?: unknown };
  if (!Array.isArray(body.people) || body.people.length === 0) {
    return NextResponse.json({ error: 'Send a non-empty "people" array' }, { status: 400 });
  }
  if (body.people.length > 2) {
    return NextResponse.json({ error: 'connect is built for two people' }, { status: 400 });
  }

  const parsed: PersonInput[] = [];
  for (const [i, raw] of body.people.entries()) {
    const result = parsePerson(raw, i);
    if (typeof result === 'string') return NextResponse.json({ error: result }, { status: 400 });
    parsed.push(result);
  }

  try {
    const people = await getStore().savePeople(parsed);
    // Pull history immediately so the dashboard isn't empty on first load. A
    // provider failure here is reported, not fatal — the roster is already saved.
    let warnings: string[] = [];
    try {
      const report = await syncAll();
      warnings = report.people.flatMap((p) => p.errors.map((e) => `${p.name} — ${e.message}`));
    } catch (err) {
      warnings = [err instanceof Error ? err.message : String(err)];
    }
    return NextResponse.json({ ok: true, people, warnings });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
