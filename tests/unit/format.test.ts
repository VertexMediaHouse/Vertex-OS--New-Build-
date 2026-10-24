import { describe, expect, it } from "vitest";
import {
  formatDate, formatDaysLeft, formatDuration, formatFileSize, formatINR, formatINRCompact, formatLongDate,
  formatRelative, formatTimePadded, initials,
} from "@/lib/format";

const ist = (s: string) => new Date(`${s}+05:30`);

describe("formatINR", () => {
  it("uses Indian grouping", () => {
    expect(formatINR(1245000)).toBe("₹12,45,000");
    expect(formatINR("2850000.00")).toBe("₹28,50,000");
    expect(formatINR(0)).toBe("₹0");
  });
  it("compacts axis labels", () => {
    expect(formatINRCompact(500000)).toBe("₹5L");
    expect(formatINRCompact(150000)).toBe("₹1.5L");
    expect(formatINRCompact(50000)).toBe("₹50K");
    expect(formatINRCompact(0)).toBe("0");
  });
});

describe("durations and sizes", () => {
  it("formats hours and minutes", () => {
    expect(formatDuration(11190)).toBe("186h 30m");
    expect(formatDuration(120)).toBe("2h 00m");
    expect(formatDuration(45)).toBe("45m");
  });
  it("formats file sizes like the PDF", () => {
    expect(formatFileSize(850 * 1024)).toBe("850 KB");
    expect(formatFileSize(2.4 * 1024 * 1024)).toBe("2.4 MB");
    expect(formatFileSize(24 * 1024 * 1024)).toBe("24 MB");
  });
});

describe("dates", () => {
  it("formats table, long and agenda dates in IST", () => {
    expect(formatDate(ist("2026-10-20T10:00:00"))).toBe("20 Oct 2026");
    expect(formatLongDate(ist("2026-10-22T09:00:00"))).toBe("Thursday, 22 October 2026");
    expect(formatTimePadded(ist("2026-10-22T14:00:00"))).toBe("02:00 PM");
  });
  it("says how long ago", () => {
    const now = ist("2026-10-22T12:00:00");
    expect(formatRelative(ist("2026-10-22T11:58:00"), now)).toBe("2 minutes ago");
    expect(formatRelative(ist("2026-10-22T11:00:00"), now)).toBe("1 hour ago");
    expect(formatRelative(ist("2026-10-19T12:00:00"), now)).toBe("3 days ago");
    expect(formatRelative(ist("2026-10-15T12:00:00"), now)).toBe("1 week ago");
  });
  it("counts days left by calendar day", () => {
    const now = ist("2026-10-22T23:00:00");
    expect(formatDaysLeft(ist("2026-10-25T09:00:00"), now)).toBe("3 days left");
    expect(formatDaysLeft(ist("2026-10-22T09:00:00"), now)).toBe("due today");
    expect(formatDaysLeft(ist("2026-10-20T09:00:00"), now)).toBe("2 days overdue");
  });
  it("makes initials", () => {
    expect(initials("Rohan Mehta")).toBe("RM");
    expect(initials("Dhrumil")).toBe("D");
  });
});
