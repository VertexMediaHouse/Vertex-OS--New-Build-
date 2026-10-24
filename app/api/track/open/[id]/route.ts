import { db } from "@/lib/db";

const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

/** Open-tracking pixel. Public by design; it only flips a recipient's first open. */
export async function GET(_req: Request, { params }: RouteContext<"/api/track/open/[id]">) {
  const { id } = await params;
  if (/^[\w-]{1,64}$/.test(id)) {
    const r = await db.campaignRecipient.findUnique({ where: { id } });
    if (r && !r.openedAt) {
      await db.$transaction([
        db.campaignRecipient.update({ where: { id }, data: { openedAt: new Date(), status: r.status === "SENT" ? "OPENED" : r.status } }),
        db.emailCampaign.update({ where: { id: r.campaignId }, data: { openCount: { increment: 1 } } }),
      ]);
    }
  }
  return new Response(new Uint8Array(GIF), { headers: { "content-type": "image/gif", "cache-control": "no-store" } });
}
