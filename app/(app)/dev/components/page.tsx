import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Banknote, CircleCheck, FolderOpen, Lightbulb, ListChecks, Users } from "lucide-react";
import { KpiCard, KpiTile } from "@/components/shared/kpi-card";
import { CompanyBadge, EnumPill, PriorityPill, StatusPill, Chip } from "@/components/shared/pills";
import { Avatar, AvatarStack, Card, Inset, ProgressBar, SectionCard, SegmentedBar, TrendChip } from "@/components/shared/primitives";
import { ActivityRow, CheckRow, FileIcon, FileRow, MeterRow, Timeline } from "@/components/shared/display";
import { CardSkeleton, EmptyState, KeyValue, KpiSkeleton, PageHeader, SidePanel } from "@/components/shared/layout";
import { FilterTabs, Pagination, SegmentedControl, UnderlineTabs } from "@/components/shared/nav";
import { ClearFilters, DateRangePicker, FilterSelect, SearchInput } from "@/components/shared/filters";
import { Button } from "@/components/ui/button";
import { GOAL_STATUS, INVOICE_STATUS, LEAD_STAGE, PROJECT_STATUS, TASK_STATUS } from "@/lib/status";
import { ChartSamples, KanbanSample, TableSample } from "./client-samples";

// Component gallery for visual review (design-spec §3). Not available in production.
export default function ComponentsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const team = ["Rohan", "Priya", "Aman", "Neha", "Dhruv"].map((name) => ({ name }));
  return (
    <div className="space-y-6">
      <PageHeader title="Components" subtitle="Shared building blocks, rendered with sample data." actions={<Button className="h-10 px-4 text-md font-semibold">+ Primary action</Button>} />

      <Section title="KPI cards">
        <div className="grid grid-cols-4 gap-3.5">
          <KpiCard icon={Users} tone="blue" label="Total Leads" value="32" trend={12} split={[{ value: 18, label: "VMH" }, { value: 14, label: "VTH" }]} />
          <KpiCard icon={Banknote} tone="green" label="Total Revenue" suffix="(This Month)" value="₹12,45,000" trend={18} size="lg" split={[{ value: "₹8,20,000", label: "Collected" }, { value: "₹4,25,000", label: "Outstanding" }]} />
          <KpiCard icon={CircleCheck} tone="red" label="Overdue" value="6" trend={50} inverse split={[{ value: 4, label: "VMH" }, { value: 2, label: "VTH" }]} />
          <KpiCard icon={FolderOpen} tone="orange" label="On Hold" value="5" trend={-17} split={[{ value: 3, label: "VMH" }, { value: 2, label: "VTH" }]} />
        </div>
        <div className="mt-3.5 grid grid-cols-4 gap-3.5">
          <KpiTile icon={ListChecks} tone="green" value={5} label="Total Goals" />
          <KpiSkeleton />
          <CardSkeleton />
          <Card className="p-4">
            <EmptyState title="No leads yet" hint="Add your first lead to start the pipeline." action={<Button size="sm">Add Lead</Button>} className="py-2" />
          </Card>
        </div>
      </Section>

      <Section title="Badges, pills, chips">
        <div className="flex flex-wrap items-center gap-2">
          <CompanyBadge code="VMH" /> <CompanyBadge code="VTH" /> <CompanyBadge code="ALL" /> <CompanyBadge code="VMH" size="lg" /> <CompanyBadge code="VTH" size="lg" />
          {Object.keys(PROJECT_STATUS).map((s) => <EnumPill key={s} map={PROJECT_STATUS} value={s} />)}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {Object.keys(TASK_STATUS).map((s) => <EnumPill key={s} map={TASK_STATUS} value={s} size="xs" />)}
          {Object.keys(LEAD_STAGE).map((s) => <EnumPill key={s} map={LEAD_STAGE} value={s} dot={false} />)}
          {Object.keys(INVOICE_STATUS).map((s) => <EnumPill key={s} map={INVOICE_STATUS} value={s} />)}
          {Object.keys(GOAL_STATUS).map((s) => <EnumPill key={s} map={GOAL_STATUS} value={s} size="md" />)}
          <PriorityPill priority="HIGH" /> <PriorityPill priority="MEDIUM" /> <PriorityPill priority="LOW" />
          <StatusPill label="In Progress" tone="info" chevron />
          <Chip tone="danger">Over</Chip> <Chip tone="warning">Idle</Chip>
          <TrendChip value={18} /> <TrendChip value={-17} /> <TrendChip value={50} inverse /> <TrendChip value={0} /> <TrendChip value={3} unit="" />
        </div>
      </Section>

      <Section title="Progress, avatars">
        <div className="grid grid-cols-3 gap-6">
          <div className="space-y-3">
            <ProgressBar value={70} /> <ProgressBar value={120} tone="danger" /> <ProgressBar value={40} tone="warning" /> <ProgressBar value={60} tone="success" height={10} />
            <SegmentedBar segments={[{ label: "In progress", value: 12, color: "#3888FC" }, { label: "Not started", value: 8, color: "#9CBCD4" }, { label: "In review", value: 4, color: "#ECBC30" }, { label: "On hold", value: 2, color: "#F06464" }]} />
          </div>
          <div className="flex items-center gap-3">
            <Avatar person={{ name: "Dhrumil" }} size={36} /> <Avatar person={{ name: "Rohan Mehta" }} /> <AvatarStack people={team} />
          </div>
          <div>
            <MeterRow label="12 Edited YouTube Shorts (Monthly)" value={66} display="8 / 12" />
            <MeterRow label="Email & Form Integrations" value={80} display="80%" tone="success" />
          </div>
        </div>
      </Section>

      <Section title="Navigation & filters">
        <Suspense>
          <div className="space-y-4">
            <FilterTabs param="co" active="all" tabs={[{ value: "all", label: "All", count: 32, tone: "blue" }, { value: "vmh", label: "VMH", count: 18, tone: "vmh" }, { value: "vth", label: "VTH", count: 14, tone: "vth" }]} />
            <UnderlineTabs active="overview" tabs={[{ value: "overview", label: "Overview" }, { value: "tasks", label: "Tasks" }, { value: "files", label: "Files" }]} />
            <div className="flex flex-wrap items-center gap-3">
              <SegmentedControl param="view" active="week" options={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }]} />
              <SearchInput placeholder="Search leads..." className="w-52" />
              <FilterSelect param="source" placeholder="All Sources" options={[{ value: "FIVERR", label: "Fiverr" }, { value: "WEBSITE", label: "Website" }]} />
              <DateRangePicker from="2026-10-01" to="2026-10-31" preset="month" />
              <DateRangePicker from="2026-10-01" to="2026-10-31" preset="month" variant="card" />
              <ClearFilters params={["q", "source"]} />
            </div>
            <Pagination page={1} pageSize={10} total={68} noun="clients" />
          </div>
        </Suspense>
      </Section>

      <Section title="Data table">
        <Suspense>
          <TableSample />
        </Suspense>
      </Section>

      <Section title="Kanban (drag cards)">
        <KanbanSample />
      </Section>

      <Section title="Charts">
        <ChartSamples />
      </Section>

      <div className="grid grid-cols-3 gap-4">
        <SectionCard title="Project Timeline" icon={Lightbulb} tone="purple" href="#">
          <Timeline points={[{ label: "Project Started", date: "1 Oct", state: "done" }, { label: "First Drafts", date: "5 Oct", state: "done" }, { label: "Client Review", date: "15 Oct", state: "done" }, { label: "Final Delivery", date: "25 Oct", state: "todo" }]} doneColor="var(--vmh)" />
        </SectionCard>
        <SectionCard title="Checklist (3/5)">
          <CheckRow done strike label="Rough-cut editing" person={{ name: "Rohan" }} />
          <CheckRow done strike label="Add captions" person={{ name: "Priya" }} />
          <CheckRow done={false} label="Export final file (1080x1920)" person={{ name: "Aman" }} />
          <CheckRow done round label="Launch website & landing page" right={<span className="text-2xs text-ink-muted">1 Oct</span>} />
        </SectionCard>
        <SectionCard title="Recent Files" href="#">
          <FileRow name="Short_01_Final.mp4" ext="MP4" size={24 * 1024 * 1024} date={new Date("2026-10-20")} status={<StatusPill label="Final" tone="success" dot={false} />} href="#" />
          <div className="mt-2 flex flex-wrap gap-2">
            {["PDF", "FIG", "MP4", "PNG", "DOCX", "XLSX", "AI", "PSD", "JSON", "SRT", "MP3", "FOLDER"].map((e) => <FileIcon key={e} ext={e} />)}
          </div>
        </SectionCard>
        <SectionCard title="Recent Activity" href="#">
          <ActivityRow person={{ name: "Priya" }} text="Priya uploaded final video for Alex Johnson" time="2 minutes ago" right={<CompanyBadge code="VMH" />} />
          <ActivityRow icon={Banknote} iconClass="bg-success-soft text-success-text" text="Payment received from Bright Labs (₹ 1,20,000)" time="1 hour ago" right={<CompanyBadge code="VTH" />} />
        </SectionCard>
        <SectionCard title="Project Details" href="#">
          <KeyValue rows={[["Client", "Bright Labs"], ["Project Type", "Short-form Video Editing"], ["Due Date", <span key="d" className="text-danger-text">25 Oct 2026 (3 days left)</span>], ["Status", <EnumPill key="s" map={PROJECT_STATUS} value="IN_PROGRESS" />]]} />
        </SectionCard>
        <SidePanel title="Invoice #VTH-019" closeHref="#" header={<EnumPill map={INVOICE_STATUS} value="PENDING" />}>
          <Inset className="p-3 text-xs text-ink-2">Docked side panel body.</Inset>
        </SidePanel>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-xl font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}
