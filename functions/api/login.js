import { json, bad, makeSession, safeEqual, isAdmin } from "../../lib/core.js";

const cookie = (v, maxAge) => `agz_admin=${v}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;

export async function onRequestGet({ request, env }) {
  return json({ admin: await isAdmin(request, env), configured: !!env.ADMIN_PASSWORD, db: !!env.DB, images: !!env.IMAGES });
}

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_PASSWORD) return bad("ADMIN_PASSWORD тохируулаагүй байна.", 503);
  const { password } = await request.json().catch(() => ({}));
  if (!password || !(await safeEqual(String(password), env.ADMIN_PASSWORD))) {
    await new Promise((r) => setTimeout(r, 600));
    return bad("Нууц үг буруу байна", 401);
  }
  return json({ ok: true }, 200, { "set-cookie": cookie(await makeSession(env), 60 * 60 * 24 * 14) });
}

export async function onRequestDelete() {
  return json({ ok: true }, 200, { "set-cookie": cookie("", 0) });
}
