import { db, json, bad, requireAdmin, safeJSON } from "../../../lib/core.js";

const s = (v, n) => String(v ?? "").trim().slice(0, n);

// POST /api/orders (public) -> store an order or a custom-design request
export async function onRequestPost({ request, env }) {
  const DB = await db(env);
  const b = await request.json().catch(() => null);
  if (!b) return bad("Мэдээлэл буруу");
  const kind = b.kind === "custom" ? "custom" : "order";
  const c = b.customer || {};
  const customer = { name: s(c.name, 80), phone: s(c.phone, 30), instagram: s(c.instagram, 60), address: s(c.address, 300) };
  if (!customer.name || !customer.phone) return bad("Нэр, утас заавал");
  if (s(b.website, 50)) return json({ ok: true, id: 0 }); // honeypot

  let items = [], total = 0;
  if (kind === "order") {
    const raw = Array.isArray(b.items) ? b.items.slice(0, 30) : [];
    if (!raw.length) return bad("Захиалга хоосон байна");
    const ids = [...new Set(raw.map((i) => s(i.id, 80)))];
    const { results } = await DB.prepare(`SELECT id,name,price,category FROM products WHERE id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all();
    const byId = Object.fromEntries(results.map((r) => [r.id, r]));
    items = raw.filter((i) => byId[i.id]).map((i) => {
      const p = byId[i.id], qty = Math.max(1, Math.min(20, Math.round(+i.qty || 1)));
      total += p.price * qty;
      return { id: p.id, name: p.name, category: p.category, price: p.price, qty, size: s(i.size, 80), note: s(i.note, 300) };
    });
    if (!items.length) return bad("Бүтээгдэхүүн олдсонгүй");
  } else {
    const r = b.request || {};
    items = [{ category: s(r.category, 20), size: s(r.size, 80), budget: s(r.budget, 40), idea: s(r.idea, 2000) }];
    if (!items[0].idea) return bad("Санаагаа бичнэ үү");
  }
  const images = (Array.isArray(b.images) ? b.images : []).filter((u) => /^\/api\/img\/r-[\w-]+\.\w+$/.test(u)).slice(0, 4);
  const res = await DB.prepare(`INSERT INTO orders (kind,customer,items,total,note,images) VALUES (?,?,?,?,?,?)`)
    .bind(kind, JSON.stringify(customer), JSON.stringify(items), total, s(b.note, 1000), JSON.stringify(images)).run();
  return json({ ok: true, id: res.meta.last_row_id, total, items }, 201);
}

// GET /api/orders (admin)
export async function onRequestGet({ request, env }) {
  const denied = await requireAdmin(request, env); if (denied) return denied;
  const DB = await db(env);
  const { results } = await DB.prepare("SELECT * FROM orders ORDER BY id DESC LIMIT 300").all();
  return json({
    orders: results.map((o) => ({ ...o, customer: safeJSON(o.customer, {}), items: safeJSON(o.items, []), images: safeJSON(o.images, []) }))
  });
}
