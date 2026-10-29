// Ported from app/(app)/layout.tsx. A 401 from /api/shell sends the user to /login
// (handled in web/api.ts), which is what proxy.ts used to do.
import { useQuery } from "@tanstack/react-query";
import { Outlet } from "react-router";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { Skeleton } from "@/components/ui/skeleton";
import { api, query } from "../api";

export default function AppShell() {
  const { data } = useQuery({ queryKey: ["shell"], queryFn: () => query(api.api.shell.$get()) });

  if (!data) {
    return (
      <div className="flex min-h-screen bg-page">
        <aside className="sticky top-0 hidden h-screen w-16 shrink-0 flex-col bg-sidebar-bg md:flex xl:w-[220px]">
          <div className="px-[22px] pt-[14px] pb-6">
            <div className="h-6 w-24 animate-pulse rounded bg-white/10" />
          </div>
          <div className="space-y-1.5 px-3">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-7 animate-pulse rounded-lg bg-white/5" />
            ))}
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card px-4">
            <div className="h-7 w-36 animate-pulse rounded-md bg-surface-muted" />
            <div className="flex items-center gap-3">
              <div className="size-8 animate-pulse rounded-full bg-surface-muted" />
              <div className="h-6 w-20 animate-pulse rounded-md bg-surface-muted" />
            </div>
          </header>
          <main className="flex-1 px-4 pt-5 pb-8">
            <Outlet />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div data-scope={data.scope.toLowerCase()} className="flex min-h-screen bg-page">
      <Sidebar scope={data.scope} allowed={data.allowed} modules={data.modules} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          scope={data.scope}
          allowed={data.allowed}
          modules={data.modules}
          user={data.user}
          unread={data.unread}
          timer={data.timer}
          notifications={data.notifications}
        />
        <main className="flex-1 px-4 pt-5 pb-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
