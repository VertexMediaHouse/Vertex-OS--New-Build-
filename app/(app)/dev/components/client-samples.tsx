"use client";

import { KanbanBoard, KanbanCard } from "@/components/shared/kanban";
import { DataTable, columnsFor } from "@/components/shared/data-table";
import { BarsChart, ChartLegend, DonutChart, DonutLegend, LinesChart, PieChart } from "@/components/shared/charts";
import { CompanyBadge, StatusPill } from "@/components/shared/pills";
import { Avatar } from "@/components/shared/primitives";
import { COMPANY_COLORS, GOAL_LINE_COLORS, PROJECT_STATUS_COLORS, WORK_CATEGORY_COLORS, WORK_CATEGORY_LABELS } from "@/lib/chart-colors";
import { formatINR } from "@/lib/format";

type Lead = { id: string; name: string; service: string; value: number; co: "VMH" | "VTH"; owner: string };

const leads: Record<string, Lead[]> = {
  NEW: [
    { id: "1", name: "Bright Labs", service: "YouTube Editing", value: 80000, co: "VMH", owner: "Rohan" },
    { id: "2", name: "ScaleUp Co.", service: "Website Development", value: 150000, co: "VTH", owner: "Priya" },
  ],
  CONTACTED: [{ id: "3", name: "GreenBuild Infra", service: "Custom CRM", value: 250000, co: "VTH", owner: "Priya" }],
  WON: [],
};

export function KanbanSample() {
  return (
    <KanbanBoard
      columns={[
        { id: "NEW", title: "New", headerClass: "bg-[#ECF0F8]", bodyClass: "bg-[#F7F8FB]", accentClass: "text-ink" },
        { id: "CONTACTED", title: "Contacted", headerClass: "bg-[#E8F3FC]", bodyClass: "bg-[#F5F9FE]", accentClass: "text-info-text" },
        { id: "WON", title: "Won", headerClass: "bg-[#E4F8F0]", bodyClass: "bg-[#F3F9F7]", accentClass: "text-success-text" },
      ]}
      items={leads}
      limit={2}
      onMove={async () => {
        await new Promise((r) => setTimeout(r, 300));
      }}
      renderCard={(l) => (
        <KanbanCard>
          <p className="text-sm font-semibold text-ink">{l.name}</p>
          <p className="text-xs text-ink-muted">{l.service}</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm font-bold text-ink">{formatINR(l.value)}</span>
            <span className="flex items-center gap-2">
              <CompanyBadge code={l.co} />
              <Avatar person={{ name: l.owner }} size={26} />
            </span>
          </div>
        </KanbanCard>
      )}
    />
  );
}

type Row = { id: string; name: string; co: "VMH" | "VTH"; status: string; revenue: number };
const rows: Row[] = [
  { id: "a", name: "Bright Labs", co: "VMH", status: "Active", revenue: 280000 },
  { id: "b", name: "GreenBuild Infra", co: "VTH", status: "Active", revenue: 250000 },
  { id: "c", name: "Creative Studio", co: "VMH", status: "On Hold", revenue: 60000 },
];
const col = columnsFor<Row>();
const columns = col.columns([
  col.accessor("name", { header: "Client", cell: (c) => <span className="font-semibold text-ink">{c.getValue()}</span> }),
  col.accessor("co", { header: "Company", cell: (c) => <CompanyBadge code={c.getValue()} /> }),
  col.accessor("status", { header: "Status", cell: (c) => <StatusPill label={c.getValue()} tone={c.getValue() === "Active" ? "success" : "warning"} chevron /> }),
  col.accessor("revenue", { header: "Total Revenue", cell: (c) => formatINR(c.getValue()) }),
]);

export function TableSample() {
  return <DataTable rows={rows} columns={columns} selectable sortable={["revenue"]} bulkActions={() => <button className="font-medium underline">Archive</button>} activeId="b" />;
}

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"];
const revenue = months.map((m, i) => ({ month: m, VMH: 200000 + i * 40000, VTH: 150000 + ((i * 37) % 5) * 60000, total: 350000 + i * 40000 + ((i * 37) % 5) * 60000 }));

export function ChartSamples() {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div>
        <ChartLegend items={[{ label: "VMH", color: COMPANY_COLORS.VMH }, { label: "VTH", color: COMPANY_COLORS.VTH }, { label: "Total", color: COMPANY_COLORS.TOTAL, line: true }]} />
        <BarsChart data={revenue} xKey="month" stacked series={[{ key: "VMH", label: "VMH", color: COMPANY_COLORS.VMH }, { key: "VTH", label: "VTH", color: COMPANY_COLORS.VTH }]} line={{ key: "total", label: "Total", color: COMPANY_COLORS.TOTAL }} yFormat="inrCompact" tooltipFormat="inr" />
      </div>
      <div className="flex items-center gap-4">
        <DonutChart
          center="28"
          centerLabel="Total Projects"
          data={[
            { label: "Not started", value: 8, color: PROJECT_STATUS_COLORS.notStarted },
            { label: "In progress", value: 12, color: PROJECT_STATUS_COLORS.inProgress },
            { label: "In review", value: 4, color: PROJECT_STATUS_COLORS.inReview },
            { label: "On hold", value: 2, color: PROJECT_STATUS_COLORS.onHold },
            { label: "Delivered", value: 2, color: PROJECT_STATUS_COLORS.delivered },
          ]}
        />
        <DonutLegend items={[{ label: "Not started", value: 8, color: PROJECT_STATUS_COLORS.notStarted }, { label: "In progress", value: 12, color: PROJECT_STATUS_COLORS.inProgress }]} />
      </div>
      <div className="flex items-center gap-4">
        <PieChart data={Object.entries({ VIDEO_EDITING: 32, WEBSITE_DEVELOPMENT: 24, CRM_ERP: 18, AUTOMATION: 12, DESIGN: 8, OTHER: 6 }).map(([k, v]) => ({ label: WORK_CATEGORY_LABELS[k]!, value: v, color: WORK_CATEGORY_COLORS[k]! }))} format="percent" />
      </div>
      <div>
        <BarsChart
          data={["Mon", "Tue", "Wed"].map((d, i) => ({ day: d, VMH: 20 - i * 3, VTH: 15 - i }))}
          xKey="day"
          series={[{ key: "VMH", label: "VMH", color: COMPANY_COLORS.VMH }, { key: "VTH", label: "VTH", color: COMPANY_COLORS.VTH }]}
          xTickLines={{ Mon: "12 Oct", Tue: "13 Oct", Wed: "14 Oct" }}
          yFormat="hours"
        />
      </div>
      <div className="col-span-2">
        <LinesChart
          data={[{ m: "Oct 2026", ALL: 22, VMH: 8, VTH: 15 }, { m: "Nov 2026", ALL: 52, VMH: 40, VTH: 47 }, { m: "Dec 2026", ALL: 78, VMH: 58, VTH: 65 }]}
          xKey="m"
          series={[{ key: "ALL", label: "All Goals", color: GOAL_LINE_COLORS.ALL }, { key: "VMH", label: "VMH Goals", color: GOAL_LINE_COLORS.VMH }, { key: "VTH", label: "VTH Goals", color: GOAL_LINE_COLORS.VTH }]}
          yFormat="percent"
        />
      </div>
    </div>
  );
}
