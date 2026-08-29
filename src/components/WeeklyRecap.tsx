import { num } from '@/lib/format';
import type { WeeklyWinnerResult } from '@/lib/metrics';
import type { PersonView } from '@/lib/types';

export default function WeeklyRecap({
  people,
  weeklyWinner,
}: {
  people: PersonView[];
  weeklyWinner: WeeklyWinnerResult;
}) {
  if (people.length === 0) return null;

  const winnerPerson = people.find((p) => p.person.id === weeklyWinner.winnerId);

  return (
    <section className="card weekly-recap">
      <div className="section-head">
        <h2>🏆 Weekly Automated Recap & Winner Spotlight</h2>
        <div className="spacer" />
        <span className="subtle">Trailing 7 Days</span>
      </div>

      <div className="recap-banner" data-winner={Boolean(winnerPerson)}>
        {winnerPerson ? (
          <div className="winner-spotlight">
            <span className="trophy-icon" aria-hidden="true">
              👑
            </span>
            <div>
              <div className="winner-title">{winnerPerson.person.name} is the Weekly Champion!</div>
              <div className="winner-subtitle">
                Completed <strong>{winnerPerson.week.daysMet}/7 days</strong> with{' '}
                <strong>{num(winnerPerson.week.github + winnerPerson.week.leetcode)}</strong> total actions.
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
              <div className="winner-subtitle">Both members achieved equal consistency and contribution points this week.</div>
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
          const { person, week, streak } = view;
          const isWinner = person.id === weeklyWinner.winnerId;
          const pct = Math.round((week.daysMet / 7) * 100);
          const totalPoints = week.github + week.leetcode;
          const isPerfect = week.daysMet === 7;

          return (
            <div key={person.id} className="recap-card" data-slot={person.slot}>
              <div className="recap-card-head">
                <span className="swatch" aria-hidden="true" />
                <span className="recap-person-name">{person.name}</span>
                {isWinner && <span className="crown-badge-sm">👑 Winner</span>}
              </div>

              <div className="recap-metrics">
                <div className="recap-metric-item">
                  <div className="recap-label">Consistency</div>
                  <div className="recap-val">{week.daysMet} / 7 days</div>
                  <div className="meter-track" style={{ marginTop: 4 }}>
                    <div className="meter-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className="recap-stats-row">
                  <div>
                    <span className="subtle">GitHub Commits</span>
                    <div className="stat-num">{num(week.github)}</div>
                  </div>
                  <div>
                    <span className="subtle">LeetCode Solves</span>
                    <div className="stat-num">{num(week.leetcode)}</div>
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
