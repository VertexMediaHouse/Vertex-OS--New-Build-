import type { PrismaClient } from "@/lib/db";
import { deleteObject } from "@/lib/storage";

/** Daily: permanently delete files that have been in Trash for more than 30 days. */
export async function purgeTrash(db: PrismaClient, now: Date): Promise<number> {
  const old = await db.file.findMany({ where: { deletedAt: { lt: new Date(now.getTime() - 30 * 86_400_000) } }, include: { versions: true } });
  const orphans: string[] = [];
  for (const f of old) {
    for (const key of [f.storageKey, ...f.versions.map((v: any) => v.storageKey)]) {
      // The row goes either way; a key we couldn't delete is logged so it can be cleaned up.
      await deleteObject(key).catch(() => orphans.push(key));
    }
    await db.file.delete({ where: { id: f.id } });
  }
  if (orphans.length) console.error(`[jobs] files.purge left ${orphans.length} stored file(s) behind:`, orphans);
  return old.length;
}
