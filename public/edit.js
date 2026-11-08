/* Editing mode for Baljka: click any text to type over it, click a picture to replace it, add or hide parts,
   pick fonts and colours, then save. Loaded by site.js only when editing. */
(() => {
  const S = window.AGZSite, A = window.AGZ;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = A.esc;
  const DEFAULT_FONT = { logo: "Italianno", serif: "Cormorant Garamond", script: "Cormorant Garamond", tech: "Exo 2" };
  const ROLE_NAME = { logo: "Лого", serif: "Гарчиг, үндсэн бичвэр", script: "Онцолсон налуу үг", tech: "Цэс, товч, жижиг гарчиг" };
  const COLOR_NAME = { bg: "Арын өнгө", fg: "Бичгийн өнгө", petal: "Ягаан (лого, товч)", "petal-ink": "Тод ягаан (онцлох үг)", moss: "Ногоон (хээ, навч)", gold: "Алтан" };

  let d = JSON.parse(JSON.stringify(S.data));
  const history = [];
  let current = null, dirty = false, demo = !S.state.backend;

  async function start() {
    if (!demo) {
      const me = await A.api("/api/login").catch(() => null);
      if (!me || !me.admin) { location.href = "admin/?next=edit"; return; }
      try { localStorage.setItem("agz-admin", "1"); } catch {}
    }
    const root = document.documentElement;
    root.classList.add("agz-editing", "no-intro");
    root.setAttribute("data-theme", "light"); // colours are edited for day mode
    $("#intro")?.remove();
    render();
    buildUI();
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", (e) => e.preventDefault(), true);
    addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
    addEventListener("scroll", place, { passive: true }); addEventListener("resize", place);
  }

  /* ---------- state ---------- */
  function render() { S.apply(d, { editing: true }); }
  function snapshot() { history.push(JSON.stringify(d)); if (history.length > 80) history.shift(); }
  function changed() { dirty = true; status(demo ? "Хадгалаагүй өөрчлөлт байна (туршилт)" : "Хадгалаагүй өөрчлөлт байна"); $("#agzUndo").disabled = !history.length; }
  function act(fn) { // toolbar actions: save typing, change, redraw, keep the same thing selected
    const key = current?.dataset.agz; commit(); snapshot(); fn(key); render(); changed();
    const again = key && document.querySelector(`[data-agz="${CSS.escape(key)}"]`);
    again ? select(again) : deselect();
    panelSync();
  }
  const isNew = (el) => !!el?.dataset.agzNew;
  const item = (key) => d.add.find((x) => x.id === key);
  const kindOf = (el) => (el.tagName === "IMG" ? "img" : "text");

  /* ---------- selecting and typing ---------- */
  function onClick(e) {
    if (e.target.closest(".agz-ui")) return;
    if (current && current.isContentEditable && current.contains(e.target)) { e.preventDefault(); e.stopPropagation(); return; }
    e.preventDefault(); e.stopPropagation();
    const t = e.target.closest("[data-agz]");
    t ? select(t) : deselect();
  }
  function select(el) {
    if (current && current !== el) { commit(); current.classList.remove("agz-sel"); current.removeAttribute("contenteditable"); }
    current = el; el.classList.add("agz-sel");
    if (kindOf(el) === "text" && !el.isContentEditable) {
      el.contentEditable = "true"; el.spellcheck = false;
      el.onkeydown = (e) => {
        if (e.key === "Enter") { e.preventDefault(); document.execCommand("insertLineBreak"); }
        if (e.key === "Escape") { e.preventDefault(); deselect(); }
      };
      el.onpaste = (e) => { e.preventDefault(); document.execCommand("insertText", false, e.clipboardData.getData("text/plain")); };
      el.focus({ preventScroll: true });
    }
    toolbar();
  }
  function deselect() {
    if (!current) return;
    commit(); current.classList.remove("agz-sel"); current.removeAttribute("contenteditable"); current.onkeydown = current.onpaste = null;
    current = null; $("#agzBar").hidden = true;
  }
  function commit() {
    const el = current; if (!el || kindOf(el) !== "text") return;
    const key = el.dataset.agz, html = S.clean(el.innerHTML);
    if (isNew(el)) { const it = item(key); if (it && it.html !== html) { snapshot(); it.html = html; changed(); } return; }
    const r = S.reg.get(key); if (!r) return;
    const before = d.text[key] ?? S.clean(r.html);
    if (html === before) return;
    snapshot();
    if (html === S.clean(r.html)) delete d.text[key]; else d.text[key] = html;
    if (el.classList.contains("logo-word")) el.dataset.text = el.textContent;
    changed();
  }

  /* ---------- floating toolbar ---------- */
  function toolbar() {
    const el = current, key = el.dataset.agz, kind = kindOf(el), fresh = isNew(el);
    const r = S.reg.get(key), hidden = d.hide.includes(key);
    const touched = fresh ? false : !!(d.text[key] || d.img[key] || d.link[key] || d.size[key] || hidden);
    const b = (id, label, title = "") => `<button type="button" data-a="${id}" title="${esc(title)}">${label}</button>`;
    let h = "";
    if (kind === "text") h += b("bold", "<b>B</b>", "Тод") + b("italic", "<i>I</i>", "Налуу");
    if (kind === "img") h += b("replace", "🖼 Солих", "Өөр зураг тавих") + b("photo", "✎ Засах", "Тайрах, гэрэл, өнгө");
    h += b("smaller", "A−", "Жижигрүүлэх") + b("bigger", "A+", "Томруулах");
    if (r?.href != null) h += b("link", "🔗 Холбоос", "Дарахад хаашаа очих");
    h += b("addText", "+ Текст", "Доор нь шинэ мөр нэмэх") + b("addImg", "+ Зураг", "Доор нь зураг нэмэх");
    h += fresh ? b("delete", "🗑 Устгах") : b("hide", hidden ? "👁 Харуулах" : "🙈 Нуух", hidden ? "Дахин харуулах" : "Сайтаас нуух");
    if (touched) h += b("reset", "↺ Анхных", "Анхны байдалд нь буцаах");
    const bar = $("#agzBar");
    bar.innerHTML = `<div class="agz-row">${h}</div>` + (r?.href != null ? `<div class="agz-row agz-link" hidden><input type="url" id="agzHref" value="${esc(d.link[key] || r.href)}" placeholder="https://"><button type="button" data-a="linkOk">OK</button></div>` : "");
    bar.hidden = false; place();
  }
  function place() {
    const bar = $("#agzBar"); if (!current || !bar || bar.hidden) return;
    const r = current.getBoundingClientRect(), bh = bar.offsetHeight, bw = bar.offsetWidth;
    let top = r.top - bh - 10; if (top < 8) top = Math.min(innerHeight - bh - 90, r.bottom + 10);
    bar.style.top = Math.max(8, top) + "px";
    bar.style.left = Math.max(8, Math.min(innerWidth - bw - 8, r.left + r.width / 2 - bw / 2)) + "px";
  }
  function onBar(e) {
    const btn = e.target.closest("[data-a]"); if (!btn || !current) return;
    const a = btn.dataset.a, el = current, key = el.dataset.agz;
    if (a === "bold" || a === "italic") { el.focus(); document.execCommand(a); return; }
    if (a === "link") { const row = $(".agz-link"); row.hidden = !row.hidden; if (!row.hidden) $("#agzHref").focus(); place(); return; }
    if (a === "linkOk") {
      const v = $("#agzHref").value.trim(), orig = S.reg.get(key).href;
      if (v && !S.okLink(v)) { status("Холбоос https:// эсвэл # -ээр эхлэх ёстой"); return; }
      return act(() => { if (!v || v === orig) delete d.link[key]; else d.link[key] = v; });
    }
    if (a === "smaller" || a === "bigger") return act(() => { const s = Math.round(((d.size[key] || 1) + (a === "bigger" ? 0.1 : -0.1)) * 10) / 10; if (s === 1) delete d.size[key]; else d.size[key] = Math.max(0.4, Math.min(3, s)); });
    if (a === "hide") return act(() => { d.hide = d.hide.includes(key) ? d.hide.filter((x) => x !== key) : [...d.hide, key]; });
    if (a === "reset") return act(() => { delete d.text[key]; delete d.img[key]; delete d.link[key]; delete d.size[key]; d.hide = d.hide.filter((x) => x !== key); });
    if (a === "delete") return act(() => { const it = item(key); d.add.forEach((x) => { if (x.after === key) x.after = it.after; }); d.add = d.add.filter((x) => x !== it); delete d.size[key]; });
    if (a === "addText") {
      const tag = /^(P|H2|H3|LI)$/.test(el.tagName) ? el.tagName.toLowerCase() : "p";
      const cls = [...el.classList].filter((c) => /^(sub|lede|eyebrow|h2|note)$/.test(c)).join(" ");
      const id = "n:" + Math.random().toString(36).slice(2, 9);
      act(() => d.add.splice(addIndex(key), 0, { id, after: key, kind: "text", tag, cls, html: "Шинэ текст" }));
      const fresh = document.querySelector(`[data-agz="${id}"]`);
      if (fresh) { select(fresh); document.execCommand("selectAll"); }
      return;
    }
    if (a === "photo") return put(el.currentSrc || el.src, (url) => act(() => {
      if (isNew(el)) item(key).src = url; else d.img[key] = url;
    }));
    if (a === "replace" || a === "addImg") return pick(async (url) => {
      if (a === "replace") act(() => { d.img[key] = url; });
      else { const id = "n:" + Math.random().toString(36).slice(2, 9); act(() => d.add.splice(addIndex(key), 0, { id, after: key, kind: "img", src: url })); }
    });
  }
  // a new item goes right after its anchor, before anything added after that anchor earlier
  const addIndex = (key) => { const i = d.add.findIndex((x) => x.after === key); return i < 0 ? d.add.length : i; };

  /* ---------- pictures ---------- */
  function pick(done) {
    const inp = Object.assign(document.createElement("input"), { type: "file", accept: "image/*" });
    inp.onchange = () => { const f = inp.files[0]; if (f) put(f, done); };
    inp.click();
  }
  // open the photo editor (crop, light, warmth…), then upload what comes out
  async function put(src, done) {
    const blob = await window.AGZPhoto.edit(src);
    if (!blob) return;
    status("Зураг оруулж байна…");
    try {
      let url;
      if (demo) { const small = await A.shrink(blob, 1000, 0.8); url = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(small); }); }
      else url = (await A.upload(blob, 2000)).url;
      await done(url); status("Зураг орлоо. Хадгалахаа мартуузай.");
    } catch (err) { status("Зураг оруулж чадсангүй: " + err.message); }
  }

  /* ---------- dock + design panel ---------- */
  function buildUI() {
    const ui = document.createElement("div"); ui.className = "agz-ui";
    ui.innerHTML = `
      <div class="agz-bar" id="agzBar" hidden></div>
      <div class="agz-dock" role="toolbar" aria-label="Засах горим">
        <span class="agz-title">✎ Засах горим</span>
        <span class="agz-status" id="agzStatus" role="status">Өөрчлөх зүйл дээрээ дарна уу</span>
        <button type="button" id="agzDesign">🎨 Фонт, өнгө</button>
        <button type="button" id="agzUndo" disabled>↶ Буцаах</button>
        <button type="button" id="agzSave" class="agz-main">Хадгалах</button>
        <button type="button" id="agzExit">Гарах</button>
      </div>
      <aside class="agz-panel" id="agzPanel" hidden>
        <button type="button" class="agz-x" id="agzPanelX" aria-label="Хаах">×</button>
        <h3>Фонт</h3>
        ${Object.keys(ROLE_NAME).map((r) => `<label class="agz-f"><span>${ROLE_NAME[r]}</span><select data-font="${r}">${S.FONTS[r].map((f) => `<option style="font-family:'${f}'">${f}</option>`).join("")}</select></label>`).join("")}
        <h3>Өнгө <small>(өдрийн горим)</small></h3>
        ${S.COLORS.map((c) => `<label class="agz-c"><input type="color" data-color="${c}"><span>${COLOR_NAME[c]}</span><button type="button" data-creset="${c}" title="Анхных">↺</button></label>`).join("")}
        <h3>Хэсгүүд</h3>
        ${S.SECTIONS.map(([id, , name]) => `<label class="agz-s"><input type="checkbox" data-sec="s:${id}"><span>${name}</span></label>`).join("")}
        <h3>Бүгдийг нь</h3>
        <button type="button" id="agzResetAll" class="agz-danger">Бүх өөрчлөлтийг арилгах</button>
      </aside>
      <div class="agz-confirm" id="agzConfirm" hidden></div>`;
    document.body.appendChild(ui);
    // load every font on offer once, so the choices show in their own lettering
    const all = [...new Set(Object.values(S.FONTS).flat())];
    document.head.appendChild(Object.assign(document.createElement("link"), { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?" + all.map((f) => "family=" + f.replace(/ /g, "+")).join("&") + "&display=swap" }));

    $("#agzBar").addEventListener("mousedown", (e) => { if (!e.target.closest("input")) e.preventDefault(); }); // keep the text selection while clicking B / I
    $("#agzBar").addEventListener("click", onBar);
    $("#agzDesign").onclick = () => { deselect(); $("#agzPanel").hidden = !$("#agzPanel").hidden; panelSync(); };
    $("#agzPanelX").onclick = () => ($("#agzPanel").hidden = true);
    $("#agzUndo").onclick = () => { if (!history.length) return; deselect(); d = JSON.parse(history.pop()); render(); changed(); panelSync(); if (!history.length) $("#agzUndo").disabled = true; };
    $("#agzSave").onclick = save;
    $("#agzExit").onclick = () => { deselect(); if (!dirty) return leave(); confirmBox("Хадгалаагүй өөрчлөлт байна.", [["Хадгалаад гарах", async () => { if (await save()) leave(); }], ["Хаяад гарах", () => { dirty = false; leave(); }], ["Болих", null]]); };
    $("#agzPanel").addEventListener("change", (e) => {
      const t = e.target;
      if (t.dataset.font) act(() => { const r = t.dataset.font; if (t.value === DEFAULT_FONT[r]) delete d.font[r]; else d.font[r] = t.value; });
      if (t.dataset.sec) act(() => { const k = t.dataset.sec; d.hide = t.checked ? d.hide.filter((x) => x !== k) : [...new Set([...d.hide, k])]; });
    });
    $("#agzPanel").addEventListener("input", (e) => { const c = e.target.dataset.color; if (!c) return; d.color[c] = e.target.value; render(); });
    $("#agzPanel").addEventListener("change", (e) => { if (e.target.dataset.color) { snapshot(); changed(); } });
    $("#agzPanel").addEventListener("click", (e) => {
      const c = e.target.dataset.creset; if (c) act(() => { delete d.color[c]; });
      if (e.target.id === "agzResetAll") confirmBox("Бүх засвараа арилгаж, сайтыг анхных руу нь буцаах уу? (Хадгалах дарахаас өмнө Буцаах товчоор сэргээж болно.)", [["Тийм, арилгах", () => act(() => { d = { v: 1, text: {}, link: {}, img: {}, size: {}, hide: [], add: [], font: {}, color: {} }; })], ["Болих", null]]);
    });
    if (demo) status("Туршилтын хуудас: өөрчлөлт зөвхөн энэ төхөөрөмж дээр хадгалагдана");
  }
  function panelSync() {
    if ($("#agzPanel").hidden) return;
    document.querySelectorAll("[data-font]").forEach((s) => (s.value = d.font[s.dataset.font] || DEFAULT_FONT[s.dataset.font]));
    const cs = getComputedStyle(document.documentElement);
    document.querySelectorAll("[data-color]").forEach((i) => { const v = d.color[i.dataset.color] || cs.getPropertyValue("--" + i.dataset.color).trim(); if (/^#[0-9a-f]{6}$/i.test(v)) i.value = v; });
    document.querySelectorAll("[data-sec]").forEach((c) => (c.checked = !d.hide.includes(c.dataset.sec)));
  }
  function confirmBox(msg, choices) {
    const box = $("#agzConfirm");
    box.innerHTML = `<p>${esc(msg)}</p><div>${choices.map(([l], i) => `<button type="button" data-i="${i}" class="${i === 0 ? "agz-main" : ""}">${esc(l)}</button>`).join("")}</div>`;
    box.hidden = false;
    box.onclick = (e) => { const b = e.target.closest("[data-i]"); if (!b) return; box.hidden = true; const fn = choices[+b.dataset.i][1]; if (fn) fn(); };
  }
  function status(t) { const s = $("#agzStatus"); if (s) s.textContent = t; }
  function leave() { location.href = location.pathname; }

  async function save() {
    commit();
    const btn = $("#agzSave"); btn.disabled = true; status("Хадгалж байна…");
    try {
      if (demo) localStorage.setItem(S.DEMO, JSON.stringify(d));
      else {
        await A.api("/api/site", { method: "PUT", body: JSON.stringify(d) });
        try { localStorage.setItem(S.CACHE, JSON.stringify(d)); } catch {}
      }
      dirty = false; status(demo ? "Хадгалагдлаа (зөвхөн энэ төхөөрөмж дээр)" : "Хадгалагдлаа. Сайт дээр шууд харагдана ✓");
      return true;
    } catch (err) {
      if (err.status === 401) status("Нэвтрэх хугацаа дууссан. Админ хэсэгт дахин нэвтэрнэ үү.");
      else status("Хадгалж чадсангүй: " + (err.name === "QuotaExceededError" ? "зураг хэт олон байна" : err.message));
      return false;
    } finally { btn.disabled = false; }
  }

  start();
})();
