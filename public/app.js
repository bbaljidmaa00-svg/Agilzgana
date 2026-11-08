/* Agilzgana storefront. Products come from /api/products (Cloudflare D1); products.json is the offline fallback. */
(() => {
  const { CATEGORIES, INSTAGRAM, esc, money, priceText, catOf, isLatin, api, upload, art } = window.AGZ;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  let PRODUCTS = [];
  let LIVE = false; // true when the database API answered
  let bag = store.get("agz-bag", []);
  let current = null;
  let activeCat = "all";

  /* ---------- intro ---------- */
  try { sessionStorage.setItem("agz-intro", "1"); } catch {}
  setTimeout(() => { const i = $("#intro"); if (i) i.remove(); }, 3600);

  /* ---------- theme ---------- */
  $("#themeBtn").addEventListener("click", () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("agz-theme", root.dataset.theme); } catch {}
    gardens.forEach((g) => g.recolor());
  });

  /* ---------- swirl-in for the headline ornaments ----------
     The symbol is copied inline so each stroke can be animated on its own: the long ribbons unroll smoothly from
     the centre outward using their real lengths, then the sparkles, rings and dots pop in one after another. */
  function swirlIn(svg, delay) {
    const u = svg && svg.querySelector("use");
    if (!u) return;
    const sym = document.querySelector(u.getAttribute("href"));
    if (!sym) return;
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "orn");
    for (const c of sym.children) { const k = c.cloneNode(true); k.removeAttribute("pathLength"); g.appendChild(k); }
    svg.setAttribute("viewBox", sym.getAttribute("viewBox"));
    u.replaceWith(g);
    const parts = [...g.children];
    if (reduce || !g.animate) return;
    const vb = sym.viewBox.baseVal, cx = vb.x + vb.width / 2;
    const long = [], bits = [];
    for (const p of parts) { const b = p.getBBox(); (b.width > 34 || b.height > 34 ? long : bits).push([p, b]); }
    for (const [p] of long) {
      const L = p.getTotalLength() + 2;
      p.style.strokeDasharray = `${L} ${L + 2}`;
      p.style.strokeDashoffset = L; p.style.fillOpacity = 0;
      p.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 2400, delay: delay * 1000, easing: "cubic-bezier(.45,.05,.2,1)", fill: "forwards" });
      p.animate([{ fillOpacity: 0 }, { fillOpacity: 1 }], { duration: 700, delay: (delay + 1.6) * 1000, easing: "ease-out", fill: "forwards" });
    }
    bits.sort((a, b) => Math.abs(a[1].x + a[1].width / 2 - cx) - Math.abs(b[1].x + b[1].width / 2 - cx));
    bits.forEach(([p], i) => {
      p.style.transformBox = "fill-box"; p.style.transformOrigin = "center"; p.style.opacity = 0;
      p.animate([
        { opacity: 0, transform: "scale(0) rotate(-45deg)" },
        { opacity: 1, transform: "scale(1.25) rotate(6deg)", offset: 0.6 },
        { opacity: 1, transform: "scale(1) rotate(0deg)" }
      ], { duration: 750, delay: (delay + 0.7 + i * 0.09) * 1000, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" });
    });
  }
  {
    const introOnNow = !document.documentElement.classList.contains("no-intro");
    swirlIn($(".intro-ornament"), 0.1);
    swirlIn($(".hero-ornament"), introOnNow ? 2.6 : 0.8);
  }

  /* ---------- living угалз garden (canvas), calligraphic ink style ----------
     Hand-designed pen flourishes grow out of the four corners: each stroke is a bezier lead-in that rolls into
     a tangent spiral, filled as a tapered brush shape (thin, swelling, fine) with a ball terminal, with smaller
     scrolls and teardrop leaves branching off. The corners are mirror images, so the frame reads as one drawn
     border around the logo. Sparkles and dot trails twinkle in the margins; the flourishes breathe slightly. */
  function Garden(canvas, opts = {}) {
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, dpr = 1, groups = [], doodles = [], t0 = performance.now(), col = "#CC6690", col2 = "#B08647", visible = true;
    const night = !!opts.night;
    const TAU = Math.PI * 2;
    function recolor() {
      col = night ? "#F8ECE6" : css("--petal");
      col2 = night ? "#E9D2A6" : css("--gold");
    }
    function rnd(a, b) { return a + Math.random() * (b - a); }
    const bez = (p, t) => { const u = 1 - t; return [u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0], u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1]]; };
    // centerline: chained cubic beziers, then a spiral tangent to the end (d = -1 turns left on screen, +1 right)
    function line(segs, r, d, turns = 1.15) {
      const pts = [];
      segs.forEach((s, k) => { for (let i = k ? 1 : 0; i <= 30; i++) pts.push(bez(s, i / 30)); });
      if (r) {
        const [x0, y0] = pts[pts.length - 2], [x1, y1] = pts[pts.length - 1];
        const th = Math.atan2(y1 - y0, x1 - x0), cx = x1 + r * Math.cos(th + d * Math.PI / 2), cy = y1 + r * Math.sin(th + d * Math.PI / 2);
        const f0 = Math.atan2(y1 - cy, x1 - cx);
        for (let i = 1; i <= 60; i++) { const t = i / 60, rr = r * (1 - 0.78 * t), f = f0 + d * TAU * turns * t; pts.push([cx + rr * Math.cos(f), cy + rr * Math.sin(f)]); }
      }
      // tangent angle and arc-length fraction for each point
      let L = 0; const acc = [0];
      for (let i = 1; i < pts.length; i++) { L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); acc.push(L); }
      return pts.map((p, i) => { const a = pts[Math.min(i + 1, pts.length - 1)], b = pts[Math.max(i - 1, 0)]; return [p[0], p[1], Math.atan2(a[1] - b[1], a[0] - b[0]), acc[i] / L]; });
    }
    // one corner flourish in local units (origin at the corner, x inward, y inward); strokes start at `at` of the group's growth
    function design() {
      return [
        { at: 0.00, w: 6.4, head: 0.2, pts: line([[[-8, 64], [70, 70], [140, 116], [150, 178]], [[150, 178], [156, 222], [128, 252], [100, 244]]], 20, -1) },
        { at: 0.22, w: 4.0, head: 0.5, pts: line([[[62, 72], [104, 70], [150, 58], [172, 80]]], 13, 1), leaf: [62, 72, -0.9] },
        { at: 0.45, w: 3.6, head: 0.5, pts: line([[[146, 150], [118, 140], [96, 150], [92, 172]]], 10, -1), leaf: [146, 150, 2.6] },
        { at: 0.35, w: 3.0, head: 0.6, pts: line([[[-6, 26], [40, 28], [80, 22], [96, 4]]], 7, -1) },
        { at: 0.55, w: 2.8, head: 0.5, pts: line([[[118, 92], [128, 112], [124, 128], [110, 132]]], 7, 1) }
      ];
    }
    function layout() {
      dpr = Math.min(2, devicePixelRatio || 1);
      const r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      const small = W < 640;
      const s = small ? Math.min(0.62, W / 620) : Math.max(0.8, Math.min(1.5, Math.min(W / 1100, H / 700)));
      const D = design();
      // corners: [x, y, flipX, flipY, delay, scale]
      const C = night
        ? [[0, H, 1, -1, 0.0, s * 0.8], [W, H, -1, -1, 0.0, s * 0.8]]          // night: only the lower corners, the heading sits top-left
        : [[0, H, 1, -1, 0.0, s], [W, H, -1, -1, 0.0, s], [0, 0, 1, 1, 0.35, s * (small ? 0.75 : 0.85)], [W, 0, -1, 1, 0.35, s * (small ? 0.75 : 0.85)]];
      groups = C.map(([x, y, fx, fy, delay, sc]) => ({ x, y, fx, fy, delay, sc, D, dur: 4.2, ph: rnd(0, TAU) }));
      doodles = [];
      const want = night ? (small ? 4 : 7) : (small ? 5 : 9);
      const kinds = ["sparkle", "sparkle", "bigSparkle", "dot", "trail", "trail"];
      let guard = 0;
      while (doodles.length < want * 2 && guard++ < 800) {
        const x = night ? rnd(14, small ? 26 : 60) : rnd(16, W / 2 - (small ? 50 : 90)), y = night ? rnd(H * 0.15, H - 240 * s) : rnd(16, H - 16);
        const cx = Math.abs(x - W / 2) / (W / 2), cy = Math.abs(y - H / 2) / (H / 2);
        if (!night && cx < (small ? 0.6 : 0.52) && cy < 0.66) continue;                       // keep the middle clear
        if ((x < 260 * s && (y < 200 * s || y > H - 270 * s))) continue;             // and off the corner flourishes
        if (doodles.some((d) => Math.hypot(d.x - x, d.y - y) < (small ? 50 : 80))) continue;
        const kind = night ? ["sparkle", "dot", "trail"][Math.floor(Math.random() * 3)] : kinds[Math.floor(Math.random() * kinds.length)];
        const base = small ? 0.75 : 1;
        const rr = kind === "dot" ? rnd(1.8, 3) : kind === "trail" ? rnd(2.2, 3) : kind === "bigSparkle" ? rnd(18, 28) * base : rnd(6, 12) * base;
        const d = { kind, x, y, r: rr, at: rnd(1.2, 4.6), rot: rnd(-0.25, 0.25), tw: rnd(0, TAU), sp: rnd(1.2, 2.4), gold: Math.random() < 0.35, ang: rnd(0, TAU) };
        doodles.push(d, Object.assign({}, d, { x: W - x, rot: -d.rot, ang: Math.PI - d.ang }));
      }
      recolor();
    }
    function brush(P, w, head, grow) {
      const Lp = [], Rp = [];
      for (const [x, y, a, u] of P) {
        if (u > grow) break;
        let f = u < 0.3 ? head + (1 - head) * Math.sin(Math.PI / 2 * u / 0.3) : 0.12 + 0.88 * Math.cos(Math.PI / 2 * (u - 0.3) / 0.7);
        f *= Math.min(1, (grow - u) * 12 + 0.2);                                   // the growing end stays pointed
        const hw = Math.max(0.3, w / 2 * f), nx = -Math.sin(a), ny = Math.cos(a);
        Lp.push(x + nx * hw, y + ny * hw); Rp.push(x - nx * hw, y - ny * hw);
      }
      if (Lp.length < 6) return;
      ctx.beginPath(); ctx.moveTo(Lp[0], Lp[1]);
      for (let i = 2; i < Lp.length; i += 2) ctx.lineTo(Lp[i], Lp[i + 1]);
      for (let i = Rp.length - 2; i >= 0; i -= 2) ctx.lineTo(Rp[i], Rp[i + 1]);
      ctx.closePath(); ctx.fill();
      if (grow >= 1) { const e = P[P.length - 1]; ctx.beginPath(); ctx.arc(e[0], e[1], Math.max(1.3, w * 0.36), 0, TAU); ctx.fill(); }
    }
    function leaf(x, y, a, len, wd) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.bezierCurveTo(len * 0.3, wd, len * 0.8, wd * 0.6, len, 0);
      ctx.bezierCurveTo(len * 0.8, -wd * 0.6, len * 0.3, -wd, 0, 0);
      ctx.fill(); ctx.restore();
    }
    function sparkle(r, long) {
      const r2 = r * 0.16;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 2, rr = r * (i % 2 ? 1 : long);
        const b = a + Math.PI / 2, bb = r * ((i + 1) % 2 ? 1 : long), m = a + Math.PI / 4;
        if (!i) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        ctx.quadraticCurveTo(Math.cos(m) * r2, Math.sin(m) * r2, Math.cos(b) * bb, Math.sin(b) * bb);
      }
      ctx.closePath(); ctx.fill();
    }
    function drawGroup(G, time, grow) {
      ctx.save();
      ctx.translate(G.x, G.y); ctx.scale(G.fx * G.sc, G.fy * G.sc);
      ctx.rotate(Math.sin(time * 0.5 + G.ph) * 0.006);                              // a slow breath
      ctx.fillStyle = col; ctx.globalAlpha = night ? 0.85 : 0.92;
      for (const S of G.D) {
        const g = Math.max(0, Math.min(1, (grow - S.at) / (1 - S.at) * 1.15));
        if (g <= 0) continue;
        brush(S.pts, S.w, S.head, 1 - Math.pow(1 - g, 2));
        if (S.leaf) { const k = Math.min(1, g * 4); leaf(S.leaf[0], S.leaf[1], S.leaf[2], 16 * k, 5 * k); }
      }
      if (grow >= 1) {                                                              // a gold sparkle settles in the big curl
        const tw = 0.85 + 0.15 * Math.sin(time * 2 + G.ph);
        ctx.fillStyle = col2; ctx.translate(118, 214); ctx.scale(tw, tw); sparkle(8, 1.4);
      }
      ctx.restore();
    }
    function drawDoodle(d, time) {
      const t = time - (opts.startDelay || 0) - d.at;
      if (t <= 0 && !reduce) return;
      const g = reduce ? 1 : Math.min(1, t / 0.9);
      const pop = reduce ? 1 : 1 + 2.2 * Math.pow(g - 1, 3) + 1.2 * Math.pow(g - 1, 2);
      const tw = 0.85 + 0.15 * Math.sin(time * d.sp + d.tw);
      ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rot);
      ctx.globalAlpha = Math.min(1, g * 1.6) * 0.85;
      ctx.fillStyle = d.gold ? col2 : col;
      if (d.kind === "sparkle" || d.kind === "bigSparkle") { ctx.scale(pop * tw, pop * tw); sparkle(d.r, d.kind === "bigSparkle" ? 1.6 : 1.15); }
      else if (d.kind === "dot") { ctx.beginPath(); ctx.arc(0, 0, d.r * pop, 0, TAU); ctx.fill(); }
      else for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(Math.cos(d.ang) * i * 9, Math.sin(d.ang) * i * 9, d.r * (1 - i * 0.28) * pop, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    function frame(now) {
      if (!visible) return;
      const time = (now - t0) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const start = opts.startDelay || 0;
      for (const G of groups) {
        const g = reduce ? 1 : Math.max(0, Math.min(1, (time - start - G.delay) / G.dur));
        if (g > 0) drawGroup(G, time, g);
      }
      for (const d of doodles) drawDoodle(d, time);
      ctx.globalAlpha = 1;
      if (!reduce) requestAnimationFrame(frame);
    }
    layout();
    let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { layout(); t0 = performance.now() - 99999; if (reduce) requestAnimationFrame(frame); }, 150); });
    if ("IntersectionObserver" in window) new IntersectionObserver(([en]) => {
      const was = visible; visible = en.isIntersecting; if (visible && !was) requestAnimationFrame(frame);
    }).observe(canvas);
    requestAnimationFrame(frame);
    return { recolor };
  }
  const introOn = !document.documentElement.classList.contains("no-intro") && !reduce;
  const gardens = [Garden($("#garden"), { startDelay: introOn ? 2.4 : 0.2 })];
  let garden2Started = false;
  const g2 = $("#garden2");
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([en], o) => { if (en.isIntersecting && !garden2Started) { garden2Started = true; gardens.push(Garden(g2, { night: true })); o.disconnect(); } }, { rootMargin: "200px" }).observe(g2);
  } else gardens.push(Garden(g2, { night: true }));

  /* ---------- page vine: a meandering stem with spiral curls, drawn by scroll progress ---------- */
  (function pageVine() {
    const svg = $("#pageVine"), path = $("#pageVinePath"), main = $("#main");
    let len = 1;
    function build() {
      const W = main.clientWidth, H = main.scrollHeight;
      if (W < 1520) { path.setAttribute("d", ""); return; }      // no room in the gutter on small screens
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      const side = Math.max(30, (W - 1280) / 4);
      const top = Math.min(H * 0.12, 820);
      const pts = [];
      const xAt = (y) => side + Math.sin(y / 210) * 22 + Math.sin(y / 77) * 5;
      let curlNext = top + 380, dir = 1;
      for (let y = top; y < H - 200; y += 6) {
        pts.push(`${pts.length ? "L" : "M"}${xAt(y).toFixed(1)} ${y.toFixed(1)}`);
        if (y >= curlNext) {
          // spiral curl that branches off the stem, then jump back to the stem
          const x0 = xAt(y); dir = -1; let a = 0, r = Math.min(34, side * 0.5);
          const cx = x0 + dir * r, cy = y;
          const spiral = [];
          for (let k = 0; k < 80; k++) { a += dir * 0.12; r *= 0.976; spiral.push(`L${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`); }
          pts.push(...spiral, `M${x0.toFixed(1)} ${y.toFixed(1)}`);
          curlNext = y + 420 + Math.random() * 260; dir = -dir;
        }
      }
      path.setAttribute("d", pts.join(""));
      len = path.getTotalLength();
      path.style.strokeDasharray = len; update();
    }
    function update() {
      const H = document.documentElement.scrollHeight - innerHeight;
      const p = Math.min(1, Math.max(0, (scrollY + innerHeight * 0.5) / (H + innerHeight * 0.5)));
      path.style.strokeDashoffset = len * (1 - p);
      $$(".divider, .frame-orn, .deco, .head-orn, .corner-orn").forEach((el) => {
        const r = el.getBoundingClientRect();
        const q = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight * 0.6)));
        el.style.setProperty("--draw", (1 - q).toFixed(3));
      });
    }
    addEventListener("scroll", update, { passive: true });
    addEventListener("resize", () => setTimeout(build, 200));
    addEventListener("load", build);
    setTimeout(build, 300);
    window.__rebuildVine = build;
  })();

  /* ---------- flowing word band ---------- */
  const words = ["Бөгж", "Бугуйвч", "Arm cuff", "Зүүлт", "Ээмэг", "Гэдэсний зүүлт", "Хавчаар", "Захиалгаар", "Гараар урласан"];
  const run = words.map((w) => `<span>${w}</span><i>✦</i>`).join("");
  $("#bandTrack").innerHTML = run + run;

  /* ---------- categories + grid ---------- */
  function renderCats() {
    const all = [{ id: "all", name: "Бүгд" }, ...CATEGORIES];
    $("#cats").innerHTML = all.map((c) => `<button class="cat" role="tab" type="button" data-cat="${c.id}" aria-selected="${c.id === activeCat}">${esc(c.name)}</button>`).join("");
  }
  $("#cats").addEventListener("click", (e) => { const b = e.target.closest(".cat"); if (!b) return; activeCat = b.dataset.cat; renderCats(); renderGrid(true); });

  const media = (p, i = 0) => p.images && p.images[i]
    ? `<img src="${esc(p.images[i])}" alt="${esc(p.name)}" loading="lazy" decoding="async">`
    : art(p.category, PRODUCTS.indexOf(p) + 2);

  function renderGrid(animate) {
    const list = PRODUCTS.filter((p) => activeCat === "all" || p.category === activeCat);
    $("#grid").innerHTML = list.length ? list.map((p, i) => `
      <button class="card" type="button" data-id="${esc(p.id)}" style="--d:${(i % 4) * 0.09}s">
        <span class="card-media">${media(p)}<span class="glare"></span>
          ${p.isExample ? '<span class="tag">Жишээ</span>' : p.featured ? '<span class="tag feat">Шинэ</span>' : ""}
          <svg class="card-orn" viewBox="0 0 410 140" aria-hidden="true"><use href="#ugalz"/></svg>
        </span>
        <span class="card-cat">${esc(catOf(p.category).name)}</span>
        <span class="card-row"><span class="card-name">${esc(p.name)}</span><span class="card-price">${priceText(p.price, true)}</span></span>
      </button>`).join("")
      : `<p class="empty">Энэ төрөлд одоогоор бүтээл алга. <a href="#custom">Өөрийн санаагаар захиалаарай.</a></p>`;
    $("#exampleNote").hidden = !PRODUCTS.some((p) => p.isExample);
    watch($$(".card", $("#grid")), animate);
    window.__rebuildVine && setTimeout(window.__rebuildVine, 100);
  }
  $("#grid").addEventListener("click", (e) => { const c = e.target.closest(".card"); if (c) location.hash = "p-" + c.dataset.id; });
  // 3D tilt + glare follow the pointer
  $("#grid").addEventListener("pointermove", (e) => {
    const m = e.target.closest(".card-media"); if (!m || e.pointerType !== "mouse") return;
    const r = m.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    m.style.setProperty("--ry", ((x - 0.5) * 10).toFixed(2) + "deg"); m.style.setProperty("--rx", ((0.5 - y) * 10).toFixed(2) + "deg");
    m.style.setProperty("--gx", x * 100 + "%"); m.style.setProperty("--gy", y * 100 + "%");
  });
  $("#grid").addEventListener("pointerout", (e) => { const m = e.target.closest(".card-media"); if (m && !m.contains(e.relatedTarget)) { m.style.setProperty("--rx", "0deg"); m.style.setProperty("--ry", "0deg"); } });

  /* ---------- scroll reveal ---------- */
  const io = "IntersectionObserver" in window ? new IntersectionObserver((ents) => {
    ents.forEach((en) => { if (en.isIntersecting) { en.target.classList.remove("reveal-wait"); en.target.classList.add("on"); io.unobserve(en.target); } });
  }, { rootMargin: "0px 0px -8% 0px" }) : null;
  function watch(els, force) {
    if (!io || reduce) { els.forEach((el) => el.classList.add("on")); return; }
    els.forEach((el) => {
      const below = el.getBoundingClientRect().top > innerHeight * 0.92;
      if (below || force) el.classList.add("reveal-on", "reveal-wait");
      requestAnimationFrame(() => io.observe(el));
    });
  }
  watch($$(".section-head, .cats, .steps li, .table-wrap, .story-photo, .story-text, .process, .custom-form"));

  /* ---------- size guide ---------- */
  const RING_SIZES = [15, 15.5, 16, 16.5, 17, 17.5, 18, 18.5, 19, 19.5, 20, 21];
  $("#sizeRows").innerHTML = RING_SIZES.map((s) => `<tr><td>${s}</td><td>${s.toFixed(1)} мм</td><td>${(Math.PI * s).toFixed(1)} мм</td></tr>`).join("");

  /* ---------- size field per category ---------- */
  function cm(label, min, max, ph, help) {
    return `<label for="cmIn">${label} (см)</label>
      <div class="unit-row"><input id="cmIn" type="number" inputmode="decimal" min="${min}" max="${max}" step="0.5" placeholder="${ph}"><span>см</span></div>
      <p class="help">${help}</p>`;
  }
  const SIZE_UI = {
    ring: () => `
      <span class="label" id="ringLbl">Бөгжний размер</span>
      <div class="chips" role="group" aria-labelledby="ringLbl">${RING_SIZES.map((s) => `<button type="button" class="chip" data-size="${s}" aria-pressed="false">${s}</button>`).join("")}</div>
      <label for="ringMm" style="margin-top:.5rem">Размераа мэдэхгүй бол хурууны тойрог (мм)</label>
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
  function showImage(p, i) {
    $("#pMain").innerHTML = p.images && p.images.length ? `<img src="${esc(p.images[i])}" alt="${esc(p.name)}">` : art(p.category, PRODUCTS.indexOf(p) + 2);
    $$("#pThumbs button").forEach((b, k) => b.setAttribute("aria-current", k === i));
  }
  function openProduct(id) {
    const p = PRODUCTS.find((x) => x.id === id); if (!p) return;
    current = p;
    const c = catOf(p.category);
    $("#pThumbs").innerHTML = (p.images || []).length > 1 ? p.images.map((src, i) => `<button type="button" data-i="${i}" aria-label="Зураг ${i + 1}"><img src="${esc(src)}" alt=""></button>`).join("") : "";
    showImage(p, 0);
    $("#pCat").textContent = c.name;
    $("#pName").textContent = p.name;
    $("#pName").classList.toggle("latin", isLatin(p.name));
    $("#pPrice").textContent = priceText(p.price, true) + (p.isExample && p.price ? " · жишээ үнэ" : "");
    $("#pDesc").textContent = p.description || "";
    $("#pMat").textContent = p.material ? "Материал: " + p.material : "";
    $("#sizeField").innerHTML = (SIZE_UI[c.size] || SIZE_UI.none)();
    $("#pQty").value = 1; $("#pNote").value = ""; $("#pErr").textContent = "";
    show($("#productPanel"));
  }
  $("#pThumbs").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b && current) showImage(current, +b.dataset.i); });
  $("#qtyMinus").onclick = () => { $("#pQty").value = Math.max(1, (+$("#pQty").value || 1) - 1); };
  $("#qtyPlus").onclick = () => { $("#pQty").value = Math.min(20, (+$("#pQty").value || 1) + 1); };
  $("#pForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const size = readSize(catOf(current.category).size);
    if (!size.ok) { $("#pErr").textContent = size.msg; return; }
    bag.push({ id: current.id, size: size.value, qty: Math.max(1, Math.min(20, +$("#pQty").value || 1)), note: $("#pNote").value.trim() });
    store.set("agz-bag", bag); updateCount(true);
    hide(); history.replaceState(null, "", location.pathname + location.search);
    setTimeout(openBag, 250);
  });

  /* ---------- order panel ---------- */
  function updateCount(bump) {
    const n = bag.reduce((a, b) => a + b.qty, 0);
    const el = $("#bagCount"); el.textContent = n;
    if (bump) { el.classList.add("bump"); setTimeout(() => el.classList.remove("bump"), 450); }
  }
  function bagItems() { return bag.map((b, i) => ({ ...b, i, p: PRODUCTS.find((x) => x.id === b.id) })).filter((b) => b.p); }
  function renderBag() {
    const items = bagItems();
    $("#bagList").innerHTML = items.map((b) => `
      <li class="bag-item">
        <span class="bag-thumb">${media(b.p)}</span>
        <span><h4>${esc(b.p.name)}</h4><span class="bag-meta">${esc(catOf(b.p.category).name)}${b.size ? " · " + esc(b.size) : ""} · ${b.qty} ш${b.note ? "<br>" + esc(b.note) : ""}</span></span>
        <button class="rm" type="button" data-i="${b.i}">Хасах</button>
      </li>`).join("");
    const total = items.reduce((a, b) => a + b.p.price * b.qty, 0);
    $("#bagEmpty").hidden = items.length > 0;
    $("#bagTotal").textContent = items.length ? "Нийт: " + money(total) + (items.some((b) => !b.p.price) ? " + үнэ тохиролцох бүтээл" : "") : "";
    $("#orderForm").hidden = !items.length;
    $("#sentBox").hidden = true;
    return { items, total };
  }
  $("#bagList").addEventListener("click", (e) => { const b = e.target.closest(".rm"); if (!b) return; bag.splice(+b.dataset.i, 1); store.set("agz-bag", bag); updateCount(); renderBag(); });
  function openBag() { renderBag(); show($("#bagPanel")); }
  $("#bagBtn").addEventListener("click", openBag);

  const saved = store.get("agz-customer", {});
  const fill = (ids) => ids.forEach(([id, k]) => { if (saved[k] && $("#" + id)) $("#" + id).value = saved[k]; });
  fill([["oName", "name"], ["oPhone", "phone"], ["oIg", "instagram"], ["oAddr", "address"], ["cName", "name"], ["cPhone", "phone"], ["cIg", "instagram"]]);

  const phoneOk = (v) => /^[+\d][\d\s-]{6,}$/.test(v);
  function copyText(el, hint) {
    const t = el.textContent;
    const ok = () => { hint.textContent = "Хуулагдлаа. Одоо Instagram-аар илгээнэ үү."; };
    const fb = () => { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); hint.textContent = "Текстийг сонголоо. Хуулаад илгээнэ үү."; };
    try { navigator.clipboard.writeText(t).then(ok, fb); } catch { fb(); }
  }

  $("#orderForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const c = { name: $("#oName").value.trim(), phone: $("#oPhone").value.trim(), instagram: $("#oIg").value.trim(), address: $("#oAddr").value.trim() };
    if (!c.name || !c.phone || !c.address) { $("#oErr").textContent = "Нэр, утас, хаягаа бөглөнө үү."; return; }
    if (!phoneOk(c.phone)) { $("#oErr").textContent = "Утасны дугаараа шалгана уу."; return; }
    $("#oErr").textContent = "";
    store.set("agz-customer", { ...store.get("agz-customer", {}), ...c });
    const { items, total } = renderBag();
    const btn = $("#orderForm button[type=submit]"); btn.disabled = true;
    let id = null;
    if (LIVE) {
      try { id = (await api("/api/orders", { method: "POST", body: JSON.stringify({ kind: "order", customer: c, items: items.map((b) => ({ id: b.id, qty: b.qty, size: b.size, note: b.note })) }) })).id; } catch {}
    }
    btn.disabled = false;
    const lines = items.map((b, n) => `${n + 1}. ${b.p.name} (${catOf(b.p.category).name})${b.size ? " · " + b.size : ""} · ${b.qty} ш · ${b.p.price ? money(b.p.price * b.qty) : "үнэ тохиролцоно"}${b.note ? "\n   Тэмдэглэл: " + b.note : ""}`);
    $("#orderText").textContent = `Сайн байна уу! Agilzgana-аас захиалга өгье${id ? ` (№${id})` : ""}.\n\n${lines.join("\n")}\n\nНийт: ${total ? money(total) : "үнэ тохиролцоно"}\n\nНэр: ${c.name}\nУтас: ${c.phone}${c.instagram ? "\nInstagram: " + c.instagram : ""}\nХаяг: ${c.address}`;
    $("#sentLede").textContent = id
      ? `Захиалга №${id} бүртгэгдлээ! Баталгаажуулахын тулд доорх текстийг Instagram-аар илгээнэ үү.`
      : "Захиалгын мэдээлэл бэлэн боллоо. Доорх текстийг хуулаад Instagram-аар илгээнэ үү.";
    $("#orderForm").hidden = true; $("#sentBox").hidden = false; $("#copyHint").textContent = "";
    if (id) { bag = []; store.set("agz-bag", bag); updateCount(); }
  });
  $("#copyBtn").addEventListener("click", () => copyText($("#orderText"), $("#copyHint")));

  /* ---------- custom (bespoke) request ---------- */
  $("#cCat").innerHTML = CATEGORIES.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("") + `<option value="other">Өөр зүйл</option>`;
  let refFiles = [];
  $("#cFiles").addEventListener("change", (e) => {
    refFiles = [...refFiles, ...e.target.files].filter((f) => f.type.startsWith("image/")).slice(0, 3);
    e.target.value = ""; drawThumbs();
  });
  function drawThumbs() {
    $("#cThumbs").innerHTML = refFiles.map((f, i) => `<figure><img src="${URL.createObjectURL(f)}" alt=""><button type="button" data-i="${i}" aria-label="Хасах">×</button></figure>`).join("");
  }
  $("#cThumbs").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; refFiles.splice(+b.dataset.i, 1); drawThumbs(); });
  $("#customForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const c = { name: $("#cName").value.trim(), phone: $("#cPhone").value.trim(), instagram: $("#cIg").value.trim() };
    const r = { category: $("#cCat").value, size: $("#cSize").value.trim(), budget: $("#cBudget").value, idea: $("#cIdea").value.trim() };
    if (!r.idea) { $("#cErr").textContent = "Санаагаа товч бичээрэй."; return; }
    if (!c.name || !phoneOk(c.phone)) { $("#cErr").textContent = "Нэр, утасны дугаараа зөв оруулна уу."; return; }
    $("#cErr").textContent = "";
    store.set("agz-customer", { ...store.get("agz-customer", {}), ...c });
    const btn = $("#customForm button[type=submit]"); btn.disabled = true; btn.querySelector("span").textContent = "Илгээж байна…";
    let id = null, images = [];
    if (LIVE) {
      try {
        for (const f of refFiles) images.push((await upload(f, 1400)).url);
        id = (await api("/api/orders", { method: "POST", body: JSON.stringify({ kind: "custom", customer: c, request: r, images, website: $("#cWebsite").value }) })).id;
      } catch (err) { console.warn(err); }
    }
    btn.disabled = false; btn.querySelector("span").textContent = "Санаагаа илгээх";
    const catName = r.category === "other" ? "Өөр зүйл" : catOf(r.category).name;
    $("#customText").textContent = `Сайн байна уу! Захиалгаар ${catName.toLowerCase()} хийлгэмээр байна${id ? ` (№${id})` : ""}.\n\nСанаа: ${r.idea}${r.size ? "\nХэмжээ: " + r.size : ""}${r.budget ? "\nТөсөв: " + r.budget : ""}\n\nНэр: ${c.name}\nУтас: ${c.phone}${c.instagram ? "\nInstagram: " + c.instagram : ""}`;
    $("#customDoneText").textContent = id
      ? `Таны санаа (№${id}) надад ирлээ${images.length ? ", зурагтайгаа" : ""}. Удахгүй холбогдоно. Хурдан хариу авах бол доорх текстийг Instagram-аар илгээгээрэй.`
      : "Доорх текстийг хуулаад Instagram-аар илгээгээрэй, хамтдаа ноорог гаргая.";
    $("#customForm").hidden = true; $("#customDone").hidden = false; $("#customHint").textContent = "";
    $("#customDone").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  });
  $("#customCopy").addEventListener("click", () => copyText($("#customText"), $("#customHint")));
  $("#customDm").href = $("#dmLink").href = "https://ig.me/m/" + INSTAGRAM;

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
  const route = () => { const h = location.hash.slice(1); if (h.startsWith("p-")) openProduct(h.slice(2)); };
  addEventListener("hashchange", route);

  /* ---------- pollen / firefly field ---------- */
  (function pollen() {
    const cv = $("#pollen"), cx = cv.getContext("2d"); if (!cx) return;
    let W, H, dpr, pts = [], mouse = { x: -999, y: -999 };
    function size() {
      dpr = Math.min(2, devicePixelRatio || 1);
      W = cv.width = innerWidth * dpr; H = cv.height = innerHeight * dpr;
      pts = Array.from({ length: Math.round(Math.min(60, innerWidth / 22)) }, (_, i) => ({ x: Math.random() * W, y: Math.random() * H, r: (Math.random() * 1.6 + .5) * dpr, a: Math.random() * 6.28, s: (Math.random() * .22 + .06) * dpr, t: Math.random() * 100, pink: i % 5 === 0 }));
    }
    addEventListener("resize", size); size();
    addEventListener("pointermove", (e) => { mouse.x = e.clientX * dpr; mouse.y = e.clientY * dpr; });
    function frame() {
      const gc = css("--gold"), pc = css("--petal");
      cx.clearRect(0, 0, W, H);
      for (const p of pts) {
        p.t += .01; p.a += Math.sin(p.t) * .02;
        p.x += Math.cos(p.a) * p.s; p.y += Math.sin(p.a) * p.s - .05 * dpr;
        const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy) || 1;
        if (d < 120 * dpr) { p.x += (dx / d) * 1.2 * dpr - dy / d * .9 * dpr; p.y += (dy / d) * 1.2 * dpr + dx / d * .9 * dpr; }
        if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10; if (p.y < -10) p.y = H + 10; if (p.y > H + 10) p.y = -10;
        cx.globalAlpha = .4 + Math.sin(p.t * 3) * .3; cx.fillStyle = p.pink ? pc : gc;
        cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.283); cx.fill();
      }
      if (!reduce) requestAnimationFrame(frame);
    }
    frame();
  })();

  /* ---------- boot ---------- */
  renderCats(); updateCount();
  api("/api/products")
    .then((d) => { LIVE = true; return d.products; })
    .catch(() => fetch("products.json").then((r) => r.json()).then((d) => d.products))
    .then((list) => { PRODUCTS = list || []; renderGrid(); updateCount(); route(); })
    .catch(() => { $("#grid").innerHTML = '<p class="empty">Бүтээгдэхүүн ачааллахад алдаа гарлаа. Хуудсаа дахин ачаална уу.</p>'; });
})();
