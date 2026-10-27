import { db, type Prisma } from "@/lib/db";
import { scopedClientWhere } from "@/lib/db/scope";
import { formatRelative } from "@/lib/format";
import { now } from "@/lib/clock";

import { logoColor } from "@/lib/chart-colors";
export { logoColor };

export type ClientFilters = { companyIds: string[]; q?: string | null; status?: string | null; tag?: string | null; owner?: string | null; archived?: boolean };

/**
 * Clients with computed Active Projects and Total Revenue (sum of project values, decision 23).
 * shortcut: filtered + sorted in memory, fine for a few hundred clients; move revenue into SQL past ~2,000.
 */
export async function listClients(f: ClientFilters) {
  const where: Prisma.ClientWhereInput = {
    archivedAt: f.archived ? { not: null } : null,
    ...scopedClientWhere(f),
    ...(f.status && { status: f.status as Prisma.ClientWhereInput["status"] }),
    ...(f.tag && { tags: { has: f.tag } }),
    ...(f.owner && { ownerId: f.owner }),
    ...(f.q && { OR: [{ name: { contains: f.q, mode: "insensitive" } }, { domain: { contains: f.q, mode: "insensitive" } }, { type: { contains: f.q, mode: "insensitive" } }] }),
  };
  const rows = await db.client.findMany({
    where,
    include: {
      owner: { select: { name: true } },
      companies: { select: { companyId: true } },
      projects: { where: { companyId: { in: f.companyIds } }, select: { status: true, value: true } },
    },
  });
  const t = now();
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    domain: c.domain,
    type: c.type,
    status: c.status,
    tags: c.tags,
    companies: c.companies.map((x) => (x.companyId === "vmh" ? "VMH" : "VTH") as "VMH" | "VTH").sort(),
    activeProjects: c.projects.filter((p) => p.status !== "COMPLETED" && p.status !== "CANCELLED").length,
    totalProjects: c.projects.length,
    revenue: c.projects.reduce((a, p) => a + Number(p.value), 0),
    owner: c.owner?.name ?? null,
    lastActivityAt: c.lastActivityAt,
    lastActivity: formatRelative(c.lastActivityAt, t),
    createdAt: c.createdAt,
    logoColor: logoColor(c.name),
  }));
}
