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
  if (!data) return <ShellSkeleton />;

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

function ShellSkeleton() {
  return (
    <div className="flex min-h-screen bg-page">
      <div className="hidden w-16 bg-sidebar-bg md:block xl:w-[220px]" />
      <div className="flex-1">
        <div className="h-14 border-b bg-card" />
        <div className="space-y-4 p-4">
          <Skeleton className="h-9 w-72" />
          <div className="grid grid-cols-4 gap-3.5">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
