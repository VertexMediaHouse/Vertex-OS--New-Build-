import { describe, expect, it } from "vitest";
import { runRoutines } from "@/lib/jobs/routines";
import type { PrismaClient } from "@/lib/db";

type Row = { id: string; companyId: string; projectId: string | null; title: string; assigneeId: string; createdById: string | null; priority: "MEDIUM"; estimatedMinutes: number | null; weekdays: number[]; active: boolean; lastRunOn: string | null };

/** Just enough Prisma to run the job: rows in memory, same claim-then-create order. */
function fakeDb(rows: Row[]) {
  const created: { title: string; assigneeId: string; dueDate: Date }[] = [];
  const db = {
    recurringTask: {
      findMany: async ({ where }: { where: { OR: { lastRunOn: string | null | { not: string } }[] } }) => {
        const today = (where.OR[1]!.lastRunOn as { not: string }).not;
        return rows.filter((r) => r.active && r.lastRunOn !== today);
      },
      updateMany: async ({ where, data }: { where: { id: string }; data: { lastRunOn: string } }) => {
        const row = rows.find((r) => r.id === where.id && r.lastRunOn !== data.lastRunOn);
        if (!row) return { count: 0 };
        row.lastRunOn = data.lastRunOn;
        return { count: 1 };
      },
    },
    task: { create: async ({ data }: { data: { title: string; assigneeId: string; dueDate: Date } }) => void created.push(data) },
  };
  return { db: db as unknown as PrismaClient, created, rows };
}

const routine = (over: Partial<Row> = {}): Row => ({
  id: "r1", companyId: "vmh", projectId: null, title: "Post the daily short", assigneeId: "u1",
  createdById: "owner", priority: "MEDIUM", estimatedMinutes: null, weekdays: [], active: true, lastRunOn: null, ...over,
});

// 2026-10-26 is a Monday; 18:00 UTC on the 25th is already Monday in IST (+5:30).
const monday = new Date("2026-10-26T04:00:00Z");
const saturday = new Date("2026-10-31T04:00:00Z");

describe("daily routines", () => {
  it("creates one task per routine, due at the end of that day", async () => {
    const { db, created } = fakeDb([routine()]);
    expect(await runRoutines(db, monday)).toBe(1);
    expect(created).toHaveLength(1);
    expect(created[0]!.title).toBe("Post the daily short");
    expect(created[0]!.dueDate.toISOString()).toBe("2026-10-26T18:29:00.000Z"); // 23:59 IST
  });

  it("never doubles up: a second run the same day makes nothing", async () => {
    const { db, created } = fakeDb([routine()]);
    await runRoutines(db, monday);
    expect(await runRoutines(db, monday)).toBe(0);
    expect(created).toHaveLength(1);
  });

  it("runs again the next day", async () => {
    const { db, created } = fakeDb([routine({ lastRunOn: "2026-10-25" })]);
    expect(await runRoutines(db, monday)).toBe(1);
    expect(created).toHaveLength(1);
  });

  it("skips a day that is not in its weekdays, without claiming it", async () => {
    const { db, created, rows } = fakeDb([routine({ weekdays: [1, 2, 3, 4, 5] })]);
    expect(await runRoutines(db, saturday)).toBe(0);
    expect(created).toHaveLength(0);
    // Not marked as run, so Monday still works.
    expect(rows[0]!.lastRunOn).toBeNull();
    expect(await runRoutines(db, monday)).toBe(1);
  });

  it("leaves paused routines alone", async () => {
    const { db, created } = fakeDb([routine({ active: false })]);
    expect(await runRoutines(db, monday)).toBe(0);
    expect(created).toHaveLength(0);
  });

  it("uses the IST day, not the UTC one", async () => {
    // 19:00 UTC on Sunday the 25th is already Monday the 26th in IST.
    const { db, created } = fakeDb([routine({ weekdays: [1] })]);
    expect(await runRoutines(db, new Date("2026-10-25T19:00:00Z"))).toBe(1);
    expect(created[0]!.dueDate.toISOString()).toBe("2026-10-26T18:29:00.000Z");
  });
});
