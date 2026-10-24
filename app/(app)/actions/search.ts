"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { getRequestContext } from "@/lib/auth/context";
import { can, isMemberOnly } from "@/lib/auth/permissions";

export type SearchHit = { group: string; label: string; sub?: string; href: string };

/** Global search across the modules the user can see, in the current company scope. */
export async function globalSearch(query: string): Promise<SearchHit[]> {
  const ctx = await getRequestContext();
  const q = z.string().trim().max(100).parse(query);
  if (q.length < 2) return [];
  const has = { contains: q, mode: "insensitive" as const };
  const co = { companyId: { in: ctx.companyIds } };
  const member = isMemberOnly(ctx.user);
  const [leads, clients, projects, tasks, invoices, files] = await Promise.all([
    can(ctx.user, "view", "lead") ? db.lead.findMany({ where: { ...co, OR: [{ name: has }, { service: has }, { email: has }] }, take: 5 }) : [],
    db.client.findMany({ where: { archivedAt: null, companies: { some: co }, OR: [{ name: has }, { domain: has }] }, take: 5 }),
    db.project.findMany({ where: { ...co, ...(member && { members: { some: { userId: ctx.user.id } } }), OR: [{ name: has }, { client: { name: has } }] }, take: 5, include: { client: { select: { name: true } } } }),
    db.task.findMany({ where: { ...co, ...(member && { assigneeId: ctx.user.id }), title: has }, take: 5, include: { project: { select: { name: true } } } }),
    can(ctx.user, "view", "invoice") ? db.invoice.findMany({ where: { ...co, OR: [{ number: has }, { client: { name: has } }] }, take: 5, include: { client: { select: { name: true } } } }) : [],
    db.file.findMany({
      where: {
        deletedAt: null,
        name: has,
        OR: [{ companyId: { in: ctx.companyIds } }, { companyId: null }],
        // Same rule as the Files page: members see their own uploads, shares and project files.
        ...(member && { AND: [{ OR: [{ uploadedById: ctx.user.id }, { shares: { some: { userId: ctx.user.id } } }, { project: { members: { some: { userId: ctx.user.id } } } }] }] }),
      },
      take: 5,
    }),
  ]);
  return [
    ...leads.map((l) => ({ group: "Leads", label: l.name, sub: l.service, href: `/leads?id=${l.id}` })),
    ...clients.map((c) => ({ group: "Clients", label: c.name, sub: c.domain ?? undefined, href: `/clients/${c.id}` })),
    ...projects.map((p) => ({ group: "Projects", label: p.name, sub: p.client?.name, href: `/projects?id=${p.id}` })),
    ...tasks.map((t) => ({ group: "Tasks", label: t.title, sub: t.project?.name, href: `/tasks?id=${t.id}` })),
    ...invoices.map((i) => ({ group: "Invoices", label: `#${i.number}`, sub: i.client.name, href: `/invoices?id=${i.id}` })),
    ...files.map((f) => ({ group: "Files", label: f.name, href: `/files?id=${f.id}` })),
  ];
}
