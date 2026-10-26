// Ported from app/(app)/content/page.tsx: the Prisma queries moved to the server route,
// the render is unchanged.
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, Clapperboard, Lightbulb, Send } from "lucide-react";
import { useSearchParams } from "@/lib/nav";
import { KpiCard } from "@/components/shared/kpi-card";
import { CardSkeleton, PageHeader } from "@/components/shared/layout";
import { FilterSelect, SearchInput } from "@/components/shared/filters";
import { ContentBoard, ContentDialog, type ContentCard } from "@/components/content/content-client";
import { CHANNELS } from "@/lib/content";
import { api, query } from "@/web/api";
import { useTitle } from "@/web/title";

export default function ContentPage() {
  useTitle("Content");
  const [params] = useSearchParams();
  const sp = Object.fromEntries(params);
  const { data } = useQuery({
    queryKey: ["content", params.toString()],
    queryFn: () => query(api.api.content.$get({ query: sp })),
  });

  if (!data) return <CardSkeleton className="h-96" />;
  if (data.denied) return <p className="p-6 text-sm text-ink-2">You don&apos;t have access to content.</p>;

  const board = data.board as Record<string, ContentCard[]>;
  return (
    <div className="space-y-3.5">
      <PageHeader
        title="Content"
        subtitle="Every idea from first thought to published, so a busy week still goes out."
        actions={data.companies.length > 0 && <ContentDialog companies={data.companies} people={data.people} />}
      />
      <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={Lightbulb} tone="amber" label="Ideas waiting" value={data.kpis.ideas} />
        <KpiCard icon={Clapperboard} tone="orange" label="Shooting" suffix="(next 7 days)" value={data.kpis.shooting} />
        <KpiCard icon={CalendarCheck} tone="blue" label="Scheduled" value={data.kpis.scheduled} />
        <KpiCard icon={Send} tone="green" label="Published" suffix="(last 30 days)" value={data.kpis.publishedMonth} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Search content..." className="w-64" />
        {data.scope === "ALL" && <FilterSelect param="co" placeholder="All Companies" options={[{ value: "vmh", label: "VMH" }, { value: "vth", label: "VTH" }]} />}
        <FilterSelect param="channel" placeholder="All Channels" options={CHANNELS.map(([value, label]) => ({ value, label }))} />
        <FilterSelect param="owner" placeholder="All Owners" options={data.people.map((x) => ({ value: x.id, label: x.name }))} />
      </div>
      <ContentBoard items={board} companies={data.companies} people={data.people} />
    </div>
  );
}
