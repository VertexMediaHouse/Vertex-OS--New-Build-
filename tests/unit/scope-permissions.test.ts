import { describe, expect, it } from "vitest";
import { scopedClientWhere, scopedSharedWhere, scopedWhere } from "@/lib/db/scope";
import { allowedCompanyIds, can, isMemberOnly, roleLabel, type CurrentUser } from "@/lib/auth/permissions";
import { parseScope } from "@/lib/scope";

const user = (over: Partial<CurrentUser>): CurrentUser => ({
  id: "u", name: "U", email: "u@x", image: null, isOwner: false, kind: "STAFF", title: null, weeklyCapacityHours: 40, memberships: [], ...over,
});

describe("scope", () => {
  it("parses URL/cookie values", () => {
    expect(parseScope("vmh")).toBe("VMH");
    expect(parseScope("ALL")).toBe("ALL");
    expect(parseScope("xyz")).toBeNull();
    expect(parseScope(undefined)).toBeNull();
  });
  it("builds filters for each row shape", () => {
    expect(scopedWhere({ companyIds: ["vmh"] })).toEqual({ companyId: { in: ["vmh"] } });
    expect(scopedSharedWhere({ companyIds: ["vth"] })).toEqual({ OR: [{ companyId: { in: ["vth"] } }, { companyId: null }] });
    expect(scopedClientWhere({ companyIds: ["vmh", "vth"] })).toEqual({ companies: { some: { companyId: { in: ["vmh", "vth"] } } } });
  });
});

describe("permissions", () => {
  const owner = user({ isOwner: true });
  const vmhManager = user({ memberships: [{ companyId: "vmh", role: "MANAGER", modules: [] }] });
  const member = user({ memberships: [{ companyId: "vmh", role: "MEMBER", modules: [] }, { companyId: "vth", role: "MEMBER", modules: [] }] });
  // Someone an admin has narrowed to just two modules in Settings.
  const narrowed = user({ memberships: [{ companyId: "vmh", role: "MANAGER", modules: ["task", "time"] }] });
  const client = user({ kind: "CLIENT" });

  it("owner sees both companies and can do anything", () => {
    expect(allowedCompanyIds(owner)).toEqual(["vmh", "vth"]);
    expect(can(owner, "delete", "invoice", "vth")).toBe(true);
    expect(roleLabel(owner)).toBe("Owner (Super Admin)");
  });
  it("roles are checked per company", () => {
    expect(allowedCompanyIds(vmhManager)).toEqual(["vmh"]);
    expect(can(vmhManager, "approve", "time", "vmh")).toBe(true);
    expect(can(vmhManager, "approve", "time", "vth")).toBe(false);
    expect(can(vmhManager, "view", "settings")).toBe(false);
  });
  it("members only work on their own things", () => {
    expect(can(member, "update", "task", "vth")).toBe(true);
    expect(can(member, "view", "invoice")).toBe(false);
    expect(can(member, "view", "lead")).toBe(false);
    expect(isMemberOnly(member)).toBe(true);
    expect(isMemberOnly(vmhManager, "vmh")).toBe(false);
  });
  it("a module list in Settings narrows the role, never widens it", () => {
    expect(can(narrowed, "update", "task", "vmh")).toBe(true);
    expect(can(narrowed, "view", "lead", "vmh")).toBe(false); // the role allows it, the list does not
    expect(can(narrowed, "view", "invoice", "vmh")).toBe(false);
    expect(can(narrowed, "view", "settings", "vmh")).toBe(false); // not granted by the role either
  });
  it("portal clients get no staff permissions", () => {
    expect(can(client, "view", "dashboard")).toBe(false);
  });
});
