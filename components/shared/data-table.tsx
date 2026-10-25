"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { createColumnHelper, rowSelectionFeature, tableFeatures, useTable, type RowData, type RowSelectionState } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { useHrefWith } from "./nav";

export const tableFx = tableFeatures({ rowSelectionFeature });
/** Column helper bound to the shared feature set: `const col = columnsFor<Row>()`. */
export const columnsFor = <T extends RowData>() => createColumnHelper<typeof tableFx, T>();

type Props<T extends RowData & { id: string }> = {
  rows: T[];
  // Column defs come from columnsFor<T>().columns([...]); their exact type is feature-bound.
  columns: Parameters<typeof useTable<typeof tableFx, T>>[0]["columns"];
  /** Checkbox column + bulk action bar. */
  selectable?: boolean;
  bulkActions?: (ids: string[], clear: () => void) => React.ReactNode;
  /** Column ids whose header toggles ?sort=&dir= (server-side sorting). */
  sortable?: string[];
  /** Per-column classes for th/td (width, alignment). */
  columnClass?: Record<string, string>;
  /** Highlighted row (open in a side panel). */
  activeId?: string | null;
  rowHeight?: "sm" | "md" | "lg";
  emptyMessage?: string;
  className?: string;
};

export function DataTable<T extends RowData & { id: string }>({
  rows,
  columns,
  selectable,
  bulkActions,
  sortable = [],
  columnClass = {},
  activeId,
  rowHeight = "md",
  emptyMessage = "Nothing here yet.",
  className,
}: Props<T>) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const table = useTable({
    features: tableFx,
    columns,
    data: rows,
    getRowId: (row: T) => row.id,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
  });
  const params = useSearchParams();
  const router = useRouter();
  const hrefWith = useHrefWith();
  const sort = params.get("sort");
  const dir = params.get("dir") === "asc" ? "asc" : "desc";
  const selectedIds = useMemo(() => Object.keys(rowSelection).filter((k) => rowSelection[k]), [rowSelection]);

  const toggleSort = (id: string) => {
    const nextDir = sort === id && dir === "desc" ? "asc" : "desc";
    router.replace(hrefWith({ sort: id, dir: nextDir, page: null }), { scroll: false });
  };

  const cellPad = rowHeight === "sm" ? "py-2" : rowHeight === "md" ? "py-2.5" : "py-4";

  return (
    <div className={cn("relative", className)}>
      {selectable && selectedIds.length > 0 && bulkActions && (
        <div className="mb-2 flex items-center gap-3 rounded-lg bg-brand-soft px-3 py-2 text-xs text-brand-text">
          <span className="font-semibold">{selectedIds.length} selected</span>
          {bulkActions(selectedIds, () => setRowSelection({}))}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-2xs">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {selectable && (
                  <th className="w-10 rounded-l-lg bg-surface-muted py-2.5 pl-3 text-left">
                    <input
                      type="checkbox"
                      aria-label="Select all rows"
                      className="size-4 rounded border-input accent-blue"
                      checked={table.getIsAllRowsSelected()}
                      ref={(el) => {
                        if (el) el.indeterminate = table.getIsSomeRowsSelected();
                      }}
                      onChange={table.getToggleAllRowsSelectedHandler()}
                    />
                  </th>
                )}
                {group.headers.map((header, i) => {
                  const id = header.column.id;
                  const canSort = sortable.includes(id);
                  const active = sort === id;
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
                      className={cn(
                        "bg-surface-muted px-3 py-2.5 text-left text-2xs font-medium whitespace-nowrap text-ink-2",
                        !selectable && i === 0 && "rounded-l-lg",
                        i === group.headers.length - 1 && "rounded-r-lg",
                        columnClass[id],
                      )}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button type="button" onClick={() => toggleSort(id)} className="inline-flex items-center gap-1 hover:text-ink">
                          <table.FlexRender header={header} />
                          {active ? dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ChevronsUpDown className="size-3 opacity-40" />}
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className={cn("group", row.id === activeId ? "bg-brand-soft" : "hover:bg-accent")} data-state={row.getIsSelected() ? "selected" : undefined}>
                {selectable && (
                  <td className={cn("border-b pl-3", cellPad)}>
                    <input
                      type="checkbox"
                      aria-label="Select row"
                      className="size-4 rounded border-input accent-blue"
                      checked={row.getIsSelected()}
                      onChange={row.getToggleSelectedHandler()}
                    />
                  </td>
                )}
                {row.getAllCells().map((cell) => (
                  <td key={cell.id} className={cn("border-b px-3 align-middle text-ink-2", cellPad, columnClass[cell.column.id])}>
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={99} className="py-10 text-center text-xs text-ink-muted">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
