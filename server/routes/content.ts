// Ported from app/(app)/content/{page.tsx,actions.ts}. Query and mutation bodies are
// unchanged; only the context and input plumbing differs. refresh() is gone — the
// frontend invalidates its query after a successful mutation.
import { Hono } from "hono";
import { z } from "zod";
import { staffContext, type Env } from "../context";
import { logActivity } from "@/lib/activity";
import { assertCan, can, type CurrentUser } from "@/lib/auth/permissions";
import { addDays, now, startOfDayIST } from "@/lib/clock";
import { db, type Prisma } from "@/lib/db";
import { formatShortDate } from "@/lib/format";
import { dayKey } from "@/lib/period";
import { companyCode } from "@/components/shared/pills";
import type { ActionResult } from "@/lib/validation/result";

const id = z.string().min(1).max(64);
const STAGES = ["IDEA", "SCRIPTING", "FILMING", "EDITING", "SCHEDULED", "PUBLISHED"] as const;

const contentSchema = z.object({
  title: z.string().trim().min(1, "Give it a title").max(200),
  companyId: z.enum(["vmh", "vth"]),
  channel: z.enum(["YOUTUBE", "INSTAGRAM", "LINKEDIN", "SHORTS", "PODCAST", "OTHER"]).default("YOUTUBE"),
  stage: z.enum(STAGES).default("IDEA"),
  ownerId: z.string().max(64).optional().or(z.literal("")),
  hook: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(5000).optional(),
  shootDate: z.string().optional(),
  publishDate: z.string().optional(),
  link: z.string().trim().max(500).optional(),
});

const day = (s?: string) => (s ? new Date(`${s}T12:00:00+05:30`) : null);

async function itemFor(user: CurrentUser, action: "update" | "delete", itemId: string) {
  const item = await db.contentItem.findUniqueOrThrow({ where: { id: id.parse(itemId) } });
  assertCan(user, action, "content", item.companyId);
  return item;
}

/** Narrow a company sub-filter (?co=vmh) to the companies already in scope. */
const subScope = (companyIds: string[], co: string | undefined) => (co && companyIds.includes(co) ? [co] : companyIds);

export const content = new Hono<Env>()
  .use(...staffContext)
  .get("/", async (c) => {
    const user = c.get("user");
    const companyIds = c.get("companyIds");
    const scope = c.get("scope");
    if (!can(user, "view", "content")) return c.json({ denied: true as const });
    const q = c.req.query("q") || null;
    const t = now();
    const today = startOfDayIST(t);
    const where: Prisma.ContentItemWhereInput = {
      companyId: { in: subScope(companyIds, c.req.query("co")) },
      ...(c.req.query("channel") && { channel: c.req.query("channel") as "YOUTUBE" }),
      ...(c.req.query("owner") && { ownerId: c.req.query("owner")! }),
      ...(q && { OR: [{ title: { contains: q, mode: "insensitive" } }, { hook: { contains: q, mode: "insensitive" } }] }),
    };
    const [rows, people, ideas, shooting, scheduled, publishedMonth] = await Promise.all([
      db.contentItem.findMany({ where, orderBy: [{ position: "asc" }], include: { owner: { select: { name: true, image: true } } } }),
      db.user.findMany({ where: { kind: "STAFF", memberships: { some: { companyId: { in: companyIds } } } }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
      db.contentItem.count({ where: { companyId: { in: companyIds }, stage: "IDEA" } }),
      db.contentItem.count({ where: { companyId: { in: companyIds }, shootDate: { gte: today, lt: addDays(today, 8) } } }),
      db.contentItem.count({ where: { companyId: { in: companyIds }, stage: "SCHEDULED" } }),
      db.contentItem.count({ where: { companyId: { in: companyIds }, stage: "PUBLISHED", publishedAt: { gte: addDays(today, -30) } } }),
    ]);

    const board: Record<string, unknown[]> = { IDEA: [], SCRIPTING: [], FILMING: [], EDITING: [], SCHEDULED: [], PUBLISHED: [] };
    for (const x of rows) {
      board[x.stage]!.push({
        id: x.id,
        title: x.title,
        co: companyCode(x.companyId),
        companyId: x.companyId,
        channel: x.channel,
        stage: x.stage,
        hook: x.hook,
        owner: x.owner,
        ownerId: x.ownerId,
        shootDate: x.shootDate ? dayKey(x.shootDate) : null,
        publishDate: x.publishDate ? dayKey(x.publishDate) : null,
        shootLabel: x.shootDate ? formatShortDate(x.shootDate) : null,
        publishLabel: x.publishDate ? formatShortDate(x.publishDate) : null,
        notes: x.notes,
        link: x.link,
      });
    }
    return c.json({
      denied: false as const,
      board,
      people,
      scope,
      kpis: { ideas, shooting, scheduled, publishedMonth },
      companies: companyIds.filter((x): x is "vmh" | "vth" => can(user, "create", "content", x)),
    });
  })
  .post("/save", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{ itemId: string | null; input: unknown }>();
    const parsed = contentSchema.safeParse(body.input);
    if (!parsed.success) return c.json<ActionResult>({ ok: false, error: parsed.error.issues[0]!.message });
    const d = parsed.data;
    const data = {
      title: d.title,
      channel: d.channel,
      stage: d.stage,
      ownerId: d.ownerId || null,
      hook: d.hook || null,
      notes: d.notes || null,
      shootDate: day(d.shootDate),
      publishDate: day(d.publishDate),
      link: d.link || null,
      // Published is the end of the line: stamp it the first time it lands there.
      publishedAt: d.stage === "PUBLISHED" ? new Date() : null,
    };
    if (body.itemId) {
      const item = await itemFor(user, "update", body.itemId);
      await db.contentItem.update({ where: { id: item.id }, data: { ...data, publishedAt: d.stage === "PUBLISHED" ? (item.publishedAt ?? new Date()) : null } });
    } else {
      assertCan(user, "create", "content", d.companyId);
      const last = await db.contentItem.aggregate({ _max: { position: true }, where: { stage: d.stage } });
      await db.contentItem.create({ data: { ...data, companyId: d.companyId, position: Number(last._max.position ?? -1) + 1 } });
    }
    return c.json<ActionResult>({ ok: true });
  })
  /** Drag between stages. Positions order the column, like the task and lead boards. */
  .post("/move", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{ itemId: string; stage: string; beforeId: string | null }>();
    const item = await itemFor(user, "update", body.itemId);
    const s = z.enum(STAGES).parse(body.stage);
    const bId = z.string().max(64).nullable().parse(body.beforeId);
    await db.$transaction(async (tx) => {
      const before = bId ? await tx.contentItem.findUnique({ where: { id: bId }, select: { position: true } }) : null;
      let position: number;
      if (before) {
        await tx.contentItem.updateMany({ where: { stage: s, position: { gte: before.position } }, data: { position: { increment: 1 } } });
        position = before.position;
      } else {
        position = Number((await tx.contentItem.aggregate({ _max: { position: true }, where: { stage: s } }))._max.position ?? -1) + 1;
      }
      await tx.contentItem.update({
        where: { id: item.id },
        data: { stage: s, position, publishedAt: s === "PUBLISHED" ? (item.publishedAt ?? new Date()) : null },
      });
      if (item.stage !== s) {
        await logActivity(tx, {
          companyId: item.companyId,
          actorId: user.id,
          verb: "moved",
          entityType: "CAMPAIGN",
          entityId: item.id,
          summary: `${user.name} moved "${item.title}" to ${s[0]! + s.slice(1).toLowerCase()}`,
        });
      }
    });
    return c.json<ActionResult>({ ok: true });
  })
  .post("/delete", async (c) => {
    const { itemId } = await c.req.json<{ itemId: string }>();
    const item = await itemFor(c.get("user"), "delete", itemId);
    await db.contentItem.delete({ where: { id: item.id } });
    return c.json<ActionResult>({ ok: true });
  });
