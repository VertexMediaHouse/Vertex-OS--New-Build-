import type { PrismaClient } from "@/lib/db";
import { dayKey } from "@/lib/period";

/** ISO weekday for an instant, in IST: 1 = Monday … 7 = Sunday. */
function istWeekday(at: Date): number {
  const ist = new Date(at.getTime() + 5.5 * 3_600_000);
  return ist.getUTCDay() === 0 ? 7 : ist.getUTCDay();
}

/**
 * Create today's copy of each active routine, once. `lastRunOn` holds the IST day the
 * routine last produced a task, so a restart, a retry or a second run the same day adds
 * nothing. Returns how many tasks were created.
 */
export async function runRoutines(db: PrismaClient, at: Date): Promise<number> {
  const today = dayKey(at);
  const weekday = istWeekday(at);
  const due = await db.recurringTask.findMany({
    where: { active: true, OR: [{ lastRunOn: null }, { lastRunOn: { not: today } }] },
  });
  let made = 0;
  for (const r of due) {
    if (r.weekdays.length > 0 && !r.weekdays.includes(weekday)) continue;
    // Claim the day first: if this throws or the process dies, the row is already marked.
    const claimed = await db.recurringTask.updateMany({
      where: { id: r.id, OR: [{ lastRunOn: null }, { lastRunOn: { not: today } }] },
      data: { lastRunOn: today },
    });
    if (claimed.count === 0) continue;
    await db.task.create({
      data: {
        companyId: r.companyId,
        projectId: r.projectId,
        title: r.title,
        assigneeId: r.assigneeId,
        createdById: r.createdById,
        priority: r.priority,
        estimatedMinutes: r.estimatedMinutes,
        status: "TODO",
        // Due at the end of the day it was created for.
        dueDate: new Date(`${today}T23:59:00+05:30`),
      },
    });
    made++;
  }
  return made;
}
