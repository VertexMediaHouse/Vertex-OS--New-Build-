import { describe, expect, it } from "vitest";
import { avgTurnaroundHours, waitingDays, workloadPercent, workloadState } from "@/lib/metrics/workload";
import { matchRules } from "@/lib/crosssell";
import { pctChange, resolvePeriod, dayKey, lastDay } from "@/lib/period";
import { pageItems, parsePage } from "@/lib/pagination";

const ist = (s: string) => new Date(`${s}+05:30`);

describe("workload", () => {
  it("adds logged and planned time against capacity", () => {
    expect(workloadPercent(28 * 60, 0, 40)).toBe(70);
    expect(workloadPercent(30 * 60, 18 * 60, 40)).toBe(120);
    expect(workloadPercent(60, 0, 0)).toBe(0);
  });
  it("flags over and idle", () => {
    expect(workloadState(120)).toBe("over");
    expect(workloadState(40)).toBe("idle");
    expect(workloadState(70)).toBe("ok");
    expect(workloadState(100)).toBe("ok");
  });
  it("averages turnaround and counts waiting days", () => {
    expect(avgTurnaroundHours([{ start: ist("2026-10-20T10:00:00"), end: ist("2026-10-21T14:00:00") }, { start: ist("2026-10-20T10:00:00"), end: ist("2026-10-21T10:00:00") }])).toBe(26);
    expect(avgTurnaroundHours([{ start: null, end: null }])).toBeNull();
    expect(waitingDays(ist("2026-10-20T09:00:00"), ist("2026-10-22T10:00:00"))).toBe(2);
  });
});

describe("cross-sell rules", () => {
  it("VMH client talking about a website, with no VTH project → VTH opportunity", () => {
    expect(matchRules({ notes: "needs a new website", tags: [], companyIds: ["vmh"], projectCompanyIds: ["vmh"] }).map((r) => r.id)).toEqual(["vmh-keywords-to-vth"]);
    expect(matchRules({ notes: "needs a new website", tags: [], companyIds: ["vmh"], projectCompanyIds: ["vmh", "vth"] })).toEqual([]);
  });
  it("VTH client launching a product → VMH opportunity", () => {
    expect(matchRules({ notes: null, tags: ["product-launch"], companyIds: ["vth"], projectCompanyIds: ["vth"] }).map((r) => r.id)).toEqual(["vth-launch-to-vmh"]);
  });
});

describe("periods", () => {
  const now = ist("2026-10-22T12:00:00");
  it("defaults to this month with last month for comparison", () => {
    const p = resolvePeriod({}, now);
    expect([dayKey(p.from), dayKey(lastDay(p)), dayKey(p.prevFrom)]).toEqual(["2026-10-01", "2026-10-31", "2026-09-01"]);
  });
  it("supports week, quarter and custom ranges", () => {
    expect(dayKey(resolvePeriod({ range: "week" }, now).from)).toBe("2026-10-19");
    expect(dayKey(resolvePeriod({ range: "quarter" }, now).from)).toBe("2026-10-01");
    const c = resolvePeriod({ range: "custom", from: "2026-10-05", to: "2026-10-10" }, now);
    expect([dayKey(c.from), dayKey(lastDay(c)), dayKey(c.prevFrom)]).toEqual(["2026-10-05", "2026-10-10", "2026-09-29"]);
  });
  it("computes % change", () => {
    expect(pctChange(118, 100)).toBeCloseTo(18);
    expect(pctChange(5, 0)).toBeNull();
    expect(pctChange(0, 0)).toBe(0);
  });
});

describe("pagination", () => {
  it("shows pages like the PDF", () => {
    expect(pageItems(1, 7)).toEqual([1, 2, 3, 4, 5, "…", 7]);
    expect(pageItems(6, 10)).toEqual([1, "…", 5, 6, 7, "…", 10]);
    expect(pageItems(2, 3)).toEqual([1, 2, 3]);
    expect(parsePage("3")).toBe(3);
    expect(parsePage("-1")).toBe(1);
    expect(parsePage(undefined)).toBe(1);
  });
});
