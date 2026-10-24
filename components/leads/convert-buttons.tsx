"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { convertLead } from "@/app/(app)/leads/actions";

export function ConvertButtons({ leadId }: { leadId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const go = (withProject: boolean) =>
    start(async () => {
      const res = await convertLead(leadId, withProject);
      if (!res.ok) return void toast.error(res.error);
      toast.success(withProject ? "Client and project created." : "Client created.");
      router.push(`/clients/${res.id}`);
    });
  return (
    <div className="flex gap-2">
      <Button disabled={pending} onClick={() => go(true)}>Convert to Client + Project</Button>
      <Button disabled={pending} variant="outline" onClick={() => go(false)}>Client only</Button>
    </div>
  );
}
