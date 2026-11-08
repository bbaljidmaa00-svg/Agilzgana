// Worker entry: /api/* goes to the handlers below, everything else is served from ./public.
import * as products from "./api/products/index.js";
import * as product from "./api/products/item.js";
import * as orders from "./api/orders/index.js";
import * as order from "./api/orders/item.js";
import * as login from "./api/login.js";
import * as upload from "./api/upload.js";
import * as img from "./api/img.js";
import * as site from "./api/site.js";
import { json } from "./lib/core.js";

const routes = [
  [/^\/api\/products\/?$/, products],
  [/^\/api\/products\/([^/]+)$/, product, "id"],
  [/^\/api\/orders\/?$/, orders],
  [/^\/api\/orders\/(\d+)$/, order, "id"],
  [/^\/api\/login\/?$/, login],
  [/^\/api\/upload\/?$/, upload],
  [/^\/api\/img\/([^/]+)$/, img, "key"],
  [/^\/api\/site\/?$/, site]
];

const METHOD = { GET: "onRequestGet", POST: "onRequestPost", PUT: "onRequestPut", PATCH: "onRequestPatch", DELETE: "onRequestDelete" };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    for (const [re, mod, param] of routes) {
      const m = url.pathname.match(re);
      if (!m) continue;
      const handler = mod[METHOD[request.method]];
      if (!handler) return json({ error: "Method not allowed" }, 405);
      const params = param ? { [param]: decodeURIComponent(m[1]) } : {};
      try { return await handler({ request, env, params, ctx }); }
      catch (e) { return json({ error: "Серверийн алдаа: " + (e && e.message) }, 500); }
    }
    return json({ error: "Олдсонгүй" }, 404);
  }
};
