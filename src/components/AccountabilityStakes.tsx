import { formatDay, type Day } from '@/lib/date';
import type { PersonView } from '@/lib/types';

interface PenaltyItem {
  day: Day;
  personId: string;
  personName: string;
  hasReason: boolean;
  reasonText: string;
  slot: number;
}

export default function AccountabilityStakes({
  people,
  today,
}: {
  people: PersonView[];
  today: Day;
}) {
  if (people.length === 0) return null;

  // Process missed goal days in the past 14 days (excluding today)
  const penaltiesByPerson: Record<string, PenaltyItem[]> = {};
  people.forEach((p) => {
    penaltiesByPerson[p.person.id] = [];
  });

  people.forEach((view) => {
    const { person, days, checkins } = view;
    // Filter days prior to today
    const pastDays = days.filter((d) => d.day < today).slice(-14);

    pastDays.forEach((stat) => {
      const hasGoals = person.goalGithub > 0 || person.goalLeetcode > 0;
      if (!hasGoals) return;

      const githubMet = person.goalGithub <= 0 || stat.github >= person.goalGithub;
      const leetcodeMet = person.goalLeetcode <= 0 || stat.leetcode >= person.goalLeetcode;
      const allMet = githubMet && leetcodeMet;

      if (!allMet) {
        const checkin = checkins[stat.day];
        const noteText = checkin?.note?.trim() ?? '';
        const hasReason = noteText.length > 0;

        penaltiesByPerson[person.id].push({
          day: stat.day,
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
    <section className="card stakes-panel">
      <div className="section-head">
        <h2>🍕 Accountability Stakes & Meal Penalties</h2>
        <div className="spacer" />
        <span className="subtle">Streak Protection & Penalty Ledger</span>
      </div>

      <div className="stakes-rule-box">
        <div className="stakes-rule-title">🍔 The Golden Rule of Accountability</div>
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
                <div className="stakes-empty">All goals met in past 14 days! Perfect record.</div>
              ) : (
                <div className="stakes-list">
                  {items.map((item) => (
                    <div key={item.day} className="stakes-item">
                      <div className="stakes-item-date">{formatDay(item.day)}</div>
                      <div className="stakes-item-status">
                        {item.hasReason ? (
                          <span className="badge" data-tone="good" title={item.reasonText}>
                            📝 Valid Reason: &quot;{item.reasonText.length > 25 ? `${item.reasonText.slice(0, 25)}...` : item.reasonText}&quot;
                          </span>
                        ) : (
                          <span className="badge meal-badge" data-tone="critical">
                            🍔 Meal Penalty Owed
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
    </section>
  );
}
