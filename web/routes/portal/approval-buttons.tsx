// Ported from app/portal/approval-buttons.tsx. The action import became an API call;
// the call site still expects a throw on failure, so `must` keeps that shape.
import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, call } from "@/web/api";

async function respondToApproval(approvalId: string, decision: "APPROVED" | "REVISION", comment?: string) {
  const r = await call(api.api.portal.respond.$post({ json: { approvalId, decision, comment } }));
  if (!r.ok) throw new Error(r.error);
}

export function ApprovalButtons({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);
  const [comment, setComment] = useState("");
  const queryClient = useQueryClient();
  const go = (d: "APPROVED" | "REVISION") => start(async () => {
    try {
      await respondToApproval(id, d, comment);
      toast.success(d === "APPROVED" ? "Approved. Thank you!" : "Revision requested.");
      await queryClient.invalidateQueries({ queryKey: ["portal"] });
    } catch { toast.error("Couldn't save. Try again."); }
  });
  return asking ? (
    <div className="flex gap-2">
      <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What should change?" className="w-56" aria-label="Revision notes" />
      <Button size="sm" disabled={pending || !comment.trim()} onClick={() => go("REVISION")}>Send</Button>
    </div>
  ) : (
    <div className="flex gap-2">
      <Button size="sm" disabled={pending} onClick={() => go("APPROVED")}>Approve</Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => setAsking(true)}>Request Revision</Button>
    </div>
  );
}
