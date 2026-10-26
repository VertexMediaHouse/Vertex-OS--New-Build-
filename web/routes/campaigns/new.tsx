// Ported from app/(app)/campaigns/new/page.tsx.
import { useQuery } from "@tanstack/react-query";
import { CardSkeleton, PageHeader } from "@/components/shared/layout";
import { CampaignBuilder } from "@/components/campaigns/campaign-client";
import { api, query } from "@/web/api";
import { useTitle } from "@/web/title";

export default function NewCampaignPage() {
  useTitle("New Campaign");
  const { data } = useQuery({ queryKey: ["campaigns", "options"], queryFn: () => query(api.api.campaigns.options.$get()) });

  if (!data) return <CardSkeleton className="h-96" />;
  if (!data.companies.length) return <p className="p-6 text-sm">You don&apos;t have permission to create campaigns.</p>;

  return (
    <div className="space-y-4">
      <PageHeader title="New Campaign" subtitle="Pick an audience, write the sequence, and start sending." />
      <CampaignBuilder companies={data.companies} />
    </div>
  );
}
