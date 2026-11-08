# Agilzgana вэбсайт

Энгийн HTML/CSS/JS сайт. Build хийх шаардлагагүй тул Cloudflare Pages дээр шууд байршина.

## Файлууд
- `index.html` — хуудасны бүтэц
- `styles.css` — өнгө, фонт, анимаци
- `app.js` — бүтээгдэхүүн харуулах, хэмжээ авах, захиалга бэлдэх
- `products.json` — **бүх бүтээгдэхүүн энд байна**
- `images/products/` — бүтээгдэхүүний зураг

## Шинэ загвар нэмэх
1. Зургаа `images/products/` хавтас руу оруулна (жишээ нь `ring-navch-1.jpg`). Босоо (4:5) зураг хамгийн гоё харагдана.
2. `products.json` доторх `"products"` жагсаалтад шинэ мөр нэмнэ:

```json
{
  "id": "ring-navch",
  "name": "Навч",
  "category": "ring",
  "price": 42000,
  "images": ["images/products/ring-navch-1.jpg", "images/products/ring-navch-2.jpg"],
  "material": "Мөнгөн утас",
  "description": "Богино тайлбар."
}
```

- `id` — латин үсэг, тоо, зураас (давтагдахгүй).
- `category` — `ring`, `bracelet`, `cuff`, `necklace`, `earring`, `belly`, `clip`-ийн аль нэг. Төрөл бүр өөрийн хэмжээ асууна (бөгж: размер, бугуйвч: бугуйн тойрог гэх мэт).
- Түр нуух бол `"hidden": true` нэмнэ.
- Жишээ бүтээгдэхүүнүүдийг (`"isExample": true`) жинхэнэ бүтээгдэхүүн орсны дараа устгана.

GitHub дээр файлаа засаад хадгалахад Cloudflare Pages сайтыг автоматаар шинэчилнэ.

## Захиалга
Одоогоор захиалагч бүтээгдэхүүн, хэмжээ, нэр, утас, хаягаа бөглөхөд захиалгын текст бэлдэгдэж, Instagram DM-ээр илгээнэ.
Instagram хаягийг `products.json` доторх `shop.instagram`-аас солино.
