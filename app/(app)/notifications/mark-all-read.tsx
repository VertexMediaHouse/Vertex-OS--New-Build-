"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { markAllNotificationsRead } from "@/app/(app)/actions/notifications";

export function MarkAllRead() {
  const [pending, start] = useTransition();
  return <Button variant="outline" disabled={pending} onClick={() => start(() => markAllNotificationsRead())}>Mark all read</Button>;
}
