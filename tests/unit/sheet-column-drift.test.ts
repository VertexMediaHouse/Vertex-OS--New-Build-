// A sheet tab only grows a column once a write actually carries a value for it, so
// tabs legitimately lag the code's row shape (the live `task` tab has no parentId
// until the first subtask exists). Rows must still reach callers fully shaped.
import { expect, test } from "vitest";
import { SCHEMA } from "@/lib/db/schema";

test("every table in the store has a SCHEMA shape to normalize against", async () => {
  // Auth tables are owned by Better Auth and deliberately absent from SCHEMA.
  const authOwned = ["session", "verification", "rateLimit"];
  const src = await import("node:fs").then((fs) =>
    fs.readFileSync(new URL("../../lib/db/index.ts", import.meta.url), "utf8"),
  );
  const block = /const store: Record<string, any\[\]> = \{([\s\S]*?)\n\};/.exec(src)![1]!;
  const tables = [...block.matchAll(/^ {2}([a-zA-Z]+):/gm)].map((m) => m[1]!);

  const unshaped = tables.filter((t) => !(t in SCHEMA) && !authOwned.includes(t));
  expect(unshaped, "add these to lib/db/schema.ts or normalizeRow() skips them").toEqual([]);
});

test("array columns are declared as arrays in SCHEMA, so they default to [] not null", () => {
  // These are mapped/filtered without a guard at call sites; null would throw.
  const mustBeArrays: Array<[string, string]> = [
    ["client", "tags"], ["task", "tags"], ["file", "tags"],
    ["membership", "modules"], ["calendarEvent", "attendeeIds"],
    ["comment", "mentions"], ["recurringTask", "weekdays"], ["emailCampaign", "steps"],
  ];
  for (const [table, col] of mustBeArrays) {
    const sample = (SCHEMA as Record<string, any>)[table]?.[col];
    expect(Array.isArray(sample), `SCHEMA.${table}.${col} must be an array sample`).toBe(true);
  }
});
