import { db } from "@/lib/db";
import { now } from "@/lib/clock";
import { markOverdueInvoices } from "./invoices";
import { recomputeGoals } from "./goals";
import { purgeTrash } from "./files";
import { runRoutines } from "./routines";
import { sendDueCampaignSteps } from "@/lib/campaigns";
import { runCrossSellRules } from "@/lib/crosssell";

/** Background jobs, in-process. Started once per server process (see server/index.ts). */
export const JOBS = {
  "invoices.overdue": { cron: "0 6 * * *", run: () => markOverdueInvoices(db, now()) },
  // Early enough that the day's fixed tasks are waiting when people start.
  "routines.create": { cron: "5 6 * * *", run: () => runRoutines(db, now()) },
  "goals.recompute": { cron: "0 * * * *", run: () => recomputeGoals(db, now()) },
  "files.purge": { cron: "30 3 * * *", run: () => purgeTrash(db, now()) },
  "campaigns.send": { cron: "*/10 * * * *", run: () => sendDueCampaignSteps(db, now()) },
  "crosssell.run": { cron: "15 * * * *", run: () => runCrossSellRules(db) },
} as Record<string, { cron: string; run: () => Promise<unknown> }>;

// One field of a 5-field cron expression: "*", "N" or "star-slash-N". Minute/hour/day/month/weekday only.
function fieldMatches(field: string, value: number): boolean {
  if (field === "*") return true;
  if (field.startsWith("*/")) return value % Number(field.slice(2)) === 0;
  return Number(field) === value;
}

function cronDue(cron: string, at: Date): boolean {
  const [min, hour, day, month, weekday] = cron.split(" ");
  return (
    fieldMatches(min!, at.getMinutes()) &&
    fieldMatches(hour!, at.getHours()) &&
    fieldMatches(day!, at.getDate()) &&
    fieldMatches(month!, at.getMonth() + 1) &&
    fieldMatches(weekday!, at.getDay())
  );
}

function istNow(): Date {
  // IST has no DST, so a fixed +5:30 offset from UTC is exact.
  const t = new Date();
  return new Date(t.getTime() + (330 + t.getTimezoneOffset()) * 60_000);
}

let started = false;
let lastRunMinute = "";

export function startJobs(): void {
  if (started) return;
  started = true;
  const tick = async () => {
    const at = istNow();
    const minuteKey = `${at.getFullYear()}-${at.getMonth()}-${at.getDate()}-${at.getHours()}-${at.getMinutes()}`;
    if (minuteKey === lastRunMinute) return;
    lastRunMinute = minuteKey;
    for (const [name, job] of Object.entries(JOBS)) {
      if (cronDue(job.cron, at)) await job.run().catch((e) => console.error(`[jobs] ${name} failed`, e));
    }
  };
  tick();
  setInterval(tick, 30_000);
}
