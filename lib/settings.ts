import { z } from "zod";

// Company.settings JSON. Missing keys fall back to these defaults.
export const companySettingsSchema = z.object({
  /** Goal is On Track at ≥ onTrack × expected progress, At Risk at ≥ atRisk ×, else Off Track. */
  goalThresholds: z.object({ onTrack: z.number().min(0).max(1), atRisk: z.number().min(0).max(1) }).default({ onTrack: 0.9, atRisk: 0.7 }),
  /** VMH production board: delivery promise for Shorts, in hours. */
  turnaroundTargetHours: z.object({ min: z.number(), max: z.number() }).default({ min: 24, max: 48 }),
  /** Dashboard revenue: invoices issued in the period, or payments received. */
  revenueBasis: z.enum(["INVOICED", "COLLECTED"]).default("INVOICED"),
  defaultTaxRate: z.number().min(0).max(100).default(0),
  paymentTermsDays: z.number().int().min(0).default(15),
  /** Weekly capacity for new team members, in hours. */
  defaultWeeklyCapacityHours: z.number().int().min(1).default(40),
});

export type CompanySettings = z.infer<typeof companySettingsSchema>;

export function parseCompanySettings(json: unknown): CompanySettings {
  return companySettingsSchema.parse(json ?? {});
}
