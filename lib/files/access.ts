import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth/permissions";
import { allowedCompanyIds, isMemberOnly } from "@/lib/auth/permissions";

/**
 * Who may see a file: staff in its company (members: only files on their projects/tasks or shared
 * with them, plus their own uploads); portal clients: their client's files marked for the portal.
 */
export async function canSeeFile(user: CurrentUser, fileId: string) {
  const f = await db.file.findUnique({ where: { id: fileId }, include: { shares: true, project: { select: { members: { select: { userId: true } } } }, task: { select: { assigneeId: true } } } });
  if (!f) return null;
  if (user.kind === "CLIENT") {
    const contact = await db.clientContact.findUnique({ where: { userId: user.id } });
    const ok = contact?.portalAccess && f.clientId === contact.clientId && (f.sharedWithPortal || f.shares.some((s) => s.clientContactId === contact.id));
    return ok && !f.deletedAt ? f : null;
  }
  if (f.companyId && !allowedCompanyIds(user).includes(f.companyId)) return null;
  if (isMemberOnly(user, f.companyId ?? undefined)) {
    const mine = f.uploadedById === user.id || f.shares.some((s) => s.userId === user.id) || f.project?.members.some((m) => m.userId === user.id) || f.task?.assigneeId === user.id;
    if (!mine) return null;
  }
  return f;
}
