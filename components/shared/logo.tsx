import { cn } from "@/lib/utils";

/** The two-stroke "V" mark. `tone` = light on the navy sidebar, dark on paper (invoices). */
export function LogoMark({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  const front = tone === "light" ? "#FFFFFF" : "#0F1A2B";
  const back = tone === "light" ? "#C9D3DE" : "#5B6478";
  return (
    <svg viewBox="0 0 32 28" aria-hidden className={cn("h-7 w-8", className)}>
      <path d="M22.5 2.5h7.2L19.2 25.5h-5.4z" fill={back} />
      <path d="M2.3 2.5h7.4l8.7 19.4-2.7 3.6h-2.6z" fill={front} />
    </svg>
  );
}

export function Logo({ subtitle = "COMMAND CENTER", tone = "light", className }: { subtitle?: string; tone?: "light" | "dark"; className?: string }) {
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center gap-1.5">
        <LogoMark tone={tone} />
        <span className={cn("text-[22px] leading-none font-semibold tracking-tight", tone === "light" ? "text-white" : "text-ink")}>Vertex</span>
      </div>
      <span className={cn("mt-1 pl-[38px] text-[10px] leading-none font-medium tracking-[0.14em]", tone === "light" ? "text-sidebar-muted" : "text-ink-muted")}>
        {subtitle}
      </span>
    </div>
  );
}
