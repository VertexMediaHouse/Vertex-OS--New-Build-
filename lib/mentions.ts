import { db } from "@/lib/db";

/** "@Rohan" → user ids (first names of active staff). */
export async function mentionedUsers(text: string): Promise<string[]> {
  const names = [...text.matchAll(/@([A-Za-z][\w.-]*)/g)].map((m) => m[1]!.toLowerCase());
  if (!names.length) return [];
  const users = await db.user.findMany({ where: { kind: "STAFF", active: true }, select: { id: true, name: true } });
  return users.filter((u) => names.includes(u.name.split(" ")[0]!.toLowerCase())).map((u) => u.id);
}
