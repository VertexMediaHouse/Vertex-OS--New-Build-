// Ported from app/(auth)/reset-password/{page.tsx,reset-form.tsx}.
// Also the "accept invite" page: invited staff and portal clients set their first password here.
import { useState } from "react";
import { useSearchParams } from "@/lib/nav";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTitle } from "@/web/title";
import { AuthLayout } from "./auth-layout";

export default function ResetPasswordPage() {
  useTitle("Choose a password");
  return (
    <AuthLayout>
      <div className="rounded-xl border bg-card p-7 shadow-card">
        <h1 className="text-3xl font-bold text-ink">Choose a password</h1>
        <ResetForm />
      </div>
    </AuthLayout>
  );
}

function ResetForm() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  if (!token) return <p className="mt-3 text-sm text-danger-text">This link is invalid or has expired.</p>;
  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const password = String(f.get("password"));
        if (password !== String(f.get("confirm"))) return setError("Passwords don't match.");
        setPending(true);
        const { error } = await authClient.resetPassword({ newPassword: password, token });
        if (error) { setPending(false); return setError("This link has expired. Ask for a new one."); }
        window.location.assign("/login");
      }}
    >
      <div className="space-y-1.5"><Label htmlFor="password">New password</Label><Input id="password" name="password" type="password" minLength={8} required className="h-10" /></div>
      <div className="space-y-1.5"><Label htmlFor="confirm">Confirm password</Label><Input id="confirm" name="confirm" type="password" minLength={8} required className="h-10" /></div>
      {error && <p className="text-xs text-danger-text">{error}</p>}
      <Button type="submit" disabled={pending} className="h-10 w-full">Save password</Button>
    </form>
  );
}
