import { serve } from "@hono/node-server";
import { app } from "./app";

const port = Number(process.env.API_PORT ?? 4000);

serve({ fetch: app.fetch, port }, ({ port }) => console.log(`[api] http://localhost:${port}`));

// Cron jobs run in this process (checked every 30s against their schedule; see lib/jobs).
if (!process.env.DISABLE_JOBS) {
  import("@/lib/jobs")
    .then(({ startJobs }) => startJobs())
    .catch((e) => console.error("[jobs] failed to start", e));
}
