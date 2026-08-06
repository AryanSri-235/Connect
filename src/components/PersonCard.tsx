import Heatmap from './Heatmap';
import { num } from '@/lib/format';
import type { PersonView } from '@/lib/types';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function Meter({ label, value, target, met }: { label: string; value: number; target: number; met: boolean }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div>
      <div className="meter-head">
        <span className="name">{label}</span>
        <span className="count">
          {value} / {target}
        </span>
      </div>
      <div
        className="meter-track"
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-label={`${label}: ${value} of ${target}`}
      >
        <div className="meter-fill" data-met={met} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function PersonCard({ view }: { view: PersonView }) {
  const { person, profile, days, today, streak, goalsMetToday, solvedToday } = view;
  const gh = profile?.github;
  const lc = profile?.leetcode;
  const avatar = gh?.avatarUrl ?? lc?.avatarUrl ?? null;
  const hasGoals = person.goalGithub > 0 || person.goalLeetcode > 0;

  return (
    <section className="card person" data-slot={person.slot}>
      <div className="person-head">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="avatar" src={avatar} alt="" width={42} height={42} referrerPolicy="no-referrer" />
        ) : (
          <div className="avatar avatar-fallback" aria-hidden="true">
            {initials(person.name)}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <h3 className="person-name">
            <span className="swatch" aria-hidden="true" />
            {person.name}
          </h3>
          <div className="handles">
            {person.githubUsername && (
              <a href={`https://github.com/${person.githubUsername}`} target="_blank" rel="noreferrer">
                GitHub /{person.githubUsername}
              </a>
            )}
            {person.leetcodeUsername && (
              <a href={`https://leetcode.com/u/${person.leetcodeUsername}/`} target="_blank" rel="noreferrer">
                LeetCode /{person.leetcodeUsername}
              </a>
            )}
          </div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <span className="badge" data-tone={goalsMetToday.all ? 'good' : 'pending'}>
            <span className="badge-icon" aria-hidden="true">
              {goalsMetToday.all ? '✓' : '○'}
            </span>
            {goalsMetToday.all ? 'Day done' : 'In progress'}
          </span>
        </div>
      </div>

      {profile?.errors?.map((e) => (
        <div className="notice" data-tone="warning" key={e.provider} style={{ marginBottom: 14 }}>
          <span className="notice-icon" aria-hidden="true">
            !
          </span>
          <span>
            <strong>{e.provider === 'github' ? 'GitHub' : 'LeetCode'} sync failed.</strong> {e.message} Showing the last
            data we have.
          </span>
        </div>
      ))}

      <div className="tiles">
        <div className="tile">
          <div className="tile-label">Commits today</div>
          <div className="tile-value">{today.github}</div>
          <div className={`tile-sub${goalsMetToday.github && person.goalGithub > 0 ? ' met' : ''}`}>
            {person.goalGithub > 0 ? (goalsMetToday.github ? `goal of ${person.goalGithub} met` : `goal ${person.goalGithub}`) : 'no goal'}
          </div>
        </div>
        <div className="tile">
          <div className="tile-label">LeetCode today</div>
          <div className="tile-value">
            {today.leetcode}
            {solvedToday !== null && solvedToday > 0 && (
              <span className="unit"> · {solvedToday} solved</span>
            )}
          </div>
          <div className={`tile-sub${goalsMetToday.leetcode && person.goalLeetcode > 0 ? ' met' : ''}`}>
            {person.goalLeetcode > 0
              ? goalsMetToday.leetcode
                ? `goal of ${person.goalLeetcode} met`
                : `goal ${person.goalLeetcode} submissions`
              : 'no goal'}
          </div>
        </div>
        <div className="tile">
          <div className="tile-label">Streak</div>
          <div className="tile-value">
            {streak.current}
            <span className="unit"> {streak.current === 1 ? 'day' : 'days'}</span>
          </div>
          <div className="tile-sub">longest {streak.longest}</div>
        </div>
      </div>

      {hasGoals && (
        <div className="meters">
          {person.goalGithub > 0 && (
            <Meter label="GitHub contributions" value={today.github} target={person.goalGithub} met={goalsMetToday.github} />
          )}
          {person.goalLeetcode > 0 && (
            <Meter
              label="LeetCode submissions"
              value={today.leetcode}
              target={person.goalLeetcode}
              met={goalsMetToday.leetcode}
            />
          )}
        </div>
      )}

      {(gh || lc) && (
        <div className="handles" style={{ marginTop: 14, gap: 16 }}>
          {gh?.totalContributions != null && <span>{num(gh.totalContributions)} contributions this year</span>}
          {lc && (
            <span>
              {num(lc.solved.total)} solved — {lc.solved.easy}E / {lc.solved.medium}M / {lc.solved.hard}H
            </span>
          )}
          {lc?.ranking != null && lc.ranking > 0 && <span>rank #{num(lc.ranking)}</span>}
        </div>
      )}

      {person.githubUsername && (
        <Heatmap
          label="GitHub contributions"
          unit="contributions"
          days={days.map((d) => d.day)}
          values={days.map((d) => d.github)}
          slot={person.slot}
        />
      )}
      {person.leetcodeUsername && (
        <Heatmap
          label="LeetCode submissions"
          unit="submissions"
          days={days.map((d) => d.day)}
          values={days.map((d) => d.leetcode)}
          slot={person.slot}
        />
      )}
    </section>
  );
}
