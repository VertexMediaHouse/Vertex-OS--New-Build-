import { describe, expect, it } from "vitest";
import { goalProgress, goalStatus } from "@/lib/metrics/goals";
import { invoiceStatus, invoiceTotals } from "@/lib/invoices/status";

const ist = (s: string) => new Date(`${s}+05:30`);
const oct = { startDate: ist("2026-10-01T00:00:00"), endDate: ist("2026-10-31T23:59:00") };
const now = ist("2026-10-22T12:00:00"); // ~69% of October elapsed

describe("goal status", () => {
  it("measures progress from start to target", () => {
    expect(goalProgress({ startValue: 0, currentValue: 187500, targetValue: 250000 })).toBe(75);
    expect(goalProgress({ startValue: 10, currentValue: 5, targetValue: 20 })).toBe(0);
    expect(goalProgress({ startValue: 0, currentValue: 30, targetValue: 20 })).toBe(100);
  });
  it("compares progress with time elapsed", () => {
    expect(goalStatus({ progress: 75, ...oct, now })).toBe("ON_TRACK");
    expect(goalStatus({ progress: 50, ...oct, now })).toBe("AT_RISK");
    expect(goalStatus({ progress: 20, ...oct, now })).toBe("OFF_TRACK");
    expect(goalStatus({ progress: 100, ...oct, now })).toBe("COMPLETED");
  });
  it("is overdue only after the end date's own day", () => {
    // Dates from the form are stored at midnight; the goal still has that whole day.
    expect(goalStatus({ progress: 30, startDate: oct.startDate, endDate: ist("2026-10-22T00:00:00"), now })).toBe("OFF_TRACK");
    expect(goalStatus({ progress: 30, startDate: oct.startDate, endDate: ist("2026-10-21T00:00:00"), now })).toBe("OVERDUE");
  });
  it("is on track before it starts", () => {
    expect(goalStatus({ progress: 0, startDate: ist("2026-11-01T00:00:00"), endDate: ist("2026-11-30T00:00:00"), now })).toBe("ON_TRACK");
  });
  it("respects custom thresholds", () => {
    expect(goalStatus({ progress: 60, ...oct, now, thresholds: { onTrack: 0.85, atRisk: 0.5 } })).toBe("ON_TRACK");
  });
});

describe("invoice status", () => {
  const due = ist("2026-10-20T18:00:00");
  it("follows money and dates", () => {
    expect(invoiceStatus({ current: "PENDING", total: 100, paid: 100, dueDate: due, now })).toBe("PAID");
    expect(invoiceStatus({ current: "PENDING", total: 100, paid: 40, dueDate: due, now })).toBe("OVERDUE");
    expect(invoiceStatus({ current: "OVERDUE", total: 100, paid: 0, dueDate: ist("2026-10-22T18:00:00"), now })).toBe("PENDING");
  });
  it("keeps manual states", () => {
    expect(invoiceStatus({ current: "DRAFT", total: 100, paid: 0, dueDate: due, now })).toBe("DRAFT");
    expect(invoiceStatus({ current: "CANCELLED", total: 100, paid: 0, dueDate: due, now })).toBe("CANCELLED");
  });
  it("totals line items with tax and discount", () => {
    expect(invoiceTotals([{ qty: 1, rate: 180000 }, { qty: 1, rate: 40000 }, { qty: 1, rate: 30000 }])).toEqual({ subtotal: 250000, taxAmount: 0, total: 250000 });
    expect(invoiceTotals([{ qty: 2, rate: 5000 }], 18, 1000)).toEqual({ subtotal: 10000, taxAmount: 1620, total: 10620 });
  });
});
