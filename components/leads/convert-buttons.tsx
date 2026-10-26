"use client";

import { useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@/lib/nav";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, call } from "@/web/api";

export function ConvertButtons({ leadId }: { leadId: string }) {
  const [pending, start] = useTransition();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const go = (withProject: boolean) =>
    start(async () => {
      const res = await call(api.api.leads.convert.$post({ json: { id: leadId, withProject } }));
      if (!res.ok) return void toast.error(res.error);
      toast.success(withProject ? "Client and project created." : "Client created.");
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      navigate(`/clients/${res.id}`);
    });
  return (
    <div className="flex gap-2">
      <Button disabled={pending} onClick={() => go(true)}>Convert to Client + Project</Button>
      <Button disabled={pending} variant="outline" onClick={() => go(false)}>Client only</Button>
    </div>
  );
}
