import type { PrismaClient } from "@/lib/db";

/** A client of one company who might need the other company's services. */
export type Rule = { id: string; from: "vmh" | "vth"; to: "vmh" | "vth"; pattern: RegExp; reason: string; requireNoProjectInTarget: boolean };

export const RULES: Rule[] = [
  { id: "vmh-keywords-to-vth", from: "vmh", to: "vth", pattern: /\b(website|crm|erp|web ?app|store|automation)\b/i, reason: "Might need a website or CRM based on recent conversations.", requireNoProjectInTarget: true },
  { id: "vth-launch-to-vmh", from: "vth", to: "vmh", pattern: /\b(launch|product-launch|video|promo)\b/i, reason: "Might need video content for product launch.", requireNoProjectInTarget: false },
];

export function matchRules(client: { notes: string | null; tags: string[]; companyIds: string[]; projectCompanyIds: string[] }): Rule[] {
  const text = `${client.notes ?? ""} ${client.tags.join(" ")}`;
  return RULES.filter(
    (r) => client.companyIds.includes(r.from) && r.pattern.test(text) && !(r.requireNoProjectInTarget && client.projectCompanyIds.includes(r.to)),
  );
}

type CrossSellClient = {
  id: string;
  notes: string | null;
  tags: string[];
  companies: { companyId: string }[];
  projects: { companyId: string }[];
};

/** Raise alerts for matching clients. Existing alerts (any status) are never re-raised. */
export async function runCrossSellRules(db: PrismaClient): Promise<number> {
  const clients = (await db.client.findMany({
    where: { archivedAt: null },
    select: { id: true, notes: true, tags: true, companies: { select: { companyId: true } }, projects: { select: { companyId: true } } },
  })) as CrossSellClient[];
  const data = clients.flatMap((c) =>
    matchRules({ notes: c.notes, tags: c.tags, companyIds: c.companies.map((x) => x.companyId), projectCompanyIds: c.projects.map((p) => p.companyId) }).map((r) => ({
      clientId: c.id, fromCompanyId: r.from, toCompanyId: r.to, rule: r.id, reason: r.reason,
    })),
  );
  const res = await db.crossSellAlert.createMany({ data, skipDuplicates: true });
  return res.count;
}
