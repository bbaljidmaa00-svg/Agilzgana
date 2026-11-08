// GET /api/img/:key -> image bytes from KV, cached hard (keys are unique per upload)
export async function onRequestGet({ params, env }) {
  if (!env.IMAGES || !/^[pr]-[\w-]+\.(webp|jpg|png|avif)$/.test(params.key)) return new Response("Not found", { status: 404 });
  const { value, metadata } = await env.IMAGES.getWithMetadata(params.key, { type: "arrayBuffer", cacheTtl: 86400 });
  if (!value) return new Response("Not found", { status: 404 });
  return new Response(value, {
    headers: { "content-type": metadata?.type || "image/webp", "cache-control": "public, max-age=31536000, immutable" }
  });
}
