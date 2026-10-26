// Ported from app/(app)/activity/page.tsx.
import { Hono } from "hono";
import { staffContext, type Env } from "../context";
import { db } from "@/lib/db";
import { scopedSharedWhere } from "@/lib/db/scope";

/** Everything that happened, newest first: the audit trail behind the "Recent Activity" widgets. */
export const activity = new Hono<Env>()
  .use(...staffContext)
  .get("/", async (c) => {
    const items = await db.activity.findMany({ where: scopedSharedWhere({ companyIds: c.get("companyIds") }), orderBy: { createdAt: "desc" }, take: 150, include: { actor: { select: { name: true, image: true } } } });
    return c.json({ items });
  });
