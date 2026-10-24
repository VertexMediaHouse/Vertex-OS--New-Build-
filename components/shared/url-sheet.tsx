"use client";

import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useHrefWith } from "./nav";

/** Right-side drawer that is open while ?{param}= is set; closing removes the param. */
export function UrlSheet({ title, param = "id", width = 420, children }: { title: string; param?: string; width?: number; children: React.ReactNode }) {
  const router = useRouter();
  const hrefWith = useHrefWith();
  return (
    <Sheet open onOpenChange={(open) => !open && router.push(hrefWith({ [param]: null }), { scroll: false })}>
      <SheetContent side="right" className="overflow-y-auto p-0" style={{ width, maxWidth: "100vw" }}>
        <SheetTitle className="sr-only">{title}</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  );
}
