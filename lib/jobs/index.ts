import { PgBoss } from "pg-boss";
import { db } from "@/lib/db";
import { now } from "@/lib/clock";
import { markOverdueInvoices } from "./invoices";

/** Background jobs on the same Postgres (pg-boss). Started once per server process. */
export const JOBS = {
  "invoices.overdue": { cron: "0 6 * * *", run: () => markOverdueInvoices(db, now()) },
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
