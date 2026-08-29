'use client';

import { useState } from 'react';
import { getCalendarWeekDays, formatDay, type Day } from '@/lib/date';
import { num } from '@/lib/format';
import { computeWeeklyWinner, sumWindow } from '@/lib/metrics';
import type { DailyStat, PersonView } from '@/lib/types';

type WeekMode = 'this-week' | 'last-week' | 'trailing-7';

export default function WeeklyRecap({
  people,
  today,
}: {
  people: PersonView[];
  today: Day;
}) {
  const [mode, setMode] = useState<WeekMode>('this-week');

  if (people.length === 0) return null;

  let selectedDays: Day[];
  let modeLabel = '';

  if (mode === 'this-week') {
    selectedDays = getCalendarWeekDays(today, 0);
    modeLabel = `This Week (${formatDay(selectedDays[0])} – ${formatDay(selectedDays[6])})`;
  } else if (mode === 'last-week') {
    selectedDays = getCalendarWeekDays(today, -1);
    modeLabel = `Last Week (${formatDay(selectedDays[0])} – ${formatDay(selectedDays[6])})`;
  } else {
    selectedDays = getCalendarWeekDays(today, 0).slice(0, 7); // fallback
    modeLabel = 'Trailing 7 Days';
  }

  const weeklyWinner = computeWeeklyWinner(people, selectedDays);
  const winnerPerson = people.find((p) => p.person.id === weeklyWinner.winnerId);

  return (
    <section className="card weekly-recap" id="weekly-recap">
      <div className="section-head">
        <h2>🏆 Weekly Automated Recap & Winner Spotlight</h2>
        <div className="spacer" />
        <div className="segmented" role="group" aria-label="Recap timeframe">
          <button
            type="button"
            aria-pressed={mode === 'this-week'}
            onClick={() => setMode('this-week')}
          >
            This Week
          </button>
          <button
            type="button"
            aria-pressed={mode === 'last-week'}
            onClick={() => setMode('last-week')}
          >
            Last Week
          </button>
        </div>
      </div>

      <p className="subtle" style={{ marginTop: -8, marginBottom: 14 }}>
        Showing automated stats for: <strong>{modeLabel}</strong>
      </p>

      <div className="recap-banner" data-winner={Boolean(winnerPerson)}>
        {winnerPerson ? (
          <div className="winner-spotlight">
            <span className="trophy-icon" aria-hidden="true">
              👑
            </span>
            <div>
              <div className="winner-title">{winnerPerson.person.name} is the Weekly Champion!</div>
              <div className="winner-subtitle">
                Lead the weekly leaderboard for <strong>{modeLabel}</strong>!
              </div>
            </div>
          </div>
        ) : weeklyWinner.isTie ? (
          <div className="winner-spotlight tie">
            <span className="trophy-icon" aria-hidden="true">
              ⚔️
            </span>
            <div>
              <div className="winner-title">Weekly Battle Tied!</div>
              <div className="winner-subtitle">Both members achieved equal consistency and points for this period.</div>
            </div>
          </div>
        ) : (
          <div className="winner-spotlight empty">
            <span className="trophy-icon" aria-hidden="true">
              📊
            </span>
            <div>
              <div className="winner-title">Weekly Race in Progress</div>
              <div className="winner-subtitle">Log goals and contributions to claim this week&apos;s crown!</div>
            </div>
          </div>
        )}
      </div>

      <div className="recap-grid">
        {people.map((view) => {
          const { person, days, streak } = view;
          const byDay = new Map<Day, DailyStat>(days.map((s) => [s.day, s]));
          const weekStats = sumWindow(byDay, person, selectedDays);
          const isWinner = person.id === weeklyWinner.winnerId;
          const pct = Math.round((weekStats.daysMet / 7) * 100);
          const totalPoints = weekStats.github + weekStats.leetcode;
          const isPerfect = weekStats.daysMet === 7;

          return (
            <div key={person.id} className="recap-card" data-slot={person.slot}>
              <div className="recap-card-head">
                <span className="swatch" aria-hidden="true" />
                <span className="recap-person-name">{person.name}</span>
                {isWinner && <span className="crown-badge-sm">👑 Winner</span>}
              </div>

              <div className="recap-metrics">
                <div className="recap-metric-item">
                  <div className="recap-label">Weekly Goal Consistency</div>
                  <div className="recap-val">{weekStats.daysMet} / 7 days met</div>
                  <div className="meter-track" style={{ marginTop: 4 }}>
                    <div className="meter-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className="recap-stats-row">
                  <div>
                    <span className="subtle">GitHub Commits</span>
                    <div className="stat-num">{num(weekStats.github)}</div>
                  </div>
                  <div>
                    <span className="subtle">LeetCode Solves</span>
                    <div className="stat-num">{num(weekStats.leetcode)}</div>
                  </div>
                  <div>
                    <span className="subtle">Total Output</span>
                    <div className="stat-num">{num(totalPoints)}</div>
                  </div>
                </div>

                <div className="recap-badges">
                  {isPerfect && (
                    <span className="badge" data-tone="good">
                      🎯 100% Perfect Week
                    </span>
                  )}
                  {streak.current >= 3 && (
                    <span className="badge" data-tone="good">
                      🔥 {streak.current}-Day Streak
                    </span>
                  )}
                  {totalPoints > 15 && <span className="badge">⚡ High Velocity</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
