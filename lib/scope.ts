// Company scope shared by client and server code. Server resolution lives in lib/auth/context.ts.

export type Scope = "ALL" | "VMH" | "VTH";
export type CompanyCode = "VMH" | "VTH";

export const SCOPE_COOKIE = "vcc_company";
export const SCOPE_PARAM = "company";

/** Company rows use their lowercase code as id ("vmh", "vth"), so scope filters need no lookup. */
export const companyIdOf = (code: CompanyCode) => code.toLowerCase();
export const ALL_COMPANY_IDS = ["vmh", "vth"] as const;

export function parseScope(value: string | null | undefined): Scope | null {
  const v = value?.toUpperCase();
  return v === "ALL" || v === "VMH" || v === "VTH" ? v : null;
}

export const COMPANY_META = {
  VMH: { code: "VMH", name: "Vertex Media House", tagline: "Video Editing" },
  VTH: { code: "VTH", name: "Vertex Tech House", tagline: "Web, CRM, ERP, Automation" },
} as const;
