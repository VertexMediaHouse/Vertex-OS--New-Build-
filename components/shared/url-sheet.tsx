"use client";

import { useNavigate } from "@/lib/nav";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useHrefWith } from "./nav";

/** Right-side drawer that is open while ?{param}= is set; closing removes the param. */
export function UrlSheet({ title, param = "id", width = 420, children }: { title: string; param?: string; width?: number; children: React.ReactNode }) {
  const navigate = useNavigate();
  const hrefWith = useHrefWith();
  return (
    <Sheet open onOpenChange={(open) => !open && navigate(hrefWith({ [param]: null }), { preventScrollReset: true })}>
      <SheetContent side="right" className="overflow-y-auto p-0" style={{ width, maxWidth: "100vw" }}>
        <SheetTitle className="sr-only">{title}</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  );
}
