import { now } from "./clock";
import { parsePage } from "./pagination";
import { dayKey, lastDay, resolvePeriod } from "./period";

export type SP = Record<string, string | string[] | undefined>;

/** Typed reads of a page's searchParams. */
export function readParams(sp: SP) {
  const str = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : null);
  const period = resolvePeriod({ range: str("range"), from: str("from"), to: str("to") }, now());
  return {
    str,
    page: parsePage(sp.page),
    period,
    /** Props for <DateRangePicker>. */
    range: { preset: period.preset, from: dayKey(period.from), to: dayKey(lastDay(period)) },
    sort: (allowed: string[], fallback: string) => {
      const s = str("sort");
      return { field: s && allowed.includes(s) ? s : fallback, dir: str("dir") === "asc" ? ("asc" as const) : ("desc" as const) };
    },
  };
}

/** Narrow a company sub-filter (?co=vmh) to the companies already in scope. */
export function subScope(companyIds: string[], co: string | null): string[] {
  return co && companyIds.includes(co) ? [co] : companyIds;
}
