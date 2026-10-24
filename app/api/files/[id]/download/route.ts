import { getCurrentUser } from "@/lib/auth/context";
import { canSeeFile } from "@/lib/files/access";
import { downloadUrl } from "@/lib/storage";
import { db } from "@/lib/db";

/** Checks access, then redirects to a short-lived signed storage URL. ?v=N downloads an older version. */
export async function GET(request: Request, { params }: RouteContext<"/api/files/[id]/download">) {
  const { id } = await params;
  const user = await getCurrentUser();
  const file = await canSeeFile(user, id);
  if (!file) return new Response("Not found", { status: 404 });
  const v = Number(new URL(request.url).searchParams.get("v"));
  const version = v ? await db.fileVersion.findUnique({ where: { fileId_version: { fileId: id, version: v } } }) : null;
  return Response.redirect(new URL(await downloadUrl(version?.storageKey ?? file.storageKey, file.name), request.url), 302);
}
