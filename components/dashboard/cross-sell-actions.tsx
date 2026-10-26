"use client";

import { useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";
import { api, call } from "@/web/api";

/** The buttons below catch a throw, so failures have to reject rather than return. */
async function must(p: Promise<Response>) {
  const r = await call(p);
  if (!r.ok) throw new Error(r.error);
}

const createOpportunity = (alertId: string) => must(api.api.dashboard.opportunities.$post({ json: { alertId } }));
const dismissAlert = (alertId: string) => must(api.api.dashboard.alerts.dismiss.$post({ json: { alertId } }));

export function CrossSellActions({ alertId }: { alertId: string }) {
  const [pending, start] = useTransition();
  const queryClient = useQueryClient();
  const run = (fn: () => Promise<void>, ok: string) =>
    start(async () => {
      try {
        await fn();
        toast.success(ok);
        await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      } catch {
        toast.error("Something went wrong. Try again.");
      }
    });
  return (
    <div className="flex items-center gap-1">
      <button type="button" disabled={pending} onClick={() => run(() => createOpportunity(alertId), "Opportunity created as a new lead.")} className="h-8 rounded-lg bg-info-soft px-3 text-xs font-semibold text-brand-text hover:bg-brand-soft disabled:opacity-50">
        Create Opportunity
      </button>
      <button type="button" disabled={pending} aria-label="Dismiss" onClick={() => run(() => dismissAlert(alertId), "Alert dismissed.")} className="rounded-md p-1 text-ink-muted hover:bg-accent">
        <X className="size-3.5" />
      </button>
    </div>
  );
}
