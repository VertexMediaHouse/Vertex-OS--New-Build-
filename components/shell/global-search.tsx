"use client";

import { useEffect, useState, useTransition } from "react";
import { useNavigate } from "@/lib/nav";
import { Search } from "lucide-react";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { api, query } from "@/web/api";
import type { SearchHit } from "@/server/routes/search";

/** Topbar search field that opens the ⌘K / Ctrl+K command palette. */
export function GlobalSearch({ placeholder }: { placeholder: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [, start] = useTransition();
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => start(async () => setHits(q.trim().length >= 2 ? await query(api.api.search.$get({ query: { q } })) : [])), 200);
    return () => clearTimeout(t);
  }, [q]);

  const groups = [...new Set(hits.map((h) => h.group))];
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="relative hidden h-9 w-[204px] items-center rounded-lg bg-surface-muted pr-3 pl-9 text-left text-xs text-ink-muted lg:flex" aria-label="Search (Ctrl+K)">
        <Search className="absolute left-3 size-4" aria-hidden />
        <span className="truncate">{placeholder}</span>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command shouldFilter={false}>
        <CommandInput value={q} onValueChange={setQ} placeholder="Search leads, clients, projects, tasks, invoices, files…" />
        <CommandList>
          <CommandEmpty>{q.trim().length < 2 ? "Type at least 2 characters." : "No results."}</CommandEmpty>
          {groups.map((g) => (
            <CommandGroup key={g} heading={g}>
              {hits.filter((h) => h.group === g).map((h) => (
                <CommandItem key={h.href} value={h.href} onSelect={() => { setOpen(false); navigate(h.href); }}>
                  <span className="font-medium">{h.label}</span>
                  {h.sub && <span className="ml-2 text-ink-muted">{h.sub}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
