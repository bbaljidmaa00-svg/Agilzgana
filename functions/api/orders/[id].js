import { db, json, bad, requireAdmin } from "../../../lib/core.js";
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
  await DB.prepare("DELETE FROM orders WHERE id = ?").bind(params.id).run();
  return json({ ok: true });
}
