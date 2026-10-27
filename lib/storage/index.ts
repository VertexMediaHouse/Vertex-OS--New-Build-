import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * File storage. STORAGE_DRIVER=s3 → any S3-compatible service (AWS S3, Cloudflare R2, RustFS/MinIO),
 * with presigned direct uploads so large videos never pass through the app server.
 * STORAGE_DRIVER=local (default without S3 credentials) → files under .data/files, served through
 * /api/storage with short-lived HMAC-signed URLs.
 */
const driver = process.env.STORAGE_DRIVER ?? (process.env.S3_ACCESS_KEY_ID && process.env.S3_ENDPOINT ? "s3" : "local");
const bucket = process.env.S3_BUCKET ?? "vertex-files";
const TTL = 15 * 60; // seconds

const s3 =
  driver === "s3"
    ? new S3Client({
        region: process.env.S3_REGION ?? "auto",
        endpoint: process.env.S3_ENDPOINT,
        forcePathStyle: true,
        credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
      })
    : null;

const root = path.resolve(".data/files");
const secret = () => {
  const s = process.env.BETTER_AUTH_SECRET;
  // Without it, anyone could sign their own file URL, so never fall back in production.
  if (!s && process.env.NODE_ENV === "production") throw new Error("BETTER_AUTH_SECRET is required to sign file URLs");
  return s ?? "dev-secret";
};
const safeKey = (key: string) => {
  const p = path.resolve(root, key);
  if (!p.startsWith(root + path.sep)) throw new Error("Bad storage key");
  return p;
};

const hmac = (data: string) => crypto.createHmac("sha256", secret()).update(data).digest("hex");
const same = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function signLocal(op: "put" | "get", key: string, expires = Math.floor(Date.now() / 1000) + TTL) {
  // Absolute: the browser is on the SPA origin, these URLs point at the API.
  const base = process.env.API_URL ?? `http://localhost:${process.env.API_PORT ?? 4000}`;
  return `${base}/api/storage?${new URLSearchParams({ op, key, expires: String(expires), sig: hmac(`${op}:${key}:${expires}`) })}`;
}

export function verifyLocal(op: string, key: string, expires: string, sig: string): boolean {
  if (Number(expires) < Date.now() / 1000) return false;
  return same(sig, hmac(`${op}:${key}:${expires}`));
}

/**
 * Proof that a storage key came from requestUpload. The browser sends the key back when it
 * records the file, so without this it could claim a key belonging to another company's file.
 */
export const signKey = (key: string) => hmac(`key:${key}`);
export const verifyKeyOwner = (key: string, sig: string) => same(sig, signKey(key));

/** New unique key for an upload. */
export const newKey = (name: string) => `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}/${name.replace(/[^\w.\- ]+/g, "_")}`;

export async function uploadUrl(key: string, mime: string): Promise<string> {
  if (s3) return getSignedUrl(s3, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: mime }), { expiresIn: TTL });
  return signLocal("put", key);
}

export async function downloadUrl(key: string, filename: string): Promise<string> {
  if (s3) return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key, ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}"` }), { expiresIn: TTL });
  return signLocal("get", key);
}

export async function putObject(key: string, body: Buffer | Uint8Array, mime: string) {
  if (s3) return void (await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: mime })));
  const p = safeKey(key);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, body);
}

export async function readLocal(key: string) {
  return fs.readFile(safeKey(key));
}

export async function writeLocal(key: string, stream: ReadableStream<Uint8Array>, maxBytes: number) {
  const p = safeKey(key);
  await fs.mkdir(path.dirname(p), { recursive: true });
  const handle = await fs.open(p, "w");
  let size = 0;
  try {
    for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
      size += chunk.byteLength;
      if (size > maxBytes) throw new Error("File too large");
      await handle.write(chunk);
    }
  } finally {
    await handle.close();
  }
  return size;
}

export async function deleteObject(key: string) {
  if (s3) return void (await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })));
  await fs.rm(safeKey(key), { force: true });
}

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024 - 1; // the largest value File.size (Int) holds
export const storageDriver = driver;
