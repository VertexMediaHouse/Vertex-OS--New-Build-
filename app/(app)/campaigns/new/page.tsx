import { Suspense } from "react";
import { getRequestContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { CardSkeleton, PageHeader } from "@/components/shared/layout";
import { CampaignBuilder } from "@/components/campaigns/campaign-client";

export default function NewCampaignPage() {
  return <Suspense fallback={<CardSkeleton className="h-96" />}><New /></Suspense>;
}

async function New() {
  const ctx = await getRequestContext();
  const companies = ctx.companyIds.filter((c): c is "vmh" | "vth" => can(ctx.user, "create", "campaign", c));
  if (!companies.length) return <p className="p-6 text-sm">You don&apos;t have permission to create campaigns.</p>;
  return (
    <div className="space-y-4">
      <PageHeader title="New Campaign" subtitle="Pick an audience, write the sequence, and start sending." />
      <CampaignBuilder companies={companies} />
    </div>
  );
}
