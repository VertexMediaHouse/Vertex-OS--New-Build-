// Ported from app/(app)/actions/notifications.ts.
import { Hono } from "hono";
import { staffContext, type Env } from "../context";
import { db } from "@/lib/db";
import type { ActionResult } from "@/lib/validation/result";

export const notifications = new Hono<Env>()
  .use(...staffContext)
  .get("/", async (c) => {
    const list = await db.notification.findMany({ where: { userId: c.get("user").id }, orderBy: { createdAt: "desc" }, take: 100 });
    return c.json({ list });
  })
  .post("/read-all", async (c) => {
    await db.notification.updateMany({ where: { userId: c.get("user").id, readAt: null }, data: { readAt: new Date() } });
    return c.json<ActionResult>({ ok: true });
  });
