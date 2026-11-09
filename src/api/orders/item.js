import { db, json, bad, requireAdmin, safeJSON } from "../../lib/core.js";
const STATUSES = ["new", "making", "ready", "done", "cancelled"];

export async function onRequestPatch({ request, params, env }) {
  const denied = await requireAdmin(request, env); if (denied) return denied;
  const { status } = await request.json().catch(() => ({}));
  if (!STATUSES.includes(status)) return bad("Төлөв буруу");
  const DB = await db(env);
  const r = await DB.prepare("UPDATE orders SET status = ? WHERE id = ?").bind(status, params.id).run();
  return r.meta.changes ? json({ ok: true }) : bad("Олдсонгүй", 404);
}

export async function onRequestDelete({ request, params, env }) {
  const denied = await requireAdmin(request, env); if (denied) return denied;
  const DB = await db(env);
  // also remove the customer's reference photos, so deleting an order deletes all of their data
  const row = await DB.prepare("SELECT images FROM orders WHERE id = ?").bind(params.id).first();
  await DB.prepare("DELETE FROM orders WHERE id = ?").bind(params.id).run();
  if (row && env.IMAGES) {
    const keys = safeJSON(row.images, []).map((u) => String(u).split("/").pop()).filter((k) => /^r-[\w-]+\.\w+$/.test(k));
    await Promise.all(keys.map((k) => env.IMAGES.delete(k).catch(() => {})));
  }
  return json({ ok: true });
}
