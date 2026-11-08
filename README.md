# Agilzgana вэбсайт

Гараар, захиалгаар урладаг үнэт эдлэлийн сайт. Cloudflare Pages дээр ажиллана:
- **Сайт** (`index.html`, `styles.css`, `app.js`, `shared.js`): ургадаг угалз, кино шиг нээлт, цуглуулга, хэмжээ оруулах, захиалга, "өөрийн санаагаар захиалах" форм.
- **Админ** (`/admin/`): бүтээл нэмэх, засах, нуух, устгах, зураг оруулах, ирсэн захиалгыг харах, төлөв солих.
- **Сервер** (`functions/api/*`, `lib/*`): Cloudflare Pages Functions. Бүтээл, захиалга нь **D1** өгөгдлийн санд, зургууд нь **KV**-д хадгалагдана.

## Cloudflare дээрх тохиргоо (нэг удаа)

1. **Өгөгдлийн сан үүсгэх:** Cloudflare dashboard → Storage & databases → **D1** → Create → нэр `agilzgana-db`.
2. **Зургийн сан үүсгэх:** Storage & databases → **KV** → Create → нэр `agilzgana-images`.
3. **Сайттай холбох:** Workers & Pages → `agilzgana` төсөл → **Settings → Bindings → Add**:
   - *D1 database*: Variable name = `DB`, database = `agilzgana-db`
   - *KV namespace*: Variable name = `IMAGES`, namespace = `agilzgana-images`
4. **Админы нууц үг:** Settings → **Variables and Secrets → Add** → Type = *Secret*, Name = `ADMIN_PASSWORD`, Value = өөрийн нууц үг.
5. **Дахин deploy:** Deployments → хамгийн сүүлийнх → **Retry deployment**.

Build тохиргоо: Framework preset = None, Build command = хоосон, Build output directory = `/`.

Өгөгдлийн сангийн хүснэгтүүд анх ашиглахад автоматаар үүсч, 8 жишээ бүтээл орно. Жинхэнэ бүтээлээ оруулаад жишээнүүдийг админаас устгана.

## Админ

`https://<таны-сайт>/admin/` руу орж нууц үгээрээ нэвтэрнэ. Утаснаас ч ажиллана.
- **+ Шинэ бүтээл**: зураг (12 хүртэл, эхнийх нь нүүр зураг), нэр, төрөл, үнэ, материал, тайлбар. Зургийг браузер дээр нь жижигрүүлээд хадгалдаг тул утасны том зураг ч хурдан орно.
- **Онцлох** нь бүтээлийг эхэнд "Шинэ" тэмдэгтэй гаргана. **Нуух** нь сайтаас түр нууна.
- **Захиалга** табад сайтаас ирсэн бүх захиалга, санаагаар хийлгэх хүсэлт (хавсаргасан зурагтай) харагдана. Төлөвийг Шинэ → Хийж байна → Бэлэн → Хүргэсэн гэж сольно.

Үйлчлүүлэгч захиалга өгөхөд захиалга өгөгдлийн санд хадгалагдаж, мөн захиалгын текстийг Instagram DM-ээр илгээх товч гарна.

## Локалаар ажиллуулах

```sh
echo 'ADMIN_PASSWORD=test' > .dev.vars
npx wrangler pages dev . --d1 DB=agz --kv IMAGES
```
