import { expect, test } from "vitest";
import { hydrateDates } from "@/lib/db";

// Regression: every boolean column (isOwner, active, done, billable, ...) comes back
// from the Sheets CSV as the literal string "TRUE"/"FALSE". Left as a string, "FALSE"
// is truthy in JS, so e.g. a staff member with isOwner explicitly set to FALSE still
// passed every `if (user.isOwner)` check and saw the super-admin dashboard.
test("TRUE/FALSE cells hydrate to real booleans", () => {
  expect(hydrateDates("TRUE")).toBe(true);
  expect(hydrateDates("FALSE")).toBe(false);
});

test("FALSE hydrates to a falsy value, not a truthy string", () => {
  expect(Boolean(hydrateDates("FALSE"))).toBe(false);
});

test("boolean coercion applies inside objects and arrays", () => {
  expect(hydrateDates({ isOwner: "FALSE", active: "TRUE" })).toEqual({ isOwner: false, active: true });
  expect(hydrateDates(["TRUE", "FALSE"])).toEqual([true, false]);
});

test("ordinary text isn't mistaken for a boolean", () => {
  expect(hydrateDates("TRUEish")).toBe("TRUEish");
  expect(hydrateDates("Dhrumil")).toBe("Dhrumil");
});
