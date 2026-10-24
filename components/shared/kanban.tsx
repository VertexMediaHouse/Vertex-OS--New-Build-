"use client";

import { useState, useTransition } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type KanbanColumn = {
  id: string;
  title: string;
  /** Header tint, body tint and title/accent colour classes. */
  headerClass: string;
  bodyClass: string;
  accentClass: string;
  /** Right side of the header (e.g. total value); count is added automatically. */
  meta?: (count: number) => React.ReactNode;
  icon?: React.ReactNode;
  headerAction?: React.ReactNode;
  topAction?: React.ReactNode;
};

type Props<T extends { id: string }> = {
  columns: KanbanColumn[];
  items: Record<string, T[]>;
  renderCard: (item: T) => React.ReactNode;
  /**
   * Persist a move; throw to roll back. Called after the board already shows the move.
   * `beforeId` is the card the item was dropped above, or null for the end of the column.
   * An id, not an index: the board may be filtered, so indexes don't match the stored order.
   */
  onMove: (itemId: string, toColumn: string, beforeId: string | null) => Promise<void>;
  /** Cards shown before "+ N more …". */
  limit?: number;
  moreLabel?: (n: number) => string;
  countStyle?: "plain" | "chip";
  className?: string;
};

/** Generic drag-and-drop board. Moves are optimistic; a failed save puts the card back. */
export function KanbanBoard<T extends { id: string }>({ columns, items, renderCard, onMove, limit = 3, moreLabel = (n) => `+ ${n} more`, countStyle = "plain", className }: Props<T>) {
  const [board, setBoard] = useState(items);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  // Server data changed (filters, revalidation): take it, during render rather than in an effect.
  const [prevItems, setPrevItems] = useState(items);
  if (prevItems !== items) {
    setPrevItems(items);
    setBoard(items);
  }

  const columnOf = (id: string) => (board[id] ? id : Object.keys(board).find((c) => board[c]!.some((i) => i.id === id)));
  const active = activeId ? Object.values(board).flat().find((i) => i.id === activeId) : null;

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    if (!e.over) return;
    const from = columnOf(String(e.active.id));
    const to = columnOf(String(e.over.id));
    if (!from || !to) return;
    const before = board;
    const moving = board[from]!.find((i) => i.id === e.active.id)!;
    const target = board[to]!.filter((i) => i.id !== moving.id);
    const overIndex = target.findIndex((i) => i.id === e.over!.id);
    const index = overIndex === -1 ? target.length : overIndex;
    if (from === to && board[from]!.findIndex((i) => i.id === moving.id) === index) return;
    const beforeId = target[index]?.id ?? null;
    target.splice(index, 0, moving);
    const next = { ...board, [from]: board[from]!.filter((i) => i.id !== moving.id), [to]: target };
    setBoard(next);
    startTransition(async () => {
      try {
        await onMove(moving.id, to, beforeId);
      } catch (err) {
        setBoard(before);
        toast.error(err instanceof Error ? err.message : "Couldn't move the card. Try again.");
      }
    });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className={cn("grid gap-3", className)} style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(180px, 1fr))` }}>
        {columns.map((col) => {
          const list = board[col.id] ?? [];
          const shown = expanded[col.id] ? list : list.slice(0, limit);
          return (
            <Column key={col.id} col={col} count={list.length} countStyle={countStyle}>
              <SortableContext items={shown.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2.5">
                  {shown.map((item) => (
                    <SortableCard key={item.id} id={item.id}>
                      {renderCard(item)}
                    </SortableCard>
                  ))}
                </div>
              </SortableContext>
              {list.length > limit && (
                <button type="button" onClick={() => setExpanded((x) => ({ ...x, [col.id]: !x[col.id] }))} className={cn("mt-2.5 px-1 text-left text-xs font-medium hover:underline", col.accentClass)}>
                  {expanded[col.id] ? "Show less" : moreLabel(list.length - limit)}
                </button>
              )}
            </Column>
          );
        })}
      </div>
      <DragOverlay>{active ? <div className="rotate-1 shadow-lg">{renderCard(active)}</div> : null}</DragOverlay>
    </DndContext>
  );
}

function Column({ col, count, countStyle, children }: { col: KanbanColumn; count: number; countStyle: "plain" | "chip"; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  return (
    <section ref={setNodeRef} aria-label={`${col.title} (${count})`} className={cn("flex flex-col rounded-xl", col.bodyClass, isOver && "ring-2 ring-blue/30")}>
      <header className={cn("rounded-t-xl px-3.5 pt-3 pb-2.5", col.headerClass)}>
        <div className="flex items-center gap-2">
          {col.icon}
          <h3 className={cn("text-md font-semibold", col.accentClass)}>{col.title}</h3>
          {countStyle === "chip" ? (
            <span className={cn("rounded-md bg-white/60 px-1.5 text-2xs font-semibold", col.accentClass)}>{count}</span>
          ) : (
            <span className={cn("ml-auto text-md font-semibold", col.accentClass)}>{count}</span>
          )}
          {col.headerAction && <span className="ml-auto">{col.headerAction}</span>}
        </div>
        {col.meta && <div className="mt-1">{col.meta(count)}</div>}
      </header>
      <div className="flex-1 px-2 pt-2 pb-3">
        {col.topAction}
        {children}
      </div>
    </section>
  );
}

function SortableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("touch-none", isDragging && "opacity-40")} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

/** White card shell used inside columns. */
export function KanbanCard({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-lg border border-card-border bg-card p-3 shadow-card", className)} {...props} />;
}
