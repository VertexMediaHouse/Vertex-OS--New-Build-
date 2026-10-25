import type { Metadata } from "next";
import { Suspense } from "react";
import { googleEnabled } from "@/lib/auth/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <div className="rounded-xl border bg-card p-7 shadow-card">
      <h1 className="text-3xl font-bold text-ink">Welcome back</h1>
      <p className="mt-1 text-md text-ink-muted">Log in to Vertex OS.</p>
      {/* reads ?next= */}
      <Suspense>
        <LoginForm google={googleEnabled} />
      </Suspense>
    </div>
  );
}
