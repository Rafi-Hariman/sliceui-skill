# Observed FIGML Schema (empiris)

Dihasilkan `analyze-schema.mjs` memakai `fast-xml-parser` 5.11.1 (konfigurasi identik produksi `src/lib/figml-parse.mjs:15-21`). 4 file dianalisis: `mahasiswa-tarif/raw.xml`, `tester.xml`, `eval-hope/.../raw.xml`, `pilar-golden/.../raw.xml`.

**Totals:** 2,733 elemen · 8,939 atribut · maxDepth 24 · tidak ada DOCTYPE/ENTITY di fixture manapun.

## Temuan format paling penting

### 1. Vocabulary tag TIDAK tertutup — nama layer Figma menjadi nama tag

Tag untuk component **instance** adalah **nama layer** di Figma, bukan tipe generik. Contoh tag teramati:

`Button_FNC`, `Checkbox_FNC`, `Field`, `search_bar`, `Status_Beasiswa`, `Icon_white`, `Icon_primary`, `Information_box_detail`, `Aksi`, `pressed`, `check`, `Icon_Font_Awesome_Free_Solid_C_caret-down`, `Icon_Font_Awesome_Free_Solid_I_info-circle`, `Text_Only`, `Checked`, `Indeterminate`.

Hanya elemen *primitif* yang memakai tag tipe stabil: `frame`/`Frame`, `Text`, `Rectangle`, `Vector`, `Line`, `Group`. Ini berarti parser TIDAK boleh mengasumsikan schema tertutup — tag apapun (nama layer) boleh muncul. Tidak ada XSD/DTD/namespace.

### 2. Case inconsistency: root `<frame>` vs children `<Frame>`

Root element ditulis lowercase `<frame>` (4 file, semua), sedangkan frame anak ditulis `<Frame>` (capital F). `classifyByTag` dan `findRootFrame` mengandalkan kecocokan case-insensitive pada regex, tapi `rootDim` (figml-parse.mjs:114) hanya cocokkan literal lowercase `<frame`.

### 3. Deklarasi versi

- `<?xml version="1.0" encoding="UTF-8"?>` — hanya di 2 export asli.
- `<?figml version="1.0"?>` — hanya di 2 export asli (PI, bukan atribut). Parser **tidak membaca** versi ini (tidak ada gate versi).

### 4. Nilai numerik bercampur tipe

- `fontWeight` bisa `integer` ("500") atau `empty-string` ("").
- `cornerRadius` bisa `integer` ("6") atau `empty-string` ("").
- `characters` bisa `string` atau `integer` (teks murni numerik, mis. sel "10.000.000" — sebenarnya string; classifier regex menganggap "10.000.000" bukan integer).
- `x`/`y`/`width`/`height` bisa `decimal` presisi penuh Figma (mis. Vector `x="1.1333333253860474"`).
- `opacity` decimal presisi penuh ("0.4000000059604645").

Parser memakai `parseAttributeValue:false` → semua nilai tetap string; konversi number dilakukan manual lewat `num()`.

## Inventaris atribut per elemen kunci

### `frame` / `Frame` (root + frame anak, 95)
`id` (figma-node-id `16601:46203`), `name`, `x`, `y`, `width`, `height`, `type` ("FRAME"), `layoutMode` (VERTICAL/HORIZONTAL), `layoutSizingHorizontal/Vertical` (FILL/HUG/AUTO), `layoutAlign` (STRETCH), `layoutGrow` (1), `layoutPositioning` (ABSOLUTE — hanya di Line), `primaryAxisAlignItems` (CENTER/SPACE_BETWEEN/MAX/MIN), `counterAxisAlignItems` (CENTER/MAX), `primaryAxisSizingMode`/`counterAxisSizingMode` (FIXED/AUTO), `itemSpacing`, `paddingLeft/Right/Top/Bottom`, `horizontalPadding`/`verticalPadding`, `cornerRadius`, `topLeft/topRight/bottomRight/bottomLeftRadius`, `maskType` (ALPHA), `expanded`, `strokeAlign`, `clipsContent` (Checkbox/Icon_white).

### `Text` (196)
`type` ("TEXT" **atau "VARIANT"**), `id`, `name`, `x`, `y`, `width`, `height`, `characters`, `fontSize`, `fontWeight`, `fontName` (string "Symbol(figma.mixed)" OR child `<fontName>`), `textAlignHorizontal` (JUSTIFIED/CENTER), `textAlignVertical` (TOP), `textAutoResize` (HEIGHT/WIDTH_AND_HEIGHT), `hyperlink` (""), `strokeAlign`, `strokeWeight` (0), `layoutSizingHorizontal`, `layoutGrow`, `layoutAlign`, `value` (bool), `visible` (false), `opacity` (decimal).

### `fill` (316) / `stroke` (64)
`color` (hanya hex-6, **tanpa** alpha/hex-8/rgba), `blendMode` (NORMAL), `visible` (false). **Tidak ada gradien, tidak ada image fill, tidak ada fill opacity** di fixture.

### `constraints` (388) — DIBUANG oleh kedua parser
`horizontal` (MIN/SCALE/CENTER), `vertical` (MIN/SCALE).

### `fontName` (child, 111)
`family` (Roboto), `style` (Bold/SemiBold/Regular). — **Di-skip** (SKIP_TAGS), family tidak masuk transcript.

### `letterSpacing` (187) / `lineHeight` (187)
`letterSpacing`: `value` (0), `unit` (PERCENT). `lineHeight`: `unit` (AUTO/PIXELS), `value` (18).

### `mainComponent` (64) — DIBUANG oleh kedua parser
`id` (figma-node-id) — **relasi component→instance**, hilang.

### `variantProperties` (54)
`type`/`Type`, `Name`/`name`, `Alphabet`, `State`, `Text_Only`, `Checked`, `Indeterminate`, `icon`, `Text`, `required` (bool). Parser hanya membaca `Type`/`Name`/`required`.

### `override` (38) / `overriddenField` (115)
`override`: `id`. `overriddenField`: `value` ("fillStyleId"/"fills"/"strokeStyleId"), `index`. Parser hanya membaca overriddenField="visible" value="false" untuk hidden-by-override; sisanya dibuang.

### `componentProperties` (55) — wrapper varian
Berisi child yang merupakan **properti komponen** (tag = nama properti, mis. `Type`, `type`, `Alphabet`, `required`, `show_error_4863_40` dengan suffix numeric = property id).

## Konsistensi urutan & ID

- Urutan child di XML adalah urutan DOM (scene/z-order). `preserveOrder:true` mempertahankannya.
- `id` node hadir di mayoritas node (Figma `node-id:sub-id`), tetapi node `Text type="VARIANT"` dan beberapa node lain bisa tanpa `id` (parser menghasilkan id sintetis dari nama + counter global `_idSeq`).
- **Duplicate names** diizinkan (nama layer Figma sering duplikat) — tidak ada deteksi ambiguitas; id Figma yang menjadi pembeda.

## Kelemahan struktural format yang teramati
1. Nama layer = tag → injeksi tag/malformed bila nama layer mengandung karakter XML ilegal (perlu [NEEDS FIGML EXPORT] untuk menguji perilaku exporter).
2. Tidak ada skema/namespace → validator schema tertutup tidak mungkin; hanya bisa "toleransi field tak dikenal".
3. Warna tanpa alpha channel terobservasi → opacity node terpisah, tapi opacity per-fill tidak ada.
