"use client";

import { Printer } from "lucide-react";

/** PDF export via the browser's "Save as PDF" (print styles hide the app chrome). */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-xs font-medium print:hidden">
      <Printer className="size-4" /> Export PDF
    </button>
  );
}
