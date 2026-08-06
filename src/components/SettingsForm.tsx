'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  githubProfileUrl,
  leetcodeProfileUrl,
  parseGithubUsername,
  parseLeetcodeUsername,
} from '@/lib/profileUrls';
import type { Person } from '@/lib/types';

interface Draft {
  id: string;
  name: string;
  githubUrl: string;
  leetcodeUrl: string;
  goalGithub: string;
  goalLeetcode: string;
}

const blank = (): Draft => ({ id: '', name: '', githubUrl: '', leetcodeUrl: '', goalGithub: '1', goalLeetcode: '3' });

function toDraft(p: Person): Draft {
  return {
    id: p.id,
    name: p.name,
    githubUrl: p.githubUsername ? githubProfileUrl(p.githubUsername) : '',
    leetcodeUrl: p.leetcodeUsername ? leetcodeProfileUrl(p.leetcodeUsername) : '',
    goalGithub: String(p.goalGithub),
    goalLeetcode: String(p.goalLeetcode),
  };
}

/** Live feedback under a URL field: confirms the username we read, or flags a bad paste. */
function UrlHint({ value, parsed, example }: { value: string; parsed: string | null; example: string }) {
  if (!value.trim()) return <span className="field-hint">Paste the profile URL, or just the username. {example}</span>;
  if (parsed) {
    return (
      <span className="field-hint" style={{ color: 'var(--good-text)' }}>
        ✓ reading <strong>{parsed}</strong>
      </span>
    );
  }
  return (
    <span className="field-hint" style={{ color: 'var(--critical)' }}>
      That doesn&apos;t look like a profile. {example}
    </span>
  );
}

export default function SettingsForm({ people }: { people: Person[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const [drafts, setDrafts] = useState<[Draft, Draft]>(() => [
    people[0] ? toDraft(people[0]) : blank(),
    people[1] ? toDraft(people[1]) : blank(),
  ]);

  function update(index: 0 | 1, patch: Partial<Draft>) {
    setDrafts((prev) => {
      const next = [...prev] as [Draft, Draft];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function save() {
    setError(null);
    setWarnings([]);

    const filled = drafts
      .map((draft, slot) => ({ draft, slot }))
      .filter(({ draft }) => draft.name.trim() !== '' || draft.githubUrl.trim() !== '' || draft.leetcodeUrl.trim() !== '');

    if (filled.length === 0) {
      setError('Fill in at least one person.');
      return;
    }

    for (const { draft, slot } of filled) {
      const label = draft.name.trim() || `Person ${slot + 1}`;
      if (!draft.name.trim()) {
        setError(`${label} needs a display name.`);
        return;
      }
      const gh = draft.githubUrl.trim() ? parseGithubUsername(draft.githubUrl) : null;
      const lc = draft.leetcodeUrl.trim() ? parseLeetcodeUsername(draft.leetcodeUrl) : null;
      if (draft.githubUrl.trim() && !gh) {
        setError(`${label}: that GitHub link isn't a profile URL.`);
        return;
      }
      if (draft.leetcodeUrl.trim() && !lc) {
        setError(`${label}: that LeetCode link isn't a profile URL.`);
        return;
      }
      if (!gh && !lc) {
        setError(`${label} needs at least a GitHub or a LeetCode profile.`);
        return;
      }
    }

    const payload = filled.map(({ draft, slot }) => ({
      id: draft.id || undefined,
      name: draft.name.trim(),
      githubUrl: draft.githubUrl.trim(),
      leetcodeUrl: draft.leetcodeUrl.trim(),
      slot,
      goalGithub: Math.max(0, Number(draft.goalGithub) || 0),
      goalLeetcode: Math.max(0, Number(draft.goalLeetcode) || 0),
    }));

    startTransition(async () => {
      try {
        const res = await fetch('/api/people', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ people: payload }),
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string; warnings?: string[] };
        if (!res.ok) throw new Error(body.error ?? `Save failed (${res.status})`);

        if (body.warnings?.length) {
          // Saved, but a provider didn't answer — say so instead of silently
          // dropping the user on an empty-looking dashboard.
          setWarnings(body.warnings);
          router.refresh();
          return;
        }
        router.push('/');
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <div className="stack">
      {([0, 1] as const).map((i) => {
        const draft = drafts[i];
        const gh = draft.githubUrl.trim() ? parseGithubUsername(draft.githubUrl) : null;
        const lc = draft.leetcodeUrl.trim() ? parseLeetcodeUsername(draft.leetcodeUrl) : null;

        return (
          <section className="card person" data-slot={i} key={i}>
            <div className="section-head">
              <span className="swatch" aria-hidden="true" />
              <h2>{i === 0 ? 'Person one' : 'Person two'}</h2>
              <div className="spacer" />
              <span className="subtle">{i === 0 ? 'blue throughout' : 'orange throughout'}</span>
            </div>

            <div className="form-grid">
              <label className="field">
                <span>Display name</span>
                <input
                  className="input"
                  value={draft.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  placeholder={i === 0 ? 'You' : 'Your accountability partner'}
                  autoComplete="off"
                />
              </label>

              <label className="field">
                <span>GitHub profile URL</span>
                <input
                  className="input"
                  value={draft.githubUrl}
                  onChange={(e) => update(i, { githubUrl: e.target.value })}
                  placeholder="https://github.com/octocat"
                  autoComplete="off"
                  spellCheck={false}
                  inputMode="url"
                />
                <UrlHint value={draft.githubUrl} parsed={gh} example="e.g. https://github.com/octocat" />
              </label>

              <label className="field">
                <span>LeetCode profile URL</span>
                <input
                  className="input"
                  value={draft.leetcodeUrl}
                  onChange={(e) => update(i, { leetcodeUrl: e.target.value })}
                  placeholder="https://leetcode.com/u/octocat"
                  autoComplete="off"
                  spellCheck={false}
                  inputMode="url"
                />
                <UrlHint value={draft.leetcodeUrl} parsed={lc} example="e.g. https://leetcode.com/u/octocat" />
              </label>

              <div className="form-row">
                <label className="field">
                  <span>Daily GitHub goal</span>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={100}
                    value={draft.goalGithub}
                    onChange={(e) => update(i, { goalGithub: e.target.value })}
                  />
                  <span className="field-hint">Contributions per day. 0 turns the goal off.</span>
                </label>
                <label className="field">
                  <span>Daily LeetCode goal</span>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={100}
                    value={draft.goalLeetcode}
                    onChange={(e) => update(i, { goalLeetcode: e.target.value })}
                  />
                  <span className="field-hint">Submissions per day. 0 turns the goal off.</span>
                </label>
              </div>
            </div>
          </section>
        );
      })}

      {error && (
        <div className="notice" data-tone="critical">
          <span className="notice-icon" aria-hidden="true">
            !
          </span>
          <span>{error}</span>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="notice" data-tone="warning">
          <span className="notice-icon" aria-hidden="true">
            !
          </span>
          <span>
            <strong>Saved, but some history didn&apos;t come through:</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <a href="/">Open the dashboard anyway</a> — Refresh will retry.
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={save} disabled={pending}>
          {pending ? 'Saving and fetching…' : 'Save and fetch history'}
        </button>
        <span className="subtle">First fetch pulls up to a year of history, so give it a few seconds.</span>
      </div>
    </div>
  );
}
