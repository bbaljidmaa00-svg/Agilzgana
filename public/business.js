/* Business details shown in the footer and on the legal pages.
   FILL THESE IN (Baljka): every empty value shows a highlighted "[бөглөх: ...]" placeholder until it is filled.
   Mongolian consumer and personal-data law expect a shop to say who it is and how to reach it. */
window.AGZ_BUSINESS = {
  shortName: "Agilzgana",
  legalName: "",        // Хуулийн этгээдийн бүтэн нэр, эсвэл хувиараа бол овог нэр. Жишээ: "Агилзгана ХХК" / "Б. Балжмаа (хувиараа)"
  regNumber: "",        // Улсын бүртгэлийн дугаар (ХХК) эсвэл регистрийн дугаар (хувь хүн, хэрэв нийтэд харуулахыг хүсвэл)
  address: "",          // Бүртгэлтэй хаяг эсвэл захидал хүлээн авах хаяг (Улаанбаатар, дүүрэг, хороо ...)
  email: "",            // Холбоо барих имэйл
  phone: "",            // Холбоо барих утас
  instagram: "agilzgana_",
  policyDate: "2026-11-09"  // Бодлогуудыг хамгийн сүүлд шинэчилсэн огноо
};

(() => {
  const B = window.AGZ_BUSINESS;
  const LABEL = {
    legalName: "хуулийн этгээдийн нэр", regNumber: "бүртгэлийн дугаар", address: "хаяг",
    email: "имэйл", phone: "утас", shortName: "брэнд нэр", instagram: "Instagram", policyDate: "огноо"
  };
  const todo = (k) => {
    const m = document.createElement("mark");
    m.className = "biz-todo"; m.textContent = `[бөглөх: ${LABEL[k] || k}]`;
    return m;
  };
  function fill() {
    document.querySelectorAll("[data-biz]").forEach((el) => {
      const k = el.dataset.biz;
      if (k === "regLabel") { el.textContent = B.regNumber ? "Бүртгэлийн дугаар: " + B.regNumber : ""; if (!B.regNumber) el.append(todo("regNumber")); return; }
      const v = B[k];
      el.textContent = "";
      if (!v) { el.append(todo(k)); return; }
      if (k === "email") el.append(Object.assign(document.createElement("a"), { href: "mailto:" + v, textContent: v }));
      else if (k === "phone") el.append(Object.assign(document.createElement("a"), { href: "tel:" + v.replace(/[^\d+]/g, ""), textContent: v }));
      else if (k === "instagram") el.append(Object.assign(document.createElement("a"), { href: "https://www.instagram.com/" + v + "/", textContent: "@" + v, rel: "noopener" }));
      else el.textContent = v;
    });
    document.querySelectorAll("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fill); else fill();
})();
