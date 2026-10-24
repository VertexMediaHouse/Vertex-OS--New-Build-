import { PgBoss } from "pg-boss";
import { db } from "@/lib/db";
import { now } from "@/lib/clock";
import { markOverdueInvoices } from "./invoices";
import { recomputeGoals } from "./goals";
import { purgeTrash } from "./files";
import { sendDueCampaignSteps } from "@/lib/campaigns";
import { runCrossSellRules } from "@/lib/crosssell";

/** Background jobs on the same Postgres (pg-boss). Started once per server process. */
export const JOBS = {
  "invoices.overdue": { cron: "0 6 * * *", run: () => markOverdueInvoices(db, now()) },
  "goals.recompute": { cron: "0 * * * *", run: () => recomputeGoals(db, now()) },
  "files.purge": { cron: "30 3 * * *", run: () => purgeTrash(db, now()) },
  "campaigns.send": { cron: "*/10 * * * *", run: () => sendDueCampaignSteps(db, now()) },
  "crosssell.run": { cron: "15 * * * *", run: () => runCrossSellRules(db) },
} as Record<string, { cron: string; run: () => Promise<unknown> }>;

let started: Promise<PgBoss> | null = null;

export function startJobs() {
  started ??= (async () => {
    const boss = new PgBoss(process.env.DATABASE_URL!);
    boss.on("error", (e) => console.error("[jobs]", e));
    await boss.start();
    for (const [name, job] of Object.entries(JOBS)) {
      await boss.createQueue(name);
      await boss.schedule(name, job.cron, null, { tz: "Asia/Kolkata" });
      await boss.work(name, async () => {
        await job.run();
      });
    }
    return boss;
  })();
  return started;
}
