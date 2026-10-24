"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronDown, LogOut, Menu, Settings } from "lucide-react";
import { Avatar } from "@/components/shared/primitives";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { authClient } from "@/lib/auth/client";
import { markAllNotificationsRead } from "@/app/(app)/actions/notifications";
import { CompanyDropdown, CompanyPills, type SwitchProps } from "./company-switch";
import { SidebarContent } from "./sidebar";
import { MiniTimer } from "@/components/time/time-client";
import { GlobalSearch } from "./global-search";

const SEARCH_PLACEHOLDER: [string, string][] = [
  ["/leads", "Search leads, clients, projects..."],
  ["/clients", "Search clients, projects, invoices..."],
  ["/projects", "Search projects, clients, tasks..."],
  ["/tasks", "Search tasks, projects, clients..."],
  ["/time", "Search tasks, projects, clients..."],
  ["/invoices", "Search invoices, clients, projects..."],
  ["/goals", "Search goals, team members..."],
  ["/files", "Search files, folders, clients..."],
  ["/reports", "Search reports, projects, clients..."],
];

export type TopbarNotification = { id: string; title: string; time: string; link: string | null; unread: boolean };

export function Topbar({
  scope,
  allowed,
  user,
  notifications,
  unread,
  timer,
}: SwitchProps & { user: { name: string; image: string | null; role: string }; notifications: TopbarNotification[]; unread: number; timer: { startedAt: string; label: string } | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const placeholder = SEARCH_PLACEHOLDER.find(([p]) => pathname.startsWith(p))?.[1] ?? "Search anything...";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card px-4">
      <button type="button" className="rounded-md p-1.5 text-ink-2 hover:bg-accent md:hidden" aria-label="Open menu" onClick={() => setMobileOpen(true)}>
        <Menu className="size-5" />
      </button>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[240px] border-none bg-sidebar-bg p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent scope={scope} allowed={allowed} forceFull onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <CompanyDropdown scope={scope} allowed={allowed} />
      <CompanyPills scope={scope} allowed={allowed} />

      <div className="ml-auto flex items-center gap-4">
        {timer && <MiniTimer startedAt={timer.startedAt} label={timer.label} />}
        <GlobalSearch placeholder={placeholder} />

        <DropdownMenu>
          <DropdownMenuTrigger className="relative rounded-md p-1.5 text-ink-2 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/40" aria-label={`Notifications, ${unread} unread`}>
            <Bell className="size-[22px]" strokeWidth={1.8} />
            {unread > 0 && <span className="absolute top-0 right-0 inline-flex size-[17px] items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white ring-2 ring-white">{unread > 9 ? "9+" : unread}</span>}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex items-center justify-between px-2 py-1.5">
              <DropdownMenuLabel className="p-0 text-sm"><Link href="/notifications" className="hover:underline">Notifications</Link></DropdownMenuLabel>
              {unread > 0 && (
                <button type="button" onClick={() => markAllNotificationsRead()} className="text-xs font-medium text-blue hover:underline">
                  Mark all read
                </button>
              )}
            </div>
            <DropdownMenuSeparator />
            {notifications.length === 0 && <p className="px-2 py-6 text-center text-xs text-ink-muted">You&apos;re all caught up.</p>}
            {notifications.map((n) => (
              <DropdownMenuItem key={n.id} asChild className="items-start gap-2.5 py-2">
                <Link href={n.link ?? "#"}>
                  <span className={n.unread ? "mt-1.5 size-2 shrink-0 rounded-full bg-blue" : "mt-1.5 size-2 shrink-0"} aria-hidden />
                  <span className="min-w-0">
                    <span className={n.unread ? "block text-xs font-semibold text-ink" : "block text-xs text-ink-2"}>{n.title}</span>
                    <span className="block text-2xs text-ink-muted">{n.time}</span>
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="hidden h-8 w-px bg-card-border sm:block" aria-hidden />
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-lg py-1 pr-1 pl-1 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/40">
            <Avatar person={user} size={36} />
            <span className="hidden flex-col sm:flex">
              <span className="text-sm leading-4 font-semibold text-ink">{user.name}</span>
              <span className="text-xs text-ink-muted">{user.role}</span>
            </span>
            <ChevronDown className="ml-4 size-4 text-ink-2" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings className="size-4" /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={async () => {
                await authClient.signOut();
                router.replace("/login");
                router.refresh();
              }}>
              <LogOut className="size-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
