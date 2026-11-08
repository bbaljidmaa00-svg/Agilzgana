/* Content Baljka edits on the page itself (open the site with ?edit): texts, links, images, sizes,
   hidden or added parts, fonts and colours. Every editable element gets a key from its ORIGINAL text or
   image slot, so the stored changes keep finding their place. edit.js holds the editing tools. */
window.AGZSite = (() => {
  const TEXT_SEL = [
    ".nav .links a", ".brand", ".intro-word", ".logo-word", "main .eyebrow", "main .h2", "main .sub", ".lede",
    "main .btn > span", ".process h3", ".process p", ".steps li", ".size-table caption", ".story-text > p",
    ".foot-in > span", ".foot-in > a", ".custom-form .field > label:not(.drop)", ".script-title", ".pp-custom", ".bag-empty", ".note"
  ].join(",");
  const IMG_SEL = "main img, .foot img";
  const SECTIONS = [
    ["hero", ".hero", "Нүүр"], ["band", ".band", "Гүйдэг үгс"], ["collection", "#collection", "Цуглуулга"],
    ["divider", "main > .divider", "Хээ (тусгаарлагч)"], ["custom", "#custom", "Захиалгаар урлах"],
    ["sizes", "#sizes", "Хэмжээний заавар"], ["story", "#story", "Тухай"], ["foot", ".foot", "Хөл хэсэг"]
  ];
  const FONT_ROLES = {
    logo: ["--f-logo", "cursive"], serif: ["--f-serif", "Georgia, serif"],
    script: ["--f-script", "Georgia, serif"], tech: ["--f-tech", "system-ui, sans-serif"]
  };
  const COLORS = ["bg", "fg", "petal", "petal-ink", "moss", "gold"];
  const CACHE = "agz-site", DEMO = "agz-site-demo";

  const reg = new Map(); // key -> { kind, els, html|src, href }
  let data = blank(), editing = false;
  const state = { backend: false };

  function blank() { return { v: 1, text: {}, link: {}, img: {}, size: {}, hide: [], add: [], font: {}, color: {} }; }
  function normalize(d) {
    const b = blank(); if (!d || typeof d !== "object") return b;
    for (const k of ["text", "link", "img", "size", "font", "color"]) if (d[k] && typeof d[k] === "object" && !Array.isArray(d[k])) b[k] = d[k];
    if (Array.isArray(d.hide)) b.hide = d.hide.filter((x) => typeof x === "string");
    if (Array.isArray(d.add)) b.add = d.add.filter((x) => x && typeof x.id === "string" && typeof x.after === "string");
    return b;
  }
  const hash = (s) => { let h = 5381; for (const ch of s) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0; return h.toString(36); };
  const norm = (s) => s.replace(/\s+/g, " ").trim();

  /* ---------- keep only harmless inline formatting ---------- */
  const KEEP = { EM: 1, STRONG: 1, B: 1, I: 1, BR: 1, SPAN: 1, U: 1 };
  const DROP = /^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|TEMPLATE|SVG|MATH|LINK|META)$/;
  function clean(html) {
    const t = document.createElement("template"); t.innerHTML = String(html ?? "");
    (function walk(n) {
      [...n.childNodes].forEach((c) => {
        if (c.nodeType === 3) return;
        if (c.nodeType !== 1 || DROP.test(c.tagName)) return c.remove();
        walk(c);
        if (!KEEP[c.tagName]) return c.replaceWith(...c.childNodes, ...(c.tagName === "DIV" || c.tagName === "P" ? [document.createElement("br")] : []));
        const cls = c.tagName === "SPAN" ? [...c.classList].filter((x) => /^(script|dot|opt)$/.test(x)).join(" ") : "";
        [...c.attributes].forEach((a) => c.removeAttribute(a.name));
        if (cls) c.className = cls;
      });
    })(t.content);
    return t.innerHTML.replace(/(<br>)+$/, "");
  }
  const okImg = (u) => typeof u === "string" && /^(\/api\/img\/[\w.-]+|images\/[\w./-]+|data:image\/(webp|jpeg|png);base64,[\w+/=]+)$/.test(u);
  const okLink = (u) => typeof u === "string" && /^(https?:\/\/[^\s"<>]+|#[\w-]*|mailto:[^\s"<>]+|tel:[\d+ -]+)$/.test(u);
  const okFont = (f) => typeof f === "string" && /^[A-Za-z0-9 ]{2,40}$/.test(f);
  const okColor = (c) => typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c);
  const okSize = (n) => typeof n === "number" && n >= 0.4 && n <= 3;

  /* ---------- find every editable thing on the page ---------- */
  function scan() {
    const seen = {};
    const next = (base) => `${base}:${(seen[base] = (seen[base] ?? -1) + 1)}`;
    document.querySelectorAll(TEXT_SEL).forEach((el) => {
      if (el.parentElement.closest(TEXT_SEL)) return;
      const key = "t:" + next(hash(norm(el.innerHTML)));
      el.dataset.agz = key;
      const a = el.closest("a");
      reg.set(key, { kind: "text", els: [el], html: el.innerHTML, href: a ? a.getAttribute("href") : null });
    });
    document.querySelectorAll(IMG_SEL).forEach((el) => {
      const cls = [...el.classList].filter((c) => !/^art-(light|dark)$/.test(c));
      const base = cls.join(".") || (el.getAttribute("src") || "").split("/").pop();
      const variant = el.classList.contains("art-dark") ? "|dark" : "";
      const n = (seen["i" + base + variant] = (seen["i" + base + variant] ?? -1) + 1);
      const key = `i:${base}:${n}`;
      el.dataset.agz = key;
      const r = reg.get(key) || { kind: "img", els: [], srcs: [] };
      r.els.push(el); r.srcs.push(el.getAttribute("src")); reg.set(key, r);
    });
    SECTIONS.forEach(([id, sel]) => { const el = document.querySelector(sel); if (el) { el.dataset.agzSec = "s:" + id; reg.set("s:" + id, { kind: "section", els: [el] }); } });
  }

  /* ---------- apply stored changes ---------- */
  let fontLink, styleEl;
  function apply(d, opts = {}) {
    data = normalize(d);
    if (opts.editing !== undefined) editing = opts.editing;
    const hidden = new Set(data.hide);
    document.querySelectorAll("[data-agz-new]").forEach((n) => n.remove());
    for (const [key, r] of reg) {
      r.els.forEach((el, i) => {
        if (r.kind === "text") {
          const html = data.text[key];
          el.innerHTML = typeof html === "string" ? clean(html) : r.html;
          if (el.classList.contains("logo-word")) el.dataset.text = el.textContent;
          const a = el.closest("a"); const href = data.link[key];
          if (a && r.href != null) a.setAttribute("href", okLink(href) ? href : r.href);
        } else if (r.kind === "img") {
          const src = data.img[key];
          el.setAttribute("src", okImg(src) ? src : r.srcs[i]);
        }
        el.style.zoom = r.kind !== "section" && okSize(data.size[key]) ? data.size[key] : "";
        el.classList.toggle("agz-hide", hidden.has(key) && !editing);
        el.classList.toggle("agz-ghost", hidden.has(key) && editing);
      });
    }
    data.add.forEach((item) => {
      const anchor = document.querySelector(`[data-agz="${CSS.escape(item.after)}"]`);
      if (!anchor) return;
      let el;
      if (item.kind === "img") {
        if (!okImg(item.src)) return;
        el = document.createElement("img"); el.className = "user-img"; el.src = item.src; el.alt = ""; el.loading = "lazy";
      } else {
        el = document.createElement(/^(p|h2|h3|li)$/.test(item.tag) ? item.tag : "p");
        const cls = String(item.cls || "").split(/\s+/).filter((c) => /^(sub|lede|eyebrow|h2|note)$/.test(c));
        el.className = cls.join(" "); el.innerHTML = clean(item.html || "");
      }
      el.dataset.agz = item.id; el.dataset.agzNew = "1";
      if (okSize(data.size[item.id])) el.style.zoom = data.size[item.id];
      (anchor.closest("[data-agz-new]") || anchor).after(el);
      // an addition right after a nested <span> inside a button or link belongs after that button
      if (el.parentElement && el.parentElement.matches("a, button")) el.parentElement.after(el);
    });
    // fonts
    const fams = Object.values(data.font).filter(okFont);
    if (fams.length) {
      fontLink = fontLink || document.head.appendChild(Object.assign(document.createElement("link"), { rel: "stylesheet" }));
      const href = "https://fonts.googleapis.com/css2?" + [...new Set(fams)].map((f) => "family=" + f.replace(/ /g, "+") + (FONT_AXES[f] ? ":" + FONT_AXES[f] : "")).join("&") + "&display=swap";
      if (fontLink.href !== href) fontLink.href = href;
    } else if (fontLink) { fontLink.remove(); fontLink = null; }
    let css = "";
    const vars = Object.entries(FONT_ROLES).filter(([r]) => okFont(data.font[r])).map(([r, [v, fb]]) => `${v}: "${data.font[r]}", ${fb};`).join(" ");
    if (vars) css += `:root, :root[data-theme] { ${vars} }`;
    const cols = COLORS.filter((c) => okColor(data.color[c])).map((c) => `--${c}: ${data.color[c]};`).join(" ");
    if (cols) css += `:root[data-theme="light"] { ${cols} } @media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) { ${cols} } }`;
    styleEl = styleEl || document.head.appendChild(document.createElement("style"));
    styleEl.textContent = css;
    document.dispatchEvent(new CustomEvent("agz:site"));
  }

  // Google Fonts axes per family (asking a single-weight font for weights it lacks breaks the whole request)
  const FONT_AXES = {
    "Cormorant Garamond": "ital,wght@0,400;0,500;0,600;1,400;1,500;1,600;1,700", "Playfair Display": "ital,wght@0,400;0,500;0,600;1,400;1,500;1,600;1,700",
    "Lora": "ital,wght@0,400;0,500;0,600;1,400;1,500;1,600;1,700", "EB Garamond": "ital,wght@0,400;0,500;0,600;1,400;1,500;1,600;1,700",
    "Noto Serif": "ital,wght@0,400;0,500;0,600;1,400;1,500;1,600;1,700", "Spectral": "ital,wght@0,400;0,500;0,600;1,400;1,500;1,600;1,700",
    "PT Serif": "ital,wght@0,400;0,700;1,400;1,700", "Philosopher": "ital,wght@0,400;0,700;1,400;1,700",
    "Exo 2": "ital,wght@0,300;0,400;0,500;0,600;1,400", "Montserrat": "ital,wght@0,300;0,400;0,500;0,600;1,400", "Nunito": "ital,wght@0,300;0,400;0,500;0,600;1,400",
    "Raleway": "ital,wght@0,300;0,400;0,500;0,600;1,400", "Inter": "wght@300;400;500;600", "Roboto": "ital,wght@0,300;0,400;0,500;1,400",
    "Rubik": "ital,wght@0,300;0,400;0,500;0,600;1,400", "Comfortaa": "wght@300;400;500;600", "Caveat": "wght@400;500;600;700"
  };
  const FONTS = {
    logo: ["Italianno", "Great Vibes", "Parisienne", "Pinyon Script", "Alex Brush", "Marck Script", "Lobster", "Cormorant Garamond", "Playfair Display"],
    serif: ["Cormorant Garamond", "Playfair Display", "Lora", "EB Garamond", "Prata", "PT Serif", "Noto Serif", "Spectral", "Philosopher"],
    script: ["Cormorant Garamond", "Playfair Display", "Lora", "EB Garamond", "Marck Script", "Caveat", "Philosopher", "Lobster"],
    tech: ["Exo 2", "Montserrat", "Nunito", "Raleway", "Inter", "Roboto", "Rubik", "Comfortaa", "Philosopher"]
  };

  /* ---------- load: last copy at once (no flash), then the fresh one ---------- */
  function boot() {
    scan();
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(CACHE) || "null"); } catch {}
    if (cached) apply(cached);
    const wantEdit = /[?&]edit\b/.test(location.search) || location.hash === "#edit";
    fetch("/api/site", { credentials: "same-origin" })
      .then((r) => (r.ok && (r.headers.get("content-type") || "").includes("json") ? r.json() : Promise.reject()))
      .then((j) => {
        state.backend = true;
        try { localStorage.setItem(CACHE, JSON.stringify(j.content || {})); } catch {}
        apply(j.content || {});
      })
      .catch(() => {
        // no server (offline preview): show the visitor's own trial edits if any
        let demo = null; try { demo = JSON.parse(localStorage.getItem(DEMO) || "null"); } catch {}
        if (demo) apply(demo);
      })
      .finally(() => {
        let admin = false; try { admin = localStorage.getItem("agz-admin") === "1"; } catch {}
        if (wantEdit) loadEditor();
        else if (admin || !state.backend) pencil();
      });
  }
  function pencil() {
    const b = document.createElement("button");
    b.type = "button"; b.className = "agz-pencil"; b.innerHTML = "✎ <span>Сайтаа засах</span>";
    b.addEventListener("click", () => { b.remove(); loadEditor(); });
    document.body.appendChild(b);
  }
  let editorLoading = false;
  function loadEditor() {
    if (editorLoading) return; editorLoading = true;
    const base = document.querySelector('script[src$="site.js"]').getAttribute("src").replace(/site\.js$/, "");
    document.head.appendChild(Object.assign(document.createElement("link"), { rel: "stylesheet", href: base + "edit.css" }));
    const photo = Object.assign(document.createElement("script"), { src: base + "photo.js" });
    photo.onload = () => document.body.appendChild(Object.assign(document.createElement("script"), { src: base + "edit.js" }));
    document.body.appendChild(photo);
  }

  boot(); // loaded at the end of <body>, before app.js, so the page is complete and nothing has animated yet
  return {
    reg, state, apply, clean, okImg, okLink, FONTS, FONT_ROLES, COLORS, SECTIONS, DEMO, CACHE,
    get data() { return data; }, hash
  };
})();
