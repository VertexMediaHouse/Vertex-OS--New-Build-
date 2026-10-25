import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIORITY, TONE_CLASSES, type Tone } from "@/lib/status";

export type CompanyBadgeCode = "VMH" | "VTH" | "ALL";

/** "vmh" → "VMH"; no company (shared across both) → "ALL". */
export const companyCode = (id: string | null | undefined): CompanyBadgeCode => (id ? (id.toUpperCase() as CompanyBadgeCode) : "ALL");

const BADGE: Record<CompanyBadgeCode, string> = {
  VMH: "bg-vmh-soft text-vmh-text",
  VTH: "bg-vth-soft text-vth-text",
  ALL: "bg-brand-soft text-brand-text",
};

/** VMH / VTH / ALL rectangle. size="lg" is the 40px tile on Cross-Sell Alerts. */
export function CompanyBadge({ code, size = "sm", className }: { code: CompanyBadgeCode; size?: "sm" | "lg"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-semibold",
        size === "sm" ? "h-[18px] rounded-[4px] px-1.5 text-[10.5px] leading-none" : "size-10 rounded-lg text-xs",
        BADGE[code],
        className,
      )}
    >
      {code}
    </span>
  );
}

/** A company badge for each code; a client of both companies shows both. */
export function CompanyBadges({ codes }: { codes: CompanyBadgeCode[] }) {
  return (
    <span className="inline-flex gap-1">
      {codes.map((c) => (
        <CompanyBadge key={c} code={c} />
      ))}
    </span>
  );
}

/** Soft pill with a leading dot: "● In Progress". Text is always present, so colour isn't the only signal. */
export function StatusPill({
  label,
  tone,
  dot = true,
  chevron = false,
  size = "sm",
  className,
}: {
  label: string;
  tone: Tone;
  dot?: boolean;
  chevron?: boolean;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const t = TONE_CLASSES[tone];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium whitespace-nowrap",
        size === "xs" && "h-[18px] px-1.5 text-[10.5px]",
        size === "sm" && "h-[22px] px-2 text-2xs",
        size === "md" && "h-8 px-3 text-md",
        dot && size !== "xs" && "pl-1.5",
        t.pill,
        className,
      )}
    >
      {dot && <span className={cn("shrink-0 rounded-full", size === "md" ? "size-2" : "size-1.5", t.dot)} aria-hidden />}
      {label}
      {chevron && <ChevronDown className="-mr-0.5 size-3 opacity-70" aria-hidden />}
    </span>
  );
}

/** Status pill from one of the lib/status maps. */
export function EnumPill({ map, value, ...rest }: { map: Record<string, { label: string; tone: Tone }>; value: string } & Omit<Parameters<typeof StatusPill>[0], "label" | "tone">) {
  const meta = map[value] ?? { label: value, tone: "neutral" as const };
  return <StatusPill label={meta.label} tone={meta.tone} {...rest} />;
}

export function PriorityPill({ priority, size }: { priority: string; size?: "xs" | "sm" }) {
  return <EnumPill map={PRIORITY} value={priority} size={size} />;
}

/** "Over" / "Idle" chips next to workload bars. */
export function Chip({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={cn("inline-flex h-5 items-center rounded-md px-1.5 text-[10.5px] font-medium", TONE_CLASSES[tone].pill)}>{children}</span>;
}
