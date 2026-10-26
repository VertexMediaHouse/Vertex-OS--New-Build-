// Ported from app/(app)/layout.tsx: everything the sidebar and topbar need.
// A 401 from here is what tells the frontend to send the user to /login.
import { Hono } from "hono";
import { staffContext, type Env } from "../context";
import { allowedCompanyIds, can, RESOURCES, roleLabel } from "@/lib/auth/permissions";
import { now } from "@/lib/clock";
import { db } from "@/lib/db";
import { formatRelative } from "@/lib/format";
import type { CompanyCode } from "@/lib/scope";

export const shell = new Hono<Env>()
  .use(...staffContext)
  .get("/", async (c) => {
    const user = c.get("user");
    const scope = c.get("scope");
    const allowed = allowedCompanyIds(user).map((id) => id.toUpperCase() as CompanyCode);
    // The nav only lists what this person may open; each page checks again on its own.
    const modules = RESOURCES.filter((r) => can(user, "view", r));
    const [notifications, unread, running] = await Promise.all([
      db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 8 }),
      db.notification.count({ where: { userId: user.id, readAt: null } }),
      db.timeEntry.findFirst({ where: { userId: user.id, status: "RUNNING" }, include: { task: { select: { title: true } }, project: { select: { name: true } } } }),
    ]);
    const at = now();
    return c.json({
      scope,
      allowed,
      modules,
      user: { name: user.name, image: user.image, role: roleLabel(user) },
      unread,
      timer: running ? { startedAt: running.start.toISOString(), label: running.task?.title ?? running.project?.name ?? "Timer" } : null,
      notifications: notifications.map((n) => ({ id: n.id, title: n.title, link: n.link, unread: !n.readAt, time: formatRelative(n.createdAt, at) })),
    });
  });
