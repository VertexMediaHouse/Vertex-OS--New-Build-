import { db } from "@/lib/db";
import { auth } from "@/lib/auth/server";
import type { ActionResult } from "@/lib/validation/result";

/**
 * Give a client contact their own portal login and email them a link to set a password.
 * Called when a client is onboarded with a contact email, and from the project's Client
 * Access tab. The caller checks permissions first; this only does the work.
 */
export async function invitePortalContact(contactId: string): Promise<ActionResult> {
  const contact = await db.clientContact.findUniqueOrThrow({ where: { id: contactId } });
  if (!contact.email) return { ok: false, error: "Add an email for this contact first." };
  const email = contact.email.toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing && existing.kind !== "CLIENT") return { ok: false, error: "That email belongs to a staff account." };
  const portalUser = existing ?? (await db.user.create({ data: { email, name: contact.name, kind: "CLIENT", emailVerified: true } }));
  await db.clientContact.update({ where: { id: contact.id }, data: { portalAccess: true, userId: portalUser.id } });
  // The reset link doubles as the sign-up link: the account exists, it just has no password.
  await auth.api.requestPasswordReset({ body: { email, redirectTo: "/reset-password" } });
  return { ok: true };
}
