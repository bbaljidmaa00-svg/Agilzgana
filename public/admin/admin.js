/* Agilzgana admin: sign in, manage products (with photo upload), follow orders. */
(() => {
  const { CATEGORIES, esc, money, catOf, api, upload, art } = window.AGZ;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const STATUS = { new: "Шинэ", making: "Хийж байна", ready: "Бэлэн", done: "Хүргэсэн", cancelled: "Цуцалсан" };

  let products = [], orders = [], editing = null, images = [], pending = 0;

  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2600);
  }
  const view = (id) => ["loginView", "setupView", "appView"].forEach((v) => ($("#" + v).hidden = v !== id));

  /* ---------- boot / auth ---------- */
  async function boot() {
    let me;
    try { me = await api("/api/login"); }
    catch { return setup(["Сайтын сервер (Pages Functions) ажиллахгүй байна. Сайт Cloudflare Pages дээр байршсан эсэхийг шалгана уу."]); }
    const missing = [];
    if (!me.db) missing.push("Өгөгдлийн сан: Settings → Bindings → <code>D1 database</code>, нэр нь <code>DB</code>");
    if (!me.images) missing.push("Зургийн сан: Settings → Bindings → <code>KV namespace</code>, нэр нь <code>IMAGES</code>");
    if (!me.configured) missing.push("Нууц үг: Settings → Variables and Secrets → <code>ADMIN_PASSWORD</code> (Secret)");
    if (missing.length) return setup(missing);
    if (!me.admin) { view("loginView"); $("#pw").focus(); return; }
    signedIn();
  }
  // remember on this device that Baljka is the admin, so the shop shows her the "Сайтаа засах" button
  function signedIn() {
    try { localStorage.setItem("agz-admin", "1"); } catch {}
    if (/[?&]next=edit\b/.test(location.search)) { location.href = "../?edit"; return; }
    view("appView"); loadAll();
  }
  function setup(items) { $("#setupList").innerHTML = items.map((i) => `<li>${i}</li>`).join(""); view("setupView"); }

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button[type=submit]"); btn.disabled = true;
    try { await api("/api/login", { method: "POST", body: JSON.stringify({ password: $("#pw").value }) }); $("#pw").value = ""; $("#loginErr").textContent = ""; signedIn(); }
    catch (err) { $("#loginErr").textContent = err.message; }
    btn.disabled = false;
  });
  $("#logoutBtn").addEventListener("click", async () => { await api("/api/login", { method: "DELETE" }).catch(() => {}); try { localStorage.removeItem("agz-admin"); } catch {} view("loginView"); });

  function authFail(err) { if (err.status === 401) { view("loginView"); return true; } toast(err.message); return false; }

  /* ---------- tabs ---------- */
  $$(".tab").forEach((t) => t.addEventListener("click", () => {
    $$(".tab").forEach((x) => x.setAttribute("aria-selected", x === t));
    $("#tab-products").hidden = t.dataset.tab !== "products";
    $("#tab-orders").hidden = t.dataset.tab !== "orders";
    if (t.dataset.tab === "orders") loadOrders();
  }));

  async function loadAll() { await Promise.all([loadProducts(), loadOrders()]); }

  /* ---------- products ---------- */
  $("#fCat").innerHTML = `<option value="">Бүх төрөл</option>` + CATEGORIES.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  $("#edCat").innerHTML = CATEGORIES.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  $("#fCat").addEventListener("change", renderProducts);
  $("#fSearch").addEventListener("input", renderProducts);

  async function loadProducts() {
    try { products = (await api("/api/products?all=1")).products; renderProducts(); }
    catch (err) { authFail(err); }
  }
  function renderProducts() {
    const cat = $("#fCat").value, q = $("#fSearch").value.trim().toLowerCase();
    const list = products.filter((p) => (!cat || p.category === cat) && (!q || p.name.toLowerCase().includes(q)));
    const hidden = products.filter((p) => p.hidden).length, ex = products.filter((p) => p.isExample).length;
    $("#prodSummary").textContent = `${products.length} бүтээл${hidden ? ` · ${hidden} нуусан` : ""}${ex ? ` · ${ex} жишээ (устгаад жинхэнээ оруулаарай)` : ""}`;
    $("#prodGrid").innerHTML = list.length ? list.map((p, i) => `
      <button class="a-card" type="button" data-id="${esc(p.id)}">
        <span class="thumb">${p.images[0] ? `<img src="${esc(p.images[0])}" alt="" loading="lazy">` : art(p.category, i + 2)}</span>
        <span class="flags">${p.hidden ? '<span class="flag hid">Нуусан</span>' : ""}${p.featured ? '<span class="flag ft">Онцлох</span>' : ""}${p.isExample ? '<span class="flag ex">Жишээ</span>' : ""}</span>
        <span class="nm">${esc(p.name)}</span>
        <span class="meta"><span>${esc(catOf(p.category).name)}</span><span>${AGZ.priceText(p.price)}</span></span>
      </button>`).join("") : `<p class="a-empty">Бүтээл олдсонгүй. "+ Шинэ бүтээл" дээр дарж эхнийхээ бүтээлийг нэмээрэй.</p>`;
  }
  $("#prodGrid").addEventListener("click", (e) => { if (arranging) return; const c = e.target.closest(".a-card"); if (c) openEditor(products.find((p) => p.id === c.dataset.id)); });

  /* ---------- arrange: drag cards into the order the shop shows, like an Instagram grid ---------- */
  let arranging = false, drag = null;
  function setArranging(on) {
    arranging = on;
    if (on) { $("#fCat").value = ""; $("#fSearch").value = ""; renderProducts(); }
    $("#prodGrid").classList.toggle("arranging", on);
    $("#arrangeBar").hidden = !on; $("#arrangeBtn").hidden = on; $("#newBtn").hidden = on;
    $(".a-filter").hidden = on;
  }
  $("#arrangeBtn").addEventListener("click", () => setArranging(true));
  $("#arrangeCancel").addEventListener("click", () => { setArranging(false); renderProducts(); });
  $("#arrangeSave").addEventListener("click", async () => {
    const order = $$("#prodGrid .a-card").map((c) => c.dataset.id);
    const btn = $("#arrangeSave"); btn.disabled = true;
    try {
      await api("/api/products", { method: "PUT", body: JSON.stringify({ order }) });
      products.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      setArranging(false); renderProducts(); toast("Дараалал хадгалагдлаа");
    } catch (err) { authFail(err); }
    btn.disabled = false;
  });
  const grid = $("#prodGrid");
  grid.addEventListener("pointerdown", (e) => {
    if (!arranging) return;
    const card = e.target.closest(".a-card"); if (!card) return;
    e.preventDefault(); card.setPointerCapture(e.pointerId);
    drag = { card, y: e.clientY }; card.classList.add("dragging");
  });
  grid.addEventListener("pointermove", (e) => {
    if (!drag) return;
    drag.y = e.clientY;
    const under = document.elementFromPoint(e.clientX, e.clientY)?.closest(".a-card");
    if (!under || under === drag.card) return;
    const cards = $$(".a-card", grid), from = cards.indexOf(drag.card), to = cards.indexOf(under);
    const before = new Map(cards.map((c) => [c, c.getBoundingClientRect()]));
    under[from < to ? "after" : "before"](drag.card);
    cards.forEach((c) => { // slide the others into their new places
      const a = before.get(c), b = c.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
      if (dx || dy) c.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 220, easing: "ease-out" });
    });
  });
  const endDrag = () => { if (drag) drag.card.classList.remove("dragging"); drag = null; };
  grid.addEventListener("pointerup", endDrag); grid.addEventListener("pointercancel", endDrag);
  (function edgeScroll() { // scroll the page while holding a card near the top or bottom edge
    if (drag) { const m = 80; if (drag.y < m) scrollBy(0, -10); else if (drag.y > innerHeight - m) scrollBy(0, 10); }
    requestAnimationFrame(edgeScroll);
  })();
  $("#newBtn").addEventListener("click", () => openEditor(null));

  /* ---------- editor ---------- */
  function openEditor(p) {
    editing = p;
    $("#edTitle").textContent = p ? "Бүтээл засах" : "Шинэ бүтээл";
    $("#edName").value = p?.name || "";
    $("#edCat").value = p?.category || ($("#fCat").value || "ring");
    $("#edPrice").value = p?.price ?? "";
    $("#edMat").value = p?.material || "";
    $("#edDesc").value = p?.description || "";
    $("#edFeat").checked = !!p?.featured;
    $("#edHidden").checked = !!p?.hidden;
    $("#edDelete").hidden = !p;
    $("#confirmDel").hidden = true;
    $("#edErr").textContent = ""; $("#upStatus").textContent = "";
    images = (p?.images || []).map((url) => ({ url }));
    drawImages();
    $("#veil").hidden = false; $("#editor").hidden = false; $("#editor").scrollTop = 0;
    document.body.style.overflow = "hidden";
    setTimeout(() => (p ? null : $("#edName").focus({ preventScroll: true })), 300);
  }
  function closeEditor() { $("#editor").hidden = true; $("#veil").hidden = true; document.body.style.overflow = ""; }
  $("#edClose").addEventListener("click", closeEditor);
  $("#veil").addEventListener("click", closeEditor);
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#editor").hidden) closeEditor(); });

  function drawImages() {
    $("#edImages").innerHTML = images.map((im, i) => `
      <div class="ed-img ${im.url ? "" : "loading"}">
        <img src="${esc(im.preview || im.url)}" alt="">
        ${i === 0 ? '<span class="cover">Нүүр</span>' : ""}
        <span class="tools">
          ${i > 0 ? `<button type="button" data-act="left" data-i="${i}" aria-label="Урагш">‹</button>` : ""}
          ${i < images.length - 1 ? `<button type="button" data-act="right" data-i="${i}" aria-label="Хойш">›</button>` : ""}
          ${im.url ? `<button type="button" data-act="edit" data-i="${i}" aria-label="Зураг засах">✎</button>` : ""}
          <button type="button" data-act="del" data-i="${i}" aria-label="Зураг хасах">×</button>
        </span>
      </div>`).join("");
  }
  $("#edImages").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-act]"); if (!b) return;
    const i = +b.dataset.i;
    if (b.dataset.act === "edit") return editImage(i);
    if (b.dataset.act === "del") images.splice(i, 1);
    if (b.dataset.act === "left") [images[i - 1], images[i]] = [images[i], images[i - 1]];
    if (b.dataset.act === "right") [images[i + 1], images[i]] = [images[i], images[i + 1]];
    drawImages();
  });
  // crop / light / warmth an image that is already in the list, then swap in the new upload
  async function editImage(i) {
    const im = images[i]; if (!im?.url) return;
    const blob = await window.AGZPhoto.edit(im.url, { aspect: "4:5" }); if (!blob) return;
    await uploadInto(im, blob, true);
  }
  async function uploadInto(im, blob, replacing) {
    im.preview = URL.createObjectURL(blob); const old = im.url; if (replacing) im.url = null; drawImages();
    pending++; $("#upStatus").textContent = `Зураг оруулж байна… (${pending})`;
    try { im.url = (await upload(blob, 1800)).url; }
    catch (err) { if (replacing) im.url = old; else images.splice(images.indexOf(im), 1); if (!authFail(err)) $("#edErr").textContent = err.message; }
    pending--; $("#upStatus").textContent = pending ? `Зураг оруулж байна… (${pending})` : "Зургууд орлоо.";
    drawImages();
  }
  async function addFiles(files) {
    const list = [...files].filter((f) => f.type.startsWith("image/")).slice(0, 12 - images.length);
    if (!list.length) return;
    if (list.length === 1) { // one picture: open the photo editor first (4:5 like the shop cards)
      const blob = await window.AGZPhoto.edit(list[0], { aspect: "4:5" }); if (!blob) return;
      const im = {}; images.push(im); return uploadInto(im, blob, false);
    }
    for (const f of list) {
      const im = { preview: URL.createObjectURL(f) }; images.push(im); drawImages();
      pending++; $("#upStatus").textContent = `Зураг оруулж байна… (${pending})`;
      try { im.url = (await upload(f, 1800)).url; }
      catch (err) { images.splice(images.indexOf(im), 1); if (!authFail(err)) $("#edErr").textContent = err.message; }
      pending--; $("#upStatus").textContent = pending ? `Зураг оруулж байна… (${pending})` : "Зургууд орлоо.";
      drawImages();
    }
  }
  $("#edFiles").addEventListener("change", (e) => { addFiles(e.target.files); e.target.value = ""; });
  const drop = $("#drop");
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));

  $("#edForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (pending) { $("#edErr").textContent = "Зураг орж дуусахыг хүлээнэ үү."; return; }
    const body = {
      name: $("#edName").value.trim(), category: $("#edCat").value, price: +$("#edPrice").value || 0,
      material: $("#edMat").value.trim(), description: $("#edDesc").value.trim(),
      featured: $("#edFeat").checked, hidden: $("#edHidden").checked,
      images: images.filter((i) => i.url).map((i) => i.url)
    };
    if (!body.name) { $("#edErr").textContent = "Нэрээ оруулна уу."; $("#edName").focus(); return; }
    const btn = $("#edSave"); btn.disabled = true;
    try {
      const res = editing
        ? await api(`/api/products/${encodeURIComponent(editing.id)}`, { method: "PUT", body: JSON.stringify(body) })
        : await api("/api/products", { method: "POST", body: JSON.stringify(body) });
      const i = products.findIndex((p) => p.id === res.product.id);
      if (i >= 0) products[i] = res.product; else products.unshift(res.product);
      renderProducts(); closeEditor(); toast(editing ? "Хадгаллаа" : "Шинэ бүтээл нэмэгдлээ");
    } catch (err) { if (!authFail(err)) $("#edErr").textContent = err.message; }
    btn.disabled = false;
  });
  $("#edDelete").addEventListener("click", () => { $("#confirmDel").hidden = false; $("#confirmDel").scrollIntoView({ block: "nearest" }); });
  $("#delNo").addEventListener("click", () => ($("#confirmDel").hidden = true));
  $("#delYes").addEventListener("click", async () => {
    try {
      await api(`/api/products/${encodeURIComponent(editing.id)}`, { method: "DELETE" });
      products = products.filter((p) => p.id !== editing.id); renderProducts(); closeEditor(); toast("Устгалаа");
    } catch (err) { if (!authFail(err)) $("#edErr").textContent = err.message; }
  });

  /* ---------- orders ---------- */
  $("#oFilter").addEventListener("change", renderOrders);
  async function loadOrders() {
    try { orders = (await api("/api/orders")).orders; renderOrders(); }
    catch (err) { authFail(err); }
  }
  const when = (s) => { const d = new Date(s.replace(" ", "T") + "Z"); return isNaN(d) ? s : d.toLocaleString("mn-MN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); };
  function renderOrders() {
    const f = $("#oFilter").value;
    const list = orders.filter((o) => f === "all" || (f === "active" ? !["done", "cancelled"].includes(o.status) : o.status === f));
    const nNew = orders.filter((o) => o.status === "new").length;
    $("#newCount").hidden = !nNew; $("#newCount").textContent = nNew;
    $("#orderSummary").textContent = `${orders.length} захиалга · ${nNew} шинэ`;
    $("#orderList").innerHTML = list.length ? list.map((o) => {
      const c = o.customer || {}, ig = (c.instagram || "").replace(/^@/, "");
      const body = o.kind === "custom"
        ? `<p class="o-idea">${esc(o.items[0]?.idea || "")}</p>
           <p class="o-items sz">${esc([o.items[0]?.category && (catOf(o.items[0].category).name), o.items[0]?.size, o.items[0]?.budget].filter(Boolean).join(" · "))}</p>`
        : `<ol class="o-items">${o.items.map((i) => `<li>${esc(i.name)} × ${i.qty} <span class="sz">${esc([i.size, i.note].filter(Boolean).join(" · "))}</span></li>`).join("")}</ol>`;
      return `<article class="o-card ${o.kind === "custom" ? "o-custom" : ""}">
        <div class="o-head">
          <span><span class="o-id">№${o.id}</span><span class="o-kind">${o.kind === "custom" ? "Санаагаар" : "Бүтээл"}</span> <span class="o-date">${esc(when(o.created_at))}</span></span>
          <select class="o-status" data-id="${o.id}" data-s="${o.status}" aria-label="Төлөв">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === o.status ? "selected" : ""}>${v}</option>`).join("")}</select>
        </div>
        <div class="o-cust"><strong>${esc(c.name)}</strong><a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>${ig ? `<a href="https://instagram.com/${esc(ig)}" target="_blank" rel="noopener">@${esc(ig)}</a>` : ""}${c.address ? `<span>${esc(c.address)}</span>` : ""}</div>
        <p class="o-items sz">${c.consent ? `Зөвшөөрөл өгсөн: ${esc(when(String(c.consent.at).slice(0, 19).replace("T", " ")))}${c.consent.version ? " (бодлого " + esc(c.consent.version) + ")" : ""}` : "Зөвшөөрлийн бүртгэлгүй (хуучин захиалга)"}</p>
        ${body}
        ${o.images?.length ? `<div class="o-imgs">${o.images.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="Санааны зураг"></a>`).join("")}</div>` : ""}
        <div class="o-foot"><span>${o.total ? money(o.total) : ""}</span><button class="o-del" type="button" data-id="${o.id}">Устгах</button></div>
      </article>`;
    }).join("") : `<p class="a-empty">Энд одоогоор захиалга алга.</p>`;
  }
  $("#orderList").addEventListener("change", async (e) => {
    const s = e.target.closest(".o-status"); if (!s) return;
    try { await api(`/api/orders/${s.dataset.id}`, { method: "PATCH", body: JSON.stringify({ status: s.value }) }); const o = orders.find((x) => x.id == s.dataset.id); o.status = s.value; renderOrders(); toast("Төлөв шинэчлэгдлээ"); }
    catch (err) { authFail(err); }
  });
  $("#orderList").addEventListener("click", async (e) => {
    const b = e.target.closest(".o-del"); if (!b) return;
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Дахин дарж баталгаажуул"; setTimeout(() => { b.dataset.armed = ""; b.textContent = "Устгах"; }, 3000); return; }
    try { await api(`/api/orders/${b.dataset.id}`, { method: "DELETE" }); orders = orders.filter((o) => o.id != b.dataset.id); renderOrders(); toast("Устгалаа"); }
    catch (err) { authFail(err); }
  });

  boot();
})();
