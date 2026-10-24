// The one place company scoping turns into query filters. Every module query uses these.

export type ScopeFilter = {
  /** Company ids the viewer may see in the current scope, e.g. ["vmh"] or ["vmh", "vth"]. */
  companyIds: string[];
};

/** Rows that always belong to one company (leads, projects, tasks, time, invoices). */
export function scopedWhere(s: ScopeFilter) {
  return { companyId: { in: s.companyIds } };
}

/** Rows where companyId = null means "both companies" (goals, events, campaigns, activity). */
export function scopedSharedWhere(s: ScopeFilter) {
  return { OR: [{ companyId: { in: s.companyIds } }, { companyId: null }] };
}

/** Clients, which can belong to one or both companies. */
export function scopedClientWhere(s: ScopeFilter) {
  return { companies: { some: { companyId: { in: s.companyIds } } } };
}
