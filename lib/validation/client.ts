import { z } from "zod";

export const CLIENT_STATUSES = ["ACTIVE", "ON_HOLD", "COMPLETED", "INACTIVE"] as const;

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  domain: z.string().trim().max(120).optional(),
  type: z.string().trim().max(120).optional(),
  status: z.enum(CLIENT_STATUSES).default("ACTIVE"),
  companies: z.array(z.enum(["vmh", "vth"])).min(1, "Pick at least one company"),
  ownerId: z.string().max(64).optional().or(z.literal("")),
  tags: z.array(z.string().trim().max(40)).max(20).optional(),
  notes: z.string().trim().max(5000).optional(),
  address: z.string().trim().max(500).optional(),
  contactName: z.string().trim().max(120).optional(),
  contactEmail: z.string().trim().email().max(200).optional().or(z.literal("")),
});

export type ClientInput = z.input<typeof clientSchema>;
