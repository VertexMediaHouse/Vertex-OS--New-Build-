"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <div className="rounded-xl border bg-card p-7 shadow-card">
      <h1 className="text-3xl font-bold text-ink">Reset password</h1>
      {sent ? (
        <p className="mt-3 text-md text-ink-2">If that email has an account, a reset link is on its way.</p>
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            await authClient.requestPasswordReset({ email: String(new FormData(e.currentTarget).get("email")), redirectTo: "/reset-password" });
            setSent(true);
          }}
        >
          <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required className="h-10" /></div>
          <Button type="submit" disabled={pending} className="h-10 w-full">Send reset link</Button>
        </form>
      )}
      <Link href="/login" className="mt-4 block text-xs text-brand-text hover:underline">Back to login</Link>
    </div>
  );
}
