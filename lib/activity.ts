import type { EntityType, Prisma, PrismaClient } from "@/lib/db";

type Tx = Prisma.TransactionClient | PrismaClient;

export type ActivityInput = {
  companyId: string | null;
  actorId: string | null;
  verb: string;
  entityType: EntityType;
  entityId: string;
  summary: string;
  meta?: Prisma.InputJsonValue;
};

/** Write inside the same transaction as the change it describes. */
export function logActivity(tx: Tx, a: ActivityInput) {
  return tx.activity.create({ data: a });
}

export type NotificationInput = {
  userIds: string[];
  type: string;
  title: string;
  body?: string;
  link?: string;
  /** Don't notify the person who caused it. */
  exceptUserId?: string;
};

export function notify(tx: Tx, n: NotificationInput) {
  const ids = [...new Set(n.userIds)].filter((id) => id !== n.exceptUserId);
  if (ids.length === 0) return Promise.resolve({ count: 0 });
  return tx.notification.createMany({
    data: ids.map((userId) => ({ userId, type: n.type, title: n.title, body: n.body, link: n.link })),
  });
}
