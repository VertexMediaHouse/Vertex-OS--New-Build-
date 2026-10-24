import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { getRequestContext } from "@/lib/auth/context";
import { allowedCompanyIds, roleLabel } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { now } from "@/lib/clock";
import { formatRelative } from "@/lib/format";
import type { CompanyCode } from "@/lib/scope";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const { user, scope } = await getRequestContext();
  const allowed = allowedCompanyIds(user).map((id) => id.toUpperCase() as CompanyCode);
  const [notifications, unread] = await Promise.all([
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 8 }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  const at = now();
  return (
    <div data-scope={scope.toLowerCase()} className="flex min-h-screen bg-page">
      <Sidebar scope={scope} allowed={allowed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          scope={scope}
          allowed={allowed}
          user={{ name: user.name, image: user.image, role: roleLabel(user) }}
          unread={unread}
          notifications={notifications.map((n) => ({ id: n.id, title: n.title, link: n.link, unread: !n.readAt, time: formatRelative(n.createdAt, at) }))}
        />
        <main className="flex-1 px-4 pt-5 pb-8">{children}</main>
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
