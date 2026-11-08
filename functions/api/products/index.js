import { db, json, bad, rowToProduct, requireAdmin, isAdmin, cleanProduct, slugify } from "../../../lib/core.js";

// GET /api/products         -> visible products (public)
// GET /api/products?all=1   -> every product, including hidden (admin)
export async function onRequestGet({ request, env }) {
  const DB = await db(env);
  const all = new URL(request.url).searchParams.get("all") && (await isAdmin(request, env));
  const { results } = await DB.prepare(
    `SELECT * FROM products ${all ? "" : "WHERE hidden = 0"} ORDER BY featured DESC, sort ASC, created_at DESC`
  ).all();
  return json({ products: results.map(rowToProduct) }, 200, all ? {} : { "cache-control": "public, max-age=30" });
}

// POST /api/products (admin) -> create
export async function onRequestPost({ request, env }) {
  const denied = await requireAdmin(request, env); if (denied) return denied;
  const DB = await db(env);
  let p;
  try { p = cleanProduct(await request.json()); } catch (e) { return bad(e.message); }
  if (!p.name || !p.category) return bad("Нэр, төрөл заавал");
  const id = slugify(p.name, p.category);
  const min = await DB.prepare("SELECT MIN(sort) AS m FROM products").first();
  await DB.prepare(`INSERT INTO products (id,name,category,price,description,material,images,hidden,featured,sort)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(
    id, p.name, p.category, p.price ?? 0, p.description ?? "", p.material ?? "", p.images ?? "[]",
    p.hidden ?? 0, p.featured ?? 0, p.sort ?? ((min?.m ?? 0) - 1)
  ).run();
  const row = await DB.prepare("SELECT * FROM products WHERE id = ?").bind(id).first();
  return json({ product: rowToProduct(row) }, 201);
}
