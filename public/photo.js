/* Photo editor used before a picture goes up: crop (free or fixed shape), rotate, light, contrast,
   colour, warm/cool and sharpness. AGZPhoto.edit(fileOrBlob, { aspect }) -> Promise<Blob|null>.
   All maths is done on pixels by hand so it works the same in every phone browser. */
window.AGZPhoto = (() => {
  const ASPECTS = [["free", "Чөлөөтэй", 0], ["1:1", "1:1", 1], ["4:5", "4:5", 4 / 5], ["3:4", "3:4", 3 / 4], ["16:9", "16:9", 16 / 9]];
  const SLIDERS = [
    ["light", "Гэрэл", -60, 60], ["contrast", "Контраст", -50, 60], ["sat", "Өнгө ханалт", -100, 80],
    ["temp", "Хүйтэн ↔ Дулаан", -60, 60], ["sharp", "Тодруулах", 0, 100]
  ];
  let css = false;
  function style() {
    if (css) return; css = true;
    document.head.appendChild(document.createElement("style")).textContent = `
    .agp { position: fixed; inset: 0; z-index: 2147483600; display: grid; grid-template-rows: 1fr auto; background: #16140f; color: #f3efe4; font: 14px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif; letter-spacing: 0; text-transform: none; }
    .agp-stage { position: relative; min-height: 0; display: grid; place-items: center; padding: 16px; overflow: hidden; touch-action: none; }
    .agp-wrap { position: relative; line-height: 0; }
    .agp canvas { max-width: 100%; max-height: 100%; display: block; }
    .agp-crop { position: absolute; box-shadow: 0 0 0 100vmax rgba(10,8,5,.62); outline: 1.5px solid #fff; cursor: move; touch-action: none; }
    .agp-crop::before, .agp-crop::after { content: ""; position: absolute; inset: 33.33% 0; border-top: 1px solid rgba(255,255,255,.35); border-bottom: 1px solid rgba(255,255,255,.35); pointer-events: none; }
    .agp-crop::after { inset: 0 33.33%; border: 0; border-left: 1px solid rgba(255,255,255,.35); border-right: 1px solid rgba(255,255,255,.35); }
    .agp-h { position: absolute; width: 26px; height: 26px; margin: -13px; touch-action: none; }
    .agp-h::before { content: ""; position: absolute; inset: 8px; background: #fff; border-radius: 50%; box-shadow: 0 1px 4px rgba(0,0,0,.5); }
    .agp-h[data-h=nw] { left: 0; top: 0; cursor: nwse-resize; } .agp-h[data-h=ne] { right: 0; top: 0; margin-right: -13px; cursor: nesw-resize; }
    .agp-h[data-h=sw] { left: 0; bottom: 0; margin-bottom: -13px; cursor: nesw-resize; } .agp-h[data-h=se] { right: 0; bottom: 0; margin: 0 -13px -13px 0; cursor: nwse-resize; }
    .agp-ctl { background: #211e17; padding: 12px max(14px, env(safe-area-inset-left)) calc(12px + env(safe-area-inset-bottom)); display: grid; gap: 10px; max-height: 46vh; overflow: auto; }
    .agp-row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
    .agp button { font: inherit; color: inherit; background: #332e24; border: 1px solid #4a4334; border-radius: 999px; padding: .45rem .8rem; cursor: pointer; }
    .agp button[aria-pressed=true] { background: #f0a3be; color: #2a1720; border-color: #f0a3be; }
    .agp .agp-ok { background: #d47494; border-color: #d47494; color: #fff; font-weight: 600; }
    .agp-sl { display: grid; grid-template-columns: 8.5em 1fr 2.6em; gap: 10px; align-items: center; }
    .agp-sl input { width: 100%; accent-color: #f0a3be; }
    .agp-sl output { text-align: right; color: #b9b29f; font-variant-numeric: tabular-nums; }
    .agp-sl[data-k=temp] input { accent-color: #e0b070; }
    .agp-sp { flex: 1; }
    @media (min-width: 900px) { .agp { grid-template-rows: none; grid-template-columns: 1fr 380px; } .agp-ctl { max-height: none; align-content: start; } }`;
  }

  async function load(src) {
    const blob = src instanceof Blob ? src : await (await fetch(src)).blob();
    const bmp = await createImageBitmap(blob);
    return bmp;
  }

  /* pixel pipeline: light, contrast, saturation, warmth, then optional unsharp mask */
  function process(img, s) {
    const d = img.data, n = d.length;
    const L = 1 + s.light / 100, C = 1 + s.contrast / 100, S = 1 + s.sat / 100, T = s.temp * 0.45;
    if (s.light || s.contrast || s.sat || s.temp) for (let i = 0; i < n; i += 4) {
      let r = d[i] * L, g = d[i + 1] * L, b = d[i + 2] * L;
      r = (r - 128) * C + 128; g = (g - 128) * C + 128; b = (b - 128) * C + 128;
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      r = y + (r - y) * S; g = y + (g - y) * S; b = y + (b - y) * S;
      r += T; g += T * 0.15; b -= T;
      d[i] = r; d[i + 1] = g; d[i + 2] = b; // Uint8ClampedArray clamps
    }
    if (s.sharp > 0) {
      const w = img.width, h = img.height, src = new Uint8ClampedArray(d), a = s.sharp / 60;
      for (let yy = 1; yy < h - 1; yy++) for (let x = 1; x < w - 1; x++) {
        const i = (yy * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          const v = src[i + c];
          const blur = (src[i + c - 4] + src[i + c + 4] + src[i + c - w * 4] + src[i + c + w * 4] + v * 4) / 8;
          d[i + c] = v + a * (v - blur);
        }
      }
    }
    return img;
  }

  // draw the rotated source into a canvas no larger than max px on the long side
  function rotated(bmp, rot, max) {
    const sw = rot % 180 ? bmp.height : bmp.width, sh = rot % 180 ? bmp.width : bmp.height;
    const k = Math.min(1, max / Math.max(sw, sh));
    const c = document.createElement("canvas"); c.width = Math.round(sw * k); c.height = Math.round(sh * k);
    const g = c.getContext("2d", { willReadFrequently: true }); g.imageSmoothingQuality = "high";
    g.translate(c.width / 2, c.height / 2); g.rotate((rot * Math.PI) / 180);
    const w = bmp.width * k, h = bmp.height * k; g.drawImage(bmp, -w / 2, -h / 2, w, h);
    return c;
  }

  function edit(src, opts = {}) {
    style();
    return new Promise(async (resolve) => {
      let bmp;
      try { bmp = await load(src); } catch { resolve(src instanceof Blob ? src : null); return; }
      const st = { light: 0, contrast: 0, sat: 0, temp: 0, sharp: 0 };
      let rot = 0, aspect = opts.aspect || "free", crop = { x: 0, y: 0, w: 1, h: 1 }, base = null;

      const ui = document.createElement("div"); ui.className = "agp agz-ui";
      ui.innerHTML = `
        <div class="agp-stage"><div class="agp-wrap"><canvas></canvas>
          <div class="agp-crop">${["nw", "ne", "sw", "se"].map((h) => `<span class="agp-h" data-h="${h}"></span>`).join("")}</div></div></div>
        <div class="agp-ctl">
          <div class="agp-row">${ASPECTS.map(([k, l]) => `<button type="button" data-asp="${k}" aria-pressed="${k === aspect}">${l}</button>`).join("")}<button type="button" data-rot>⟳ Эргүүлэх</button></div>
          ${SLIDERS.map(([k, l, a, b]) => `<label class="agp-sl" data-k="${k}"><span>${l}</span><input type="range" min="${a}" max="${b}" value="0" data-s="${k}"><output>0</output></label>`).join("")}
          <div class="agp-row"><button type="button" data-auto>✨ Автомат сайжруулах</button><button type="button" data-reset>↺ Анхных</button></div>
          <div class="agp-row"><span class="agp-sp"></span><button type="button" data-cancel>Болих</button><button type="button" class="agp-ok" data-ok>Ашиглах</button></div>
        </div>`;
      document.body.appendChild(ui);
      const cv = ui.querySelector("canvas"), box = ui.querySelector(".agp-crop"), stage = ui.querySelector(".agp-stage");
      const g = cv.getContext("2d", { willReadFrequently: true });

      function rebase() { base = rotated(bmp, rot, 1000); cv.width = base.width; cv.height = base.height; fit(); setAspect(aspect, true); draw(); }
      function fit() { // largest size that fits the stage
        const r = stage.getBoundingClientRect(), k = Math.min((r.width - 32) / base.width, (r.height - 32) / base.height);
        cv.style.width = base.width * k + "px"; cv.style.height = base.height * k + "px";
      }
      let raf = 0;
      function draw() {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => { const img = base.getContext("2d").getImageData(0, 0, base.width, base.height); g.putImageData(process(img, st), 0, 0); });
      }
      const ratio = () => (ASPECTS.find((a) => a[0] === aspect) || [, , 0])[2];
      function setAspect(k, reset) {
        aspect = k; ui.querySelectorAll("[data-asp]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.asp === k));
        const R = ratio();
        if (!R) { if (reset) crop = { x: 0, y: 0, w: 1, h: 1 }; return showCrop(); }
        // biggest centred box of that shape (R is width/height in pixels)
        const iw = base.width, ih = base.height;
        let w = iw, h = w / R; if (h > ih) { h = ih; w = h * R; }
        crop = { x: (iw - w) / 2 / iw, y: (ih - h) / 2 / ih, w: w / iw, h: h / ih };
        showCrop();
      }
      function showCrop() { Object.assign(box.style, { left: crop.x * 100 + "%", top: crop.y * 100 + "%", width: crop.w * 100 + "%", height: crop.h * 100 + "%" }); }

      // drag to move the frame, drag a corner to resize it
      let drag = null;
      box.addEventListener("pointerdown", (e) => {
        e.preventDefault(); box.setPointerCapture(e.pointerId);
        const r = cv.getBoundingClientRect();
        drag = { h: e.target.dataset.h || "move", sx: e.clientX, sy: e.clientY, c: { ...crop }, W: r.width, H: r.height };
      });
      box.addEventListener("pointermove", (e) => {
        if (!drag) return;
        const dx = (e.clientX - drag.sx) / drag.W, dy = (e.clientY - drag.sy) / drag.H, c = { ...drag.c }, min = 0.08;
        if (drag.h === "move") { c.x = Math.min(1 - c.w, Math.max(0, c.x + dx)); c.y = Math.min(1 - c.h, Math.max(0, c.y + dy)); }
        else {
          let x1 = c.x, y1 = c.y, x2 = c.x + c.w, y2 = c.y + c.h;
          if (drag.h.includes("w")) x1 = Math.min(x2 - min, Math.max(0, x1 + dx)); else x2 = Math.max(x1 + min, Math.min(1, x2 + dx));
          if (drag.h.includes("n")) y1 = Math.min(y2 - min, Math.max(0, y1 + dy)); else y2 = Math.max(y1 + min, Math.min(1, y2 + dy));
          const R = ratio();
          if (R) { // keep the shape: height follows width, then shrink both if it runs off the picture
            const k = base.width / base.height; let w = x2 - x1, h = (w * k) / R;
            const room = drag.h.includes("n") ? y2 : 1 - y1;
            if (h > room) { h = room; w = (h * R) / k; }
            if (drag.h.includes("w")) x1 = x2 - w; else x2 = x1 + w;
            if (drag.h.includes("n")) y1 = y2 - h; else y2 = y1 + h;
          }
          Object.assign(c, { x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
        }
        crop = c; showCrop();
      });
      box.addEventListener("pointerup", () => (drag = null));

      ui.addEventListener("input", (e) => { const k = e.target.dataset.s; if (!k) return; st[k] = +e.target.value; e.target.nextElementSibling.textContent = e.target.value; draw(); });
      const sync = () => ui.querySelectorAll("[data-s]").forEach((i) => { i.value = st[i.dataset.s]; i.nextElementSibling.textContent = st[i.dataset.s]; });
      ui.addEventListener("click", async (e) => {
        const t = e.target.closest("button"); if (!t) return;
        if (t.dataset.asp) setAspect(t.dataset.asp, true);
        if (t.hasAttribute("data-rot")) { rot = (rot + 90) % 360; rebase(); }
        if (t.hasAttribute("data-auto")) { Object.assign(st, { light: 6, contrast: 12, sat: 14, sharp: 35 }); sync(); draw(); }
        if (t.hasAttribute("data-reset")) { Object.assign(st, { light: 0, contrast: 0, sat: 0, temp: 0, sharp: 0 }); rot = 0; sync(); rebase(); setAspect(opts.aspect || "free", true); }
        if (t.hasAttribute("data-cancel")) { close(); resolve(null); }
        if (t.hasAttribute("data-ok")) {
          t.disabled = true; t.textContent = "Түр хүлээнэ үү…";
          await new Promise((r) => setTimeout(r, 30));
          const full = rotated(bmp, rot, 4000);
          const sx = Math.round(crop.x * full.width), sy = Math.round(crop.y * full.height);
          const sw = Math.max(1, Math.round(crop.w * full.width)), sh = Math.max(1, Math.round(crop.h * full.height));
          const k = Math.min(1, (opts.max || 2000) / Math.max(sw, sh));
          const out = document.createElement("canvas"); out.width = Math.round(sw * k); out.height = Math.round(sh * k);
          const og = out.getContext("2d", { willReadFrequently: true }); og.imageSmoothingQuality = "high";
          og.drawImage(full, sx, sy, sw, sh, 0, 0, out.width, out.height);
          og.putImageData(process(og.getImageData(0, 0, out.width, out.height), st), 0, 0);
          let blob = await new Promise((r) => out.toBlob(r, "image/webp", 0.9));
          if (!blob || blob.type !== "image/webp") blob = await new Promise((r) => out.toBlob(r, "image/jpeg", 0.9));
          close(); resolve(blob);
        }
      });
      const onResize = () => fit();
      addEventListener("resize", onResize);
      function close() { removeEventListener("resize", onResize); ui.remove(); bmp.close?.(); }
      rebase();
    });
  }
  return { edit };
})();
