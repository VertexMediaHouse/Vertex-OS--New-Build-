"use client";

import { useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "@/components/ui/link";
import { MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { DataTable, columnsFor } from "@/components/shared/data-table";
import { CompanyBadges, StatusPill } from "@/components/shared/pills";
import { Avatar } from "@/components/shared/primitives";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CLIENT_STATUS } from "@/lib/status";
import { formatINR } from "@/lib/format";
import { api, call } from "@/web/api";
import { toast as notify } from "sonner";

const setClientStatus = (ids: string[], status: string) => call(api.api.clients.status.$post({ json: { ids, status } }));
const archiveClients = (ids: string[], restore = false) => call(api.api.clients.archive.$post({ json: { ids, restore } }));
const deleteClient = (clientId: string) => call(api.api.clients.delete.$post({ json: { clientId } }));

export type ClientRow = {
  id: string; name: string; domain: string | null; companies: ("VMH" | "VTH")[]; type: string | null; status: string;
  activeProjects: number; totalProjects: number; revenue: number; owner: string | null; lastActivity: string; logoColor: string;
};

/** One place to refresh the list after a mutation (was refresh() in the server action). */
function useRefreshClients() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["clients"] });
}

function StatusMenu({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const refresh = useRefreshClients();
  const meta = CLIENT_STATUS[status]!;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger disabled={pending} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/40" aria-label={`Status: ${meta.label}. Change`}>
        <StatusPill label={meta.label} tone={meta.tone} chevron />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {Object.entries(CLIENT_STATUS).map(([k, v]) => (
          <DropdownMenuItem key={k} onSelect={() => start(async () => { await setClientStatus([id], k); toast.success(`Status set to ${v.label}.`); await refresh(); })}>
            <StatusPill label={v.label} tone={v.tone} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const col = columnsFor<ClientRow>();
const columns = col.columns([
  col.accessor("name", {
    header: "Client",
    cell: (c) => {
      const r = c.row.original;
      return (
        <Link href={`/clients/${r.id}`} className="flex items-center gap-2.5">
          <span className="inline-flex size-[30px] shrink-0 items-center justify-center rounded-lg text-sm font-bold" style={{ background: `${r.logoColor}1F`, color: r.logoColor }}>{r.name[0]}</span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-ink hover:underline">{r.name}</span>
            <span className="block truncate text-[10.5px] text-ink-muted">{r.domain}</span>
          </span>
        </Link>
      );
    },
  }),
  col.accessor("companies", { header: "Company", cell: (c) => <CompanyBadges codes={c.getValue()} /> }),
  col.accessor("type", { header: "Type" }),
  col.accessor("status", { header: "Status", cell: (c) => <StatusMenu id={c.row.original.id} status={c.getValue()} /> }),
  col.accessor("activeProjects", { header: "Active Projects", cell: (c) => `${c.getValue()} / ${c.row.original.totalProjects}` }),
  col.accessor("revenue", { header: "Total Revenue", cell: (c) => <span className="tabular">{formatINR(c.getValue())}</span> }),
  col.accessor("owner", { header: "Owner", cell: (c) => c.getValue() && <span className="flex items-center gap-2"><Avatar person={{ name: c.getValue()! }} size={26} />{c.getValue()}</span> }),
  col.accessor("lastActivity", { header: "Last Activity" }),
  col.display({
    id: "actions",
    header: "Actions",
    cell: (c) => <RowActions id={c.row.original.id} />,
  }),
]);

function RowActions({ id }: { id: string }) {
  const refresh = useRefreshClients();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-md p-1 hover:bg-accent" aria-label="Actions"><MoreVertical className="size-4" /></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild><Link href={`/clients/${id}`}>View or edit</Link></DropdownMenuItem>
        <DropdownMenuItem onSelect={async () => { await archiveClients([id]); toast.success("Client archived."); await refresh(); }}>Archive</DropdownMenuItem>
        <DropdownMenuItem
          className="text-danger-text"
          onSelect={async () => {
            const res = await deleteClient(id);
            notify[res.ok ? "success" : "error"](res.ok ? "Client deleted." : res.error);
            await refresh();
          }}
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ClientsTable({ rows, archived = false }: { rows: ClientRow[]; archived?: boolean }) {
  return (
    <DataTable
      rows={rows}
      columns={columns}
      selectable
      sortable={["name", "revenue", "lastActivity"]}
      rowHeight="md"
      columnClass={{ actions: "w-14 text-center", activeProjects: "text-center" }}
      bulkActions={(ids, clear) => <BulkActions ids={ids} clear={clear} archived={archived} />}
    />
  );
}

function BulkActions({ ids, clear, archived }: { ids: string[]; clear: () => void; archived: boolean }) {
  const refresh = useRefreshClients();
  return archived ? (
    <button className="font-medium underline" onClick={async () => { await archiveClients(ids, true); clear(); toast.success("Restored."); await refresh(); }}>Restore</button>
  ) : (
    <>
      {(["ACTIVE", "ON_HOLD", "INACTIVE"] as const).map((s) => (
        <button key={s} className="font-medium underline" onClick={async () => { await setClientStatus(ids, s); clear(); toast.success("Updated."); await refresh(); }}>Mark {CLIENT_STATUS[s]!.label}</button>
      ))}
      <button className="font-medium underline" onClick={async () => { await archiveClients(ids); clear(); toast.success("Archived."); await refresh(); }}>Archive</button>
    </>
  );
}
