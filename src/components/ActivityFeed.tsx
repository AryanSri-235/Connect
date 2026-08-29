'use client';

import { useState } from 'react';
import type { ActivityItem, PersonView } from '@/lib/types';

interface Entry extends ActivityItem {
  personName: string;
  slot: number;
}

function ago(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 90) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function ActivityFeed({ people }: { people: PersonView[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const now = Date.now();

  const entries: Entry[] = people
    .flatMap((p) =>
      [...(p.profile?.github?.recent ?? []), ...(p.profile?.leetcode?.recent ?? [])].map((item) => ({
        ...item,
        personName: p.person.name,
        slot: p.person.slot,
      })),
    )
    .sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime())
    .slice(0, 20);

  return (
    <section className="card" id="activity" data-collapsed={collapsed}>
      <div className="section-head">
        <div className="section-title-wrap" onClick={() => setCollapsed(!collapsed)}>
          <h2>⚡ Recent activity</h2>
          {collapsed && <span className="subtle">(Collapsed)</span>}
        </div>
        <div className="spacer" />
        {!collapsed && <span className="subtle">newest first</span>}
        <button
          type="button"
          className="collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expand section' : 'Collapse section'}
        >
          {collapsed ? '▼ Expand' : '▲ Collapse'}
        </button>
      </div>

      {!collapsed && (
        <>
          {entries.length === 0 ? (
            <p className="checkin-empty">
              Nothing yet — activity appears once GitHub or LeetCode reports something for either of you.
            </p>
          ) : (
            <div className="feed">
              {entries.map((e, i) => (
                <div className="feed-item person" data-slot={e.slot} key={`${e.at}-${i}`}>
                  <span className="feed-dot" style={{ background: 'var(--accent)' }} aria-hidden="true" />
                  <div>
                    <div className="feed-title">
                      <strong style={{ fontWeight: 580 }}>{e.personName}</strong>{' '}
                      {e.url ? (
                        <a href={e.url} target="_blank" rel="noreferrer">
                          {e.title}
                        </a>
                      ) : (
                        e.title
                      )}
                      <span className="subtle"> · {e.provider === 'github' ? 'GitHub' : 'LeetCode'}</span>
                    </div>
                    {e.detail && <span className="feed-detail">{e.detail}</span>}
                  </div>
                  <span className="feed-time">{ago(e.at, now)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
