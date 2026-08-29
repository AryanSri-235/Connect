'use client';

import { useState } from 'react';
import { formatDay, getCalendarWeekDays, type Day } from '@/lib/date';
import type { PersonView } from '@/lib/types';

interface PenaltyItem {
  day: Day;
  personId: string;
  personName: string;
  hasReason: boolean;
  reasonText: string;
  slot: number;
}

type StakesTimeframe = 'this-week' | 'last-week' | 'all';

export default function AccountabilityStakes({
  people,
  today,
}: {
  people: PersonView[];
  today: Day;
}) {
  const [timeframe, setTimeframe] = useState<StakesTimeframe>('this-week');
  const [collapsed, setCollapsed] = useState(false);

  if (people.length === 0) return null;

  let targetDays: Day[];
  let timeframeLabel = '';

  if (timeframe === 'this-week') {
    const week = getCalendarWeekDays(today, 0);
    targetDays = week.filter((d) => d < today);
    timeframeLabel = 'This Calendar Week';
  } else if (timeframe === 'last-week') {
    targetDays = getCalendarWeekDays(today, -1);
    timeframeLabel = 'Last Calendar Week (Mon–Sun)';
  } else {
    const { days } = people[0];
    targetDays = days.map((d) => d.day).filter((d) => d < today).slice(-14);
    timeframeLabel = 'Past 14 Days';
  }

  const penaltiesByPerson: Record<string, PenaltyItem[]> = {};
  people.forEach((p) => {
    penaltiesByPerson[p.person.id] = [];
  });

  people.forEach((view) => {
    const { person, days, checkins } = view;
    const byDayMap = new Map(days.map((d) => [d.day, d]));

    targetDays.forEach((targetDay) => {
      const stat = byDayMap.get(targetDay);
      if (!stat) return;

      const hasGoals = person.goalGithub > 0 || person.goalLeetcode > 0;
      if (!hasGoals) return;

      const githubMet = person.goalGithub <= 0 || stat.github >= person.goalGithub;
      const leetcodeMet = person.goalLeetcode <= 0 || stat.leetcode >= person.goalLeetcode;
      const allMet = githubMet && leetcodeMet;

      if (!allMet) {
        const checkin = checkins[targetDay];
        const noteText = checkin?.note?.trim() ?? '';
        const hasReason = noteText.length > 0;

        penaltiesByPerson[person.id].push({
          day: targetDay,
          personId: person.id,
          personName: person.name,
          hasReason,
          reasonText: noteText,
          slot: person.slot,
        });
      }
    });
  });

  return (
    <section className="card stakes-panel" id="stakes" data-collapsed={collapsed}>
      <div className="section-head">
        <div className="section-title-wrap" onClick={() => setCollapsed(!collapsed)}>
          <h2>🍕 Accountability Stakes & Meal Penalties</h2>
          {collapsed && <span className="subtle">(Collapsed)</span>}
        </div>
        <div className="spacer" />
        {!collapsed && (
          <div className="segmented" role="group" aria-label="Stakes timeframe">
            <button
              type="button"
              aria-pressed={timeframe === 'this-week'}
              onClick={() => setTimeframe('this-week')}
            >
              This Week
            </button>
            <button
              type="button"
              aria-pressed={timeframe === 'last-week'}
              onClick={() => setTimeframe('last-week')}
            >
              Last Week
            </button>
            <button
              type="button"
              aria-pressed={timeframe === 'all'}
              onClick={() => setTimeframe('all')}
            >
              14 Days
            </button>
          </div>
        )}
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
          <div className="stakes-rule-box">
            <div className="stakes-rule-title">🍔 Weekly Meal Penalty Ledger ({timeframeLabel})</div>
            <p className="stakes-rule-desc">
              If a daily goal is missed without writing a valid reason in your daily check-in note, you owe your partner a meal!
              Write your reason in the daily check-in box to excuse a missed day.
            </p>
          </div>

          <div className="stakes-ledger-grid">
            {people.map((view) => {
              const items = penaltiesByPerson[view.person.id] ?? [];
              const mealOwedCount = items.filter((item) => !item.hasReason).length;

              return (
                <div key={view.person.id} className="stakes-person-card" data-slot={view.person.slot}>
                  <div className="stakes-person-head">
                    <span className="swatch" aria-hidden="true" />
                    <span className="person-name">{view.person.name}</span>
                    <span className={`meal-counter ${mealOwedCount > 0 ? 'active' : 'clean'}`}>
                      {mealOwedCount > 0 ? `🍔 ${mealOwedCount} Meal${mealOwedCount > 1 ? 's' : ''} Owed` : '🎉 0 Meals Owed'}
                    </span>
                  </div>

                  {items.length === 0 ? (
                    <div className="stakes-empty">All goals met for {timeframeLabel.toLowerCase()}! Perfect record.</div>
                  ) : (
                    <div className="stakes-list">
                      {items.map((item) => (
                        <div key={item.day} className="stakes-item">
                          <div className="stakes-item-date">{formatDay(item.day)}</div>
                          <div className="stakes-item-status">
                            {item.hasReason ? (
                              <span className="badge" data-tone="good" title={item.reasonText}>
                                📝 Reason: &quot;{item.reasonText.length > 25 ? `${item.reasonText.slice(0, 25)}...` : item.reasonText}&quot;
                              </span>
                            ) : (
                              <span className="badge meal-badge" data-tone="critical">
                                🍔 Meal Owed
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
