import { expect, test } from "vitest";
import { parseCsv } from "@/lib/sheets/csv";

test("keeps headers verbatim so camelCase date/FK columns still match", () => {
  const rows = parseCsv('"companyId","lastActivityAt"\n"vmh","2026-10-27T04:30:00.000Z"');
  expect(rows[0]).toEqual({ companyId: "vmh", lastActivityAt: "2026-10-27T04:30:00.000Z" });
});

test("drops the sheet's trailing padding columns", () => {
  // Real shape of the `client` tab: four blank headers after the last real one.
  const rows = parseCsv('"name","id","","",""\n"Durrell","client_1","","",""');
  expect(Object.keys(rows[0]!)).toEqual(["name", "id"]);
});

test("handles quoted commas, escaped quotes and newlines inside a field", () => {
  const rows = parseCsv('"body","id"\n"Hi ""there"", line1\nline2, end","c1"');
  expect(rows).toHaveLength(1);
  expect(rows[0]!.body).toBe('Hi "there", line1\nline2, end');
  expect(rows[0]!.id).toBe("c1");
});

test("empty tab and header-only tab yield no rows", () => {
  expect(parseCsv("")).toEqual([]);
  expect(parseCsv('"id","name"')).toEqual([]);
});

test("blank lines between records are skipped, not emitted as rows", () => {
  expect(parseCsv('"id"\n"a"\n\n"b"\n')).toEqual([{ id: "a" }, { id: "b" }]);
});
