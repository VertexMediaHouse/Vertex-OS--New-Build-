import type { PrismaClient } from "@/lib/db/generated/client";
import { deleteObject } from "@/lib/storage";

/** Daily: permanently delete files that have been in Trash for more than 30 days. */
export async function purgeTrash(db: PrismaClient, now: Date): Promise<number> {
  const old = await db.file.findMany({ where: { deletedAt: { lt: new Date(now.getTime() - 30 * 86_400_000) } }, include: { versions: true } });
  for (const f of old) {
    for (const key of [f.storageKey, ...f.versions.map((v) => v.storageKey)]) await deleteObject(key).catch(() => undefined);
    await db.file.delete({ where: { id: f.id } });
  }
  return old.length;
}
