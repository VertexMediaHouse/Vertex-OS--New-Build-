import { Logo } from "@/components/shared/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-sidebar-bg p-10 lg:flex">
        <Logo />
        <div className="max-w-md">
          <p className="text-[28px] leading-tight font-bold text-white">One command center for Vertex Media House and Vertex Tech House.</p>
          <p className="mt-3 text-md text-sidebar-muted">Leads, clients, projects, time and invoices for both companies, combined or one at a time.</p>
          <div className="mt-8 flex gap-2">
            <span className="rounded-md bg-vmh px-2.5 py-1 text-xs font-semibold text-white">VMH Video Editing</span>
            <span className="rounded-md bg-vth px-2.5 py-1 text-xs font-semibold text-white">VTH Web, CRM, ERP, Automation</span>
          </div>
        </div>
        <p className="text-xs text-sidebar-muted">© Vertex Media House · Vertex Tech House</p>
      </aside>
      <main className="flex items-center justify-center bg-page p-6">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
