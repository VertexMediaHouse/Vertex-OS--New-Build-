/** `warning` is for a side effect that failed while the main thing succeeded. */
export type ActionResult = { ok: true; id?: string; warning?: string } | { ok: false; error: string };
