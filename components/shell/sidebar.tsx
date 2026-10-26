"use client";

import Link from "@/components/ui/link";
import { usePathname } from "@/lib/nav";
import {
  ChartColumn, Clapperboard, Clock, FileText, Files, FolderKanban, House, Mail, Settings, SquareCheck, SquareCheckBig, UserRound, Users, UsersRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo, LogoMark } from "@/components/shared/logo";
import { SwitchCompanyCard, type SwitchProps } from "./company-switch";

/** The shell also needs to know which modules this person may open. */
export type NavProps = SwitchProps & { modules: string[] };

export const NAV: { href: string; label: string; icon: LucideIcon; module: string }[] = [
  { href: "/dashboard", label: "Dashboard", icon: House, module: "dashboard" },
  { href: "/leads", label: "Leads", icon: UserRound, module: "lead" },
  { href: "/clients", label: "Clients", icon: UsersRound, module: "client" },
  { href: "/projects", label: "Projects", icon: FolderKanban, module: "project" },
  { href: "/tasks", label: "Tasks", icon: SquareCheckBig, module: "task" },
  { href: "/time", label: "Time Tracking", icon: Clock, module: "time" },
  { href: "/invoices", label: "Invoices", icon: FileText, module: "invoice" },
  { href: "/campaigns", label: "Email Campaigns", icon: Mail, module: "campaign" },
  { href: "/content", label: "Content", icon: Clapperboard, module: "content" },
  { href: "/goals", label: "Goals", icon: SquareCheck, module: "goal" },
  { href: "/team", label: "Team", icon: Users, module: "team" },
  { href: "/files", label: "Files", icon: Files, module: "file" },
  { href: "/reports", label: "Reports", icon: ChartColumn, module: "report" },
  { href: "/settings", label: "Settings", icon: Settings, module: "settings" },
];

/** Left navigation. Full width ≥ 1280px, icons only from 768px, drawer below (see MobileNav). */
export function Sidebar(props: NavProps) {
  return (
    <aside className="sticky top-0 hidden h-screen w-16 shrink-0 flex-col bg-sidebar-bg md:flex xl:w-[220px]">
      <SidebarContent {...props} />
    </aside>
  );
}

export function SidebarContent({ scope, allowed, modules, forceFull = false, onNavigate }: NavProps & { forceFull?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const full = forceFull ? "" : "hidden xl:";
  return (
    <div className="flex h-full flex-col">
      <div className="px-[22px] pt-[14px] pb-6">
        <div className={cn(forceFull ? "block" : "hidden xl:block")}>
          <Logo />
        </div>
        <div className={cn(forceFull ? "hidden" : "xl:hidden")}>
          <LogoMark />
        </div>
      </div>
      <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {NAV.filter((n) => modules.includes(n.module)).map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              title={label}
              className={cn(
                "flex h-10 items-center gap-3 rounded-lg px-3 text-[12.5px] font-normal transition-colors",
                active ? "bg-sidebar-active text-white" : "text-sidebar-text hover:bg-white/5",
              )}
            >
              <Icon className="size-[18px] shrink-0" strokeWidth={1.8} aria-hidden />
              <span className={cn(full + "inline", "truncate")}>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-3 pt-4 pb-12">
        <div className={cn(forceFull ? "block" : "hidden xl:block")}>
          <SwitchCompanyCard scope={scope} allowed={allowed} />
        </div>
        <div className={cn(forceFull ? "hidden" : "xl:hidden")}>
          <SwitchCompanyCard scope={scope} allowed={allowed} collapsed />
        </div>
      </div>
    </div>
  );
}
