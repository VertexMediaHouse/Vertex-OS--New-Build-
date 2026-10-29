import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";

describe("db.task.aggregate and position calculation", () => {
  it("calculates _max correctly on numeric fields for kanban positioning", async () => {
    // Create temporary tasks with known positions
    const t1 = await db.task.create({
      data: {
        title: "Test task 1",
        companyId: "vmh",
        status: "TODO",
        position: 5,
      },
    });
    const t2 = await db.task.create({
      data: {
        title: "Test task 2",
        companyId: "vmh",
        status: "TODO",
        position: 12,
      },
    });

    const agg = await db.task.aggregate({
      _max: { position: true },
      where: { id: { in: [t1.id, t2.id] } },
    });

    expect(agg._max).toBeDefined();
    expect(agg._max.position).toBe(12);

    // Position calculation pattern used by /move
    const nextPos = Number(agg._max.position ?? -1) + 1;
    expect(nextPos).toBe(13);

    // Empty result returns null without throwing
    const emptyAgg = await db.task.aggregate({
      _max: { position: true },
      where: { id: "non-existent-task-id" },
    });
    expect(emptyAgg._max).toBeDefined();
    expect(emptyAgg._max.position).toBeNull();
    const fallbackPos = Number(emptyAgg._max.position ?? -1) + 1;
    expect(fallbackPos).toBe(0);

    // Clean up
    await db.task.delete({ where: { id: t1.id } });
    await db.task.delete({ where: { id: t2.id } });
  });

  it("calculates _min and _avg correctly", async () => {
    const t1 = await db.task.create({
      data: { title: "T1", companyId: "vmh", status: "TODO", position: 10 },
    });
    const t2 = await db.task.create({
      data: { title: "T2", companyId: "vmh", status: "TODO", position: 20 },
    });

    const agg = await db.task.aggregate({
      _min: { position: true },
      _avg: { position: true },
      where: { id: { in: [t1.id, t2.id] } },
    });

    expect(agg._min?.position).toBe(10);
    expect(agg._avg?.position).toBe(15);

    // Clean up
    await db.task.delete({ where: { id: t1.id } });
    await db.task.delete({ where: { id: t2.id } });
  });
});
