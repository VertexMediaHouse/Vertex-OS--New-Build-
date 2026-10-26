import Link from "@/components/ui/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, IconTile, TrendChip, type TileTone } from "./primitives";

export type KpiSplit = { value: React.ReactNode; label: string }[];

/**
 * KPI card: tinted icon tile, label, big value + trend chip, optional two-column footer
 * ("18 VMH | 14 VTH" or "₹8,20,000 Collected | ₹4,25,000 Outstanding").
 */
export function KpiCard({
  icon,
  tone,
  label,
  href,
  suffix,
  value,
  trend,
  trendUnit = "%",
  inverse,
  split,
  size = "md",
  className,
  children,
}: {
  icon: LucideIcon;
  tone: TileTone;
  label: string;
  href?: string;
  suffix?: string;
  value: React.ReactNode;
  trend?: number | null;
  trendUnit?: "%" | "";
  inverse?: boolean;
  split?: KpiSplit;
  size?: "md" | "lg";
  className?: string;
  children?: React.ReactNode;
}) {
  const card = (
    <Card className={cn("flex flex-col px-4 pt-4 pb-3.5", href && "h-full hover:bg-accent", className)}>
      <div className="flex items-start gap-3.5">
        <IconTile icon={icon} tone={tone} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">
            {label}
            {suffix && <span className="font-normal text-ink-muted"> {suffix}</span>}
          </p>
          <div className="mt-1 flex items-center gap-2.5">
            <span className={cn("leading-none font-bold text-ink tabular", size === "lg" ? "text-[26px]" : "text-2xl")}>{value}</span>
            {trend !== undefined && <TrendChip value={trend} unit={trendUnit} inverse={inverse} />}
          </div>
        </div>
      </div>
      {children}
      {split && (
        <div className="mt-auto grid grid-cols-2 pt-4">
          {split.map((s, i) => (
            <div key={s.label} className={cn("flex flex-col items-center", i === 1 && "border-l")}>
              <span className="text-md leading-5 font-bold text-ink tabular">{s.value}</span>
              <span className="text-2xs font-medium text-ink-muted">{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
  return href ? <Link href={href} className="block h-full">{card}</Link> : card;
}

/** Page 11 simple tile: big icon, number, label, no trend. */
export function KpiTile({ icon, tone, value, label }: { icon: LucideIcon; tone: TileTone; value: React.ReactNode; label: string }) {
  return (
    <Card className="flex items-center gap-6 px-5 py-5">
      <IconTile icon={icon} tone={tone} size="xl" />
      <div>
        <div className="text-[34px] leading-none font-bold text-ink tabular">{value}</div>
        <div className="mt-1.5 text-base text-ink-muted">{label}</div>
      </div>
    </Card>
  );
}
