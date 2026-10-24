import { z } from "zod";

export const STAGES = ["NEW", "CONTACTED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"] as const;
export const SOURCES = ["FIVERR", "WEBSITE", "REFERRAL", "LINKEDIN", "EMAIL", "INSTAGRAM", "OTHER"] as const;

export const leadSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  service: z.string().trim().min(1, "Service is required").max(120),
  value: z.coerce.number().min(0).max(1e10),
  companyId: z.enum(["vmh", "vth"]),
  source: z.enum(SOURCES),
  ownerId: z.string().max(64).optional().or(z.literal("")),
  contactName: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(5000).optional(),
});

export type LeadInput = z.input<typeof leadSchema>;
