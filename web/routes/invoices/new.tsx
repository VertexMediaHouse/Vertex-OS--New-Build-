// Ported from app/(app)/invoices/new/page.tsx.
import { useQuery } from "@tanstack/react-query";
import { CardSkeleton, PageHeader } from "@/components/shared/layout";
import { InvoiceBuilder } from "@/components/invoices/invoice-client";
import { useSearchParams } from "@/lib/nav";
import { api, query } from "@/web/api";
import { useTitle } from "@/web/title";

export default function NewInvoicePage() {
  useTitle("Create Invoice");
  const [params] = useSearchParams();
  const { data } = useQuery({ queryKey: ["invoices", "builder"], queryFn: () => query(api.api.invoices.builder.$get()) });

  if (!data) return <CardSkeleton className="h-96" />;
  if (data.denied) return <p className="p-6 text-sm">You don&apos;t have permission to create invoices.</p>;

  return (
    <div className="space-y-4">
      <PageHeader title="Create Invoice" subtitle="Numbering follows each company's own sequence." />
      <InvoiceBuilder
        defaults={{ companyId: data.scope === "ALL" ? undefined : data.scope.toLowerCase(), projectId: params.get("project") ?? undefined }}
        companies={data.companies}
        clients={data.clients}
        projects={data.projects}
        entries={data.entries}
      />
    </div>
  );
}
