import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { auth } from "./auth";
import type { Env } from "./context";
import { activity } from "./routes/activity";
import { calendar } from "./routes/calendar";
import { campaigns } from "./routes/campaigns";
import { clients } from "./routes/clients";
import { content } from "./routes/content";
import { dashboard } from "./routes/dashboard";
import { files } from "./routes/files";
import { goals } from "./routes/goals";
import { invoices } from "./routes/invoices";
import { leads } from "./routes/leads";
import { notifications } from "./routes/notifications";
import { portal } from "./routes/portal";
import { publicRoutes } from "./routes/public";
import { projects } from "./routes/projects";
import { reports } from "./routes/reports";
import { search } from "./routes/search";
import { settings } from "./routes/settings";
import { shell } from "./routes/shell";
import { tasks } from "./routes/tasks";
import { team } from "./routes/team";
import { time } from "./routes/time";
import { googleEnabled } from "@/lib/auth/config";
import { ForbiddenError } from "@/lib/auth/permissions";
import { parseScope, SCOPE_COOKIE } from "@/lib/scope";

export const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:5173";

const base = new Hono<Env>();

base.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return WEB_ORIGIN;
      if (
        origin === WEB_ORIGIN ||
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        return origin;
      }
      return null;
    },
    credentials: true,
  })
);

// Everything answers in the ActionResult shape the frontend already branches on.
base.onError((err, c) => {
  if (err instanceof ForbiddenError) return c.json({ ok: false, error: err.message }, 403);
  if (err instanceof HTTPException) return c.json({ ok: false, error: err.message }, err.status);
  console.error("[api]", err);
  return c.json({ ok: false, error: "Something went wrong." }, 500);
});

base.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

export const app = base
  .get("/api/health", (c) => c.json({ ok: true as const }))
  // Public: the login page needs to know whether to offer the Google button.
  .get("/api/config", (c) => c.json({ google: googleEnabled }))
  // Replaces proxy.ts's ?company= -> cookie sync. The value is only a preference:
  // withScope narrows it to the companies the user actually belongs to.
  .post("/api/scope", async (c) => {
    const scope = parseScope((await c.req.json<{ company?: string }>()).company);
    if (!scope) return c.json({ ok: false as const, error: "Unknown company." }, 400);
    setCookie(c, SCOPE_COOKIE, scope.toLowerCase(), {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "Lax",
    });
    return c.json({ ok: true as const });
  })
  .route("/api", publicRoutes)
  .route("/api/shell", shell)
  .route("/api/search", search)
  .route("/api/notifications", notifications)
  .route("/api/activity", activity)
  .route("/api/dashboard", dashboard)
  .route("/api/calendar", calendar)
  .route("/api/leads", leads)
  .route("/api/clients", clients)
  .route("/api/projects", projects)
  .route("/api/tasks", tasks)
  .route("/api/time", time)
  .route("/api/invoices", invoices)
  .route("/api/campaigns", campaigns)
  .route("/api/content", content)
  .route("/api/goals", goals)
  .route("/api/team", team)
  .route("/api/files", files)
  .route("/api/reports", reports)
  .route("/api/settings", settings)
  .route("/api/portal", portal);

export type AppType = typeof app;
