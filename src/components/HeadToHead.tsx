import { num } from '@/lib/format';
import type { PersonView } from '@/lib/types';

interface Row {
  label: string;
  a: number;
  b: number;
  /** Higher is better — used to word the lead line. */
  unit: string;
}

function Bars({ row, nameA, nameB }: { row: Row; nameA: string; nameB: string }) {
  const max = Math.max(row.a, row.b, 1);
  return (
    <div className="h2h-row">
      <div className="h2h-label">{row.label}</div>
      <div className="h2h-side left">
        <span className="h2h-value">{num(row.a)}</span>
        <div className="h2h-bar left" style={{ flex: 1 }}>
          <div
            className="h2h-fill"
            style={{ width: `${(row.a / max) * 100}%` }}
            role="img"
            aria-label={`${nameA}: ${row.a} ${row.unit}`}
          />
        </div>
      </div>
      <div className="h2h-axis" aria-hidden="true" />
      <div className="h2h-side right">
        <div className="h2h-bar right" style={{ flex: 1 }}>
          <div
            className="h2h-fill"
            style={{ width: `${(row.b / max) * 100}%` }}
            role="img"
            aria-label={`${nameB}: ${row.b} ${row.unit}`}
          />
        </div>
        <span className="h2h-value">{num(row.b)}</span>
      </div>
    </div>
  );
}

export default function HeadToHead({ people }: { people: PersonView[] }) {
  if (people.length < 2) return null;

  const [a, b] = people;
  const rows: Row[] = [
    { label: 'GitHub contributions', a: a.week.github, b: b.week.github, unit: 'contributions' },
    { label: 'LeetCode submissions', a: a.week.leetcode, b: b.week.leetcode, unit: 'submissions' },
    { label: 'Days all goals met', a: a.week.daysMet, b: b.week.daysMet, unit: 'days' },
  ];

  const aWins = rows.filter((r) => r.a > r.b).length;
  const bWins = rows.filter((r) => r.b > r.a).length;
  const nothingYet = rows.every((r) => r.a === 0 && r.b === 0);

  const lead = nothingYet
    ? 'Neither of you has logged anything this week yet.'
    : aWins > bWins
      ? `${a.person.name} leads ${aWins}–${bWins} this week.`
      : bWins > aWins
        ? `${b.person.name} leads ${bWins}–${aWins} this week.`
        : `Level at ${aWins}–${bWins} this week.`;

  return (
    <section className="card" id="head-to-head">
      <div className="section-head">
        <h2>Head to head — last 7 days</h2>
        <div className="spacer" />
        <div className="legend">
          <span className="legend-item">
            <span className="legend-swatch" style={{ background: 'var(--p0)' }} aria-hidden="true" />
            {a.person.name}
          </span>
          <span className="legend-item">
            <span className="legend-swatch" style={{ background: 'var(--p1)' }} aria-hidden="true" />
            {b.person.name}
          </span>
        </div>
      </div>

      {rows.map((row) => (
        <Bars key={row.label} row={row} nameA={a.person.name} nameB={b.person.name} />
      ))}

      <p className="h2h-lead">{lead}</p>

      <div className="table-wrap">
        <table className="data">
          <caption className="sr-only">Head to head totals for the last 7 days</caption>
          <thead>
            <tr>
              <th scope="col">Metric</th>
              <th scope="col">{a.person.name}</th>
              <th scope="col">{b.person.name}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row" style={{ fontWeight: 500, textAlign: 'left' }}>
                  {r.label}
                </th>
                <td>{r.a.toLocaleString()}</td>
                <td>{r.b.toLocaleString()}</td>
              </tr>
            ))}
            <tr>
              <th scope="row" style={{ fontWeight: 500, textAlign: 'left' }}>
                Current streak
              </th>
              <td>{a.streak.current}</td>
              <td>{b.streak.current}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
