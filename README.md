# Vertex OS

Internal operations platform for Vertex Media House (VMH, video editing) and Vertex Tech House (VTH, software).
Design source of truth: `docs/vertex-design.pdf` (analysis in `docs/design-spec.md`, choices in `docs/decisions.md`).

## Setup (no Docker needed)

Requires Node 22+.

```sh
npm install
cp .env.example .env          # then set BETTER_AUTH_SECRET to a long random string
npm run services              # embedded Postgres on :5433 (leave running), or just use `npm run dev`
npx prisma migrate deploy
npm run db:seed               # demo data matching the design PDF
npm run db:fresh              # or: an empty OS, just the two companies and the staff logins
npm run dev                   # starts services + Next.js on http://localhost:3000
```

Log in as `dhrumil@vertexmediahouse.com` with the password set in `SEED_PASSWORD` (see `.env`).
Other demo users: rohan@, priya@, aman@, dhruv@vertexmediahouse.com and neha@vertextechhouse.com.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Local Postgres + Next.js dev server |
| `npm run services` | Local Postgres only |
| `npm run db:migrate` | Create/apply a migration after editing `prisma/schema.prisma` |
| `npm run db:seed` | Wipe and reseed the database in `DATABASE_URL` |
| `npm run db:fresh` | Wipe to an empty, usable OS: two companies, the staff logins, the root folders, nothing else |
| `npm run typecheck` / `lint` / `test` | Types, ESLint, Vitest unit tests |
| `npm run test:e2e` | Playwright end-to-end tests (needs a seeded database) |
| `npm run build` / `start` | Production build and server |

`SEED_TODAY=2026-10-22` pins "today" for the seed and the app, so screens match the PDF. Leave it empty in
production.

## Modules

Dashboard · Leads · Clients · Projects (VMH video and VTH software templates) · Tasks · Time · Invoices · Goals ·
Files · Reports · Email Campaigns · Team · Settings · Calendar · Notifications · Activity · Client portal (`/portal`).
Global search: **Ctrl/⌘ K**. The company switch (All / VMH / VTH) in the topbar or sidebar scopes every module.

Invoices are in INR only. Revenue totals add invoice amounts up without converting currency, so billing in another
currency needs a stored exchange rate first (decision 32).

## Environment

All variables are documented in [`.env.example`](.env.example). The ones that matter in production:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Postgres connection string (Neon: use the pooled URL) |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Long random secret; the public URL of the app |
| `GOOGLE_CLIENT_ID` / `SECRET` | Optional; the Google button appears only when both are set |
| `STORAGE_DRIVER` + `S3_*` | `s3` for R2/S3 in production; `local` writes to `.data/files` |
| `RESEND_API_KEY`, `EMAIL_FROM` | Empty key = emails are logged to the console |
| `SEED_TODAY` | Leave **empty** in production |

## Architecture in one paragraph

Server components read data through Prisma (`lib/db`). Every query is filtered by the current company scope
(`getRequestContext()` + `scopedWhere()` in `lib/db/scope.ts`). Every mutation is a server action that checks
permissions (`lib/auth/permissions.ts`), validates input with Zod, and writes an activity entry and its notifications
in the same transaction. All dashboard and report numbers are computed in `lib/metrics/*`; nothing is hard-coded.
Background jobs (overdue invoices, goal recompute, trash purge, campaign sends) run on pg-boss in the same Postgres.

## Deploy (Vercel + Neon + Cloudflare R2)

1. **Neon:** create a database and copy the pooled connection string into `DATABASE_URL`.
2. **R2:** create a bucket and an API token. Set `STORAGE_DRIVER=s3`, `S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com`,
   `S3_REGION=auto`, `S3_BUCKET` and the keys. Add a CORS rule that allows `PUT` from your app's domain (needed for
   browser uploads).
3. **Resend:** verify your sending domain and set `RESEND_API_KEY` and `EMAIL_FROM`.
4. **Vercel:** import the repo and add the env vars above. Build command: `npm run build`. Then run
   `npx prisma migrate deploy` once against the Neon URL. Do not run `npm run db:seed` against it: the seed wipes the
   database and refuses any non-local host unless `--force` is passed.
5. **Jobs:** pg-boss needs a long-running process. On Vercel, run the workers elsewhere (e.g. a small Railway or Fly
   instance running `npm start`), or move the five job functions in `lib/jobs/` behind Vercel Cron routes.
6. Create real users and remove the seeded demo accounts, or change `SEED_PASSWORD` before seeding.

## Tests

- `npm run test`: unit tests for metrics, formatting, scope and permission rules, invoice totals, campaign merge.
- `npm run test:e2e`: login, scope switching, every module in every scope, and the lead → client + project flow.
  It runs against the dev server and the seeded database (it adds one lead per run; reseed to reset).
