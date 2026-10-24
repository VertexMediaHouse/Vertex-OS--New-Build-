import { Suspense } from "react";
import { getRequestContext } from "@/lib/auth/context";
import { db } from "@/lib/db";
import { scopedWhere } from "@/lib/db/scope";

// Phase 2 placeholder: proves login + company scope end to end. Replaced in Phase 4.
export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="p-6">Loading…</p>}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const ctx = await getRequestContext();
  const leads = await db.lead.count({ where: scopedWhere(ctx) });
  return (
    <main className="p-6">
      <h1 className="text-4xl font-bold text-ink">Welcome back, {ctx.user.name}!</h1>
      <p data-testid="scope" className="mt-2 text-md text-ink-muted">
        Scope {ctx.scope} · companies {ctx.companyIds.join(", ")} · {leads} leads
      </p>
    </main>
  );
}
