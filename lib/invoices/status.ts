import { startOfDayIST } from "@/lib/clock";

export type InvoiceStatusName = "DRAFT" | "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";

/**
 * Draft and Cancelled are set by people; the rest follow from money and dates:
 * fully paid → Paid, past due (day after the due date) → Overdue, otherwise Pending.
 */
export function invoiceStatus(input: {
  current: InvoiceStatusName;
  total: number;
  paid: number;
  dueDate: Date;
  now: Date;
}): InvoiceStatusName {
  if (input.current === "DRAFT" || input.current === "CANCELLED") return input.current;
  if (input.paid >= input.total) return "PAID";
  return startOfDayIST(input.now) > startOfDayIST(input.dueDate) ? "OVERDUE" : "PENDING";
}

/** Line items → totals. Money is rounded to the rupee/cent at each step. */
export function invoiceTotals(lines: { qty: number; rate: number }[], taxRate = 0, discount = 0) {
  const round = (n: number) => Math.round(n * 100) / 100;
  const subtotal = round(lines.reduce((s, l) => s + round(l.qty * l.rate), 0));
  const taxable = Math.max(0, subtotal - discount);
  const taxAmount = round((taxable * taxRate) / 100);
  return { subtotal, taxAmount, total: round(taxable + taxAmount) };
}
