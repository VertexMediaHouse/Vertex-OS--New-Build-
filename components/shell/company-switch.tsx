"use client";

import { useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "@/lib/nav";
import { Building2, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, call } from "@/web/api";
import { COMPANY_META, type CompanyCode, type Scope } from "@/lib/scope";
import { CompanyBadge } from "@/components/shared/pills";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** One switching function for the dropdown, the pills and the sidebar card. */
export function useSwitchCompany() {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [pending, startTransition] = useTransition();
  const switchTo = (scope: Scope) => {
    // A page number or open record from another company makes no sense after switching.
    const next = new URLSearchParams(params);
    next.delete("page");
    next.delete("id");
    startTransition(async () => {
      await call(api.api.scope.$post({ json: { company: scope } }));
      setParams(next, { replace: true, preventScrollReset: true });
      // The scope cookie decides what every query returns.
      await queryClient.invalidateQueries();
    });
  };
  return { switchTo, pending };
}

export type SwitchProps = { scope: Scope; allowed: CompanyCode[] };

const options = (allowed: CompanyCode[]): Scope[] => (allowed.length > 1 ? ["ALL", ...allowed] : allowed);
const nameOf = (s: Scope) => (s === "ALL" ? "All Companies" : COMPANY_META[s].name);

export function CompanyDropdown({ scope, allowed }: SwitchProps) {
  const { switchTo } = useSwitchCompany();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="hidden h-9 min-w-[184px] items-center gap-2.5 rounded-lg border bg-card px-3 text-sm font-semibold text-ink outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/40 lg:inline-flex">
        {scope === "ALL" ? <Building2 className="size-[18px] text-vmh-text" aria-hidden /> : <CompanyBadge code={scope} />}
        <span className="min-w-0 flex-1 text-left whitespace-nowrap">{nameOf(scope)}</span>
        <ChevronDown className="size-4 text-ink-2" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {options(allowed).map((s) => (
          <DropdownMenuItem key={s} onSelect={() => switchTo(s)} className="gap-2.5 text-sm">
            {s === "ALL" ? <Building2 className="size-4" /> : <CompanyBadge code={s} />}
            {nameOf(s)}
            {s === scope && <Check className="ml-auto size-4 text-brand-text" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const FILLED: Record<Scope, string> = { ALL: "bg-brand-strong text-white", VMH: "bg-vmh text-white", VTH: "bg-vth text-white" };

export function CompanyPills({ scope, allowed }: SwitchProps) {
  const { switchTo } = useSwitchCompany();
  const opts = options(allowed);
  if (opts.length < 2) return null;
  return (
    <div role="radiogroup" aria-label="Company" className="inline-flex h-10 items-center lg:ml-3.5 rounded-[10px] bg-surface-muted/70 p-0.5">
      {opts.map((s) => {
        const active = s === scope;
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => switchTo(s)}
            className={cn(
              "inline-flex h-full items-center gap-2 rounded-lg px-3 text-xs font-medium whitespace-nowrap transition-colors",
              s === "ALL" && "min-w-[50px] justify-center text-sm",
              active ? FILLED[s] : "text-ink-2 hover:bg-white/70",
            )}
          >
            {s === "ALL" ? (
              "All"
            ) : (
              <>
                <CompanyBadge code={s} className={cn(active && "bg-white/20 text-white")} />
                <span className="hidden xl:inline">{COMPANY_META[s].name}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** "Switch Company" card at the bottom of the sidebar. */
export function SwitchCompanyCard({ scope, allowed, collapsed }: SwitchProps & { collapsed?: boolean }) {
  const { switchTo } = useSwitchCompany();
  const opts = options(allowed);
  if (opts.length < 2) return null;
  return (
    <div className="rounded-[10px] bg-sidebar-card p-2">
      {!collapsed && <p className="px-2 pt-1.5 pb-2 text-xs text-sidebar-muted">Switch Company</p>}
      <div className="space-y-0.5">
        {opts.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => switchTo(s)}
            aria-pressed={s === scope}
            title={nameOf(s)}
            className={cn(
              "flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-xs text-sidebar-text transition-colors",
              s === scope ? "bg-sidebar-switch-active text-white" : "hover:bg-white/5",
            )}
          >
            {s === "ALL" ? (
              <span className="inline-flex size-[22px] shrink-0 items-center justify-center rounded-full bg-brand text-white">
                <Check className="size-3.5" strokeWidth={3} aria-hidden />
              </span>
            ) : (
              <span className={cn("inline-flex h-[22px] w-[30px] shrink-0 items-center justify-center rounded-md text-[9.5px] font-semibold text-white", s === "VMH" ? "bg-sidebar-vmh-avatar" : "bg-sidebar-vth-avatar")}>
                {s}
              </span>
            )}
            {!collapsed && <span className="truncate">{nameOf(s)}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
