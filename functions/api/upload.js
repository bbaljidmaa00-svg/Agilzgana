import { json, bad, isAdmin } from "../../lib/core.js";

// POST /api/upload  body = image bytes, content-type image/*
// Admin uploads go under p/ (product photos, 6 MB max).
// Customers may attach reference photos to a custom order under r/ (3 MB max).
const TYPES = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png", "image/avif": "avif" };

export async function onRequestPost({ request, env }) {
  if (!env.IMAGES) return bad("Зургийн сан (IMAGES) холбогдоогүй байна.", 503);
  const type = (request.headers.get("content-type") || "").split(";")[0].trim();
  if (!TYPES[type]) return bad("Зөвхөн JPG, PNG, WEBP зураг оруулна уу.");
  const admin = await isAdmin(request, env);
  const limit = admin ? 6 : 3;
  const buf = await request.arrayBuffer();
  if (buf.byteLength > limit * 1024 * 1024) return bad(`Зураг ${limit} MB-аас бага байх ёстой.`, 413);
  if (buf.byteLength < 100) return bad("Зураг хоосон байна.");
  const key = `${admin ? "p" : "r"}-${crypto.randomUUID()}.${TYPES[type]}`;
  await env.IMAGES.put(key, buf, { metadata: { type } });
  return json({ url: `/api/img/${key}` }, 201);
}
