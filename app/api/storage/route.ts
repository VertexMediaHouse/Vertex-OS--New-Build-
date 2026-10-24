import { MAX_UPLOAD_BYTES, readLocal, verifyLocal, writeLocal } from "@/lib/storage";

// Local storage driver endpoint. Signed URLs (lib/storage) are the authorization; they expire in 15 minutes.
function check(url: URL, op: "put" | "get") {
  const key = url.searchParams.get("key") ?? "";
  const ok = url.searchParams.get("op") === op && verifyLocal(op, key, url.searchParams.get("expires") ?? "0", url.searchParams.get("sig") ?? "");
  return ok ? key : null;
}

export async function PUT(request: Request) {
  const key = check(new URL(request.url), "put");
  if (!key || !request.body) return new Response("Forbidden", { status: 403 });
  try {
    const size = await writeLocal(key, request.body, MAX_UPLOAD_BYTES);
    return Response.json({ size });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Upload failed", { status: 413 });
  }
}

export async function GET(request: Request) {
  const key = check(new URL(request.url), "get");
  if (!key) return new Response("Forbidden", { status: 403 });
  try {
    const data = await readLocal(key);
    const name = key.split("/").pop() ?? "file";
    return new Response(new Uint8Array(data), { headers: { "content-type": "application/octet-stream", "content-disposition": `attachment; filename="${encodeURIComponent(name)}"` } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
