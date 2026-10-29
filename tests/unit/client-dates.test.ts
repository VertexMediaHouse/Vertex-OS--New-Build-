// A client created on the live site has a blank lastActivityAt cell in Sheets.
// That used to reach formatRelative() as "" and blank the whole Clients page.
import { expect, it } from "vitest";
import { listClients } from "@/lib/clients";

it("blank date cells never reach callers as strings", async () => {
  const rows = await listClients({ companyIds: ["vmh", "vth"] });
  expect(rows.length).toBeGreaterThan(0);
  for (const r of rows) {
    expect(r.lastActivityAt).toBeInstanceOf(Date);
    expect(r.lastActivity).toMatch(/ago|just now/);
    // The route sorts on this; a string would throw here.
    expect(Number.isFinite(r.lastActivityAt.getTime())).toBe(true);
  }
});
