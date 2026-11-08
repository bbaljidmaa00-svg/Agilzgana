/* Shared helpers for the shop and the admin page. */
window.AGZ = (() => {
  const CATEGORIES = [
    { id: "ring", name: "Бөгж", size: "ring" },
    { id: "bracelet", name: "Бугуйвч", size: "wrist" },
    { id: "cuff", name: "Arm cuff", size: "arm" },
    { id: "necklace", name: "Зүүлт", size: "neck" },
    { id: "earring", name: "Ээмэг", size: "none" },
    { id: "belly", name: "Гэдэсний зүүлт", size: "waist" },
    { id: "clip", name: "Хавчаар", size: "none" }
  ];
  const INSTAGRAM = "agilzgana_";
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => Number(n || 0).toLocaleString("en-US").replace(/,/g, " ") + " ₮";
  const catOf = (id) => CATEGORIES.find((c) => c.id === id) || { id, name: id, size: "none" };
  const isLatin = (t) => /^[\x00-\x7F]*$/.test(t);

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      credentials: "same-origin",
      ...opts,
      headers: opts.body && !(opts.body instanceof Blob) ? { "content-type": "application/json", ...(opts.headers || {}) } : opts.headers
    });
    const ct = res.headers.get("content-type") || "";
    const data = ct.includes("json") ? await res.json() : null;
    if (!res.ok || !data) throw Object.assign(new Error((data && data.error) || `Алдаа (${res.status})`), { status: res.status });
    return data;
  }

  /* Downscale a photo in the browser before upload: sharp enough for retina, small enough to load fast. */
  async function shrink(file, max = 1600, quality = 0.86) {
    const bmp = await createImageBitmap(file).catch(() => null);
    if (!bmp) throw new Error("Зургийг уншиж чадсангүй");
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    const g = c.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, "image/webp", quality));
    if (blob && blob.type === "image/webp") return blob;
    return new Promise((r) => c.toBlob(r, "image/jpeg", quality));
  }
  async function upload(file, max) {
    const blob = await shrink(file, max);
    return api("/api/upload", { method: "POST", body: blob, headers: { "content-type": blob.type } });
  }

  /* Placeholder artwork, drawn until a real photo exists: metallic line jewelry in an arch, with угалз watermark. */
  let uid = 0;
  function art(cat, seed = 1) {
    const id = "a" + (++uid);
    const r = (n) => (Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453) % 1 * 0.5 + 0.5;
    const G = `url(#${id}g)`, P = `url(#${id}p)`;
    const leaf = (x, y, a, s = 1) => `<path d="M0 0 q 16 -20 34 -5 q -18 18 -34 5z" transform="translate(${x} ${y}) rotate(${a}) scale(${s})" fill="var(--moss)" opacity=".35"/>`;
    const flower = (x, y, s, o) => `<g transform="translate(${x} ${y}) scale(${s})" opacity="${o}">${[0, 72, 144, 216, 288].map((a) => `<ellipse cy="-17" rx="10" ry="17" transform="rotate(${a})" fill="${P}"/>`).join("")}<circle r="6" fill="${G}"/></g>`;
    const shapes = {
      ring: `<ellipse cx="200" cy="300" rx="96" ry="62" fill="none" stroke="${G}" stroke-width="9"/>
             <ellipse cx="200" cy="300" rx="96" ry="62" fill="none" stroke="#fff" stroke-width="1.5" opacity=".55" stroke-dasharray="60 400" stroke-dashoffset="-30"/>
             <path d="M200 196 l 22 26 -22 32 -22 -32z" fill="${P}"/><path d="M178 222 h44 M200 196 l -8 26 8 32 8 -32z" stroke="#fff" stroke-width="1" fill="none" opacity=".6"/>
             ${leaf(232, 236, -20, .8)}${leaf(168, 236, 200, .8)}`,
      bracelet: `<ellipse cx="200" cy="270" rx="124" ry="80" fill="none" stroke="${G}" stroke-width="3" stroke-dasharray="4 8" stroke-linecap="round"/>
             <g transform="translate(200 352)"><path d="M0 0 c -22 -26 -50 -12 -38 8 c 7 12 28 10 38 -8z M0 0 c 22 -26 50 -12 38 8 c -7 12 -28 10 -38 -8z M0 4 c -14 10 -22 26 -10 30 c 6 2 10 -14 10 -30z M0 4 c 14 10 22 26 10 30 c -6 2 -10 -14 -10 -30z" fill="${P}"/><path d="M0 -12 v38" stroke="${G}" stroke-width="2.5"/></g>`,
      cuff: `<path d="M104 310 C 104 196, 296 196, 296 278 C 296 330, 146 340, 148 266 C 150 214, 262 214, 258 266 C 255 304, 186 304, 190 266 C 192 246, 226 246, 224 266" fill="none" stroke="${G}" stroke-width="6" stroke-linecap="round"/>
             ${leaf(292, 270, -40)}${leaf(106, 312, 150)}${leaf(296, 252, -80, .7)}`,
      necklace: `<path d="M64 96 C 84 320, 316 320, 336 96" fill="none" stroke="${G}" stroke-width="2.6" stroke-dasharray="3 7" stroke-linecap="round"/>
             <path d="M200 272 v 24" stroke="${G}" stroke-width="2.5"/>
             <path d="M200 296 c 26 22 26 58 0 72 c -26 -14 -26 -50 0 -72z" fill="${P}"/><path d="M200 306 c 10 14 10 34 0 50" stroke="#fff" stroke-width="1.5" fill="none" opacity=".6"/>`,
      earring: `<g fill="none" stroke="${G}" stroke-width="3.5" stroke-linecap="round"><path d="M138 130 c 0 -34 38 -34 38 0 v 46"/><path d="M226 130 c 0 -34 38 -34 38 0 v 46"/></g>
             ${[157, 245].map((x) => `<path d="M${x + 19} 182 l 10 22 24 3 -17 16 4 24 -21 -11 -21 11 4 -24 -17 -16 24 -3z" fill="${P}" transform="translate(-19 0)"/>`).join("")}`,
      belly: `<path d="M44 176 C 120 270, 280 270, 356 176" fill="none" stroke="${G}" stroke-width="2.4" stroke-dasharray="3 7" stroke-linecap="round"/>
             <path d="M56 210 C 130 336, 270 336, 344 210" fill="none" stroke="${G}" stroke-width="2.4" stroke-dasharray="3 7" stroke-linecap="round"/>
             <circle cx="200" cy="304" r="11" fill="${P}"/><circle cx="200" cy="246" r="7" fill="${P}" opacity=".7"/>
             <path d="M200 315 v 44" stroke="${G}" stroke-width="2.4"/><path d="M200 359 c 10 8 10 22 0 28 c -10 -6 -10 -20 0 -28z" fill="${G}"/>`,
      clip: `<rect x="86" y="246" width="228" height="16" rx="8" fill="none" stroke="${G}" stroke-width="4"/>
             ${flower(150, 240, 1, .95)}${flower(236, 246, .65, .8)}${flower(284, 236, .45, .7)}${leaf(110, 238, -150, .8)}`
    };
    return `<svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--gold-hi)"/><stop offset=".5" style="stop-color:var(--gold)"/><stop offset="1" style="stop-color:var(--gold-hi)"/></linearGradient>
        <linearGradient id="${id}p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--petal)" stop-opacity=".95"/><stop offset="1" style="stop-color:var(--petal-ink)"/></linearGradient>
        <radialGradient id="${id}h" cx=".5" cy=".55" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      </defs>
      <circle cx="${120 + r(1) * 160}" cy="${150 + r(2) * 80}" r="${150 + r(3) * 40}" fill="url(#${id}h)"/>
      <use href="#ugalz" x="40" y="${372 + r(4) * 20}" width="320" height="110" opacity=".3" style="stroke:var(--petal);stroke-width:2.4"/>
      ${shapes[cat] || shapes.ring}
      <text x="${290 + r(9) * 60}" y="${80 + r(10) * 50}" fill="var(--gold)" font-size="26">✦</text>
      <text x="${50 + r(11) * 40}" y="${150 + r(12) * 60}" fill="var(--gold)" font-size="14" opacity=".7">✦</text>
    </svg>`;
  }

  return { CATEGORIES, INSTAGRAM, esc, money, catOf, isLatin, api, shrink, upload, art };
})();
