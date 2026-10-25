import { cn } from "@/lib/utils";

/**
 * The Vertex chevron, drawn rather than imported so it takes its colour from the surface
 * it sits on. The source artwork is public/vertex-os-logo.png.
 */
export function LogoMark({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  return (
    <svg viewBox="0 0 34 40" aria-hidden className={cn("h-7 w-[26px] text-brand", className)}>
      <polyline points="9,8 23,20 9,32" fill="none" stroke="currentColor" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
      {/* tone only decides the divider: the chevron is always brand */}
      <line x1="31" y1="5" x2="31" y2="35" stroke={tone === "light" ? "#FFFFFF" : "#000000"} strokeWidth="2.5" strokeLinecap="round" opacity={tone === "light" ? 0.85 : 1} />
    </svg>
  );
}

export function Logo({ subtitle, tone = "light", className }: { subtitle?: string; tone?: "light" | "dark"; className?: string }) {
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center gap-2">
        <LogoMark tone={tone} />
        <span className="text-[21px] leading-none font-extrabold tracking-tight text-brand">Vertex OS</span>
      </div>
      {subtitle && (
        <span className={cn("mt-1.5 pl-[34px] text-[10px] leading-none font-medium tracking-[0.14em]", tone === "light" ? "text-sidebar-muted" : "text-ink-muted")}>
          {subtitle}
        </span>
      )}
    </div>
  );
}
