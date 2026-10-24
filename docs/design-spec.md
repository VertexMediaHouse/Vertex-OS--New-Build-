# Vertex Command Center: Design Spec

Source of truth for visuals: `docs/vertex-design.pdf` (13 pages, one screen per page).

- Each PDF page is a single **1536 × 1024 px raster image** (no vector text). The images are extracted to
  `docs/reference/page-01.png` … `page-13.png`.
- **All px values below are measured on that 1536 × 1024 canvas.** Treat them as CSS px at a 1536 px wide
  viewport. Visual comparison screenshots use 1536 × 1024 so they line up 1:1 with the reference images
  (1440 × 900 screenshots are taken too, as the brief asks).
- Colours were sampled from the rasters (dominant colour of a region). The rasters are slightly soft, so
  values are rounded to clean tokens. Font sizes were estimated from glyph heights (Inter cap/digit height
  = 0.727 em), accurate to about ±1 px.
- The PDF is AI-generated and **contradicts itself in places** (numbers that don't add up, the same chart
  with different colours on two pages). Section 5 lists every conflict found and the rule used to resolve it.

---

## 0. Page index

| PDF page | Screen | Route | Scope shown |
|---|---|---|---|
| 1 | Owner dashboard ("Welcome back") | `/dashboard` | All |
| 2 | Dashboard, analytics layout: combined + VMH view + VTH view (3 mock-ups) | `/dashboard` | All / VMH / VTH |
| 3 | Leads (KPIs, kanban pipeline, source/company charts, recent leads) | `/leads` | All |
| 4 | Clients (KPIs, table, segments, top clients, recent clients) | `/clients` | All |
| 5 | Projects, VMH template ("Client Projects", master-detail) | `/projects?company=vmh` | VMH |
| 6 | Projects, VTH template ("Projects (VTH)", master-detail) | `/projects?company=vth` | VTH |
| 7 | Tasks (KPIs, kanban, task drawer, my tasks, team workload) | `/tasks` | All |
| 8 | Time Tracking (KPIs, start timer, charts, timesheet) | `/time` | All |
| 9 | Invoices (KPIs, table, invoice drawer, invoice preview) | `/invoices` | All |
| 10 | Goals, detailed view | `/goals` | All |
| 11 | Goals, simple view | `/goals?view=simple` | All |
| 12 | Files (categories, folder tree, list, preview panel) | `/files` | All |
| 13 | Reports, Overview tab | `/reports` | All |

---

## 1. Design tokens

### 1.1 Colour

Brief's suggested value in brackets where the PDF differs. **The PDF value wins.**

**Surfaces and neutrals**

| Token | Value | Use |
|---|---|---|
| `--sidebar-bg` | `#181C25` [brief `#0F1A2B`] | Sidebar. Near-neutral charcoal navy, darker and less blue than the brief. |
| `--sidebar-card` | `#1F2734` | "Switch Company" card |
| `--sidebar-active` | `#1F3B61` | Active nav pill |
| `--sidebar-switch-active` | `#1F3C6C` | Active row inside the Switch Company card |
| `--sidebar-text` | `#E6EAF0` | Nav labels and icons |
| `--sidebar-muted` | `#C9D3DE` | "Switch Company", "COMMAND CENTER" |
| `--page-bg` | `#F4F7FA` [brief `#F5F7FB`] | App background |
| `--card-bg` | `#FFFFFF` | Cards, topbar |
| `--card-border` | `#E6EAF0` | 1 px card / table / input border |
| `--surface-muted` | `#F1F4F8` | Inset boxes (Pipeline Value), table header rows, Draft tab, segmented-control track, filled search inputs |
| `--track` | `#E9EEF4` | Progress-bar track |
| `--text` | `#0F172A` | Headings, primary values |
| `--text-2` | `#334155` | Body, table cells |
| `--text-muted` | `#5B6478` | Subtitles, secondary lines, labels |
| `--text-faint` | `#94A3B8` | Placeholders, axis labels |

**Primary and company colours**

| Token | Value | Use |
|---|---|---|
| `--primary` | `#1167FB` [brief `#1E6BF0`] | Primary buttons, "All" pill, links, default progress bars, pagination active |
| `--primary-soft` | `#E2EDFC` | Selected list item (`#E4F0FC`), active filter tab (`#DCE8FC`), selected table row (`#EAF4FC`), soft buttons ("Create Opportunity" `#E8F0FC`) |
| `--vmh` | `#7231FB` [brief `#7C3AED`] | Filled VMH segment (page 5), VMH-scoped accents |
| `--vmh-chart` | `#8650F8` | VMH chart series (pages 2, 8, 13) |
| `--vmh-chart-light` | `#9276FC` | Lighter VMH bars (page 3 "Leads by Source") |
| `--vmh-soft` | `#F4EAFD` | VMH badge / tab background |
| `--vmh-text` | `#6D28D9` | VMH badge / tab text |
| `--vth` | `#00B675` [brief `#10B981`] | Filled VTH segment, **primary buttons on VTH-scoped screens** (page 6 "New Project"), VTH tab underline |
| `--vth-chart` | `#28C89C` | VTH chart series |
| `--vth-soft` | `#E4F8F0` | VTH badge / tab background |
| `--vth-text` | `#047857` | VTH badge / tab text |
| `--all-soft` / `--all-text` | `#E2EDFC` / `#1167FB` | "ALL" badge |
| `--sidebar-vmh-avatar` | `#4E3F7A` | Small VMH square in Switch Company card |
| `--sidebar-vth-avatar` | `#286057` | Small VTH square in Switch Company card |

**Semantic (status pills = soft background + saturated text + 6 px leading dot)**

| Token | Solid (bars, dots) | Soft (pill bg) | Text | Statuses |
|---|---|---|---|---|
| success | `#10B981` (bars `#00BC80`, workload `#24C098`) | `#DDF7EC` | `#047857` | Completed, Paid, On Track, Approved, Final, Won, Active, Delivered |
| warning | `#F2B92E` | `#FCF0E0` | `#EA580C` | Pending (invoice/approval), At Risk, On Hold, Medium, Idle, Review, In Review (tasks table), Client Review |
| danger | `#EF5356` (page 11 bar `#FC5C48`) | `#FCE6E8` | `#DC2626` | Overdue, High, Off Track, Over, Revision, Rejected, due-date warnings |
| info | `#3B88FC` | `#E0ECFC` | `#2563EB` | In Progress, Contacted, Editing, Progress |
| review | `#8B5CF6` | `#F2E8FC` | `#7C3AED` | Proposal, Development, Planning, In Review (kanban column) |
| neutral | `#94A3B8` | `#F0F4F8` | `#5B6478` | New, Not Started, Draft, Cancelled, Non-Billable, Pending (task/milestone) |

Priority pills: High = danger, Medium = warning, Low = success.

**KPI icon tiles** (48 × 48, radius 12, soft background, 22 px outline icon in the solid colour)

| Variant | Tile bg | Icon |
|---|---|---|
| green | `#DCF8E9` | `#10B981` |
| blue | `#D2E1FC` | `#1167FB` |
| purple | `#E8D8FC` | `#7C3AED` |
| pink | `#FCD9E8` | `#E5487A` |
| orange | `#FDEBD8` | `#F28C28` |
| red | `#FCE2E2` | `#E5484D` |

**Trend chips**: up = soft `#D9F8EE` + text `#059669` ("↗ 18%"); down = soft `#FCE2E2` + text `#DC2626`
("↘ 17%"); `inverse` flag flips the colours for metrics where up is bad (Overdue ↗ 50% red, Pending ↗ 8% red,
At Risk/Off Track chips amber/red); 0% = neutral grey chip.

**Kanban column tints** (header bg / body bg / title + count colour)

| Board | Column | Header | Body | Accent |
|---|---|---|---|---|
| Leads | New | `#ECF0F8` | `#F7F8FB` | `#0F172A` |
| Leads | Contacted | `#E8F3FC` | `#F5F9FE` | `#2563EB` |
| Leads | Proposal | `#F3EBFC` | `#F8F4FC` | `#7C3AED` |
| Leads | Negotiation | `#FCF1EB` | `#FCF7F3` | `#EA580C` |
| Leads | Won | `#E4F8F0` | `#F3F9F7` | `#047857` |
| Tasks | To Do | `#ECF0F8` | `#F7F8FB` | `#0F172A` (no dot) |
| Tasks | In Progress | `#E4F0FC` | `#F5F9FE` | `#2563EB` (blue dot) |
| Tasks | In Review | `#F0E8FC` | `#F8F4FC` | `#7C3AED` (purple dot) |
| Tasks | Client Review | `#FCF0E8` | `#FCF7F3` | `#EA580C` (orange square) |
| Tasks | Completed | `#DCF8F0` | `#F3F9F7` | `#047857` (green check dot) |

**Chart palettes** (each chart uses the palette of the page it appears on)

| Chart | Series colours |
|---|---|
| Company series | VMH `--vmh-chart`, VTH `--vth-chart`, Total line `#1E293B` with dots |
| VMH Production Board bars (p1) | Editing `#4290FC`, Internal QC `#96BEFC`, Client Review `#C6EAFC`, Revision `#FCB6B6`, Delivered `#4AD0A6` |
| Project type (p8 donut, p13 pie) | Video Editing `#8B5CF6`, Website Development `#3B82F6`, CRM / ERP `#10B981`, Automation (n8n) `#F59E0B`, Design (Thumbnails) `#F26B6B`, Meetings / Others `#B8C0CC` |
| Goals by Category (p10) | Revenue & Sales `#7C3AED`, Client Acquisition `#3B82F6`, Project Delivery `#10B981`, Team & Hiring `#F59E0B`, Process & Automation `#F26B6B`, Learning & Growth `#C0C6D0` |
| Client Segments (p4) | Active `#10B981`, On Hold `#F59E0B`, Completed `#3B82F6`, Inactive `#EF4444` |
| Project Status, dashboard (p2) | Not started `#3B82F6`, In progress `#10B981`, In review `#F5B83D`, On hold `#EF4444`, Delivered `#8FB3E8` |
| Project Status, reports (p13) | Completed `#10B981`, In Progress `#3B82F6`, On Hold `#F5A524`, Not Started `#EF5356` |
| Tasks Overview (p2) | Pending `#3B82F6`, Due today `#F5B83D`, Overdue `#EF4444`, Completed `#1E293B`, Upcoming `#8FB3E8` |
| Active Projects segmented bar (p1) | In progress `#3888FC`, Not started `#9CBCD4`, In review `#ECBC30`, On hold `#F06464`, Delivered `#0E7C66` |
| Goal Progress lines (p10) | All Goals `#1167FB`, VMH Goals `#8B3FF0`, VTH Goals `#10B981` |

**Folder & file-type colours** (p12)

- Category folders (icon / tile bg): Client Files `#308CFC` / `#E6F0FD`; Project Files `#902EFC` / `#F1E6FD`;
  Design Assets `#FC6C78` / `#FDE6E9`; Video Assets `#FC9C0E` / `#FDF0DD`; Documents `#04CC88` / `#DDF7EC`.
- File types: PDF red `#E5484D` doc with "PDF"; FIG Figma multicolour mark; MP4 purple-blue `#5B3FF5` play
  square; PNG/JPG green `#10B981` image square; DOCX blue `#2B6CE6` "W"; XLSX green `#1E9E5A` "X";
  AI `#2B1A0E` square with orange "Ai"; PSD `#001E36` square with blue "Ps"; JSON purple `#6D3FF5`;
  SRT/MP3 purple doc; folder = filled folder in the category colour.

### 1.2 Typography

Font: **Inter** (400 / 500 / 600 / 700). `font-variant-numeric: tabular-nums` on KPI values, table numbers
and durations.

| Role | Size / weight | Colour | Example |
|---|---|---|---|
| Page title | 30 / 700 (dashboard welcome 28 / 700) | text | "Leads", "Welcome back, Durrell! 👋" |
| Page subtitle | 14 / 400 | text-muted | "Track, manage and convert leads…" |
| Master-list title | 24 / 700 | text | "Client Projects", "Projects (VTH)" |
| Detail title | 20 / 700 | text | "YouTube Shorts Editing" |
| Large section title | 18–19 / 700 | text | "Leads Pipeline", "Timesheet" |
| Card title | 15–16 / 600 | text | "Email Campaigns", "Project Status" |
| KPI label | 13 / 500 (+ " (This Month)" in 13 / 400 muted) | text | "Total Leads" |
| KPI value | 22 / 700 (p1 revenue 26 / 700) | text | "32", "₹ 12,45,000" |
| KPI split value / label | 14 / 700 · 11 / 500 muted | | "18" / "VMH" |
| Body | 13 / 400 | text-2 | |
| Card list primary line | 12–13 / 600 | text | "Bright Labs" |
| Secondary line | 11–12 / 400 | text-muted | "brightlabs.co", "2,450 sent", "3 days ago" |
| Table header | 11 / 500 | text-muted | |
| Table cell | 12 / 400 (name column 12 / 600) | text-2 | |
| Nav label | 14 / 500 | sidebar-text | |
| Button | 14 / 600 (small buttons 12–13 / 600) | | "Add Lead" |
| Pill / badge | 11–12 / 500 (badge 11 / 600) | | |
| Link ("View All →") | 12 / 500 | primary | |
| Logo word / tag | 22 / 600 white · 10 / 500, uppercase, letter-spacing 0.14 em | sidebar-muted | "Vertex" / "COMMAND CENTER" |
| Topbar user | name 13 / 600 · role 12 / 400 muted | | "Dhrumil" / "Owner (Super Admin)" |
| **Goals simple view (p11)** uses a larger scale | KPI 34 / 700, KPI label 15 / 400 muted, tabs 15 / 500, row title 15 / 700, row subtitle 14 / 400, table header 14 / 500, pills 14 / 500 | | |

Number formats:
- Currency: `₹12,45,000` via `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })`.
  The PDF shows a narrow gap after ₹ on large KPI values ("₹ 12,45,000"). Use the Intl output as-is.
- Compact axis labels: `₹5L`, `₹10L`, `₹15L`, `₹50K`, `₹1.0L`.
- Durations `186h 30m`, `2h 00m` (minutes always 2 digits); relative times "2 minutes ago", "1 week ago";
  table dates `20 Oct 2026`; short dates `20 Oct`; timestamps `20 Oct, 10:30 AM`; dashboard date card
  `Thursday, 22 October 2026`; ranges `1 Oct 2026 - 31 Oct 2026`; quarter `Oct 2026 - Dec 2026`.

### 1.3 Shape, spacing, elevation

| Item | Value |
|---|---|
| Sidebar width | 216 px (measured 212–220 across pages) |
| Topbar height | 56 px, white, 1 px bottom border `--card-border` |
| Page padding | 16 px left/right; title block starts ~24 px under the topbar |
| Grid gap between cards | 12–14 px (use 14) [brief 16–20] |
| Card | radius 12, 1 px border, padding 16 (KPI 14–16), shadow `0 1px 2px rgb(15 23 42 / .04)` |
| KPI card height | ~120 px (with split footer ~140, dashboard p1 ~186) |
| Primary button | height 38–40, radius 8, padding 0 16, 16 px leading icon, gap 8 |
| Outline button | white, 1 px `#E2E7EE` border, text-2 label |
| Icon button ("…", kebab boxes) | 36–40 square, radius 8, outline |
| Select / input | height 34–36, radius 8, 1 px border; filled variant (search) bg `#F4F6F9` no border |
| Pill | height 20–22, fully rounded, padding 0 8, 6 px dot, gap 6 |
| Company badge | height 18, radius 4, padding 0 6, 11 / 600 |
| Progress bar | 6 px (KPI segmented bar 8 px, p11 goals 10 px), fully rounded, track `--track` |
| Avatar | 36 topbar, 32 lists, 28 tables, 24 kanban/stacks (2 px white ring, −8 px overlap), "+2" overflow chip `--primary-soft` |
| Icon tiles | KPI 48 / r12; card-title tiles 36–40 / r10; list logos 30–36 / r8; detail logo 56 / r12 |
| Filter tabs with counts | height 32, radius 8, padding 0 14, 13 / 500, company/status tinted |
| Underline tabs | 14 / 500; active = primary text + 2 px underline (VTH screens: green text, underline and a soft green tab background) |
| Segmented control | 36–40 tall, active segment filled (primary / VMH / VTH) with white text, radius 8 |
| Docked side panels | Task drawer ~300 px, invoice drawer ~330 px, file preview ~285 px, goal detail ~340 px. **In the PDF these are docked columns that narrow the page, not overlays.** |
| Pagination | 30 px squares, radius 6, outline; active filled primary; "‹ 1 2 3 4 5 … 7 ›" |

### 1.4 Icons

`lucide-react`, ~1.75 stroke. 18 px in the nav, 16 px in buttons, 22 px in KPI tiles.

Nav order and icons: Dashboard `House`, Leads `UserRoundSearch`/`Users`, Clients `Users`, Projects `FolderKanban`,
Tasks `SquareCheckBig`, Time Tracking `Clock`, Invoices `FileText`, Email Campaigns `Mail`, Goals `SquareCheck`/`Target`,
Team `Users`, Files `Files`, Reports `ChartColumn`, Settings `Settings`.

### 1.5 Logo

White two-stroke "V" mark (left stroke white, right stroke light grey, overlapping at the base), ~26 px,
followed by "Vertex" (22 / 600 white) and "COMMAND CENTER" beneath. On invoices: dark navy V mark +
"Vertex" + "TECH HOUSE" / "MEDIA HOUSE". The logo PNGs in `~/Downloads` (red chevron "VERTEX Media House",
concept sheet) do **not** match this mark, so it is recreated as an inline SVG.

---

## 2. App shell (every page)

### 2.1 Sidebar (216 px, `--sidebar-bg`)

- Logo block, top 14 px, left 22 px.
- 13 nav items, pitch ~42 px, item height 40, inset 12 px; active item = `--sidebar-active` pill radius 8,
  white text. Order: Dashboard, Leads, Clients, Projects, Tasks, Time Tracking, Invoices, Email Campaigns,
  Goals, Team, Files, Reports, Settings.
- **Switch Company** card pinned to the bottom (x 16–208, ~150 px tall, `--sidebar-card`, radius 10):
  label "Switch Company" (12 / 400 muted); three 36 px rows:
  - All Companies: blue check-circle icon as its avatar
  - Vertex Media House: small rounded square "VMH" (`--sidebar-vmh-avatar`)
  - Vertex Tech House: small rounded square "VTH" (`--sidebar-vth-avatar`)
  - The active scope's row gets `--sidebar-switch-active` background (p5: VMH row highlighted; p6: VTH row).

### 2.2 Topbar (56 px, white)

Left to right:
1. **Company dropdown** (~172 × 36, outline): building icon (primary/purple tint) + current scope name
   ("All Companies" / "Vertex Media House" / "Vertex Tech House" with its badge) + chevron.
2. **Segmented company pills** (track `--surface-muted`, radius 10): `All` | `[VMH] Vertex Media House` |
   `[VTH] Vertex Tech House`. Selected segment filled: All = primary, VMH = `--vmh`, VTH = `--vth`, white text.
3. Spacer.
4. **Search** (~230 × 36, filled `#F4F6F9`, search icon). Placeholder changes per page:
   Dashboard "Search anything...", Leads "Search leads, clients, projects...", Clients "Search clients, projects, invoices...",
   Projects "Search projects, clients, tasks...", Tasks/Time "Search tasks, projects, clients...",
   Invoices "Search invoices, clients, projects...", Goals "Search goals, team members..." (simple view "Search goals..."),
   Files "Search files, folders, clients...", Reports "Search reports, projects, clients...".
5. **Bell** with red count badge (`3`).
6. **User**: 36 px avatar, name (13 / 600), "Owner (Super Admin)" (12 muted), chevron.

### 2.3 Page header pattern

Title (30 / 700) + subtitle (14 muted) on the left; primary action(s) on the right, top-aligned with the title.

---

## 3. Shared components inventory

| Component | Pages | Variants / notes |
|---|---|---|
| `AppShell`, `Sidebar`, `Topbar`, `CompanySwitcher` (dropdown + pills + sidebar card, one state) | all | Three controls always in sync |
| `PageHeader` | all | title, subtitle, actions slot |
| `KpiCard` | 1, 2, 3, 4, 7, 8, 9, 10, 13 | icon tile colour; label + optional muted suffix; value; trend chip (up/down/inverse/neutral); optional split footer `VMH \| VTH` with divider; slot for custom body (p1 legend lists, segmented bar, inset box) |
| `KpiTile` (simple) | 11 | big icon tile, number, label, no trend |
| `TrendChip` | KPI cards | ↗/↘ + % or absolute delta |
| `CompanyBadge` | everywhere | VMH / VTH / ALL; `size="lg"` 40 px square tile (p1 Cross-Sell) |
| `StatusPill` | everywhere | dot + label, tone from §1.1 table; `withChevron` for inline status dropdowns (p4, p5, p6, p7); `noDot` (p3 Recent Leads stage chips) |
| `PriorityPill` | 5, 6, 7 | High / Medium / Low |
| `ProgressBar` | everywhere | tone (primary / success / warning / danger / vmh / vth), height 6/8/10, optional % label |
| `SegmentedBar` | 1 | multi-colour stacked bar + legend |
| `Avatar`, `AvatarStack` | everywhere | sizes 24/28/32/36/40; overflow "+N" |
| `IconTile` | card titles, lists | colour variants |
| `SectionCard` | everywhere | title, optional icon tile, subtitle, "View All →", right control slot (select "This Month ▾", "Monthly ▾", badge) |
| `DataTable` (TanStack) | 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13 | checkbox column, sortable headers, kebab menu, selected row tint, footer "Showing 1 to 10 of 68 clients" + `Pagination` |
| `MiniTable` | 1, 5, 6, 7 | compact table inside cards, header row on `--surface-muted` |
| `FilterBar` | 4, 7, 8, 9, 10, 11, 12 | search + selects + "Clear" link + right-side buttons (Export) |
| `FilterTabs` | 3, 4, 5, 6, 8, 9, 10 | pill tabs with counts, tinted per company / status |
| `UnderlineTabs` | 5, 6, 7 (drawer), 9 (drawer), 10, 11, 12 (preview), 13 | VTH variant = green |
| `SegmentedControl` | topbar, 7 (List/Kanban/Calendar), 8 (Day/Week/Month) | |
| `Select` / dropdown button | everywhere | outline, chevron |
| `DateRangePicker` | 2, 3, 8, 10, 11, 13 | calendar icon + range text + chevron; presets Today, This Week, This Month, This Quarter, custom; dashboard variant shows "This Month" + range on two lines |
| `SidePanel` (docked drawer) | 7, 9, 10, 12 | header with title + pills + ×; tabs; docked ≥ 1440 px, overlay sheet below |
| `KanbanBoard` / `KanbanColumn` / `KanbanCard` | 3, 7 | tinted columns, header count + total value (leads), "+ Add Task", "+ N more" expander |
| `DonutChart` | 2, 3, 4, 8, 10, 13 | centre value + label, legend with count and/or % |
| `StackedBarChart` | 2 (revenue trend + Total line), 3 (leads by source) | |
| `GroupedBarChart` | 8, 13 | VMH/VTH pairs |
| `SingleBarChart` | 2 (scoped revenue trend) | gradient bars |
| `LineChart` | 10 | end-point value chips |
| `PieChart` | 13 | |
| `HorizontalBarList` | 8 (team hours), 13 (hours by member, top clients) | avatar/logo + label + bar + value |
| `Timeline` (milestone dots) | 5 (4 points), 6 (8 points) | filled = done, ring = current/next, hollow grey = upcoming |
| `Checklist` | 5 (deliverables), 6 (key deliverables), 7 (task checklist), 10 (goal milestones) | counts "8 / 12" or % bars, per-item avatar + kebab |
| `FileRow` / `FileIcon` | 5, 6, 7, 12 | type icon, name, "24 MB • 20 Oct 2026", status pill, download button |
| `ActivityFeed` | 1, 2, 8, 10 | avatar or icon circle, sentence, time, optional company badge |
| `CommentThread` / `NotesList` | 5, 7 | avatar, name, timestamp, text, "Add Comment" |
| `ContactCard` | 5, 6 | avatar, name, title, email/phone/timezone rows, Email/Call/Message buttons, additional contacts |
| `KeyValueGrid` | 5, 6, 7, 9, 10, 12 | label (12 muted) / value rows |
| `InvoiceDocument` | 9 (+ PDF export) | company-branded invoice |
| `EmptyState`, `Skeleton`, `ConfirmDialog`, `Toast` | all (not in PDF) | same visual language |

---

## 4. Screens

Layout widths are approximate px on the 1536 canvas (content area x ≈ 230–1520).

### 4.1 Page 1: Owner Dashboard `/dashboard`

**Header.** "Welcome back, Durrell! 👋" (seed user is Dhrumil) and "Here's what's happening across Vertex Media
House and Vertex Tech House." Right: date card (~250 × 60, white, radius 12): purple calendar icon tile,
"Thursday, 22 October 2026" (13 / 600), "Let's make it count today!" (12 muted).

**Row 1: 4 KPI cards** (~186 px tall; widths ~320 / 313 / 287 / 327)

1. **Total Revenue (This Month)**: green tile; "₹ 12,45,000" (26 / 700); chip "↗ +18%". Footer, two columns:
   "₹ 8,20,000" / "Collected" and "₹ 4,25,000" / "Outstanding" (16 / 600 values, 13 muted labels).
2. **Active Projects**: blue folder tile; "28"; chip "↗ +3". Segmented bar (8 px) + two-column legend:
   "8 Not started", "12 In progress", "4 In review", "2 On hold", "2 Delivered".
3. **Open Tasks**: purple check tile; "54"; no chip. Legend rows (dot, count, label): 12 Pending (blue),
   8 Due today (amber), 6 Overdue (red), 20 Completed this week (navy), 15 Upcoming (blue).
4. **Ongoing Leads**: pink users tile; "32"; chip "↗ +5". Left list with right-aligned counts: New 10 (blue),
   Contacted 8 (blue), Proposal 6 (purple), Negotiation 5 (magenta), Won 3 (green). Right: inset box
   (`--surface-muted`, r10, ~124 × 92): "Pipeline Value" (12 muted) / "₹ 28,50,000" (16 / 700).

**Row 2** (~242 px; widths ~445 / 435 / 380)

- **Email Campaigns**: blue paper-plane tile; subtitle "3 Active Campaigns"; "View All →". Three bordered
  rows (r8): name (13 / 600) + "2,450 sent"; open % (green, 14 / 600) + "open"; reply % (red) + "reply";
  meetings count + "meetings"; company badge.
  - YouTube Growth Outreach · 2,450 sent · 48% · 12% · 6 · VMH
  - Website & CRM Leads · 1,820 sent · 36% · 8% · 4 · VTH
  - Re-Engagement Campaign · 980 sent · 52% · 14% · 8 · ALL
- **Goals Progress**: green target tile; "View All →". Rows: name (13 / 600) + subtitle; bar (~95 px) with
  "₹ 3,60,000 / ₹ 5,00,000" under it; % (13 / 600); badge.
  - VMH - Monthly Revenue · ₹ 5,00,000 · ₹ 3,60,000 / ₹ 5,00,000 · 72% · VMH (blue bar)
  - VTH - New Clients (Monthly) · 10 clients · 6 / 10 · 60% · VTH (blue)
  - Videos Delivered (Weekly) · 20 videos · 17 / 20 · 85% · VMH (green)
  - Projects Shipped (Monthly) · 5 projects · 2 / 5 · 40% · VTH (blue)
- **Team Workload**: orange users tile; "View All →". Rows: avatar 32; name (13 / 600) + "28h this week";
  bar (~108 px); %; chip.
  - Rohan · 28h · 70% green
  - Priya · 34h · 120% red + "Over" chip (red soft)
  - Aman · 16h · 40% amber + "Idle" chip (amber soft)
  - Neha · 22h · 60% green

**Row 3** (~186 px; widths ~475 / 426 / 360)

- **Client Approvals Waiting**: orange clock tile; "View All →". Mini table: Client | Project | Deliverable |
  Waiting Since. Deliverable is an underlined link. Waiting pill: 1 day amber, ≥ 2 days red.
  - Alex Johnson · YouTube Shorts · Video Batch #12 · 2 days
  - Bright Labs · Website Redesign · Homepage Design · 4 days
  - Karan Mehta · Channel Management · Thumbnails · 1 day
  - ScaleUp Co. · CRM Development · Feature Module · 6 days
- **VMH Production Board**: red play tile; "Avg. Turnaround: 28 hours" (13; "28 hours" 600); "On Track" green
  soft badge top-right. Five columns with thin dividers: label (12 muted), count (14 / 700), 6 px bar:
  Editing 12, Internal QC 8, Client Review 6, Revision 4, Delivered 18 (colours §1.1). Footnote with blue info
  dot: "Target: 24–48 hours for Shorts".
- **VTH Delivery Board**: blue `</>` tile; "View All →". Rows (small icon + label + right value):
  Milestones Due This Week 5 (blue calendar), Open Bugs 3 (red), Support Tickets 7 (green headset);
  Retainer Hours Used (purple icon) with "42h / 60h" above a green bar and "70%".

**Row 4** (~192 px; widths ~413 / 400 / 447)

- **Today's Agenda**: blue calendar tile; "View All →". Rows: time (12 muted), event icon (blue; pink for team
  events), title (12), badge.
  - 10:00 AM · Client Call - Bright Labs · VTH
  - 11:30 AM · Project Review - YouTube Batch · VMH
  - 02:00 PM · Follow Up - New Lead (ScaleUp Co.) · VTH
  - 04:00 PM · Team Sync · ALL
- **Recent Activity**: purple pulse tile; "View All →". Rows: avatar or icon circle, sentence (12), time (11 muted),
  badge.
  - Priya uploaded final video for Alex Johnson · 2 minutes ago · VMH
  - Rohan marked task as completed · 15 minutes ago · VTH
  - Payment received from Bright Labs (₹ 1,20,000) · 1 hour ago · VTH (green receipt icon)
  - New lead added: ScaleUp Co. · 2 hours ago · ALL (users icon)
- **Cross-Sell Alerts**: amber bulb tile; "View All →". Rows: 40 px company badge tile, "Alex Johnson (VMH Client)"
  (12 / 600), reason (12 muted), "Create Opportunity" soft-blue button (h 32, r8, 12 / 600).
  - Alex Johnson (VMH Client) · Might need a website or CRM based on recent conversations.
  - Bright Labs (VTH Client) · Might need video content for product launch.

### 4.2 Page 2: Dashboard, analytics layout + scoped variants `/dashboard`

Three mock-ups: a large "All Companies (Combined View)" with the callout "Shows data from both Vertex Media House
and Vertex Tech House", plus smaller "VMH View: Shows only Vertex Media House data" and "VTH View: Shows only
Vertex Tech House data". The callouts are annotations, not UI.

**Header.** "Dashboard" + subtitle "Overview of Vertex Media House and Vertex Tech House" (VMH: "Vertex Media House
(Video Editing)"; VTH: "Vertex Tech House (Web, CRM, ERP, Automation)"). Right: period card (calendar icon, "This
Month" 12 / 600, "1 Oct 2026 - 31 Oct 2026" 11 muted, chevron). This drives every number on the page.

**Combined view**

- **KPI row** (~120 px, 4 cards, split footer): Total Revenue ₹12,45,000 ↗18% (₹8,20,000 VMH | ₹4,25,000 VTH);
  Active Projects 28 ↗3 (16 | 12); Open Tasks 54 ↗12 (32 | 22); Ongoing Leads 32 ↗5 (18 | 14).
- **Row 2** (~180 px; widths ~300 / 230 / 225 / 255):
  - Revenue Trend: "Monthly ▾"; legend ■ VMH ■ VTH —●— Total; stacked bars Jan–Oct (VMH bottom, VTH top), Total
    line with dots; y-axis ₹0 / ₹5L / ₹10L / ₹15L.
  - Project Status: donut, centre "28" / "Total Projects"; legend Not started 8, In progress 12, In review 4,
    On hold 2, Delivered 2.
  - Tasks Overview: donut "54" / "Total Tasks"; Pending 12, Due today 8, Overdue 6, Completed 20, Upcoming 8.
  - Team Workload: "View All →"; Rohan 70%, Priya 120% Over, Aman 40%, Neha 60% (no hours line).
- **Row 3** (~150 px; widths ~385 / 320 / 330):
  - Leads Pipeline: legend ■ VMH ■ VTH; five stage cells with dividers (label 11 muted, count 14 / 700): New 8,
    Contacted 10, Proposal 6, Negotiation 5, Won 3; inset box "Pipeline Value ₹28,50,000".
  - Today's Agenda: 10:00 AM Client Call - Bright Labs VMH; 11:30 AM Project Review - Website Build VTH;
    02:00 PM Follow Up - New Lead ALL; 04:00 PM Team Sync ALL.
  - Recent Activity: same four rows as page 1.

**VMH view** (VMH segment filled; card titles get the suffix " (VMH)"; KPI cards have **no split footer**;
charts single-series purple, bars with a light-to-dark purple gradient)

- KPIs: Total Revenue ₹8,20,000 ↗22%; Active Projects 16 ↗4; Open Tasks 32 ↗8; Ongoing Leads 18 ↗3.
- Revenue Trend (VMH): y ₹0 / ₹5L / ₹10L. Project Status (VMH): 16 Total, Not started 4, In progress 7,
  In review 3, On hold 1, Delivered 1. Tasks (VMH): 32 Total, Pending 8, Due today 6, Overdue 6, Completed 10,
  Upcoming 4.
- Leads Pipeline (VMH): New 6, Contacted 6, Proposal 3, Negotiation 2, Won 1; Pipeline Value ₹18,20,000.
- Team Workload (VMH): Rohan 80%, Priya 110% Over, Aman 60%.
- Today's Agenda (VMH): 10:00 AM Client Call - Alex Johnson; 11:30 AM Project Review - Batch #12;
  02:00 PM Follow Up - New Lead; 04:00 PM Team Sync (all VMH badges).

**VTH view** (VTH segment filled green; single-series green)

- KPIs: Total Revenue ₹4,25,000 ↗12%; Active Projects 12 ↗2; Open Tasks 22 ↗4; Ongoing Leads 14 ↗2.
- Revenue Trend (VTH): y ₹0 / ₹2.5L / ₹5.5L. Project Status (VTH): 12 Total, Not started 4, In progress 5,
  In review 1, On hold 1, "Upcoming" 4 (typo for Delivered). Tasks (VTH): 22 Total, Pending 4, Due today 2,
  Overdue 2, Completed 10, Upcoming 4.
- Leads Pipeline (VTH): New 2, Contacted 4, Proposal 4, Negotiation 3, Won 2; Pipeline Value ₹10,30,000.
- Team Workload (VTH): Neha 60%, Rohan 50%, Aman 30% (amber).
- Today's Agenda (VTH): 10:00 AM Platform Demo - Real Estate CRM; 11:30 AM Project Review - Automation;
  02:00 PM Follow Up - Proposal; 04:00 PM Client Call - Build Timeline.

### 4.3 Page 3: Leads `/leads`

**Header.** "Leads" / "Track, manage and convert leads for Vertex Media House and Vertex Tech House." Primary
"+ Add Lead" (118 × 38).

**KPIs** (5 cards, ~140 px, split footer)

| Card | Tile | Value | Chip | VMH | VTH |
|---|---|---|---|---|---|
| Total Leads | blue users | 32 | ↗ 12% | 18 | 14 |
| Pipeline Value | blue funnel | ₹ 28,50,000 | ↗ 18% | ₹ 16,20,000 | ₹ 12,30,000 |
| New Leads (This Month) | purple calendar | 32 | ↗ 6% | 18 | 14 |
| Won Leads | green handshake | 8 | ↗ 33% | 5 | 3 |
| Conversion Rate | orange clock/gauge | 25% | ↗ 8% | 28% | 21% |

**Leads Pipeline card**

- Title "Leads Pipeline" (19 / 700). Filter tabs: All (32) (active, blue soft), VMH (18) (purple soft),
  VTH (14) (green soft). Right: search "Search leads..." (~206 px), "All Sources ▾", "All Owners ▾",
  "📅 1 Oct 2026 - 31 Oct 2026 ▾".
- 5 equal columns (~235 px, gap 12), tinted (§1.1). Header row 1: stage name (14 / 600, accent colour) +
  count right. Header row 2: a second number left + column total value right (14 / 500).
- Card (white, r8, border, padding 12, ~90 px): name (13 / 600), service (12 muted), value (13 / 700),
  time ago (11 muted, optional); bottom-right company badge + owner avatar (28).
- Footer link "+ 5 more leads" in the column accent colour.

| Column | Header | Visible cards (name · service · value · badge · time) | Footer |
|---|---|---|---|
| New | 8 · "4" · ₹6,40,000 | Bright Labs · YouTube Editing · ₹80,000 · VMH · –; ScaleUp Co. · Website Development · ₹1,50,000 · VTH · 3 days ago; Creative Studio · Video Editing · ₹60,000 · VMH · – | + 5 more leads |
| Contacted | 10 · "10" · ₹8,20,000 | GreenBuild Infra · Custom CRM · ₹2,50,000 · VTH · 1 day ago; Flow Marketing · Short-form Editing · ₹75,000 · VMH · 2 days ago; Urban Living · Website Redesign · ₹1,20,000 · VTH · 3 days ago | + 7 more leads |
| Proposal | 6 · "4" · ₹7,80,000 | Rocco Construction · Website + CRM · ₹3,00,000 · VTH · 2 days ago; Fit Life Media · Monthly Editing · ₹1,20,000 · VMH · 3 days ago; Ashoka Buildcon · Automation System · ₹3,50,000 · VTH · 5 days ago | + 3 more leads |
| Negotiation | 5 · "5" · ₹4,60,000 | Elite Creators · YouTube Channel · ₹1,00,000 · VMH · 1 day ago; Durrell Properties · 2 Websites · ₹2,00,000 · VTH · 2 days ago; NextGen Agency · Video Editing · ₹80,000 · VMH · 4 days ago | + 2 more leads |
| Won | 3 · "8" · ₹4,50,000 | Danny Drywall · Website + Estimator · ₹1,20,000 · VTH · 1 week ago; Bhaumik Podcast · 12 Reels Editing · ₹60,000 · VMH · 1 week ago; Vidhi Enterprise · Custom ERP · ₹2,70,000 · VTH · 2 weeks ago | – |

**Bottom row** (~232 px; widths ~430 / 270 / 535)

- **Leads by Source**: "This Month ▾"; legend ■ VMH ■ VTH; one bar per source with the count on top:
  Fiverr 8, Website 6, Referral 5, LinkedIn 4, Email 4, Instagram 3, Other 2. In the PDF each bar is a single
  colour (purple for Fiverr/Instagram/Other, green for the rest).
- **Leads by Company**: legend ● Vertex Media House ● Vertex Tech House; donut purple/green, centre "32" /
  "Total Leads"; right: "● 18 56%", "● 14 44%".
- **Recent Leads**: "View All →". Mini table Name | Company | Service | Value | Stage | Owner | Date. Stage chips
  without dots.
  - Bright Labs · VMH · YouTube Editing · ₹80,000 · New (grey) · 22 Oct 2026
  - GreenBuild Infra · VTH · Custom CRM · ₹2,50,000 · Contacted (blue) · 21 Oct 2026
  - Rocco Construction · VTH · Website + CRM · ₹3,00,000 · Proposal (purple) · 20 Oct 2026
  - Elite Creators · VMH · YouTube Channel · ₹1,00,000 · Negotiation (orange) · 19 Oct 2026
  - Danny Drywall · VTH · Website + Estimator · ₹1,20,000 · Won (green) · 15 Oct 2026

### 4.4 Page 4: Clients `/clients`

**Header.** "Clients" / "Manage all your clients across Vertex Media House and Vertex Tech House." Primary "+ Add Client".

**KPIs** (5 cards, split footer)

| Card | Tile | Value | Chip | VMH | VTH |
|---|---|---|---|---|---|
| Total Clients | purple users | 68 | ↗ 15% | 38 | 30 |
| Active Clients | green handshake | 54 | ↗ 12% | 32 | 22 |
| On Hold | orange clock | 5 | ↘ 17% (red) | 3 | 2 |
| New Clients (This Month) | blue user-plus | 8 | ↗ 33% | 5 | 3 |
| Total Revenue (Clients) | green dollar | ₹ 28,50,000 | – | ₹ 16,20,000 | ₹ 12,30,000 |

**Main table card** (~985 px)

- Tabs: All Clients (68) (active), VMH Clients (38), VTH Clients (30). Right: search "Search clients...",
  "All Status ▾", "All Tags ▾", "All Owners ▾", outline "⤓ Export".
- Columns: checkbox | Client (30 px logo tile + name 12 / 600 + domain 11 muted) | Company | Type | Status
  (pill + chevron, inline dropdown) | Active Projects "2 / 3" | Total Revenue | Owner (avatar 28 + name) |
  Last Activity | Actions (kebab). Row height ~48.

| Client | Domain | Co. | Type | Status | Active Projects | Revenue | Owner | Last Activity |
|---|---|---|---|---|---|---|---|---|
| Bright Labs | brightlabs.co | VMH | YouTube Editing | Active | 2 / 3 | ₹2,80,000 | Rohan | 2 hours ago |
| GreenBuild Infra | greenbuild.com | VTH | Custom CRM | Active | 1 / 1 | ₹2,50,000 | Priya | 1 day ago |
| Rocco Construction | roccoconstruction.com | VTH | Website + CRM | Active | 3 / 5 | ₹3,00,000 | Aman | 2 days ago |
| Elite Creators | elitecreators.co | VMH | YouTube Channel | Active | 4 / 4 | ₹1,00,000 | Neha | 1 day ago |
| Danny Drywall | dannydrywall.com | VTH | Website + Estimator | Active | 1 / 2 | ₹1,20,000 | Rohan | 3 hours ago |
| ScaleUp Co. | scaleup.co | VTH | Website Development | Active | 2 / 3 | ₹1,50,000 | Priya | 5 days ago |
| Creative Studio | creativestudio.co | VMH | Video Editing | On Hold | 0 / 1 | ₹60,000 | Aman | 1 week ago |
| Flow Marketing | flowmarketing.co | VMH | Short-form Editing | Active | 3 / 4 | ₹75,000 | Neha | 2 days ago |
| Urban Living | urbanliving.com | VTH | Website Redesign | Active | 1 / 2 | ₹1,20,000 | Rohan | 3 days ago |
| Ashoka Buildcon | ashokabuildcon.com | VTH | Automation System | Active | 2 / 4 | ₹3,50,000 | Priya | 4 days ago |

Footer: "Showing 1 to 10 of 68 clients"; pager ‹ 1 2 3 4 5 … 7 ›.
Logos: letter marks on tinted tiles (B blue, G multicolour, R black, F italic, …). Seed generates monograms;
real logos can be uploaded later.

**Right column** (~285 px)

- **Client Segments**: donut "68" / "Clients"; Active 54 79%, On Hold 5 7%, Completed 6 9%, Inactive 3 4%.
- **Top Clients by Revenue** ("View All"): Ashoka Buildcon ₹3,50,000; Rocco Construction ₹3,00,000; Bright Labs
  ₹2,80,000; GreenBuild Infra ₹2,50,000; Vidhi Enterprise ₹2,70,000. (The PDF order is not sorted; we sort by
  revenue, which puts Vidhi above GreenBuild.)
- **Recent New Clients** ("View All"): NextGen Agency · Video Editing · 2 days ago; Durrell Properties · Website ·
  3 days ago; Bhaumik Podcast · Video Editing · 1 week ago; Fit Life Media · Video Editing · 1 week ago.

### 4.5 Page 5: Projects, VMH template `/projects`

Scope VMH: VMH segment filled purple, VMH row highlighted in the sidebar card.

**Left master list** (x 212–622)

- "Client Projects" (24 / 700) / "Manage and track all client projects". Primary "+ New Project" (**blue** on VMH).
- Filter tabs: All (28) (active), Active (18), In Review (4), Completed (6), "…" overflow. Search
  "Search projects..." + filter icon button.
- Item (~76 px, r10, border; selected = `--primary-soft` bg + 2 px primary left border): 36 px logo; client name
  (13 / 600); project name (12 muted); VMH badge; status pill (top-right); progress bar (~150 px) + %; avatar stack.

| Client | Project | Status | Progress |
|---|---|---|---|
| Bright Labs (selected) | YouTube Shorts Editing | In Progress | 70% (+2 avatars) |
| Elite Creators | Monthly Video Editing | Client Review | 85% |
| Flow Marketing | Instagram Reels Editing | Editing | 45% |
| Creative Studio | YouTube Channel Management | In Progress | 60% |
| Bhaumik Podcast | Podcast Editing | Revision | 90% |
| ScaleUp Co. | Thumbnails Design | Completed | 100% |
| Fit Life Media | Short-form Editing | In Progress | 55% |
| Neha Personal Brand | Reels Editing | On Hold | 30% |
| Urban Living | YouTube Long-form | Not Started | 0% |
| Trend Talk | Shorts + Thumbnails | In Progress | 65% |

Footer "Showing 1 to 10 of 28 projects", pager ‹ 1 2 3 ›.

**Right detail**

- Breadcrumb "Projects › Bright Labs › YouTube Shorts Editing" (12 muted). Right: outline "✎ Edit Project" + "…".
- Header: 56 px logo tile; "YouTube Shorts Editing" (20 / 700) + VMH badge; "Bright Labs ↗" (primary link);
  "Editing 12 Shorts per month with thumbnails and captions" (13 muted). Right: status select "● In Progress ▾"
  (~128 × 26), progress bar (~160 px) + "70%", "Start Date 1 Oct 2026" | "Due Date 25 Oct 2026 (4 days left)" (red).
- Underline tabs: **Overview**, Tasks, Files, Client Access, Time Tracking, Invoices, Notes (icon), Activity (icon).

Overview row A (~325 px; widths ~300 / 340 / 245):
- **Project Details** ("Edit"): Client [B] Bright Labs; Company [VMH] Vertex Media House (VMH); Project Type
  Short-form Video Editing; Start Date 1 Oct 2026; Due Date 25 Oct 2026 (4 days left) red; Status In Progress pill;
  Priority ● High; Project Value ₹80,000 (bold); Billing Type Monthly Retainer; Team Members avatar stack + "+" button.
- **Project Description** ("Edit"): "Edit 12 YouTube Shorts per month with engaging captions, transitions, sound
  effects and branded thumbnails. Maintain consistent style and fast turnaround (24–48 hours)."
  **Deliverables** (checked blue boxes, "8 / 12" + bar): 12 Edited YouTube Shorts (Monthly); 12 Thumbnails;
  Captions & Subtitles; Background Music & SFX; Final Files (1080x1920), all 8 / 12.
- **Client Contact** ("View Client →"): avatar 40, Rohan Mehta, Founder, Bright Labs; rohan@brightlabs.co;
  +1 415 555 0192; PST (USA); outline buttons Email / Call / Message. **Additional Contacts**: Priya Shah ·
  Marketing Manager · priya@brightlabs.co; Aman Verma · Content Lead · aman@brightlabs.co.

Row B (~228 px):
- **Tasks (8/12 completed)** ("View All"): Task | Assignee | Due Date | Status, with a status circle (filled green when
  done): Edit Short #1 · 20 Oct · Completed; Edit Short #2 · 21 Oct · Completed; Edit Short #3 · 22 Oct · In Review
  (orange); Edit Short #4 · 23 Oct · Editing (blue); Edit Short #5 · 24 Oct · Pending (grey).
- **Recent Files** ("View All"): Short_01_Final.mp4 · 24 MB • 20 Oct 2026 · Final; Short_02_Review.mp4 · 22 MB •
  21 Oct 2026 · Review; Thumbnail_01.jpg · 3 MB • 20 Oct 2026 · Final; Captions_Short_01.srt · 120 KB • 20 Oct 2026 ·
  Final; Style Guide.pdf · 2 MB • 18 Oct 2026 · –. Download icon button per row.
- **Client Approvals** ("View All"): 36 px thumbnail, item, sub-line, pill: Short #1 · Approved on 20 Oct · Approved;
  Short #2 · Changes requested on 21 Oct · Revision; Thumbnail #1 · Approved on 19 Oct · Approved; Short #3 ·
  Pending approval · Pending.

Row C (~150 px):
- **Project Timeline** ("View All"): purple line, 4 points: 1 Oct Project Started ●, 5 Oct First Drafts ●,
  15 Oct Client Review ●, 25 Oct Final Delivery ○.
- **Invoices** ("View All"): Invoice | Amount | Status | Due Date: #VMH-001 · ₹40,000 · Paid · 1 Oct 2026;
  #VMH-002 · ₹40,000 · Pending · 1 Nov 2026; soft button "+ Create Invoice".
- **Notes** ("View All"): Rohan · 21 Oct, 10:30 AM · "Looks great! Can we make the caption bold?"; Priya · 21 Oct,
  11:15 AM · "Sure, updating in next version."; Dhrumil · 20 Oct, 6:45 PM · "Client approved Short #1. Moving to Short #2."

### 4.6 Page 6: Projects, VTH template `/projects`

Scope VTH: topbar dropdown shows "[VTH] Vertex Tech House", VTH segment filled green, VTH row highlighted in the
sidebar card. **Accent colour becomes green**: "+ New Project" button, active filter tab, selected item border, active
underline tab (green text + green underline + soft green background), client link.

**Left master list**: "Projects (VTH)" / "Manage all website, CRM, ERP and automation projects". Tabs All (12),
Active (8), In Review (2), Completed (2), "…". Items have **no company badge**; status pill at top-right; progress bars
stay blue.

| Client | Project | Status | Progress |
|---|---|---|---|
| GreenBuild Infra (selected) | Custom CRM Development | In Progress | 70% (+2) |
| Rocco Construction | Website + CRM | In Review (orange) | 85% |
| Ashoka Buildcon | Website Redesign | Development (purple) | 60% |
| Vidhi Enterprise | Custom ERP System | Planning (lavender) | 20% |
| NextGen Agency | AI Automation (n8n) | In Progress | 55% |
| Durrell Properties | Property Management CRM | Completed | 100% |
| Elite Creators | Automation + Dashboard | Development | 45% |
| ScaleUp Co. | Website Development | On Hold | 30% |
| Flow Marketing | Client Portal + CRM | Planning | 10% |
| Urban Living | Real Estate Dashboard | Planning | – |

Footer "Showing 1 to 10 of 12 projects", pager ‹ 1 2 ›.

**Right detail**

- Breadcrumb "Projects › GreenBuild Infra › Custom CRM Development". Title "Custom CRM Development" + VTH badge;
  "GreenBuild Infra ↗" (green); "Custom CRM with lead management, project tracking and automation". Status
  "● In Progress ▾", 70%, Start 1 Sep 2026, Due 30 Oct 2026 (4 days left) red.
- Tabs: **Overview**, Tasks, **Milestones**, Files, Client Access, Time Tracking, Invoices, Notes, Activity.

Row A:
- **Project Details**: Client [G] GreenBuild Infra; Company [VTH] Vertex Tech House; Project Type Custom CRM
  Development; Start 1 Sep 2026; Due 30 Oct 2026 (4 days left) red; Status In Progress; Priority High; Project Value
  ₹2,50,000; Billing Type Fixed Scope; Team Members.
- **Project Description**: "Custom CRM system for GreenBuild Infra to manage leads, clients, projects and automation
  workflows. Includes role-based access, reporting dashboard and integrations with email and contact forms."
  **Key Deliverables** (checkbox, %, bar; green ≥ 60%, blue below, unchecked at 0%): CRM Module (Leads, Clients,
  Projects) 100%; User Roles & Permissions 100%; Email & Form Integrations 80%; Reporting Dashboard 60%;
  n8n Automation Workflows 40%; Testing & Deployment 0%; Training & Handover 0%.
- **Client Contact**: Raj Mehta · Director, GreenBuild Infra · raj@greenbuildinfra.com (green) · +1 415 555 0187 ·
  California, USA; Email / Call / Message. Additional Contacts ("View All →"): Pooja Shah · Project Manager ·
  pooja@greenbuildinfra.com; Karan Patel · Technical Lead · karan@greenbuildinfra.com.

Row B:
- **Milestones (4/7 completed)** ("View All"): numbered, status circle (green check = done, blue check = in progress,
  hollow = pending), date, pill: 1. Requirement Gathering · 5 Sep · Completed; 2. UI/UX Design Approval · 12 Sep ·
  Completed; 3. Core CRM Development · 28 Sep · Completed; 4. Integration Setup · 10 Oct · Progress; 5. Testing & QA ·
  20 Oct · Pending; 6. Client Review · 25 Oct · Pending; 7. Final Deployment · 30 Oct · Pending.
- **Tasks (12 total)**: Design CRM Dashboard · 12 Oct · Completed; Build Lead Module · 15 Oct · Completed;
  Setup Email Integration · 18 Oct · Progress; Develop Reports · 20 Oct · Progress; QA Testing · 25 Oct · Pending.
- **Recent Files** (download + kebab per row): CRM_Requirements.pdf · 2.4 MB · 1 Sep 2026; UI_Designs.fig · 12 MB ·
  5 Sep 2026; Database_Structure.xlsx · 1.1 MB · 8 Sep 2026; API_Integration_Docs.pdf · 3.2 MB · 12 Sep 2026;
  Testing_Report.pdf · 1.8 MB · 20 Oct 2026.

Row C:
- **Project Timeline**, 8 phases: 1 Sep Start ●, 5 Sep Requirements ●, 12 Sep Design ●, 28 Sep Development ● (green),
  10 Oct Integration ● (blue = current), 20 Oct Testing ◎ (blue ring), 25 Oct Review ○, 30 Oct Deployment ○ (grey).
  The line is green through completed phases, blue to the current one, grey after.
- **Time Tracking** ("View All →"): Total Hours 42h 30m | Billable Hours 38h 15m | Non-Billable 4h 15m; green bar 85%.

### 4.7 Page 7: Tasks `/tasks`

**Header.** "Tasks" / "Plan, assign and track all tasks across Vertex Media House and Vertex Tech House." Right:
primary "+ Add Task"; segmented List | **Kanban** | Calendar (icons); outline "Filters"; "…".

**KPIs** (5, split footer): Total Tasks 54 ↗12% (32 | 22) blue users; Pending 12 ↗8% red/inverse (8 | 4) purple
clock; Due Today 8 ↗33% (5 | 3) orange calendar; Overdue 6 ↗50% red/inverse (4 | 2) red triangle; Completed (This
Week) 20 ↗25% (12 | 8) green check.

**Filter bar**: search "Search tasks..." (~210 px), All Companies ▾, All Projects ▾, All Assignees ▾, All Priority ▾,
All Status ▾, "Clear".

**Kanban** (5 columns ~190 px, gap 10): header = dot/icon + name (13 / 600) + count chip + "+"; "+ Add Task" link at
the top of each column. Card (white, r8, padding 10): title (12 / 600) + company badge; client (11 muted); priority
pill + due chip "📅 20 Oct" (11 muted); progress bar + %; assignee avatar 24 bottom-right.

| Column (count) | Visible cards (title · client · co. · priority · due/progress) | Footer |
|---|---|---|
| To Do (12) | Edit Podcast Episode #12 · Bhaumik Podcast · VMH · High · 20 Oct; Create Thumbnail Options · Elite Creators · VMH · Medium · 21 Oct; Website Homepage Design · Rocco Construction · VTH · High · 20 Oct; CRM Module - User Roles · GreenBuild Infra · VTH · Medium · 22 Oct; Prepare Client Presentation · NextGen Agency · VTH · Low · 24 Oct | + 7 more tasks |
| In Progress (18) | Edit YouTube Short #1 · Bright Labs · VMH · High · 70%; Client Revisions - Video 2 · Elite Creators · VMH · Medium · 50%; CRM Lead Module · GreenBuild Infra · VTH · High · 60%; Landing Page Development · ScaleUp Co. · VTH · Medium · 40%; Automation Workflow (n8n) · Ashoka Buildcon · VTH · High · 65% | + 13 more tasks |
| In Review (8) | Thumbnail Review · Creative Studio · VMH · Medium · 90%; Website UI Design · Vidhi Enterprise · VTH · High · 80%; API Integration Testing · NextGen Agency · VTH · Medium · 70%; Final Video QC · Neha Personal Brand · VMH · High · 90% | + 4 more tasks |
| Client Review (10) | Short #3 for Approval · Bright Labs · VMH · High · 100%; Website Design Approval · Rocco Construction · VTH · Medium · 100%; CRM Dashboard Review · GreenBuild Infra · VTH · High · 100%; Podcast Episode Final · Bhaumik Podcast · VMH · Medium · 100% | + 6 more tasks |
| Completed (20) | Short #2 Delivered · Bright Labs · VMH · High · 100%; Thumbnail Set Delivered · Elite Creators · VMH · Medium · 100%; Homepage Design Live · ScaleUp Co. · VTH · High · 100%; Lead Module Completed · GreenBuild Infra · VTH · Medium · 100%; Podcast Episode #11 · Bhaumik Podcast · VMH · Medium | + 15 more tasks |

**Bottom row** (~165 px; widths ~485 / 490)
- **My Tasks** ("View All"): Task | Project | Due Date | Priority | Status: Edit YouTube Short #1 · Bright Labs · 20 Oct ·
  High · In Progress; Website UI Design · Vidhi Enterprise · 21 Oct · High · In Review; CRM Lead Module · GreenBuild
  Infra · 22 Oct · Medium · In Progress; Podcast Episode Final · Bhaumik Podcast · 22 Oct · Medium · Client Review;
  API Integration Testing · NextGen Agency · 24 Oct · Medium · In Review.
- **Team Workload** ("View All"): Team Member | Assigned | Completed | In Progress | Overdue (red when > 0) | Workload
  bar + %: Rohan 12 · 8 · 4 · 1 · 75%; Priya 10 · 6 · 4 · 0 · 60%; Aman 8 · 5 · 2 · 1 · 50%; Neha 14 · 10 · 3 · 1 ·
  80%; Dhruv 6 · 4 · 1 · 1 · 40%.

**Task drawer** (docked right, ~300 px)
- "Edit YouTube Short #1" (17 / 700) + ×. Row: VMH badge, status select "● In Progress ▾", "● High".
- Key/values: Project "Bright Labs - YouTube Editing ↗"; Client "Bright Labs ↗"; Start Date 18 Oct 2026; Due Date
  "20 Oct 2026 (2 days left)" red; Assignee select [avatar] Rohan ▾; Tags: Editing (purple soft), Shorts, YouTube,
  "+".
- Tabs: **Details** | Files (3) | Time (2h 30m) | Activity.
- **Description** ("Edit"): "Edit 1 YouTube Short (30–60 seconds) with captions, transitions, background music and
  brand elements as per the brief. Maintain fast pace and engaging style."
- **Checklist (3/5)** ("+ Add Item"), per-item avatar + kebab: ☑ Rough-cut editing (struck through); ☑ Add captions;
  ☑ Add background music; ☐ Add brand elements (logo, lower third); ☐ Export final file (1080x1920).
- **Files (3)** ("+ Upload"): Short_RoughCut.mp4 · 45 MB • 18 Oct 2026; Brand_Logo.png · 2 MB • 18 Oct 2026;
  Music_Track.mp3 · 5 MB • 18 Oct 2026 (download buttons).
- **Comments (4)** ("Add Comment"): Priya · 18 Oct, 11:30 AM · "Looks good! Can we make the captions bold?";
  Rohan · 18 Oct, 12:15 PM · "Updated the captions. Please check the new version."

### 4.8 Page 8: Time Tracking `/time`

**Header.** "Time Tracking" / "Track team hours across all projects and clients for Vertex Media House and Vertex Tech
House." Right: "📅 1 Oct 2026 - 31 Oct 2026 ▾"; segmented Day | **Week** | Month; outline "Filters".

**KPIs** (4, ~230 px each, split footer): Total Hours 186h 30m ↗12% (108h 20m | 78h 10m) purple clock; Billable Hours
152h 15m ↗18% (92h 40m | 59h 35m) blue play-circle; Non-Billable Hours 34h 15m ↘8% red (15h 40m | 18h 35m) orange
pause; Active Team Members 4 ↗0% grey (4 | 4) blue users.

**Start Timer panel** (right, x 1190–1517, ~290 px): primary blue header (44 px, r12 top) with play icon "Start Timer"
(15 / 600 white) and a lighter "▷ Manual Entry" button. Body: "Select Project" + select "Choose a project...";
"Select Task (Optional)" + select "Choose a task..."; textarea "Add a note (what are you working on?)" (~62 px);
full-width primary "▷ Start Tracking" (36 px).

**Charts row** (~215 px)
- **Hours Overview** (~535 px): legend "● VMH (108h 20m) ● VTH (78h 10m)" + chevron; grouped bars per day,
  Mon 12 Oct … Sun 18 Oct; y 0h / 10h / 20h / 30h.
- **Hours by Project Type** (~395 px): "This Week ▾"; donut centre "186h 30m" / "Total"; Video Editing 32%,
  Website Development 24%, CRM / ERP 18%, Automation (n8n) 12%, Design (Thumbnails) 8%, Meetings 6%.

**Timesheet** (~945 px): title + outline "⤓ Export"; tabs All (active) / VMH / VTH; search "Search team members,
projects, tasks..."; All Team Members ▾; All Projects ▾; All Status ▾. Columns: checkbox | Date | Team Member (avatar +
name) | Project (client 12 / 600 + project 11 muted) | Task | Company | Start Time | End Time | Duration | Billable
(toggle) | Status | Actions.

| Date | Member | Client / Project | Task | Co. | Start | End | Dur. | Billable | Status |
|---|---|---|---|---|---|---|---|---|---|
| 20 Oct 2026 | Rohan | Bright Labs / YouTube Editing | Edit Short #1 | VMH | 10:00 AM | 11:30 AM | 1h 30m | on | Approved |
| 20 Oct 2026 | Priya | GreenBuild Infra / Custom CRM | UI Design - Dashboard | VTH | 11:45 AM | 1:15 PM | 1h 30m | on | Approved |
| 20 Oct 2026 | Aman | Elite Creators / Video Editing | Add Captions | VMH | 2:00 PM | 4:00 PM | 2h 00m | on | Approved |
| 20 Oct 2026 | Neha | NextGen Agency / Automation (n8n) | Workflow Setup | VTH | 4:15 PM | 6:00 PM | 1h 45m | on | Approved |
| 19 Oct 2026 | Dhruv | ScaleUp Co. / Thumbnail Design | Thumbnail Options | VMH | 11:00 AM | 12:30 PM | 1h 30m | on | Approved |
| 19 Oct 2026 | Rohan | VTH Internal / System Setup | Figma Design | VTH | 1:00 PM | 3:30 PM | 2h 30m | off | Non-Billable |
| 19 Oct 2026 | Priya | Bhaumik Podcast / Podcast Editing | Episode Edit | VMH | 4:00 PM | 6:00 PM | 2h 00m | on | Approved |
| 18 Oct 2026 | Aman | Ashoka Buildcon / Website + CRM | Client Meeting | VTH | 3:00 PM | 4:00 PM | 1h 00m | off | Non-Billable |

(Rows 5 and 7 show project above client in the PDF; we always show client first. "VTH Internal" = internal project
with no client.)

**Right column**
- **Team Hours (This Week)** ("View All"): avatar, name, hours, primary bar, %: Rohan 42h 30m 85%; Priya 36h 15m 72%;
  Aman 28h 10m 56%; Neha 32h 45m 65%; Dhruv 18h 20m 37%.
- **Recent Time Entries** ("View All"): name (11 muted), task (12 / 600), client (11 muted); right: duration (13 / 700)
  + timestamp: Rohan · Edit Short #1 · Bright Labs · 1h 30m · 20 Oct, 10:00 AM; Priya · UI Design - Dashboard ·
  GreenBuild Infra · 1h 30m · 20 Oct, 11:45 AM; Aman · Add Captions · Elite Creators · 2h 00m · 20 Oct, 2:00 PM;
  Neha · Workflow Setup · NextGen Agency · 1h 45m · 20 Oct, 4:15 PM.
- **Time Log Activity** ("View All"): icon circle (green ▶ started, red ■ stopped, blue ✎ edited, grey note), sentence,
  detail line, timestamp: "Rohan started tracking time" · Edit Short #1 — Bright Labs · 20 Oct, 10:00 AM; "Priya
  stopped tracking time" · UI Design — GreenBuild Infra · 20 Oct, 1:15 PM; "Aman edited time entry" · Episode Edit —
  Bhaumik Podcast · 19 Oct, 6:00 PM; "Neha added a note" · "Completed workflow setup and tested." · 19 Oct, 5:45 PM.

### 4.9 Page 9: Invoices `/invoices`

**Header.** "Invoices" / "Create, manage and track all invoices across Vertex Media House and Vertex Tech House."
Right: primary "+ Create Invoice", outline "⤓ Export", "…".

**KPIs** (4, ~230 px each, split footer): Total Invoices 42 ↗18% (24 | 18) purple users; Total Amount ₹18,60,000 ↗22%
(₹8,40,000 | ₹10,20,000) green dollar; Paid Amount ₹12,30,000 ↗28% (₹5,60,000 | ₹6,70,000) blue; Outstanding Amount
₹6,30,000 ↘12% red (₹2,80,000 | ₹3,50,000) orange clock.

**Status tabs**: All Invoices (42) (blue soft, active), Paid (28) (green soft), Pending (8) (purple soft), Overdue (4)
(red soft), Draft (2) (grey), Cancelled (0) (white/grey).

**Filters**: search "Search invoices..." (~280 px), All Companies ▾, All Status ▾, All Clients ▾, All Projects ▾, Clear.

**Table**: checkbox | Invoice # | Client (logo + name 12 / 600) | Company | Project | Issue Date | Due Date | Amount |
Status | Payment Progress (bar ~80 px + %; green at 100%, blue otherwise) | Actions. Selected row = `#EAF4FC`.

| Invoice # | Client | Co. | Project | Issue | Due | Amount | Status | Paid |
|---|---|---|---|---|---|---|---|---|
| #VMH-021 | Bright Labs | VMH | YouTube Editing | 20 Oct 2026 | 27 Oct 2026 | ₹40,000 | Paid | 100% |
| #VTH-019 (selected) | GreenBuild Infra | VTH | Custom CRM | 18 Oct 2026 | 2 Nov 2026 | ₹2,50,000 | Pending | 40% |
| #VMH-020 | Elite Creators | VMH | Monthly Editing | 15 Oct 2026 | 22 Oct 2026 | ₹25,000 | Paid | 100% |
| #VTH-018 | Rocco Construction | VTH | Website + CRM | 12 Oct 2026 | 26 Oct 2026 | ₹3,00,000 | Overdue | 20% |
| #VMH-019 | Bhaumik Podcast | VMH | Podcast Editing | 10 Oct 2026 | 20 Oct 2026 | ₹18,000 | Paid | 100% |
| #VTH-017 | ScaleUp Co. | VTH | Website Development | 8 Oct 2026 | 25 Oct 2026 | ₹1,50,000 | Pending | 60% |
| #VMH-018 | Fit Life Media | VMH | Short-form Editing | 5 Oct 2026 | 15 Oct 2026 | ₹22,000 | Paid | 100% |
| #VTH-016 | NextGen Agency | VTH | Automation (n8n) | 3 Oct 2026 | 20 Oct 2026 | ₹1,20,000 | Pending | 50% |
| #VMH-017 | Flow Marketing | VMH | Reels Editing | 1 Oct 2026 | 10 Oct 2026 | ₹30,000 | Paid | 100% |
| #VTH-015 | Ashoka Buildcon | VTH | Automation System | 28 Sep 2026 | 15 Oct 2026 | ₹3,50,000 | Pending | 30% |

Footer "Showing 1 to 10 of 42 invoices", pager ‹ 1 2 3 4 5 … ›.

**Invoice drawer** (docked right, ~330 px)
- "Invoice #VTH-019" (17 / 700) + "● Pending" (orange) + ×. Tabs: **Overview** | Payments | Files (3) | Notes (5) | Activity.
- Client block: 40 px logo, "GreenBuild Infra" (13 / 600), "greenbuild.com", "View Client →".
- Key/values: Project "Custom CRM Development ↗"; Company "[VTH] Vertex Tech House (VTH)"; Issue Date 18 Oct 2026;
  Due Date "2 Nov 2026 (15 days left)" red; Amount ₹2,50,000; Paid Amount ₹1,00,000; Outstanding ₹1,50,000;
  progress bar + "40%".
- Buttons: primary "✈ Send Reminder", outline "▭ Record Payment", "…".

**Invoice Preview** card: "Invoice Preview" (14 / 700), outline "⤓ Download", expand icon button. Paper (white, r8,
border, faint blue wave at the bottom):
- Top-left: navy V mark + "Vertex" + "TECH HOUSE". Top-right: "#VTH-019" (bold), "Issue Date: 18 Oct 2026",
  "Due Date: 2 Nov 2026".
- "INVOICE" (20 / 700). "Bill To" / "GreenBuild Infra" / "123 Business Park, Ahmedabad, Gujarat, India".
  "Project" / "Custom CRM Development".
- Line items (header on `--surface-muted`): # | Description | Qty | Rate | Amount: 1 · CRM Development · 1 · ₹1,80,000 ·
  ₹1,80,000; 2 · Email Integration · 1 · ₹40,000 · ₹40,000; 3 · Training & Handover · 1 · ₹30,000 · ₹30,000.
- Subtotal ₹2,50,000; Tax (0%) ₹0; **Total ₹2,50,000** (top rule).
- "Notes": "Thank you for your business. Payment is due by 2 Nov 2026."

### 4.10 Page 10: Goals, detailed `/goals`

**Header.** "Goals" / "Set, track, and achieve goals across Vertex Media House and Vertex Tech House." Right:
"📅 Oct 2026 - Dec 2026 ▾", primary "+ Create Goal". Underline tabs: **Overview** | Company Goals | Team Goals |
Personal Goals; right: outline "✎ Edit Goal", "…".

**KPIs** (4, split footer): Total Goals 18 ↗28% (10 | 8) green target; On Track 12 ↗67% (7 | 5) blue line-chart;
At Risk 4 ↗22% amber (2 | 2) orange clock; Off Track 2 ↗11% red (1 | 1) red alert-circle.

**Charts row** (~240 px)
- **Goal Progress Overview** (~580 px): "This Quarter ▾"; legend All Goals / VMH Goals / VTH Goals (line + dot); y 0% /
  25% / 50% / 75% / 100%; x Oct 2026, Nov 2026, Dec 2026; end chips 78% (All, blue filled), 65% (VTH, green soft),
  58% (VMH, purple soft). Approximate points: All 22 → 52 → 78; VTH 15 → 47 → 65; VMH 8 → 40 → 58.
- **Goals by Category** (~330 px): donut "18" / "Goals"; Revenue & Sales 28%, Client Acquisition 22%, Project Delivery
  17%, Team & Hiring 11%, Process & Automation 11%, Learning & Growth 11%.

**Goals table**: tabs All Goals (18) / VMH Goals (10) / VTH Goals (8); All Categories ▾; All Status ▾; All Owners ▾;
search "Search goals...". Columns: checkbox | Goal Title (coloured 16 px icon + title 12 / 600) | Company | Category
(icon + text) | Start Date | End Date | Progress (bar ~80 + %) | Status | Owner (avatar) | Actions.

| Goal | Co. | Category | Start | End | Progress | Status |
|---|---|---|---|---|---|---|
| Monthly Revenue Goal | VTH | Revenue & Sales | 1 Oct 2026 | 31 Oct 2026 | 75% | On Track |
| Acquire 5 New Clients | VMH | Client Acquisition | 1 Oct 2026 | 31 Oct 2026 | 60% | On Track |
| Complete 20 Projects | VMH | Project Delivery | 1 Oct 2026 | 31 Oct 2026 | 80% | On Track |
| Launch CRM Module | VTH | Product Development | 1 Oct 2026 | 15 Nov 2026 | 40% | At Risk |
| Hire 2 New Editors | VMH | Team & Hiring | 1 Oct 2026 | 31 Oct 2026 | 50% | At Risk |
| Automate 3 Workflows | VTH | Process & Automation | 1 Oct 2026 | 31 Oct 2026 | 20% | Off Track |
| Complete Website Redesign | VTH | Project Delivery | 1 Oct 2026 | 31 Oct 2026 | 90% | On Track |
| Create 12 YouTube Shorts | VMH | Content Creation | 1 Oct 2026 | 31 Oct 2026 | 100% | Completed |
| Improve Client Satisfaction | All | Client Success | 1 Oct 2026 | 31 Dec 2026 | 55% | On Track |
| Team Training (AI Tools) | All | Learning & Growth | 1 Oct 2026 | 31 Oct 2026 | 35% | At Risk |

**Right column** (~340 px)
- **Goal detail**: "Monthly Revenue Goal - VTH" (15 / 700) + "● On Track"; "Increase monthly revenue for Vertex Tech
  House"; bar + "75%"; Current ₹1,87,500 | Target ₹2,50,000 (16 / 700); Company [VTH] Vertex Tech House; Category
  Revenue & Sales; Start Date 1 Oct 2026; End Date 31 Oct 2026; Owner [avatar] Dhrumil; Team Members stack +2;
  Description "Increase monthly revenue by 25% through new website, CRM and automation projects."
- **Milestones (3/4 completed)** ("+ Add Milestone"): ✓ Launch website & landing page · 1 Oct; ✓ Get 3 new client
  proposals · 15 Oct; ✓ Reach ₹1,50,000 revenue · 25 Oct; ○ Reach ₹2,50,000 revenue · 31 Oct.
- **Recent Activity** ("View All"): Rohan updated progress to 75% · 2 hours ago; Priya marked milestone as completed ·
  5 hours ago; Aman added a new comment · 18 Oct, 10:30 AM; Neha changed status to On Track · 17 Oct, 4:15 PM.

### 4.11 Page 11: Goals, simple `/goals?view=simple`

Larger type scale (§1.2). **Header.** "Goals" / "Set, track and achieve your important goals." Primary "+ Add Goal"
(~134 × 46). Underline tabs (15 / 500): **My Goals** | Team Goals | Company Goals.

**KPI tiles** (4, ~108 px, 70 px icon tiles, no trend, no split): 5 Total Goals (green target); 3 On Track (blue
chart); 1 At Risk (orange clock); 1 Overdue (red triangle).

**Filters**: wide filled search "Search goals..." (~560 px), All Status ▾, All Companies ▾, "📅 Oct 2026 - Dec 2026".

**Table** (row ~96 px): checkbox | Goal (52 px icon tile + title 15 / 700 + subtitle 14 muted) | Owner (avatar 32 +
name 14) | Due Date | Progress (bar 170 × 10 + % 15 / 600) | Status (14 / 500 pill) | 36 px bordered kebab.

| Goal | Subtitle | Owner | Due | Progress | Status | Icon |
|---|---|---|---|---|---|---|
| Generate ₹10,00,000 Revenue | Total revenue across all services | Dhrumil | 31 Oct 2026 | 70% (green bar) | On Track | green bar-chart |
| Get 10 New Clients | New clients for both companies | 3 avatars +2 | 31 Oct 2026 | 60% | On Track | purple users |
| Complete 5 Active Projects | Deliver and go live | Rohan | 31 Oct 2026 | 40% | At Risk | orange document |
| Publish 20 YouTube Videos | For Vertex Media House | Priya | 20 Oct 2026 | 30% (red bar) | Overdue | red YouTube |
| Learn n8n Automation | Complete basic to advanced course | Aman | 31 Oct 2026 | 80% | On Track | blue graduation cap |

### 4.12 Page 12: Files `/files`

**Header.** "Files" / "Store, organize and access all your files across clients and projects." Right: primary
"+ Upload File", outline "+ New Folder", "…".

**Category cards** (5, ~82 px; 48 px folder tile + title 14 / 700 + "12 folders · 248 files" 13 muted): Client Files
(blue) 12 folders · 248 files; Project Files (purple) 18 folders · 320 files; Design Assets (coral) 8 folders · 156
files; Video Assets (amber) 6 folders · 210 files; Documents (green) 10 folders · 96 files.

**Folders panel** (~225 px): "Folders" (17 / 700) + search icon. Quick links (icon + label 13): **All Files** (active,
blue soft), Recent, Starred (amber star), Shared with Me, Trash. Divider. Tree with chevrons:
- Clients (expanded): Bright Labs (purple), GreenBuild Infra (pink), Elite Creators (pink), Rocco Construction (amber),
  ScaleUp Co. (amber), "+ 8 more clients" (primary link).
- Projects (expanded): Website Development (purple), CRM Development (blue), Video Editing, Automation (n8n),
  "+ 6 more projects".
- Design Assets (orange), Video Assets (amber), Documents (green), Team Resources (slate), collapsed.

**Main list** (~750 px): filled search "Search files and folders..." (~345 px); grid/list toggle (list active, filled
primary); filters All Types ▾, All Companies ▾, All Clients ▾, All Projects ▾; sort "Last Modified ▾" + direction
icon + density icon. Columns: checkbox | Name (26 px type icon + name 13 / 500) | Type | Size | Last Modified | Shared
With (22 px stack, +2) | Actions. Rows ~41 px.

| Name | Type | Size | Modified |
|---|---|---|---|
| Client Files | Folder | — | 20 Oct 2026 |
| Project Files | Folder | — | 18 Oct 2026 |
| Design Assets | Folder | — | 15 Oct 2026 |
| Video Assets | Folder | — | 12 Oct 2026 |
| Documents (green folder) | Folder | — | 10 Oct 2026 |
| Project Brief - Bright Labs.pdf (selected) | PDF | 2.4 MB | 20 Oct 2026 |
| Website Design Figma.fig | FIG | 5.1 MB | 19 Oct 2026 |
| Intro Video Final.mp4 | MP4 | 48.3 MB | 18 Oct 2026 |
| CRM Flow Diagram.png | PNG | 1.2 MB | 17 Oct 2026 |
| Client Meeting Notes.docx | DOCX | 850 KB | 16 Oct 2026 |
| Invoice Template.xlsx | XLSX | 320 KB | 15 Oct 2026 |
| Logo - GreenBuild.ai | AI | 6.8 MB | 14 Oct 2026 |
| Thumbnail Design.psd | PSD | 12.4 MB | 13 Oct 2026 |
| Automation Workflow.json | JSON | 48 KB | 12 Oct 2026 |

**Preview panel** (docked right, ~285 px): "Project Brief - Bright Labs.pdf" (14 / 700) + ×; preview area (grey, r10,
~215 px) with a white page showing a red PDF icon, "Project Brief" (15 / 700), "Bright Labs", pink wave. Then name
(14 / 700) + "2.4 MB · PDF"; primary "⤓ Download", outline "⇪ Share", "…". Tabs: **Details** | Version History |
Activity. Key/values: Location "Clients › Bright Labs" (links); Uploaded by [avatar] Dhrumil; Uploaded on 20 Oct 2026,
10:30 AM; Last modified 20 Oct 2026, 10:30 AM; Shared with stack +2; Tags Brief, Client, Website (blue soft) + "+";
Description (grey box) "Initial project brief and requirements shared by Bright Labs for website redesign."

### 4.13 Page 13: Reports `/reports`

**Header.** "Reports" / "Get a clear overview of your business performance across all projects and clients." Right:
"📅 1 Oct 2026 - 31 Oct 2026 ▾", outline "⤓ Export Report". Underline tabs: **Overview** | Projects | Team |
Financial | Clients.

**KPIs** (5, split footer): Total Projects 18 ↗28% (10 | 8) blue folder; Total Hours 186h 30m ↗12% (108h 20m | 78h 10m)
purple clock; Total Revenue ₹4,80,000 ↗22% (₹2,80,000 | ₹2,00,000) green dollar; Invoices Sent 12 ↗33% (7 | 5) orange
document; Active Clients 14 ↗17% (8 | 6) red/pink users.

**Row 2** (~215 px; widths ~445 / 385 / 405)
- **Revenue Overview**: "This Month ▾"; legend ■ VMH ■ VTH; grouped bars Week 1 (1 - 7 Oct), Week 2 (8 - 14 Oct),
  Week 3 (15 - 21 Oct), Week 4 (22 - 31 Oct); y 0 / ₹50K / ₹1.0L / ₹1.5L / ₹2.0L.
- **Project Status**: donut "18" / "Projects"; Completed 8 (44%), In Progress 6 (33%), On Hold 2 (11%), Not Started
  2 (11%).
- **Hours by Team Member**: avatar + name + primary bar (~210 px) + hours: Rohan 42h 30m; Priya 36h 15m; Aman 28h 10m;
  Neha 32h 45m; Dhruv 18h 20m.

**Row 3** (~195 px; widths ~410 / 420 / 410)
- **Top Clients by Revenue** ("This Month ▾"): logo + name + bar + value: Bright Labs ₹1,20,000; GreenBuild Infra
  ₹80,000; Elite Creators ₹60,000; Rocco Construction ₹40,000; NextGen Agency ₹30,000.
- **Project Type** pie ("This Month ▾"): Video Editing 32%, Website Development 24%, CRM / ERP 18%, Automation (n8n)
  12%, Design (Thumbnails) 8%, Others 6%.
- **Monthly Hours** ("This Month ▾"): grouped bars per week (same weeks), y 0h / 10h / 20h / 30h.

**Row 4** (~235 px)
- **Recent Projects Report** (~1010 px, "View All"): [icon] Project Name | Client | Company | Start Date | End Date |
  Revenue | Hours | Status:
  - YouTube Editing · Bright Labs · VMH · 1 Oct 2026 · 31 Oct 2026 · ₹40,000 · 42h 30m · Completed
  - Custom CRM Development · GreenBuild Infra · VTH · 1 Oct 2026 · 15 Nov 2026 · ₹1,50,000 · 36h 15m · In Progress
  - Podcast Editing · Bhaumik Podcast · VMH · 10 Oct 2026 · 31 Oct 2026 · ₹18,000 · 28h 10m · Completed
  - Website + CRM · Rocco Construction · VTH · 12 Oct 2026 · 26 Oct 2026 · ₹3,00,000 · 32h 45m · On Hold
  - Workflow Setup (n8n) · NextGen Agency · VTH · 15 Oct 2026 · 5 Nov 2026 · ₹1,20,000 · 18h 20m · In Progress
- **Quick Insights** (~250 px): bulb icon title; 4 bordered rows with icon circles: green ↑ "Revenue increased by 22%
  compared to last month."; blue users "3 new clients added this month."; purple clock "Team productivity up by 18%
  (186h this month)."; amber trophy "8 projects completed this month."

### 4.14 Screens not in the PDF (same visual language)

Email Campaigns, Team, Settings, Auth (login / forgot / reset / accept invite), Client Portal, Calendar. Build them
from the shared components above: page header + KPI row + `SectionCard`s + `DataTable`. Auth pages use a split layout:
`--sidebar-bg` brand panel with the logo on the left, white form card on the right. The portal uses the topbar and
cards without the sidebar, branded with the company colour.

---

## 5. Where the PDF contradicts itself, and how we resolve it

All numbers on screen are computed from the database (brief §0.5), so values that contradict each other **cannot all
be reproduced**. The seed targets the numbers that are most visible and internally consistent; everything else is
derived. Exact seed targets get written down in `docs/decisions.md` in Phase 2.

| # | Where | Conflict | Resolution |
|---|---|---|---|
| 1 | p2 vs p5 | VMH-scoped pill is filled **blue** on p2, **purple** on p5 | Purple (p5 + brief); VTH is green on both |
| 2 | p1 vs p2 | Two different dashboard layouts (owner command center vs analytics) | **Open question for the owner** (see plan) |
| 3 | p1 vs p2 | Page 1 topbar has the company dropdown + pills; p2 has pills only, labelled "All Companies" | Page 1 topbar everywhere |
| 4 | p1 vs p3 | Lead stage counts: p1 New 10 / Contacted 8; p2, p3 New 8 / Contacted 10 | Page 3 (brief) |
| 5 | p3 | Column values sum to ₹27,00,000 open (₹31,50,000 with Won), KPI says ₹28,50,000; Proposal header ₹7,80,000 leaves ₹10,000 for its 3 hidden leads | Seed open stages to total ₹28,50,000 by raising the 3 hidden Proposal leads (Proposal header becomes ~₹9,30,000); visible cards unchanged |
| 6 | p3 | Won column has 3 leads; Won Leads KPI says 8 and conversion 25% (= 8 / 32) | Seed the board (3 Won). Conversion rate is computed and will differ unless we seed Lost leads (see decisions) |
| 7 | p3 | Each column header shows a second number on row 2 (4, 10, 4, 5, 8) that matches nothing | Row 2 shows the column total value only; the count stays top-right |
| 8 | p3 | "Leads by Source" draws one single-colour bar per source; brief asks for VMH/VTH grouped bars | Stacked VMH + VTH bar per source with the total on top: same height and label as the PDF, but accurate |
| 9 | p2 vs p3 | Pipeline split ₹18,20,000 / ₹10,30,000 (p2) vs ₹16,20,000 / ₹12,30,000 (p3) | Page 3 |
| 10 | p7 | Kanban columns sum to 68 tasks; Total Tasks KPI 54; dashboard "Open Tasks 54" vs 48 open on the board | Seed the board (it is self-consistent: visible cards + "N more" = header counts); KPIs computed |
| 11 | p5, p6, p7, p9 | "(4 days left)" / "(2 days left)" / "(15 days left)" don't match today = 22 Oct | Computed from today |
| 12 | p6 | "Milestones (4/7 completed)" but only 3 are marked Completed | Computed (shows 3/7) |
| 13 | p9 | Statuses don't match dates (VTH-018 "Overdue" but due 26 Oct; VTH-016 and VTH-015 past due but "Pending") | Status computed by the overdue job: VTH-016 and VTH-015 become Overdue, VTH-018 becomes Pending, unless the seed shifts due dates to keep the PDF look (decide in Phase 2) |
| 14 | p9 vs p5 | Bright Labs invoices are #VMH-021 (p9) and #VMH-001 / #VMH-002 (p5 project card) | Page 9 numbering; the project card lists whatever invoices are linked |
| 15 | p1 vs p13 | Revenue this month ₹12,45,000 (p1) vs ₹4,80,000 (p13), same period | Expected per brief: different metric definitions (dashboard = invoiced, reports = collected); both computed |
| 16 | p1, p8, p13 | Workload denominators: dashboard implies 40 h/week (28 h = 70%), Time page implies 50 h (42h 30m = 85%) | Single per-user capacity, default 40 h; Time page % will differ |
| 17 | p8 | "Team Hours (This Week)" sums to 158 h, total is 186h 30m; chart shows 12–18 Oct, but this week is 19–25 Oct | Computed for the selected period |
| 18 | p2, p13 | Project Status donut colours differ between pages | Each chart uses its own page's palette (§1.1) |
| 19 | p7 | Checklist: only the first done item is struck through | Strike through every done item |
| 20 | p7 vs p1 | Workload bar colours on p7 (80% red, 50% green, 40% amber) don't follow p1's rule | One rule everywhere: > 100% red + "Over", < 50% amber + "Idle", else green |
| 21 | p10, p11 | Progress bar colours vary without a clear rule | Primary blue by default; green at 100% / Completed; red when Overdue / Off Track |
| 22 | p10 | Table categories include Product Development, Content Creation, Client Success, which the donut lacks | Category enum includes all nine; the donut shows whichever categories have goals |
| 23 | p1 vs others | Trend chip "↗ +18%" (with sign) on p1; "↗ 18%" elsewhere | No sign (majority) |
| 24 | p11 | "My Goals" lists goals owned by Rohan, Priya, Aman | My Goals = goals I own **or** am a member of |
| 25 | p4 | Top Clients by Revenue list isn't sorted | Sorted by revenue |
| 26 | p5 / p6 | p6 shows the "All" pill filled blue at the same time as VTH | Only the active scope's pill is filled |
| 27 | p2 VTH | Project Status legend says "Upcoming" instead of "Delivered" | "Delivered" |

---

## 6. States not shown in the PDF

- **Hover**: rows and list items `#F8FAFC`; buttons darken ~6%; links underline.
- **Focus**: 2 px ring `--primary` at 40% opacity, 2 px offset (VTH scope: green).
- **Loading**: skeleton blocks matching each card's layout (grey `#EEF2F6` with shimmer).
- **Empty**: centred 40 px icon tile, one-line title, muted hint, primary CTA ("Add your first lead").
- **Error**: inline card message with retry; toasts for mutations (success green, error red).
- **Responsive**: sidebar collapses to icons < 1280 px and becomes a drawer < 768 px; docked side panels become overlay
  sheets < 1440 px; KPI rows wrap to 2–3 columns; tables scroll horizontally inside their card.
