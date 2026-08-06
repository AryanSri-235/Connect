# connect

A two-person accountability dashboard. Both of you see each other's daily progress
side by side — GitHub contributions, LeetCode history, daily goals, streaks, and a
written check-in.

Open the site → enter the shared password → paste both people's GitHub and LeetCode
profile URLs → the dashboard fetches up to a year of history and starts tracking.

---

## What's on the dashboard

| Section | What it shows |
|---|---|
| **Person cards** | Today's contributions and submissions against each person's goal, current and longest streak, lifetime LeetCode solved (Easy/Medium/Hard) and rank |
| **Heatmaps** | A GitHub grid and a LeetCode grid per person, over 3 / 6 / 12 months. Each person keeps one colour everywhere — one is blue, the other orange |
| **Head to head** | Last 7 days: contributions, submissions, and days-all-goals-met, as back-to-back bars plus a plain table |
| **Daily check-in** | You write what you got done and mark the day; your partner's note sits next to yours, read-only. Below that, the previous week |
| **Recent activity** | Both people's pushes, PRs, issues, and solved problems merged into one feed |

Every chart also has a table view, so no value is reachable only through colour.

---

## Quick start (local)

```bash
npm install
```

```bash
npm run dev
```

Open the printed URL. With no environment configured at all it just works: data
goes into `.data/connect.json`, and GitHub is read through the public API.

On first visit you'll be asked to **choose the shared password**. Whatever you pick
is stored as a hash and is what both of you type to get in.

---

## Environment

Copy `.env.example` to `.env.local` and fill in what you need. **`.env.example` is a
template that gets committed to git — never put a real password in it.** Only
`.env.local` is gitignored.

| Variable | Required | What it does |
|---|---|---|
| `DATABASE_URL` | **in production** | Postgres connection string. Locally, leave unset to use the JSON file |
| `GITHUB_TOKEN` | recommended | Unlocks exact daily contribution counts for a full year |
| `APP_PASSWORD` | optional | Fixes the shared password at deploy time instead of choosing it in the browser |
| `CRON_SECRET` | optional | Authenticates the nightly `/api/cron` snapshot |
| `APP_TIMEZONE` | optional | IANA zone deciding when a day rolls over. Defaults to `UTC` |

### About `GITHUB_TOKEN`

Without it, the app falls back to GitHub's public events feed — capped at 300 events,
reaching back only ~90 days, and rate-limited to 60 requests/hour. The dashboard says
so in a banner when this is the case.

With a token it uses the GraphQL contribution calendar: exact per-day counts for a
full year. A classic token with **no scopes ticked** is enough for public profiles.
Create one at <https://github.com/settings/tokens>.

### About `APP_TIMEZONE`

Streaks depend on where you draw the line between days. Set this to the zone you
actually live in (e.g. `Asia/Kolkata`), or a late-night session will land on the
wrong day. Note that the providers bucket their own data slightly differently —
GitHub uses the profile's timezone and LeetCode uses UTC — so a day boundary is
never going to be exact to the minute.

---

## Deploying to Vercel

1. **Create a Postgres database.** [Neon](https://neon.tech) and
   [Supabase](https://supabase.com) both have a free tier. Copy the **pooled**
   connection string — serverless functions open many short-lived connections.
2. **Push this folder to a Git repo** and import it in Vercel.
3. **Set the environment variables** in Project Settings → Environment Variables.
   At minimum `DATABASE_URL`; realistically also `GITHUB_TOKEN`, `APP_PASSWORD`,
   and `APP_TIMEZONE`.
4. **Deploy.** Tables are created automatically on the first request.

`vercel.json` registers a nightly cron at 23:50 UTC that re-syncs both people. Its
real job is capturing each person's lifetime LeetCode total before the day rolls
over, which is what makes the exact "N solved today" figure possible.

> The JSON-file store is refused on Vercel on purpose. Serverless filesystems are
> read-only and per-instance, so writes would vanish silently — the app fails loudly
> instead.

---

## How the data is fetched

**GitHub** — the official REST and GraphQL APIs. Public data only.

**LeetCode** — LeetCode publishes no documented API. The app calls the same GraphQL
endpoint the profile page itself uses, which serves public profiles without auth.
This is unofficial and can break without notice; if LeetCode changes it or blocks
the request, the dashboard shows a warning on that person's card and keeps
displaying the last data it successfully fetched.

Two LeetCode numbers appear, and they mean different things:

- **submissions** — from LeetCode's own calendar. This counts *submissions*, not
  unique problems, and it's what the heatmap and the daily goal use, because it's
  the only figure with real history behind it.
- **solved** — the exact count of problems finished that day, derived from the change
  in your lifetime accepted total between two syncs. It only appears once there are
  two consecutive days of data, so it starts showing up the day after you set things up.

**Sync timing** — loading the dashboard triggers a refetch if the last one was more
than 10 minutes ago. The Refresh button forces one immediately.

### LinkedIn

LinkedIn is not supported and can't be. It has no public API for profile activity,
and its terms prohibit scraping, so there's no way to pull a LinkedIn history
without breaking them.

---

## Goals and streaks

Each person sets a daily GitHub goal and a daily LeetCode goal. Setting either to
`0` turns that goal off, and it stops counting against them.

A day counts toward a streak when **every active goal is met**. The current streak
counts back from today — and a today you haven't earned yet doesn't break it, since
the day isn't over. It only breaks once a *finished* day is missed.

---

## Project layout

```
src/
  app/
    page.tsx            dashboard
    settings/           roster, profile URLs, goals
    login/              shared-password gate and first-run setup
    api/                session, me, people, checkin, refresh, cron
  components/           PersonCard, Heatmap, HeadToHead, CheckinPanel, ActivityFeed, Toolbar
  lib/
    providers/          github.ts, leetcode.ts
    store/              postgres.ts + jsonfile.ts behind one interface
    sync.ts             fetch, merge, persist
    metrics.ts          streaks, weekly totals, heat levels
    profileUrls.ts      turns pasted URLs into usernames
```

---

## Notes on the password

Both people share one password — it's a lock on the front door, not per-user auth.
The session cookie stores a hash, never the password itself, and the password is
stored hashed too.

"Who am I" is a separate, non-security preference: it only decides whose check-in
box is editable, and either person could change it. That's fine for two people who
trust each other, and it is not a permission system. Don't put anything on this
dashboard you wouldn't want the other person to edit.
