"use server";

import { refresh } from "next/cache";
import { getStaffUser } from "@/lib/auth/context";
import { db } from "@/lib/db";

export async function markAllNotificationsRead() {
  const user = await getStaffUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  refresh();
}
