import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

const { insightSentences } = await import("@/lib/metrics/reports");
const { merge } = await import("@/lib/campaigns");

describe("insightSentences", () => {
  it("words direction, rounding and plurals from the numbers", () => {
    expect(insightSentences({ revenueChange: 18.4, newClients: 1, hoursChange: -6.6, hours: 11190, completed: 2 }).map((s) => s.text)).toEqual([
      "Revenue increased by 18% compared to last period.",
      "1 new client added this period.",
      "Team productivity down by 7% (187h this period).",
      "2 projects completed this period.",
    ]);
  });
  it("skips comparisons when there is no previous period", () => {
    expect(insightSentences({ revenueChange: null, newClients: 0, hoursChange: null, hours: 0, completed: 1 }).map((s) => s.tone)).toEqual(["clients", "trophy"]);
  });
});

describe("merge", () => {
  it("fills known fields, blanks unknown ones and escapes HTML", () => {
    expect(merge("Hi {{ name }}, {{company}}{{missing}}", { name: "<Ana>", company: "Tom & Co" })).toBe("Hi &lt;Ana&gt;, Tom &amp; Co");
  });
});
