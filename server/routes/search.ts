// Ported from app/(app)/actions/search.ts.
import { Hono } from "hono";
import { z } from "zod";
import { staffContext, type Env } from "../context";
import { can, isMemberOnly } from "@/lib/auth/permissions";
import { db } from "@/lib/db";

export type SearchHit = { group: string; label: string; sub?: string; href: string };

export const search = new Hono<Env>()
  .use(...staffContext)
  .get("/", async (c) => {
    const user = c.get("user");
    const companyIds = c.get("companyIds");
    const q = z.string().trim().max(100).parse(c.req.query("q") ?? "");
    if (q.length < 2) return c.json<SearchHit[]>([]);
    const has = { contains: q, mode: "insensitive" as const };
    const co = { companyId: { in: companyIds } };
    const member = isMemberOnly(user);
    const [leads, clients, projects, tasks, invoices, files] = await Promise.all([
      can(user, "view", "lead") ? db.lead.findMany({ where: { ...co, OR: [{ name: has }, { service: has }, { email: has }] }, take: 5 }) : [],
      db.client.findMany({ where: { archivedAt: null, companies: { some: co }, OR: [{ name: has }, { domain: has }] }, take: 5 }),
      db.project.findMany({ where: { ...co, ...(member && { members: { some: { userId: user.id } } }), OR: [{ name: has }, { client: { name: has } }] }, take: 5, include: { client: { select: { name: true } } } }),
      db.task.findMany({ where: { ...co, ...(member && { assigneeId: user.id }), title: has }, take: 5, include: { project: { select: { name: true } } } }),
      can(user, "view", "invoice") ? db.invoice.findMany({ where: { ...co, OR: [{ number: has }, { client: { name: has } }] }, take: 5, include: { client: { select: { name: true } } } }) : [],
      db.file.findMany({
        where: {
          deletedAt: null,
          name: has,
          OR: [{ companyId: { in: companyIds } }, { companyId: null }],
          // Same rule as the Files page: members see their own uploads, shares and project files.
          ...(member && { AND: [{ OR: [{ uploadedById: user.id }, { shares: { some: { userId: user.id } } }, { project: { members: { some: { userId: user.id } } } }] }] }),
        },
        take: 5,
      }),
    ]);
    return c.json<SearchHit[]>([
      ...leads.map((l) => ({ group: "Leads", label: l.name, sub: l.service, href: `/leads?id=${l.id}` })),
      ...clients.map((x) => ({ group: "Clients", label: x.name, sub: x.domain ?? undefined, href: `/clients/${x.id}` })),
      ...projects.map((p) => ({ group: "Projects", label: p.name, sub: p.client?.name, href: `/projects?id=${p.id}` })),
      ...tasks.map((t) => ({ group: "Tasks", label: t.title, sub: t.project?.name, href: `/tasks?id=${t.id}` })),
      ...invoices.map((i) => ({ group: "Invoices", label: `#${i.number}`, sub: i.client.name, href: `/invoices?id=${i.id}` })),
      ...files.map((f) => ({ group: "Files", label: f.name, href: `/files?id=${f.id}` })),
    ]);
  });
