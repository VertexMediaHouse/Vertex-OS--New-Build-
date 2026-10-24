# Vertex Command Center

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
npm run dev                   # starts services + Next.js on http://localhost:3000
```

Log in as `dhrumil@vertexmediahouse.com` with the password in `SEED_PASSWORD` (default `vertex123`).
Other demo users: rohan@, priya@, aman@, dhruv@vertexmediahouse.com and neha@vertextechhouse.com.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Local Postgres + Next.js dev server |
| `npm run services` | Local Postgres only |
| `npm run db:migrate` | Create/apply a migration after editing `prisma/schema.prisma` |
| `npm run db:seed` | Wipe and reseed the database in `DATABASE_URL` |
| `npm run typecheck` / `lint` / `test` | Types, ESLint, Vitest unit tests |
| `npm run test:e2e` | Playwright end-to-end tests (needs a seeded database) |
| `npm run build` / `start` | Production build and server |

`SEED_TODAY=2026-10-22` pins "today" for the seed and the app, so screens match the PDF. Leave it empty in
production.
