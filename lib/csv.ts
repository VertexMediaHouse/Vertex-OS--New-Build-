/** RFC 4180 CSV with a BOM so Excel reads UTF-8 (₹). Cells starting with = + - @ are quoted with a ' to block formula injection. */
export function toCsv(header: string[], rows: unknown[][]): string {
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}
