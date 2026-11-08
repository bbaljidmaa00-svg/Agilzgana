import { json, bad, db, requireAdmin, safeJSON } from "../lib/core.js";

// GET /api/site  -> the content Baljka edited on the page itself (texts, images, fonts, colours, hidden parts)
// PUT /api/site  -> admin saves it; the previous version is kept in meta 'site_prev' so one bad save can be undone
export async function onRequestGet({ env }) {
  if (!env.DB) return json({ content: {} });
  const D = await db(env);
  const row = await D.prepare("SELECT v FROM meta WHERE k='site'").first();
  return json({ content: safeJSON(row?.v, {}) });
}

export async function onRequestPut({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const text = await request.text();
  if (text.length > 300_000) return bad("Өөрчлөлт хэт том байна.", 413);
  const c = safeJSON(text, null);
  if (!c || typeof c !== "object" || Array.isArray(c)) return bad("Өгөгдөл буруу байна.");
  if (/data:/i.test(text) || /javascript:/i.test(text)) return bad("Зургийг эхлээд сервер рүү оруулна уу.");
  const D = await db(env);
  await D.batch([
    D.prepare("INSERT OR REPLACE INTO meta (k,v) SELECT 'site_prev', v FROM meta WHERE k='site'"),
    D.prepare("INSERT OR REPLACE INTO meta (k,v) VALUES ('site', ?)").bind(JSON.stringify(c))
  ]);
  return json({ ok: true });
}
