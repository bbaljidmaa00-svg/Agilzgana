// Shared helpers for Pages Functions: JSON responses, schema, admin auth.
import seed from "./seed.js";
// Note: lives outside public/ so it is never served as a static file.

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
  });

export const bad = (msg, status = 400) => json({ error: msg }, status);

export const CATEGORIES = ["ring", "bracelet", "cuff", "necklace", "earring", "belly", "clip"];

let ready = false;
export async function db(env) {
  if (!env.DB) throw new Error("DB binding missing");
  if (ready) return env.DB;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price INTEGER NOT NULL DEFAULT 0,
      description TEXT DEFAULT '',
      material TEXT DEFAULT '',
      images TEXT DEFAULT '[]',
      hidden INTEGER DEFAULT 0,
      featured INTEGER DEFAULT 0,
      is_example INTEGER DEFAULT 0,
      sort INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL DEFAULT 'order',
      customer TEXT NOT NULL,
      items TEXT DEFAULT '[]',
      total INTEGER DEFAULT 0,
      note TEXT DEFAULT '',
      images TEXT DEFAULT '[]',
      status TEXT DEFAULT 'new',
      created_at TEXT DEFAULT (datetime('now'))
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)`)
  ]);
  const seeded = await env.DB.prepare("SELECT v FROM meta WHERE k='seeded'").first();
  if (!seeded) {
    const stmts = seed.map((p, i) =>
      env.DB.prepare(`INSERT OR IGNORE INTO products (id,name,category,price,description,material,images,is_example,sort)
        VALUES (?,?,?,?,?,?,?,1,?)`).bind(p.id, p.name, p.category, p.price, p.description, p.material, "[]", i));
    stmts.push(env.DB.prepare("INSERT OR REPLACE INTO meta (k,v) VALUES ('seeded','1')"));
    await env.DB.batch(stmts);
  }
  ready = true;
  return env.DB;
}

export const rowToProduct = (r) => ({
  id: r.id, name: r.name, category: r.category, price: r.price,
  description: r.description || "", material: r.material || "",
  images: safeJSON(r.images, []), hidden: !!r.hidden, featured: !!r.featured,
  isExample: !!r.is_example, sort: r.sort, updatedAt: r.updated_at
});
export function safeJSON(t, d) { try { return JSON.parse(t); } catch { return d; } }

/* ---------- auth: HMAC-signed cookie, key = ADMIN_PASSWORD ---------- */
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}
export async function makeSession(env) {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 14;
  return `${exp}.${await hmac(env.ADMIN_PASSWORD, "agz:" + exp)}`;
}
export async function isAdmin(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const m = (request.headers.get("cookie") || "").match(/(?:^|;\s*)agz_admin=([^;]+)/);
  if (!m) return false;
  const [exp, sig] = m[1].split(".");
  if (!exp || !sig || +exp < Date.now()) return false;
  const good = await hmac(env.ADMIN_PASSWORD, "agz:" + exp);
  if (good.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < good.length; i++) diff |= good.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}
export async function safeEqual(a, b) {
  const [x, y] = await Promise.all([hmac("cmp", a), hmac("cmp", b)]);
  return x === y;
}
export async function requireAdmin(request, env) {
  if (!env.ADMIN_PASSWORD) return bad("ADMIN_PASSWORD тохируулаагүй байна. Cloudflare Pages → Settings → Variables and Secrets.", 503);
  if (!(await isAdmin(request, env))) return bad("Нэвтрэх шаардлагатай", 401);
  return null;
}

export function slugify(name, category) {
  const map = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"yo",ж:"j",з:"z",и:"i",й:"i",к:"k",л:"l",м:"m",н:"n",о:"o",ө:"u",п:"p",р:"r",с:"s",т:"t",у:"u",ү:"u",ф:"f",х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sh",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" };
  const base = String(name).toLowerCase().split("").map((c) => map[c] ?? c).join("").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return `${category}-${base || "item"}-${Math.random().toString(36).slice(2, 6)}`;
}

export function cleanProduct(body) {
  const out = {};
  if (body.name !== undefined) { out.name = String(body.name).trim().slice(0, 80); if (!out.name) throw new Error("Нэр хоосон байна"); }
  if (body.category !== undefined) { if (!CATEGORIES.includes(body.category)) throw new Error("Төрөл буруу"); out.category = body.category; }
  if (body.price !== undefined) { out.price = Math.max(0, Math.round(Number(body.price) || 0)); }
  if (body.description !== undefined) out.description = String(body.description).slice(0, 2000);
  if (body.material !== undefined) out.material = String(body.material).slice(0, 300);
  if (body.images !== undefined) {
    if (!Array.isArray(body.images)) throw new Error("Зураг буруу");
    out.images = JSON.stringify(body.images.filter((s) => typeof s === "string" && /^(\/api\/img\/[\w.-]+|images\/[\w./-]+|https:\/\/[^\s"]+)$/.test(s)).slice(0, 12));
  }
  if (body.hidden !== undefined) out.hidden = body.hidden ? 1 : 0;
  if (body.featured !== undefined) out.featured = body.featured ? 1 : 0;
  if (body.sort !== undefined) out.sort = Math.round(Number(body.sort) || 0);
  return out;
}
