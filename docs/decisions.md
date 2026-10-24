# Decisions log

Choices made where the brief or the PDF left room, newest last. Each entry: what, why.

## Phase 1: Analysis (24 Oct 2026)

1. **Design PDF location.** The brief points to `docs/vertex-design.pdf`, which didn't exist. Copied
   `~/Downloads/Vertex_Command_Center_All_Dashboard_Designs.pdf` (13 pages; the two copies in Downloads are
   byte-identical) to `docs/vertex-design.pdf`.
2. **Reference images.** Each PDF page is one 1536 × 1024 raster. They are extracted losslessly to
   `docs/reference/page-NN.png` and serve as the comparison baseline. (The PDF reader needs poppler, which isn't
   installed; extraction used a small Node script and no new dependencies.)
3. **Comparison viewport = 1536 × 1024**, the PDF's native size, so screenshots line up 1:1 with the reference
   images. 1440 × 900 screenshots are captured as well, per the brief.
4. **PDF colours override the brief's suggested values** where they differ: sidebar `#181C25` (not `#0F1A2B`),
   primary `#1167FB`, VMH `#7231FB`, VTH `#00B675`. Full table in `design-spec.md` §1.1.
5. **Filled VMH pill is purple** (page 5 and the brief), not blue (page 2).
6. **Spacing follows the PDF**: 12–14 px gaps and 16 px page padding (the brief suggested 16–20 / 24).
7. **Logo recreated as SVG.** The logo files in Downloads don't match the PDF's "V" mark.
8. **Docked side panels.** The task, invoice, goal and file panels are docked columns in the PDF, not overlays. They
   dock at ≥ 1440 px and become overlay sheets below that.
9. **PDF self-contradictions** are resolved per `design-spec.md` §5. Seed targets get recorded here in Phase 2.

## Plan approval (24 Oct 2026), owner's answers

10. **Dashboard layout by scope.** All → page 1 layout ("Welcome back" command center). VMH / VTH → page 2 layout
    (Revenue Trend, Project Status, Tasks, Team Workload, Leads Pipeline, Agenda), filtered, single colour. Page 2's
    combined mock-up is not built.
11. **Local dev without Docker.** Postgres runs through the `embedded-postgres` npm package and storage through a
    standalone MinIO exe, both started by `npm run services` (and by `npm run dev`). No docker-compose file.
12. **Scope = the brief.** The extra modules in `Vertex Command Center - System Requirements.docx` are listed in
    `docs/backlog.md`. Where the doc and the brief conflict, the brief wins: 5 team members, video files uploaded to S3,
    one shared lead pipeline for both companies.
13. **Better Auth instead of Auth.js.** Auth.js v5 is still beta (5.0.0-beta.32), its email/password login can't use
    database sessions (the brief requires DB sessions), and Auth.js is now maintained by the Better Auth team.
    Better Auth has email/password, Google, DB sessions, a Prisma adapter and rate limiting built in.
14. **Prisma 7.10.1** (stable). npm's `latest` tag points at an 8.0 release candidate.
15. **Pinned clock.** `SEED_TODAY` (e.g. `2026-10-22`) drives both the seed and `lib/clock.ts → now()`, so relative
    dates match the PDF in screenshots and E2E runs. When unset, the real date is used.
16. **Dev email.** With no `RESEND_API_KEY`, emails are logged to the server console instead of sent.

## Phase 2: Foundation (24 Oct 2026)

17. **MinIO is gone.** Its binary download now returns 410 Gone (MinIO stopped publishing free binaries in
    2025). The candidate replacement, RustFS 1.0.3 (MinIO-compatible, Apache-2.0), was downloaded to `.bin/`, but
    running a downloaded executable was blocked by the session's safety check. **Open decision for the owner**,
    needed before Phase 7 (file storage). Until then `npm run services` starts Postgres only.
18. **Embedded Postgres runs on port 5433** with UTF-8 encoding (Windows defaults to WIN1252, which can't store ₹).
    It creates `vertex` and `vertex_test` databases.
19. **Company ids are their lowercase codes** (`vmh`, `vth`), so scope filters are a plain `companyId in (...)` with
    no lookup.
20. **Scope lives in a cookie, kept in sync with `?company=` by `proxy.ts`.** Server code reads only the cookie
    (`getRequestContext()`), and the proxy rewrites the request cookie, so the first render after a switch is
    already correct. The scope is narrowed to the companies the user belongs to.
21. **Port 3000 is used by the dev server.** `BETTER_AUTH_URL` in `.env` must match the port the app runs on.
22. **Owner time counts in totals but not in team lists.** Dhrumil logs 28h 30m, so October totals (186h 30m) and
    the page-13 per-person hours (Rohan 42h 30m … Dhruv 18h 20m) both hold. Team lists show staff only, as in the
    PDF.
23. **Client "Total Revenue" = sum of the client's project values** (contract value). This reproduces the page-4
    column (e.g. Bright Labs ₹2,80,000 = ₹80,000 shorts + ₹2,00,000 website). Period revenue elsewhere comes from
    invoices and payments.
24. **Avatars are initials on tinted circles.** The PDF uses stock photos we don't have.

### Seed results vs the PDF (module pages are the source of truth; dashboards derive)

| Area | Matches the PDF | Differs (and why) |
|---|---|---|
| Clients (p4) | 68 total; VMH 38; segments 54 / 5 / 6 / 3; all 10 table rows | VTH tab 36 (PDF 30): 6 clients work with both companies, and per the brief they count in both |
| Leads (p3) | Columns 8 / 10 / 6 / 5 / 3 with every visible card; 18 VMH / 14 VTH; open pipeline ₹28,50,000; sources 8/6/5/4/4/3/2 | Proposal column ₹9,30,000 (PDF ₹7,80,000), needed for the ₹28,50,000 pipeline. VMH/VTH pipeline split is computed (₹10,25,000 / ₹18,25,000). Won = 3 (PDF KPI says 8) |
| Projects (p5, p6) | VMH 28: 18 active / 4 in review / 6 completed; VTH 12; all 20 visible list rows | VTH completed 1, active 9 (PDF 2 / 8). Two internal projects ("Operations", "System Setup") exist but aren't client projects |
| Tasks (p7) | Board 12 / 18 / 8 / 10 / 20 with every visible card; 8 due today | 68 total (PDF KPI 54); 7 overdue (PDF 6, from the visible due dates); drawer task 60% = checklist 3/5 (PDF 70%); Bright Labs project 7/12 done (PDF 8/12; five open tasks are visible, so 8 is impossible) |
| Time (p8, p13) | 186h 30m; VMH 108h 20m / VTH 78h 10m; billable 152h 15m (92h 40m / 59h 35m); GreenBuild 42h 30m / 38h 15m; all 8 timesheet rows | "This week" widgets are computed for the real current week |
| Invoices (p9) | All 10 visible rows; Paid 28, Overdue 4, Draft 2; VTH-019 line items | 40 invoices (PDF 42): numbering tops out at VMH-021 / VTH-019. Pending 6 (PDF 8). Statuses follow dates, so VTH-016 and VTH-015 show Overdue and VTH-018 Pending. Amounts computed |
| Goals (p1, p10, p11) | Every visible goal with its progress | 19 goals (PDF 18 + the page-1 goals). Status is computed: 8 on track, 5 at risk, 4 off track, 1 completed, 1 overdue |
| Files (p12) | Category counts 248 / 320 / 156 / 210 / 96; all visible rows | 13 client folders (card says 12, tree shows 5 + 8 more), 10 project folders (card says 18) |

## Phases 3–15 (24 Oct 2026)

25. **Storage: local disk driver for now (resolves 17 for development).** `STORAGE_DRIVER=local` keeps files in
    `.data/files`, served through `/api/storage` with HMAC-signed, expiring URLs. `STORAGE_DRIVER=s3` uses presigned
    direct uploads to any S3-compatible store (Cloudflare R2, AWS S3, RustFS/MinIO); no code change is needed to switch.
    Still open for the owner: R2 or a self-hosted RustFS for production.
26. **Font: Inter Tight**, not Inter. Its narrower letterforms match the PDF's headings and table text more closely.
27. **Chart colours** use a colour-blind-checked palette (`lib/chart-colors.ts`). A few hues are a step darker or
    lighter than the PDF, so adjacent series stay distinguishable under deuteranopia and protanopia.
28. **Exports are CSV, not XLSX.** CSV opens in Excel and Google Sheets with no extra dependency. Cells that start
    with `= + - @` are prefixed, to block formula injection.
29. **Report PDF = browser print.** "Export PDF" on Reports calls `window.print()` with a print stylesheet.
    Invoice PDFs are real files rendered with `@react-pdf/renderer`.
30. **Background jobs run in-process with pg-boss** (started in `instrumentation.ts`): overdue invoices daily at
    06:00, goal recompute hourly, trash purge at 03:30 and campaign sends every 10 minutes (Asia/Kolkata). On
    serverless hosting, keep one long-running worker or call the same functions from a cron route.
31. **Visual review after Phase 4 was skipped** at the owner's request ("build fast, no manual testing"). From
    Phase 5 onward, screens have been checked by typecheck, lint, unit tests and E2E smoke tests only, not compared
    against `docs/reference`.

## Review fixes (24 Oct 2026)

32. **INR only for now.** Every revenue total sums invoice amounts without converting, so a USD invoice would be
    counted as rupees. The invoice builder is fixed to INR; billing in USD needs a stored exchange rate first
    (`shortcut:` comment in `components/invoices/invoice-client.tsx`).
33. **Board order is sent as "before this card", not an index.** The board can be filtered, so an index means
    nothing to the server. A drop now shifts positions with one `updateMany` instead of renumbering the column,
    and the Leads/Tasks boards only load cards closed in the last 30 days.
34. **Payments are serialized on the invoice row** (`SELECT … FOR UPDATE` inside the transaction), so two people
    recording a payment at once can't both pass the balance check.
35. **One running timer per user is enforced by the database**, not only by application code
    (partial unique index, migration `20261024120000`).
36. **The six top-level file folders are created by a migration**, not only by the seed. "Add Client" and
    "Convert lead" create a folder under Client Files, so on a migrated-only database they used to fail.
37. **Campaign audiences are clamped to the sender's own companies**, whatever the form submits.
38. **A failed campaign send is retried, not marked Bounced.** Send errors are usually rate limits, not dead
    addresses; only a provider bounce webhook should set BOUNCED. Sends pause ~0.6s apart.
39. **The seed refuses any non-local database host** unless `--force` is passed. `NODE_ENV` is usually unset in a
    terminal, so it was not a real guard.
40. **Invoice reminders attach the PDF** instead of linking to it: the PDF route needs a login, which most client
    contacts don't have.
41. **Auto-tracked goals count whole IST days**, including their last day.
42. **Shared `<Field>` and `companyCode()`** replace 33 copies of the label markup and 10 copies of the
    company-code helper.
