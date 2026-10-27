import Link from "@/components/ui/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { TONE_CLASSES, type Tone } from "@/lib/status";

// ── Icon tile ───────────────────────────────────────────────────────────
export type TileTone = "green" | "blue" | "purple" | "pink" | "orange" | "red" | "amber" | "slate" | "vmh" | "vth";

const TILE: Record<TileTone, string> = {
  green: "bg-success-soft text-success-text",
  blue: "bg-info-soft text-brand-text",
  purple: "bg-review-soft text-review-text",
  pink: "bg-review-soft text-review-text",
  orange: "bg-warning-soft text-warning-text",
  red: "bg-danger-soft text-danger-text",
  amber: "bg-warning-soft text-warning-text",
  slate: "bg-surface-muted text-ink-muted",
  vmh: "bg-vmh-soft text-vmh-text",
  vth: "bg-vth-soft text-vth-text",
};

export function IconTile({ icon: Icon, tone, size = "md", className }: { icon: LucideIcon; tone: TileTone; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        size === "sm" && "size-8 rounded-lg [&_svg]:size-4",
        size === "md" && "size-10 rounded-[10px] [&_svg]:size-5",
        size === "lg" && "size-12 rounded-xl [&_svg]:size-[22px]",
        size === "xl" && "size-[70px] rounded-xl [&_svg]:size-9",
        TILE[tone],
        className,
      )}
      aria-hidden
    >
      <Icon strokeWidth={1.9} />
    </span>
  );
}

// ── Progress ────────────────────────────────────────────────────────────
export type BarTone = Tone | "primary" | "vmh" | "vth" | "brand";

const BAR: Record<BarTone, string> = {
  ...Object.fromEntries(Object.entries(TONE_CLASSES).map(([k, v]) => [k, v.bar])),
  primary: "bg-brand-strong",
  brand: "bg-brand",
  vmh: "bg-vmh-chart",
  vth: "bg-vth-chart",
} as Record<BarTone, string>;

export function ProgressBar({ value, tone = "primary", height = 6, className, label }: { value: number; tone?: BarTone; height?: number; className?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("w-full overflow-hidden rounded-full bg-track", className)}
      style={{ height }}
    >
      <div className={cn("h-full rounded-full", BAR[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Multi-colour bar (page 1 Active Projects). Segments with value 0 are skipped. */
export function SegmentedBar({ segments, height = 8 }: { segments: { value: number; color: string; label: string }[]; height?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div className="flex w-full overflow-hidden rounded-full bg-track" style={{ height }} role="img" aria-label={segments.map((s) => `${s.label} ${s.value}`).join(", ")}>
      {segments.filter((s) => s.value > 0).map((s) => (
        <div key={s.label} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
      ))}
    </div>
  );
}

// ── Avatars ─────────────────────────────────────────────────────────────
const AVATAR_COLORS = ["#E0E7FF:#4338CA", "#FCE7F3:#BE185D", "#DCFCE7:#15803D", "#FEF3C7:#B45309", "#E0F2FE:#0369A1", "#F3E8FF:#7E22CE", "#FFE4E6:#BE123C", "#CCFBF1:#0F766E"];

function avatarColor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [bg, fg] = AVATAR_COLORS[h % AVATAR_COLORS.length]!.split(":");
  return { background: bg, color: fg };
}

export type AvatarPerson = { name: string; image?: string | null };

export function Avatar({ person, size = 28, ring = false, className }: { person: AvatarPerson; size?: number; ring?: boolean; className?: string }) {
  const style = { width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.38)) };
  return person.image ? (
    <img src={person.image} alt={person.name} title={person.name} style={style} className={cn("shrink-0 rounded-full object-cover", ring && "ring-2 ring-white", className)} />
  ) : (
    <span
      role="img"
      aria-label={person.name}
      title={person.name}
      style={{ ...style, ...avatarColor(person.name) }}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", ring && "ring-2 ring-white", className)}
    >
      {initials(person.name)}
    </span>
  );
}

export function AvatarStack({ people, max = 3, size = 24 }: { people: AvatarPerson[]; max?: number; size?: number }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((p, i) => (
        <Avatar key={`${p.name}-${i}`} person={p} size={size} ring />
      ))}
      {extra > 0 && (
        <span className="inline-flex items-center justify-center rounded-full bg-brand-soft text-[10.5px] font-semibold text-brand-text ring-2 ring-white" style={{ width: size, height: size }}>
          +{extra}
        </span>
      )}
    </div>
  );
}

// ── Trend chip ──────────────────────────────────────────────────────────
/** ↗ 18% (green) / ↘ 17% (red). `inverse` for metrics where going up is bad (Overdue, Pending). */
export function TrendChip({ value, unit = "%", inverse = false, className }: { value: number | null; unit?: "%" | ""; inverse?: boolean; className?: string }) {
  if (value === null || !Number.isFinite(value)) return null;
  const up = value > 0;
  const flat = Math.round(value) === 0;
  const good = flat ? null : inverse ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-0.5 rounded-md px-1.5 text-[11px] font-semibold tabular",
        good === null && "bg-neutral-soft text-neutral-text",
        good === true && "bg-success-soft text-success-text",
        good === false && "bg-danger-soft text-danger-text",
        className,
      )}
    >
      <Icon className="size-3" strokeWidth={2.4} aria-hidden />
      <span className="sr-only">{up ? "up" : "down"}</span>
      {Math.abs(Math.round(value))}
      {unit}
    </span>
  );
}

// ── Cards ───────────────────────────────────────────────────────────────
export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-xl border bg-card shadow-card", className)} {...props} />;
}

export function ViewAll({ href, label = "View All" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand-text hover:underline">
      {label} <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
}

/** Card with a title row: optional icon tile, title + subtitle, right-side control or View All. */
export function SectionCard({
  title,
  icon,
  tone = "blue",
  subtitle,
  href,
  action,
  className,
  bodyClassName,
  children,
  titleClassName,
}: {
  title: React.ReactNode;
  icon?: LucideIcon;
  tone?: TileTone;
  subtitle?: React.ReactNode;
  href?: string;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  titleClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("flex flex-col p-4", className)}>
      <div className="flex items-start gap-3">
        {icon && <IconTile icon={icon} tone={tone} />}
        <div className="min-w-0 flex-1 self-center">
          <h2 className={cn("text-lg leading-5 font-semibold text-ink", titleClassName)}>{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
        </div>
        {action}
        {href && !action && <ViewAll href={href} />}
      </div>
      <div className={cn("mt-2.5 flex-1", bodyClassName)}>{children}</div>
    </Card>
  );
}

/** Grey inset box ("Pipeline Value"). */
export function Inset({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-[10px] bg-surface-muted", className)} {...props} />;
}
