"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { createOpportunity, dismissAlert } from "@/app/(app)/dashboard/actions";

export function CrossSellActions({ alertId }: { alertId: string }) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<void>, ok: string) =>
    start(async () => {
      try {
        await fn();
        toast.success(ok);
      } catch {
        toast.error("Something went wrong. Try again.");
      }
    });
  return (
    <div className="flex items-center gap-1">
      <button type="button" disabled={pending} onClick={() => run(() => createOpportunity(alertId), "Opportunity created as a new lead.")} className="h-8 rounded-lg bg-[#E8F0FC] px-3 text-xs font-semibold text-blue hover:bg-blue-soft disabled:opacity-50">
        Create Opportunity
      </button>
      <button type="button" disabled={pending} aria-label="Dismiss" onClick={() => run(() => dismissAlert(alertId), "Alert dismissed.")} className="rounded-md p-1 text-ink-muted hover:bg-accent">
        <X className="size-3.5" />
      </button>
    </div>
  );
}
