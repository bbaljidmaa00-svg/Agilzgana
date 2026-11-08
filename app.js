/* Agilzgana storefront — plain JS, no build step. Products live in products.json. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const isLatin = (t) => /^[\x00-\x7F]*$/.test(t);

  let DATA = { shop: { instagram: "agilzgana_", currency: "₮" }, categories: [], products: [] };
  let bag = store.get("agz-bag", []);
  let current = null;
  let activeCat = "all";

  const money = (n) => Number(n || 0).toLocaleString("en-US").replace(/,/g, " ") + " " + (DATA.shop.currency || "₮");
  const catOf = (id) => DATA.categories.find((c) => c.id === id) || { name: id, size: "none" };

  /* ---------- theme ---------- */
  $("#themeBtn").addEventListener("click", () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    const next = dark ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem("agz-theme", next); } catch {}
  });

  /* ---------- placeholder art (used until real photos are added) ---------- */
  function art(cat, seed = 0) {
    const g = "var(--gold)", p = "var(--petal)", m = "var(--moss)";
    const r = (n) => ((Math.sin(seed * 9.1 + n * 3.7) + 1) / 2);
    const leaf = (x, y, a) => `<path d="M${x} ${y} q 14 -18 30 -4 q -16 16 -30 4z" transform="rotate(${a} ${x} ${y})" style="fill:none;stroke:${m};stroke-width:1.2;opacity:.7"/>`;
    const shapes = {
      ring: `<ellipse cx="200" cy="270" rx="92" ry="64" style="fill:none;stroke:${g};stroke-width:7"/>
             <ellipse cx="200" cy="270" rx="80" ry="54" style="fill:none;stroke:${g};stroke-width:1;opacity:.6"/>
             <path d="M200 176 l 18 22 -18 26 -18 -26z" style="fill:${p};opacity:.85"/>
             <path d="M182 198 h36" style="stroke:#fff;stroke-width:1;opacity:.7"/>`,
      bracelet: `<ellipse cx="200" cy="250" rx="120" ry="78" style="fill:none;stroke:${g};stroke-width:2.4;stroke-dasharray:3 9;stroke-linecap:round"/>
             <g transform="translate(200 334)"><path d="M0 0 c -20 -24 -44 -10 -34 8 c 6 10 24 8 34 -8z M0 0 c 20 -24 44 -10 34 8 c -6 10 -24 8 -34 -8z" style="fill:${p};opacity:.8"/><path d="M0 -10 v18" style="stroke:${g};stroke-width:2"/></g>`,
      cuff: `<path d="M110 300 C 110 200, 290 200, 290 270 C 290 320, 150 330, 150 260 C 150 210, 260 210, 256 262 C 252 300, 186 300, 190 262" style="fill:none;stroke:${g};stroke-width:5;stroke-linecap:round"/>
             ${leaf(286, 268, -30)}${leaf(110, 300, 160)}`,
      necklace: `<path d="M70 110 C 90 300, 310 300, 330 110" style="fill:none;stroke:${g};stroke-width:2;stroke-dasharray:2 6;stroke-linecap:round"/>
             <path d="M200 262 v 26" style="stroke:${g};stroke-width:2"/>
             <path d="M200 288 c 22 20 22 52 0 64 c -22 -12 -22 -44 0 -64z" style="fill:${p};opacity:.85"/>`,
      earring: `<g style="fill:none;stroke:${g};stroke-width:3;stroke-linecap:round"><path d="M140 120 c 0 -30 34 -30 34 0 v 40"/><path d="M226 120 c 0 -30 34 -30 34 0 v 40"/></g>
             <path d="M174 170 l 9 20 21 3 -15 14 4 21 -19 -10 -19 10 4 -21 -15 -14 21 -3z" style="fill:${p};opacity:.85" transform="translate(-9 0)"/>
             <path d="M260 170 l 9 20 21 3 -15 14 4 21 -19 -10 -19 10 4 -21 -15 -14 21 -3z" style="fill:${p};opacity:.85" transform="translate(-9 0)"/>`,
      belly: `<path d="M50 170 C 120 260, 280 260, 350 170" style="fill:none;stroke:${g};stroke-width:2;stroke-dasharray:2 6;stroke-linecap:round"/>
             <path d="M60 200 C 130 320, 270 320, 340 200" style="fill:none;stroke:${g};stroke-width:2;stroke-dasharray:2 6;stroke-linecap:round"/>
             <circle cx="200" cy="292" r="10" style="fill:${p}"/><circle cx="200" cy="236" r="6" style="fill:${p};opacity:.7"/>
             <path d="M200 302 v 40" style="stroke:${g};stroke-width:2"/><circle cx="200" cy="348" r="7" style="fill:${g}"/>`,
      clip: `<rect x="90" y="236" width="220" height="16" rx="8" style="fill:none;stroke:${g};stroke-width:3"/>
             <g transform="translate(150 230)">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-18" rx="11" ry="18" transform="rotate(${a})" style="fill:${p};opacity:.75"/>`).join("")}<circle r="7" style="fill:${g}"/></g>
             <g transform="translate(240 236) scale(.6)">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-18" rx="11" ry="18" transform="rotate(${a})" style="fill:${p};opacity:.55"/>`).join("")}<circle r="7" style="fill:${g}"/></g>`
    };
    return `<svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <circle cx="${80 + r(1) * 240}" cy="${80 + r(2) * 120}" r="${120 + r(3) * 60}" style="fill:${p};opacity:.08"/>
      <path d="M-10 ${430 - r(4) * 40} C 120 ${380 + r(5) * 40}, 260 ${470}, 410 ${400 + r(6) * 30}" style="fill:none;stroke:${m};stroke-width:1;opacity:.5"/>
      ${leaf(60 + r(7) * 60, 440, -20)}${leaf(300, 120 + r(8) * 40, 140)}
      ${shapes[cat] || shapes.ring}
      <text x="${300 + r(9) * 50}" y="${70 + r(10) * 40}" style="fill:${g};font-size:28px">✦</text>
    </svg>`;
  }
  const media = (p, i = 0) => p.images && p.images[i]
    ? `<img src="${esc(p.images[i])}" alt="${esc(p.name)}" loading="lazy">`
    : art(p.category, DATA.products.indexOf(p) + 1);

  /* ---------- categories + grid ---------- */
  function renderCats() {
    const all = [{ id: "all", name: "Бүгд" }, ...DATA.categories];
    $("#cats").innerHTML = all.map((c) =>
      `<button class="cat" role="tab" type="button" data-cat="${esc(c.id)}" aria-selected="${c.id === activeCat}">${esc(c.name)}</button>`).join("");
  }
  $("#cats").addEventListener("click", (e) => {
    const b = e.target.closest(".cat"); if (!b) return;
    activeCat = b.dataset.cat; renderCats(); renderGrid(true);
  });

  function renderGrid(animate) {
    const list = DATA.products.filter((p) => !p.hidden && (activeCat === "all" || p.category === activeCat));
    $("#grid").innerHTML = list.length ? list.map((p, i) => `
      <button class="card" type="button" data-id="${esc(p.id)}" style="--d:${(i % 4) * 0.08}s">
        <span class="card-media">${media(p)}${p.isExample ? '<span class="tag-example">Жишээ</span>' : ""}</span>
        <span class="card-cat">${esc(catOf(p.category).name)}</span>
        <span class="card-row"><span class="card-name">${esc(p.name)}</span><span class="card-price">${money(p.price)}</span></span>
      </button>`).join("") : `<p class="note">Энэ төрөлд одоогоор бүтээл алга. Удахгүй нэмэгдэнэ.</p>`;
    $("#exampleNote").hidden = !DATA.products.some((p) => p.isExample);
    watch($$(".card", $("#grid")), animate);
  }
  $("#grid").addEventListener("click", (e) => {
    const c = e.target.closest(".card"); if (c) location.hash = "p-" + c.dataset.id;
  });

  /* ---------- scroll reveal ---------- */
  const io = "IntersectionObserver" in window ? new IntersectionObserver((ents) => {
    ents.forEach((en) => { if (en.isIntersecting) { en.target.classList.remove("reveal-wait"); io.unobserve(en.target); } });
  }, { rootMargin: "0px 0px -8% 0px" }) : null;
  function watch(els, force) {
    if (!io || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    els.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const below = rect.top > innerHeight * 0.92;
      if (!below && !force) return; // already on screen: leave it visible
      el.classList.add("reveal-on", "reveal-wait");
      requestAnimationFrame(() => io.observe(el));
    });
  }

  /* ---------- size guide ---------- */
  const RING_SIZES = [15, 15.5, 16, 16.5, 17, 17.5, 18, 18.5, 19, 19.5, 20, 21];
  $("#sizeRows").innerHTML = RING_SIZES.map((s) =>
    `<tr><td>${s}</td><td>${s.toFixed(1)} мм</td><td>${(Math.PI * s).toFixed(1)} мм</td></tr>`).join("");

  /* ---------- size field per category ---------- */
  const SIZE_UI = {
    ring: () => `
      <span class="label" id="ringLbl">Бөгжний размер</span>
      <div class="chips" role="group" aria-labelledby="ringLbl">${RING_SIZES.map((s) => `<button type="button" class="chip" data-size="${s}" aria-pressed="false">${s}</button>`).join("")}</div>
      <label for="ringMm" style="margin-top:.4rem">Размераа мэдэхгүй бол хурууны тойрог (мм)</label>
      <div class="unit-row"><input id="ringMm" type="number" inputmode="decimal" min="40" max="80" step="0.5" placeholder="54"><span id="ringCalc"></span></div>`,
    wrist: () => cm("Бугуйн тойрог", 12, 24, "15.5", "Бугуйн ясны дээгүүр хэмжинэ. Бид 1–1.5 см чөлөө нэмнэ."),
    arm: () => cm("Гарын тойрог (зүүх хэсэг)", 16, 45, "26", "Ихэвчлэн шууны дээд хэсэгт зүүдэг."),
    waist: () => cm("Бүсэлхийн тойрог", 50, 130, "70", "Зүүх өндөр дээрээ хэмжинэ."),
    neck: () => `
      <span class="label" id="neckLbl">Гинжний урт</span>
      <div class="chips" role="group" aria-labelledby="neckLbl">${[40, 45, 50, 55, 60].map((s) => `<button type="button" class="chip" data-size="${s} см" aria-pressed="${s === 45}">${s} см</button>`).join("")}</div>
      <p class="help">40 см хүзүүнд ойр, 45 см эгэмний яс, 50–60 см урт унжина.</p>`,
    none: () => `<p class="help">Энэ бүтээлд хэмжээ шаардлагагүй.</p>`
  };
  function cm(label, min, max, ph, help) {
    return `<label for="cmIn">${label} (см)</label>
      <div class="unit-row"><input id="cmIn" type="number" inputmode="decimal" min="${min}" max="${max}" step="0.5" placeholder="${ph}"><span>см</span></div>
      <p class="help">${help}</p>`;
  }
  function readSize(type) {
    if (type === "none") return { ok: true, value: "" };
    if (type === "ring" || type === "neck") {
      const on = $(".chip[aria-pressed='true']", $("#sizeField"));
      if (on) return { ok: true, value: type === "ring" ? "Размер " + on.dataset.size : on.dataset.size };
      if (type === "ring") {
        const mm = parseFloat($("#ringMm").value);
        if (mm >= 40 && mm <= 80) return { ok: true, value: `Хурууны тойрог ${mm} мм (≈ размер ${(mm / Math.PI).toFixed(1)})` };
      }
      return { ok: false, msg: "Размераа сонгох эсвэл хурууныхаа тойргийг мм-ээр оруулна уу." };
    }
    const inp = $("#cmIn"), v = parseFloat(inp.value);
    if (!(v >= +inp.min && v <= +inp.max)) return { ok: false, msg: `Хэмжээг ${inp.min}–${inp.max} см хооронд оруулна уу.` };
    return { ok: true, value: `${v} см` };
  }
  $("#sizeField").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip"); if (!chip) return;
    $$(".chip", $("#sizeField")).forEach((c) => c.setAttribute("aria-pressed", c === chip));
    const mm = $("#ringMm"); if (mm) { mm.value = ""; $("#ringCalc").textContent = ""; }
  });
  $("#sizeField").addEventListener("input", (e) => {
    if (e.target.id !== "ringMm") return;
    const mm = parseFloat(e.target.value);
    $$(".chip", $("#sizeField")).forEach((c) => c.setAttribute("aria-pressed", "false"));
    if (mm >= 40 && mm <= 80) {
      const d = mm / Math.PI, near = RING_SIZES.reduce((a, b) => Math.abs(b - d) < Math.abs(a - d) ? b : a);
      $("#ringCalc").textContent = `≈ размер ${near}`;
    } else $("#ringCalc").textContent = "";
  });

  /* ---------- product panel ---------- */
  function openProduct(id) {
    const p = DATA.products.find((x) => x.id === id); if (!p) return;
    current = p;
    const c = catOf(p.category);
    const imgs = p.images && p.images.length ? p.images.map((_, i) => media(p, i)).join("") : media(p);
    $("#pMedia").innerHTML = imgs;
    $("#pCat").textContent = c.name;
    $("#pName").textContent = p.name;
    $("#pName").classList.toggle("cyr", !isLatin(p.name));
    $("#pPrice").textContent = money(p.price) + (p.isExample ? "  · жишээ үнэ" : "");
    $("#pDesc").textContent = p.description || "";
    $("#pMat").textContent = p.material ? "Материал: " + p.material : "";
    $("#sizeField").innerHTML = (SIZE_UI[c.size] || SIZE_UI.none)();
    $("#pQty").value = 1; $("#pNote").value = ""; $("#pErr").textContent = "";
    show($("#productPanel"));
  }
  $("#qtyMinus").onclick = () => { $("#pQty").value = Math.max(1, (+$("#pQty").value || 1) - 1); };
  $("#qtyPlus").onclick = () => { $("#pQty").value = Math.min(20, (+$("#pQty").value || 1) + 1); };
  $("#pForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const size = readSize(catOf(current.category).size);
    if (!size.ok) { $("#pErr").textContent = size.msg; return; }
    bag.push({ id: current.id, size: size.value, qty: Math.max(1, Math.min(20, +$("#pQty").value || 1)), note: $("#pNote").value.trim() });
    store.set("agz-bag", bag);
    updateCount(true);
    hide(); history.replaceState(null, "", location.pathname + location.search);
    setTimeout(openBag, 250);
  });

  /* ---------- order panel ---------- */
  function updateCount(bump) {
    const n = bag.reduce((a, b) => a + b.qty, 0);
    const el = $("#bagCount"); el.textContent = n;
    if (bump) { el.classList.add("bump"); setTimeout(() => el.classList.remove("bump"), 400); }
  }
  function renderBag() {
    const items = bag.map((b, i) => ({ ...b, i, p: DATA.products.find((x) => x.id === b.id) })).filter((b) => b.p);
    $("#bagList").innerHTML = items.map((b) => `
      <li class="bag-item">
        <span class="bag-thumb">${media(b.p)}</span>
        <span><h4>${esc(b.p.name)}</h4><span class="bag-meta">${esc(catOf(b.p.category).name)}${b.size ? " · " + esc(b.size) : ""} · ${b.qty} ш${b.note ? "<br>" + esc(b.note) : ""}</span></span>
        <button class="rm" type="button" data-i="${b.i}">Хасах</button>
      </li>`).join("");
    const total = items.reduce((a, b) => a + b.p.price * b.qty, 0);
    $("#bagEmpty").hidden = items.length > 0;
    $("#bagTotal").textContent = items.length ? "Нийт: " + money(total) : "";
    $("#orderForm").hidden = !items.length;
    $("#sentBox").hidden = true;
    return { items, total };
  }
  $("#bagList").addEventListener("click", (e) => {
    const b = e.target.closest(".rm"); if (!b) return;
    bag.splice(+b.dataset.i, 1); store.set("agz-bag", bag); updateCount(); renderBag();
  });
  function openBag() { renderBag(); show($("#bagPanel")); }
  $("#bagBtn").addEventListener("click", openBag);

  const saved = store.get("agz-customer", {});
  ["oName", "oPhone", "oIg", "oAddr"].forEach((k) => { if (saved[k]) $("#" + k).value = saved[k]; });

  $("#orderForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = Object.fromEntries(["oName", "oPhone", "oIg", "oAddr"].map((k) => [k, $("#" + k).value.trim()]));
    if (!f.oName || !f.oPhone || !f.oAddr) { $("#oErr").textContent = "Нэр, утас, хаягаа бөглөнө үү."; return; }
    if (!/^[+\d][\d\s-]{6,}$/.test(f.oPhone)) { $("#oErr").textContent = "Утасны дугаараа шалгана уу."; return; }
    $("#oErr").textContent = "";
    store.set("agz-customer", f);
    const { items, total } = renderBag();
    const lines = items.map((b, n) => `${n + 1}. ${b.p.name} (${catOf(b.p.category).name})${b.size ? " · " + b.size : ""} · ${b.qty} ш · ${money(b.p.price * b.qty)}${b.note ? "\n   Тэмдэглэл: " + b.note : ""}`);
    const text = `Сайн байна уу! Agilzgana-аас захиалга өгье.\n\n${lines.join("\n")}\n\nНийт: ${money(total)}\n\nНэр: ${f.oName}\nУтас: ${f.oPhone}${f.oIg ? "\nInstagram: " + f.oIg : ""}\nХаяг: ${f.oAddr}`;
    $("#orderText").textContent = text;
    $("#orderForm").hidden = true;
    $("#sentBox").hidden = false;
    $("#copyHint").textContent = "";
  });
  $("#copyBtn").addEventListener("click", () => {
    const t = $("#orderText").textContent;
    const ok = () => { $("#copyHint").textContent = "Хуулагдлаа. Одоо Instagram-аар илгээнэ үү."; };
    const fallback = () => {
      const r = document.createRange(); r.selectNodeContents($("#orderText"));
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      $("#copyHint").textContent = "Текстийг сонголоо. Хуулаад илгээнэ үү.";
    };
    try { navigator.clipboard.writeText(t).then(ok, fallback); } catch { fallback(); }
  });

  /* ---------- panel helpers ---------- */
  let lastFocus = null;
  function show(panel) {
    $$(".panel").forEach((p) => { if (p !== panel) p.hidden = true; });
    lastFocus = document.activeElement;
    $("#veil").hidden = false; panel.hidden = false;
    document.body.style.overflow = "hidden";
    const f = panel.querySelector(".close"); f && f.focus({ preventScroll: true });
  }
  function hide() {
    $$(".panel").forEach((p) => (p.hidden = true));
    $("#veil").hidden = true; document.body.style.overflow = "";
    lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true });
  }
  function closeAll() {
    const wasProduct = !$("#productPanel").hidden;
    hide();
    if (wasProduct && location.hash.startsWith("#p-")) history.replaceState(null, "", location.pathname + location.search);
  }
  $("#veil").addEventListener("click", closeAll);
  $$("[data-close]").forEach((b) => b.addEventListener("click", closeAll));
  addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(); });

  function route() {
    const h = location.hash.slice(1);
    if (h.startsWith("p-")) openProduct(h.slice(2));
  }
  addEventListener("hashchange", route);

  /* ---------- pollen / firefly field ---------- */
  (function pollen() {
    const cv = $("#pollen"), cx = cv.getContext("2d");
    if (!cx) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W, H, dpr, pts = [], mouse = { x: -999, y: -999 };
    const color = () => getComputedStyle(document.documentElement).getPropertyValue("--gold").trim() || "#D9A92B";
    const pink = () => getComputedStyle(document.documentElement).getPropertyValue("--petal").trim() || "#E25FA6";
    function size() {
      dpr = Math.min(2, devicePixelRatio || 1);
      W = cv.width = innerWidth * dpr; H = cv.height = innerHeight * dpr;
      const n = Math.round(Math.min(70, innerWidth / 18));
      pts = Array.from({ length: n }, (_, i) => ({
        x: Math.random() * W, y: Math.random() * H, r: (Math.random() * 1.8 + .6) * dpr,
        a: Math.random() * Math.PI * 2, s: (Math.random() * .25 + .08) * dpr, t: Math.random() * 100, pink: i % 5 === 0
      }));
    }
    addEventListener("resize", size); size();
    addEventListener("pointermove", (e) => { mouse.x = e.clientX * dpr; mouse.y = e.clientY * dpr; });
    function frame() {
      const gc = color(), pc = pink();
      cx.clearRect(0, 0, W, H);
      for (const p of pts) {
        p.t += .01;
        p.a += Math.sin(p.t) * .02;
        p.x += Math.cos(p.a) * p.s; p.y += Math.sin(p.a) * p.s - .05 * dpr;
        const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy);
        if (d < 120 * dpr) { p.x += (dx / d) * 1.2 * dpr - dy / d * .8 * dpr; p.y += (dy / d) * 1.2 * dpr + dx / d * .8 * dpr; } // swirl away from cursor
        if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10; if (p.y > H + 10) p.y = -10;
        const glow = .45 + Math.sin(p.t * 3) * .35;
        cx.globalAlpha = glow; cx.fillStyle = p.pink ? pc : gc;
        cx.shadowBlur = 8 * dpr; cx.shadowColor = p.pink ? pc : gc;
        cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, Math.PI * 2); cx.fill();
      }
      if (!reduce) requestAnimationFrame(frame);
    }
    frame();
  })();

  /* ---------- section reveals ---------- */
  watch($$(".section-head, .cats, .steps li, .table-wrap, .story-photo, .story-text"));

  /* ---------- boot ---------- */
  updateCount();
  fetch("products.json", { cache: "no-cache" })
    .then((r) => r.json())
    .then((d) => {
      DATA = d;
      if (d.shop && d.shop.instagram) {
        const ig = d.shop.instagram.replace(/^@/, "");
        $("#dmLink").href = "https://ig.me/m/" + ig;
      }
      renderCats(); renderGrid(); updateCount(); route();
    })
    .catch(() => { $("#grid").innerHTML = '<p class="note">Бүтээгдэхүүн ачааллахад алдаа гарлаа. Хуудсаа дахин ачаална уу.</p>'; });
})();
