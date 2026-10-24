"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

/** Only same-site paths, so ?next= can't send people to another domain. */
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export function LoginForm({ google }: { google: boolean }) {
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const next = safeNext(params.get("next"));

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
      {google && (
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
