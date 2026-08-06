'use client';

import { useMemo, useState } from 'react';
import { formatFullDay, monthLabel, weekday, type Day } from '@/lib/date';
import { num } from '@/lib/format';
import { heatLevel } from '@/lib/metrics';

interface Props {
  label: string;
  unit: string;
  days: Day[];
  values: number[];
  /** 0 = blue ramp, 1 = orange ramp. Follows the person, never the value. */
  slot: number;
}

interface Cell {
  day: Day | null;
  value: number;
  level: number;
}

interface Hover {
  cell: Cell;
  x: number;
  y: number;
}

export default function Heatmap({ label, unit, days, values, slot }: Props) {
  const [hover, setHover] = useState<Hover | null>(null);
  const [showTable, setShowTable] = useState(false);

  const { weeks, months, total, best } = useMemo(() => {
    const max = Math.max(1, ...values);
    const cells: Cell[] = [];

    // Pad so every column is a full Sun–Sat week.
    for (let i = 0; i < weekday(days[0]); i++) cells.push({ day: null, value: 0, level: 0 });
    days.forEach((day, i) => {
      const value = values[i] ?? 0;
      cells.push({ day, value, level: heatLevel(value, max) });
    });
    while (cells.length % 7 !== 0) cells.push({ day: null, value: 0, level: 0 });

    const weeks: Cell[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

    // Label a column only when its month differs from the previous column's.
    let previous = '';
    const months = weeks.map((week) => {
      const first = week.find((c) => c.day);
      if (!first?.day) return '';
      const m = monthLabel(first.day);
      if (m === previous) return '';
      previous = m;
      return m;
    });

    const total = values.reduce((a, b) => a + b, 0);
    const bestIndex = values.reduce((bi, v, i) => (v > (values[bi] ?? 0) ? i : bi), 0);
    const best = values[bestIndex] > 0 ? { day: days[bestIndex], value: values[bestIndex] } : null;

    return { weeks, months, total, best };
  }, [days, values]);

  const active = values.filter((v) => v > 0).length;
  const rows = days.map((day, i) => ({ day, value: values[i] ?? 0 })).filter((r) => r.value > 0).reverse();

  return (
    <div className="heat" data-slot={slot}>
      <div className="heat-title">
        <span>{label}</span>
        <span className="total">
          {num(total)} {unit} · {active} active {active === 1 ? 'day' : 'days'}
        </span>
      </div>

      <div style={{ position: 'relative' }}>
        <div className="heat-scroll">
          <div style={{ display: 'inline-block', minWidth: '100%' }}>
            <div
              className="heat-months"
              style={{ gridTemplateColumns: `repeat(${weeks.length}, var(--cell))` }}
              aria-hidden="true"
            >
              {months.map((m, i) => (
                <div className="heat-month" key={i}>
                  {m && <span>{m}</span>}
                </div>
              ))}
            </div>

            {/* The grid is decorative for AT; the table below is the accessible twin. */}
            <div className="heat-grid" aria-hidden="true">
              {weeks.map((week, wi) =>
                week.map((cell, di) => (
                  <div
                    key={`${wi}-${di}`}
                    className="heat-cell"
                    data-level={cell.level}
                    data-empty={cell.day === null}
                    onMouseEnter={(e) => {
                      if (!cell.day) return;
                      const box = e.currentTarget.getBoundingClientRect();
                      const parent = e.currentTarget.closest('.heat')!.getBoundingClientRect();
                      setHover({ cell, x: box.left - parent.left + box.width / 2, y: box.top - parent.top });
                    }}
                    onMouseLeave={() => setHover(null)}
                  />
                )),
              )}
            </div>
          </div>
        </div>

        {hover?.cell.day && (
          <div
            role="presentation"
            style={{
              position: 'absolute',
              left: hover.x,
              top: hover.y - 8,
              transform: 'translate(-50%, -100%)',
              background: 'var(--ink)',
              color: 'var(--surface)',
              padding: '5px 9px',
              borderRadius: 6,
              fontSize: 12,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              zIndex: 20,
              boxShadow: 'var(--shadow)',
            }}
          >
            <strong>
              {hover.cell.value} {unit}
            </strong>{' '}
            on {formatFullDay(hover.cell.day)}
          </div>
        )}
      </div>

      <div className="heat-legend">
        <span>Less</span>
        <span className="swatches">
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className="sw" style={{ background: `var(--h${l})` }} />
          ))}
        </span>
        <span>More</span>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 0,
            color: 'var(--ink-muted)',
            fontSize: 11,
            textDecoration: 'underline',
            padding: 0,
          }}
          aria-expanded={showTable}
        >
          {showTable ? 'Hide table' : 'Table view'}
        </button>
      </div>

      <p className="sr-only">
        {label}: {total} {unit} across {active} active days
        {best ? `, best day ${best.value} on ${formatFullDay(best.day)}` : ''}.
      </p>

      {showTable && (
        <div className="table-wrap" style={{ maxHeight: 220, overflowY: 'auto' }}>
          <table className="data">
            <caption className="sr-only">{label} by day</caption>
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">{unit[0].toUpperCase() + unit.slice(1)}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={2} style={{ color: 'var(--ink-muted)' }}>
                    No activity in this window.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.day}>
                    <td>{formatFullDay(r.day)}</td>
                    <td>{r.value}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
