"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { ActionResult } from "@/lib/validation/result";

/**
 * Delete for good, for something created by mistake. The action decides whether it is
 * allowed: anything with history behind it refuses and says what is holding it.
 */
export function DeleteButton({
  action,
  noun,
  name,
  redirectTo,
  label = "Delete",
  variant = "button",
}: {
  action: () => Promise<ActionResult>;
  noun: string;
  name: string;
  /** Where to go once it is gone, when the thing being deleted is what you are looking at. */
  redirectTo?: string;
  label?: string;
  variant?: "button" | "link";
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {variant === "link" ? (
          <button type="button" className="text-2xs font-medium text-danger-text hover:underline">{label}</button>
        ) : (
          <Button type="button" variant="outline" size="sm" className="text-danger-text">
            <Trash2 className="size-3.5" /> {label}
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this {noun}?</AlertDialogTitle>
          <AlertDialogDescription>
            {name} will be removed for good. This cannot be undone. If it has any history behind it, the delete will be refused and you can archive or cancel it instead.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await action();
                if (!res.ok) return void toast.error(res.error);
                toast.success(`${noun[0]!.toUpperCase()}${noun.slice(1)} deleted.`);
                setOpen(false);
                if (redirectTo) router.push(redirectTo);
              });
            }}
          >
            {pending ? "Deleting…" : `Delete ${noun}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
