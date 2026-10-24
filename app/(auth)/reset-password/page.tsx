import { Suspense } from "react";
import { ResetForm } from "./reset-form";

/** Also the "accept invite" page: invited staff and portal clients set their first password here. */
export default function ResetPasswordPage() {
  return (
    <div className="rounded-xl border bg-card p-7 shadow-card">
      <h1 className="text-3xl font-bold text-ink">Choose a password</h1>
      <Suspense><ResetForm /></Suspense>
    </div>
  );
}
