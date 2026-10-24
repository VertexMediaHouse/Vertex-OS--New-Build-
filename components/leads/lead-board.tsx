"use client";

import Link from "next/link";
import { KanbanBoard, KanbanCard, type KanbanColumn } from "@/components/shared/kanban";
import { CompanyBadge, type CompanyBadgeCode } from "@/components/shared/pills";
import { Avatar } from "@/components/shared/primitives";
import { useHrefWith } from "@/components/shared/nav";
import { formatINR } from "@/lib/format";
import { moveLead } from "@/app/(app)/leads/actions";

export type BoardLead = { id: string; name: string; service: string; value: number; co: CompanyBadgeCode; owner: string | null; ago: string | null };

const COLUMNS: (Omit<KanbanColumn, "meta"> & { more: string })[] = [
  { id: "NEW", title: "New", headerClass: "bg-[#ECF0F8]", bodyClass: "bg-[#F7F8FB]", accentClass: "text-ink", more: "text-blue" },
  { id: "CONTACTED", title: "Contacted", headerClass: "bg-[#E8F3FC]", bodyClass: "bg-[#F5F9FE]", accentClass: "text-info-text", more: "text-blue" },
  { id: "PROPOSAL", title: "Proposal", headerClass: "bg-[#F3EBFC]", bodyClass: "bg-[#F8F4FC]", accentClass: "text-review-text", more: "text-review-text" },
  { id: "NEGOTIATION", title: "Negotiation", headerClass: "bg-[#FCF1EB]", bodyClass: "bg-[#FCF7F3]", accentClass: "text-warning-text", more: "text-warning-text" },
  { id: "WON", title: "Won", headerClass: "bg-[#E4F8F0]", bodyClass: "bg-[#F3F9F7]", accentClass: "text-success-text", more: "text-success-text" },
  { id: "LOST", title: "Lost", headerClass: "bg-[#FCE6E8]", bodyClass: "bg-[#FDF5F6]", accentClass: "text-danger-text", more: "text-danger-text" },
];

export function LeadBoard({ items, showLost }: { items: Record<string, BoardLead[]>; showLost: boolean }) {
  const hrefWith = useHrefWith();
  const total = (id: string) => (items[id] ?? []).reduce((a, l) => a + l.value, 0);
  const columns = COLUMNS.filter((c) => showLost || c.id !== "LOST").map((c) => ({
    ...c,
    meta: () => <p className={`text-right text-md font-medium ${c.accentClass}`}>{formatINR(total(c.id))}</p>,
  }));
  return (
    <KanbanBoard
      columns={columns}
      items={items}
      onMove={moveLead}
      limit={3}
      moreLabel={(n) => `+ ${n} more leads`}
      renderCard={(l) => (
        <KanbanCard className="relative">
          <Link href={hrefWith({ id: l.id })} scroll={false} className="absolute inset-0 rounded-lg" aria-label={`Open ${l.name}`} />
          <p className="text-sm font-semibold text-ink">{l.name}</p>
          <p className="text-xs text-ink-muted">{l.service}</p>
          <div className="mt-2 flex items-end justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-ink tabular">{formatINR(l.value)}</p>
              {l.ago && <p className="mt-0.5 text-2xs text-ink-muted">{l.ago}</p>}
            </div>
            <span className="flex items-center gap-2">
              <CompanyBadge code={l.co} />
              {l.owner && <Avatar person={{ name: l.owner }} size={28} />}
            </span>
          </div>
        </KanbanCard>
      )}
    />
  );
}
