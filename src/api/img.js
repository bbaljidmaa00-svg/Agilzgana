import { isAdmin } from "../lib/core.js";

// GET /api/img/:key -> image bytes from KV, cached hard (keys are unique per upload)
// p-* product photos are public. r-* are customers' reference photos (personal data): only the logged-in admin sees them.
export async function onRequestGet({ request, params, env }) {
  if (!env.IMAGES || !/^[pr]-[\w-]+\.(webp|jpg|png|avif)$/.test(params.key)) return new Response("Not found", { status: 404 });
  const priv = params.key.startsWith("r-");
  if (priv && !(await isAdmin(request, env))) return new Response("Not found", { status: 404 });
  const { value, metadata } = await env.IMAGES.getWithMetadata(params.key, { type: "arrayBuffer", cacheTtl: 86400 });
  if (!value) return new Response("Not found", { status: 404 });
  return new Response(value, {
    headers: { "content-type": metadata?.type || "image/webp", "cache-control": priv ? "private, no-store" : "public, max-age=31536000, immutable" }
  });
}
