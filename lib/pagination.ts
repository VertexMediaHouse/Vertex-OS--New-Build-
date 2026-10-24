/** Page buttons as in the PDF: 1 2 3 4 5 … 7. Short lists show every page. */
export function pageItems(page: number, pages: number): (number | "…")[] {
  if (pages <= 6) return Array.from({ length: pages }, (_, i) => i + 1);
  const items: (number | "…")[] = [1];
  const start = Math.max(2, Math.min(page - 1, pages - 4));
  const end = Math.min(pages - 1, Math.max(page + 1, 5));
  if (start > 2) items.push("…");
  for (let i = start; i <= end; i++) items.push(i);
  if (end < pages - 1) items.push("…");
  items.push(pages);
  return items;
}

/** Parses ?page= safely: positive integer, defaults to 1. */
export function parsePage(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}
