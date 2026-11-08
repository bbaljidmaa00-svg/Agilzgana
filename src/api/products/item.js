import { db, json, bad, rowToProduct, requireAdmin, cleanProduct } from "../../lib/core.js";

export async function onRequestGet({ params, env }) {
  const DB = await db(env);
  const row = await DB.prepare("SELECT * FROM products WHERE id = ? AND hidden = 0").bind(params.id).first();
  return row ? json({ product: rowToProduct(row) }) : bad("Олдсонгүй", 404);
}

// PUT /api/products/:id (admin) -> update any subset of fields
export async function onRequestPut({ request, params, env }) {
  const denied = await requireAdmin(request, env); if (denied) return denied;
  const DB = await db(env);
  let p;
  try { p = cleanProduct(await request.json()); } catch (e) { return bad(e.message); }
  const keys = Object.keys(p);
  if (!keys.length) return bad("Өөрчлөх зүйл алга");
  const res = await DB.prepare(
    `UPDATE products SET ${keys.map((k) => `${k} = ?`).join(", ")}, is_example = 0, updated_at = datetime('now') WHERE id = ?`
  ).bind(...keys.map((k) => p[k]), params.id).run();
  if (!res.meta.changes) return bad("Олдсонгүй", 404);
  const row = await DB.prepare("SELECT * FROM products WHERE id = ?").bind(params.id).first();
  return json({ product: rowToProduct(row) });
}

// DELETE /api/products/:id (admin) -> remove product and its uploaded images
export async function onRequestDelete({ request, params, env }) {
  const denied = await requireAdmin(request, env); if (denied) return denied;
  const DB = await db(env);
  const row = await DB.prepare("SELECT images FROM products WHERE id = ?").bind(params.id).first();
  if (!row) return bad("Олдсонгүй", 404);
  await DB.prepare("DELETE FROM products WHERE id = ?").bind(params.id).run();
  if (env.IMAGES) {
    const keys = JSON.parse(row.images || "[]").filter((s) => s.startsWith("/api/img/")).map((s) => s.slice(9));
    await Promise.all(keys.map((k) => env.IMAGES.delete(k)));
  }
  return json({ ok: true });
}
