# ReachInbox — Email Job Scheduler

A production-quality SaaS foundation for scheduling **bulk email campaigns that send gradually over time** — on a controlled delay, with per-sender hourly throttling, full status tracking, and **real delayed background jobs that survive restarts**.

> Scheduling is powered by **BullMQ delayed jobs** backed by Redis. **No cron. No `setInterval`/`setTimeout` scheduler. No in-memory queues.**

---

## Features

- **Google sign-in** via Supabase Auth (dev sign-in fallback until keys are added — fully usable end-to-end).
- **Compose campaigns**: subject, body, recipients, start time, delay between emails, hourly limit.
- **CSV / TXT upload** parsed in the browser: extracts emails, lowercases, trims, dedupes, drops invalid, and shows live counts (valid / duplicates removed / invalid ignored).
- **Real delayed scheduling**: each recipient becomes its own BullMQ delayed job at `start + index × delay`.
- **Pacing & throttling**: configurable minimum delay + Redis-backed per-sender hourly cap. On limit, jobs are **rescheduled to the next hour (not failed)** and flagged as throttled.
- **Scheduled & Sent tables** with colored status badges, loading skeletons, empty/error states, retry, pagination, and Ethereal preview links.
- **Stats**: Scheduled / Sending / Sent / Failed.
- **Slack notifications** on rate-limit (Incoming Webhook; OAuth prepared for a later phase).
- **Search** across recipients / subjects.
- **Queue monitor** + **Bull Board** dashboard (`/api/admin/queues`).
- Toasts, responsive layout, reusable component library.

## Architecture

```
Controller → Service → Repository → PostgreSQL          (request flow)

POST /schedule → EmailService → DB (jobs) → BullMQ Queue → Redis
                                                   │
                                        BullMQ Worker (delayed)
                                                   │
                                          EmailProvider (Ethereal)
                                                   │
                                             DB status update
```

Modular monolith backend with clear boundaries: `config`, `controllers`, `services`, `repositories`, `middleware`, `validators`, `queues`, `workers`, `integrations` (email / google / slack / elasticsearch).

## Tech Stack

- **Frontend**: React 19, React Router, Axios, React Hook Form + Zod, Papa Parse, Tailwind CSS, shadcn/ui, Lucide, Sonner.
- **Backend**: Node.js + TypeScript, Express, Prisma, PostgreSQL, Redis (ioredis), BullMQ, Nodemailer + Ethereal, Zod, Helmet, CORS, Pino, JWT, Bull Board.
- **Infra**: Docker Compose (PostgreSQL + Redis; optional Elasticsearch).

## Project Structure

```
/app
├── server/                 # Node/TS/Express backend + worker
│   ├── src/
│   │   ├── config/         # env (zod), logger, prisma, redis
│   │   ├── controllers/    # http handlers
│   │   ├── routes/         # /api/auth, /api/emails, /health
│   │   ├── services/       # email, auth, rateLimit (business logic)
│   │   ├── repositories/   # prisma data access
│   │   ├── middleware/     # auth, validate, error
│   │   ├── validators/     # zod schemas
│   │   ├── queues/         # email.queue.ts (BullMQ)
│   │   ├── workers/        # email.worker.ts (delayed job processor)
│   │   ├── integrations/   # email/ google/ slack/ elasticsearch/
│   │   ├── admin/          # bull board
│   │   ├── app.ts / server.ts
│   ├── prisma/schema.prisma + seed.ts
│   └── package.json
├── frontend/               # React SPA (components/ pages/ services/ hooks/ utils/)
├── docker-compose.yml
└── .env.example
```

> **Platform note (this deployment):** the frontend is served on port 3000 and the backend
> API on port 8001 by the hosting platform. The port-8001 process is a thin FastAPI reverse
> proxy (`/app/backend/server.py`) that forwards `/api/*` to the Node backend on port 9000.
> Locally (see below) the backend runs directly on port 4000. The application code and
> architecture are identical.

## Prerequisites

- Node.js 20+, Yarn, Docker (for Postgres + Redis).

## Environment Variables

Copy `.env.example` → `server/.env` and adjust. Key ones:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL (local or Supabase pooler) |
| `REDIS_URL` | Redis / BullMQ |
| `WORKER_CONCURRENCY` | Worker parallelism (default 5) — **configurable** |
| `MIN_EMAIL_DELAY_MS` | Enforced minimum delay between sends (default 2000) — **configurable** |
| `MAX_EMAILS_PER_HOUR` | Default per-sender hourly cap (default 200) — **configurable** |
| `ETHEREAL_USER/PASSWORD` | Optional; auto-created if blank |
| `SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY` | Google auth via Supabase |
| `SLACK_*` | Slack OAuth (Phase 3) |
| `ADMIN_USER/ADMIN_PASSWORD` | Bull Board basic auth |

## Running PostgreSQL & Redis

```bash
docker-compose up -d          # starts postgres + redis with persistent volumes
```

## Database Migration

```bash
cd server
yarn prisma:generate
yarn migrate:dev              # creates tables + indexes
```

## Seed Data

```bash
cd server && yarn seed        # 1 user, 2 senders, campaigns, scheduled/sent/failed emails
```

## Running Backend

```bash
cd server && yarn start       # Express API on PORT (default 4000)
```

## Running Worker

```bash
cd server && yarn worker      # BullMQ worker; concurrency = WORKER_CONCURRENCY
```

## Running Frontend

```bash
cd frontend && yarn start     # Vite/CRA dev server; set REACT_APP_BACKEND_URL
```

## Ethereal Setup

No setup required. If `ETHEREAL_USER`/`ETHEREAL_PASSWORD` are blank, a test account is
**auto-created on first send**. Every sent email exposes a **preview URL** (logged and
stored on the job, shown in the Sent table). No real email is ever delivered.

## Google OAuth Setup

Google login runs through **Supabase Auth**:
1. Create a Supabase project; set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
2. In Supabase → Authentication → Providers → Google, enable Google and paste your Google
   **Client ID / Secret** (Google Cloud → OAuth client → Web). Add Supabase's
   `/auth/v1/callback` as an authorized redirect URI.
3. The frontend calls `supabase.auth.signInWithOAuth({ provider: 'google' })`; the backend
   verifies the Supabase access token at `POST /api/auth/supabase` and maps it to a user.

Until configured, **dev sign-in** (`POST /api/auth/dev-login`, or the login button) gives full access. OAuth is **not** replaced by a fake hardcoded user — it's a clearly-labelled dev fallback.

## BullMQ Architecture

- Queue: `email-send-queue` (`src/queues/email.queue.ts`).
- Each job payload is minimal: `{ emailJobId }` (bodies stay in Postgres, not Redis).
- `jobId = emailJobId` gives a stable id to aid idempotency.
- Delayed scheduling via BullMQ `delay` = `scheduledAt − now`.

## Persistence After Restart

- **Redis (AOF enabled)** persists queued/delayed jobs → they fire at the right time even
  after the backend/worker restart.
- **PostgreSQL** persists all application state (campaigns, jobs, statuses).

**Demonstrate:** schedule emails with a future start time → stop the worker/API → confirm
jobs remain in Redis (Bull Board “delayed”) → restart → the worker picks them up and sends
at their scheduled time. Status transitions `scheduled → processing → sent/failed` persist in Postgres.

## Throughput, Concurrency & Behavior Under Load

- **Worker concurrency** is configurable via `WORKER_CONCURRENCY` (BullMQ `Worker` concurrency). It is safe in parallel because the worker **atomically claims** each job: `updateMany({ where: { id, status: 'scheduled' }, data: { status: 'processing' }})`. Only one worker/instance wins the claim; others skip → **no double sends** (idempotent).
- **Minimum delay between sends** = `MIN_EMAIL_DELAY_MS` (**default 2000ms / 2 seconds**). Enforced by scheduling each recipient at `startTime + index × delayMs` with `delayMs` floored to `MIN_EMAIL_DELAY_MS`, so sends are naturally spaced even under concurrency.
- **Per-sender hourly rate limit** = `MAX_EMAILS_PER_HOUR` (default 200), overridable per campaign (`hourlyLimit`). Enforced with **atomic Redis `INCR`** on a windowed key `email-rate:{senderId}:{hourWindow}` (TTL just over an hour). This is safe across multiple workers/instances (Redis, not in-memory). Supports multiple senders (keyed per `senderId`).
- **When the hourly limit is reached** the worker does **not** drop or fail the job: it sets `status = scheduled`, `rescheduledForRateLimit = true`, moves `scheduledAt` to the next hour window, and re-enqueues a BullMQ delayed job (`jobId = <emailJobId>:rl:<window>`). Order is preserved as much as practical (rescheduled in claim order; re-throttled again in the next window if still over). The dashboard surfaces a **"throttled"** badge; if Slack is connected, a live message is posted.

### 1000+ emails scheduled at ~the same time
- Each recipient is its own delayed job spaced by `delayMs`; Redis holds them (survives restart).
- The first `hourlyLimit` per sender go out that hour; the remainder are rescheduled forward hour-by-hour until drained — nothing is lost or duplicated. (You don't need to actually send thousands via Ethereal; the logic scales.)

## Slack — Real OAuth ("Connect Slack")

Two ways to connect (both live, both post real messages on rate-limit):

**A) One-click OAuth (recommended)**
1. Create a Slack app at https://api.slack.com/apps → **From scratch**.
2. **OAuth & Permissions → Redirect URLs** → add `<APP_PUBLIC_URL>/api/auth/slack/oauth/callback`.
3. Add scope **`incoming-webhook`** (Bot Token Scopes). Save.
4. **Basic Information** → copy **Client ID** and **Client Secret** → set `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, and `APP_PUBLIC_URL` (and optionally `SLACK_REDIRECT_URI`).
5. In the app, Settings → **Connect Slack** → authorize & pick a channel. The backend exchanges the code at `oauth.v2.access`, stores the incoming-webhook URL **per user**, and posts to that channel when a sender hits its hourly limit.

**B) Manual Incoming Webhook** (works without OAuth): paste a webhook URL in Settings → Slack.

If Slack is **not** connected, rate-limit hits simply skip notification (no crash). Connect later and it starts working with **no redeploy**. Disconnect/reconnect are supported.


Redis-backed, **per-sender, per-hour** counter using atomic `INCR` on key
`email-rate:{senderId}:{hourWindow}` with expiry. When the cap is reached the worker
**reschedules** the job to the next hour window (status stays `scheduled`,
`rescheduledForRateLimit = true`) instead of failing, and (if connected) posts a Slack notice.
`MAX_EMAILS_PER_HOUR` is configurable; the interface is extensible to global / per-tenant limits.

## Idempotency

Safe state machine: `scheduled → processing → sent` (or `→ failed`). Before sending, the
worker reloads the job and **returns early if already `sent`**. Retries are handled by BullMQ.

> **Known window:** if the process dies **after** SMTP accepts the message but **before** the
> DB commits `sent`, a retry could resend. This is minimized (status re-check + stable jobId)
> and documented; a fully exactly-once solution would need a provider idempotency key.

## API Documentation

All responses: `{ success, data, pagination? }` or `{ success:false, error:{ message, code } }`.

| Method | Route | Description |
| --- | --- | --- |
| GET | `/api/health` | `{ status, database, redis }` |
| GET | `/api/health/queue` | Queue counts |
| GET | `/api/auth/config` | Which auth methods are configured |
| POST | `/api/auth/dev-login` | Dev sign-in → `{ token, user }` |
| POST | `/api/auth/supabase` | Exchange Supabase token → session |
| GET | `/api/auth/me` | Current user |
| POST | `/api/auth/logout` | Logout |
| GET/POST | `/api/auth/slack/status|connect|disconnect` | Slack integration |
| POST | `/api/emails/schedule` | Create campaign + schedule jobs |
| GET | `/api/emails/scheduled?page&limit&status&search` | Scheduled list |
| GET | `/api/emails/sent?page&limit&status&search` | Sent list |
| GET | `/api/emails/stats` | Counts by status |
| GET | `/api/emails/search?q=` | Search recipients/subjects |
| GET | `/api/emails/:id` | Single job |
| POST | `/api/emails/:id/retry` | Retry a failed job |
| — | `/api/admin/queues` | Bull Board (basic auth) |

## Demo Flow

1. Open `/login` → **Continue with Google** (dev sign-in).
2. Dashboard shows stats + Scheduled/Sent tabs.
3. **Compose New Email** → subject, body, upload a CSV (see live counts), set start/delay/hourly limit → **Schedule Email**.
4. Watch jobs move `scheduled → processing → sent`; open the Ethereal **Preview** link.
5. Check **Queue Monitor** / Bull Board for waiting/active/delayed/completed/failed.

## Testing

- Backend: `cd server && yarn test` (email validation / normalization; node:test).
- Frontend: `cd frontend && yarn test` (email validator utility).

## Assumptions

- Supabase is used for DB/auth/storage per the plan; a local Postgres works identically via `DATABASE_URL`.
- Ethereal for test email; no production email is sent.
- CSV is parsed client-side; only the cleaned recipient list is sent to the server.
- Search runs on PostgreSQL in Phase 1 (same response shape as a future Elasticsearch swap).

## Trade-offs

- Frontend uses JavaScript (JSX) on this hosting template (CRA) rather than TSX; the **backend is full TypeScript strict**. Types/DTOs are documented and mirrored across the boundary.
- Slack supports **real OAuth v2** ("Connect Slack") and a manual webhook; both post live messages on rate-limit.
- The SMTP/DB idempotency window above is accepted for the assignment scope.

## Future Improvements

- Phase 2: full Supabase Google OAuth UI, richer authorization/roles, multi-sender management.
- Phase 3: Elasticsearch search, Slack OAuth polish (channel picker / more notification types), global/per-tenant rate tiers, analytics.
