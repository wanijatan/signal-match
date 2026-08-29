# Signal — by RightSignal

Tell us what you need. Tell us what you can offer. We'll find the overlap.

A no-profile, no-feed, no-password matching utility. Passwordless email-OTP
auth via Clerk (people can log back in anytime to edit their requirement/
offer — no account creation flow, ever), Postgres via Supabase, deterministic
keyword matching by default with an optional OpenAI-embeddings upgrade,
transactional email via Resend. Ships ready to deploy on Vercel.

**Verified locally before hand-off:** `tsc --noEmit` and production builds
pass on both the frontend and backend, the backend boots and its `/api/health`,
cron, and renew endpoints respond correctly, and the matching engine's
scoring was sanity-checked in isolation against synthetic signal pairs. It
has **not** been run against live Clerk/Supabase/Resend accounts or an
actual Vercel deployment — that's the remaining step, covered below.

---

## What's new in this version

- **Login anytime, no account creation** — `/login` is a custom branded
  email + OTP screen (Clerk passwordless underneath) for people who already
  have a signal. `/my-signal` lets them view and edit their requirement/
  offer, renew their matching window, or delete their signal — all without
  ever seeing a "create an account" step.
- **Tiered retention** — a "looking for" request stays matchable for **30
  days**; a "can offer" listing stays matchable for **90 days** (offers are
  more evergreen than asks). Either half can lapse independently; editing or
  hitting "Renew" resets both timers. A daily Vercel Cron job
  (`/api/cron/expire-signals`) flips the expired flags and fully retires a
  signal once both halves have lapsed.
- **Minimal, single-viewport landing page** — one headline, one CTA, three
  short lines below the fold. No stacked marketing sections.
- **Vercel-ready** — `backend/api/index.ts` + `backend/vercel.json` turn the
  Express app into a Vercel serverless function; `frontend/vercel.json`
  configures the Vite SPA. Matching now runs synchronously inside the
  request (not fire-and-forget), which is required for correctness on
  serverless hosting — work queued after a response isn't guaranteed to run.

---

## 1. Prerequisites

- A [Supabase](https://supabase.com) project (Postgres + pgvector)
- A [Clerk](https://clerk.com) application, configured for **email code /
  passwordless only**: Clerk Dashboard → **User & Authentication → Email,
  Phone, Username** → enable "Email verification code", turn **off**
  Password and Username.
- A [Resend](https://resend.com) account + verified sending domain (optional
  for local dev — emails just log to the console without a key)
- A [Vercel](https://vercel.com) account
- An OpenAI API key (optional — only needed for semantic/embedding matching
  instead of the deterministic keyword fallback)

## 2. Database setup (Supabase)

1. Supabase Dashboard → SQL Editor → run, **in order**:
   - `database/migrations/001_init.sql`
   - `database/migrations/002_expiry_and_login.sql`
2. Once you have real signal volume, uncomment the `ivfflat` index creation
   statements near the bottom of `001_init.sql` for faster vector search.
3. Grab your project's **URL**, **service role key** (Settings → API), and
   **direct connection string** (Settings → Database) — you'll need these
   below.

## 3. Clerk setup

1. Create a Clerk application with email-code-only auth (step 1 above).
2. Clerk Dashboard → **Webhooks** → add endpoint
   `https://<your-backend-domain>/api/webhooks/clerk`, subscribed to
   `user.created`, `user.updated`, `user.deleted`. Copy the **signing
   secret** → this is `CLERK_WEBHOOK_SECRET`.
3. Copy the **publishable key** (`pk_...`) and **secret key** (`sk_...`)
   from Clerk Dashboard → API Keys.
4. Once your frontend has a real domain, add it to Clerk Dashboard →
   **Domains** so sessions work cross-origin with the backend.

## 4. Deploy the backend to Vercel

1. Push this repo to GitHub (or GitLab/Bitbucket).
2. Vercel → **Add New Project** → import the repo → set **Root Directory**
   to `backend`.
3. Vercel auto-detects `backend/vercel.json`, which runs `npm run build`
   (compiles TypeScript to `dist/`) before packaging `api/index.ts` as the
   serverless function, and rewrites every request path to it.
4. Add environment variables (Project Settings → Environment Variables) —
   everything in `backend/.env.example` except `PORT` (Vercel manages that).
   At minimum: `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL` (your frontend's Vercel URL, set
   this after step 5), `RIGHTSIGNAL_URL`, `ADMIN_EMAIL`, `CRON_SECRET` (any
   random string — Vercel Cron sends it automatically as a Bearer token).
5. Deploy. Note the resulting URL (e.g. `https://signal-api.vercel.app`) —
   this is your backend's `API_URL`.
6. The `crons` entry in `backend/vercel.json` schedules
   `/api/cron/expire-signals` daily at 03:00 UTC automatically — no extra
   setup needed, it activates on deploy.

## 5. Deploy the frontend to Vercel

1. Vercel → **Add New Project** → import the same repo again → set **Root
   Directory** to `frontend`. Vercel auto-detects Vite.
2. Add environment variables: `VITE_CLERK_PUBLISHABLE_KEY` (from Clerk),
   `VITE_API_URL` (the backend URL from step 4.5), `VITE_RIGHTSIGNAL_URL`.
3. Deploy. Note the resulting URL (e.g. `https://signal.vercel.app`).
4. Go back to the **backend** project's env vars and set `APP_URL` to this
   frontend URL (used for CORS and links in emails), then redeploy the
   backend.
5. Add both this URL and the backend URL to Clerk Dashboard → Domains.

## 6. Make yourself an admin

In Supabase SQL Editor:
```sql
insert into admin_users (clerk_user_id, email, role)
values ('user_xxx_from_clerk', 'you@yourdomain.com', 'admin');
```
(Find your `clerk_user_id` in Clerk Dashboard → Users after you've signed in
once via `/start` or `/login` on the live site.) Then visit
`https://<your-frontend-domain>/admin`.

## 7. Local development (optional, for changes before redeploying)

```bash
cp backend/.env.example backend/.env    # fill in real keys
cp frontend/.env.example frontend/.env

cd backend && npm install && npm run dev     # http://localhost:8080
cd frontend && npm install && npm run dev    # http://localhost:5173
```

---

## What's implemented

- Landing page (minimal, single-viewport hero + three-line "how it works")
- Multi-step signal form with inline Clerk email-code verification and
  form-state preservation for new users; `/login` + `/my-signal` for
  returning users to sign in and edit/renew/delete their signal anytime —
  no account-creation step either way
- One active signal per user, moderation (auto-block/flag + admin queue),
  basic anti-spam (submission caps, rate limiting)
- **Tiered expiry**: requests active 30 days, offers active 90 days,
  independently lapsing, renewed on any edit or explicit "Renew"; a daily
  cron job enforces it and fully retires signals once both halves lapse
- Matching engine: deterministic concept/synonym matching always runs;
  OpenAI embeddings blend in when `AI_MATCHING_ENABLED=true`; only
  non-expired halves of a signal are matchable; direct / reciprocal /
  one-way classification; configurable strong/good/potential thresholds;
  pair-level dedup
- Match page with privacy-safe reveal (no email before mutual interest),
  interest/reject, mutual-match unlock, RightSignal handoff with referral
  attribution
- Pass-it-on request forwarding flow
- Transactional emails (Resend) for every email type in the spec
- Admin dashboard: overview stats, signal search/suspend/flag/delete,
  manual match trigger, match table with status filters
- Privacy/Terms pages, "Delete my Signal", analytics event tracking table
- Vercel deployment config for both apps, including the daily expiry cron

## What's intentionally minimal for this MVP

- Admin manual-match-creation UI and the report/moderation review UI exist
  as API routes (`POST /api/admin/matches/manual`, `GET
  /api/admin/reports`) but don't yet have dedicated admin screens.
- Per-category SEO landing pages (`/for-founders`, etc.) aren't built.
- CAPTCHA and durable (cross-instance) rate limiting aren't wired in — the
  built-in rate limiter is in-memory per serverless instance, a soft
  backstop rather than a hard guarantee at scale. Add a store like Upstash
  Redis if you need strict limits under real traffic.
- If Vercel's TypeScript bundler ever has trouble tracing `api/index.ts`'s
  import of the build output (`../dist/app.js`), the fallback is to check
  in the compiled `backend/dist/` folder to source control and remove
  `dist/` from `.gitignore` for that project — this guarantees the exact
  file the function imports exists at deploy time.
