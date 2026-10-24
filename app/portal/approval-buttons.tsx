"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { respondToApproval } from "./actions";

export function ApprovalButtons({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);
  const [comment, setComment] = useState("");
  const go = (d: "APPROVED" | "REVISION") => start(async () => {
    try { await respondToApproval(id, d, comment); toast.success(d === "APPROVED" ? "Approved. Thank you!" : "Revision requested."); }
    catch { toast.error("Couldn't save. Try again."); }
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
