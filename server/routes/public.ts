// Ported from app/api/storage/route.ts and app/api/track/open/[id]/route.ts.
// Mounted at /api with no auth middleware: signed URLs and the pixel are public by design.
import { Hono } from "hono";
import type { Env } from "../context";
import { db } from "@/lib/db";
import { MAX_UPLOAD_BYTES, readLocal, verifyLocal, writeLocal } from "@/lib/storage";

// Local storage driver endpoint. Signed URLs (lib/storage) are the authorization; they expire in 15 minutes.
function check(url: URL, op: "put" | "get") {
  const key = url.searchParams.get("key") ?? "";
  const ok = url.searchParams.get("op") === op && verifyLocal(op, key, url.searchParams.get("expires") ?? "0", url.searchParams.get("sig") ?? "");
  return ok ? key : null;
}

const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

export const publicRoutes = new Hono<Env>()
  .put("/storage", async (c) => {
    const key = check(new URL(c.req.url), "put");
    if (!key || !c.req.raw.body) return c.text("Forbidden", 403);
    try {
      const size = await writeLocal(key, c.req.raw.body, MAX_UPLOAD_BYTES);
      return c.json({ size });
    } catch (e) {
      return c.text(e instanceof Error ? e.message : "Upload failed", 413);
    }
  })
  .get("/storage", async (c) => {
    const key = check(new URL(c.req.url), "get");
    if (!key) return c.text("Forbidden", 403);
    try {
      const data = await readLocal(key);
      const name = key.split("/").pop() ?? "file";
      return c.body(new Uint8Array(data), 200, {
        "content-type": "application/octet-stream",
        "content-disposition": `attachment; filename="${encodeURIComponent(name)}"`,
      });
    } catch {
      return c.text("Not found", 404);
    }
  })
  /** Open-tracking pixel. Public by design; it only flips a recipient's first open. */
  .get("/track/open/:id", async (c) => {
    const id = c.req.param("id");
    if (/^[\w-]{1,64}$/.test(id)) {
      const r = await db.campaignRecipient.findUnique({ where: { id } });
      if (r && !r.openedAt) {
        await db.$transaction([
          db.campaignRecipient.update({ where: { id }, data: { openedAt: new Date(), status: r.status === "SENT" ? "OPENED" : r.status } }),
          db.emailCampaign.update({ where: { id: r.campaignId }, data: { openCount: { increment: 1 } } }),
        ]);
      }
    }
    return c.body(new Uint8Array(GIF), 200, { "content-type": "image/gif", "cache-control": "no-store" });
  });
