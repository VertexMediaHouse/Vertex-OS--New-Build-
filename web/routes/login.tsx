// Ported from app/(auth)/{layout.tsx,login/page.tsx,login/login-form.tsx}.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "@/lib/nav";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "@/components/ui/link";
import { useTitle } from "@/web/title";
import { api, query } from "../api";
import { AuthLayout } from "./auth-layout";

/** Only same-site paths, so ?next= can't send people to another domain. */
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export default function LoginPage() {
  useTitle("Log in");
  return (
    <AuthLayout>
      <div className="rounded-xl border bg-card p-7 shadow-card">
        <h1 className="text-3xl font-bold text-ink">Welcome back</h1>
        <p className="mt-1 text-md text-ink-muted">Log in to Vertex OS.</p>
        <LoginForm />
      </div>
    </AuthLayout>
  );
}

function LoginForm() {
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const next = safeNext(params.get("next"));
  const { data: config } = useQuery({ queryKey: ["config"], queryFn: () => query(api.api.config.$get()) });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    if (error) {
      setPending(false);
      setError(error.status === 429 ? "Too many attempts. Try again in a minute." : "Email or password is incorrect.");
      return;
    }
    window.location.assign(next);
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required className="h-10" />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/forgot-password" className="text-xs font-medium text-brand-text hover:underline">
            Forgot password?
          </Link>
        </div>
        <Input id="password" name="password" type="password" autoComplete="current-password" required className="h-10" />
      </div>
      {error && (
        <p role="alert" className="text-xs text-danger-text">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="h-10 w-full text-md font-semibold">
        {pending ? "Logging in…" : "Log in"}
      </Button>
      {config?.google && (
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full"
          onClick={() => authClient.signIn.social({ provider: "google", callbackURL: next })}
        >
          Continue with Google
        </Button>
      )}
    </form>
  );
}
