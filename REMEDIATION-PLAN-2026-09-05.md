# SliceUI Remediation Plan — Implementasi Fix Gap Analysis

> **Dari:** `SLICEUI-GAP-ANALYSIS-2026-09-05.md`
> **Tanggal:** 2026-09-05 · **Target versi:** v0.13.0 (setelah 0c/0d)
> **Tujuan:** blueprint implementasi konret per fix — file, fungsi, baris, logika baru, test. Semua lokasi diverifikasi di source v0.12.1.

---

## Prioritas & urutan kerja (dikunci)

| Fase | Isi | Usaha | Waktu |
|---|---|---|---|
| **0** | Fix murah & deterministik — close false-green, resolusi kontradiksi, schema-variant. Bisa di-CI. | S | 1–2 hari |
| **1** | `styleFidelity` + `loadedClassRegistry` — nilai/kelas-mati tertangkap. | M | 1–2 hari |
| **2** | `stamp-and-pair` + rendering oracle (fork a/b) — sebelum render gate. | M–L | 2–4 hari |
| **3** | Hulu: resolve diperluas, schema, non-self-ref fidelity, registry. | L | 2–3 hari |

**Kerangka untuk semua fix:** deterministik dulu (0,1), render belakangan (2,3). Jangan pernah biarkan gate jadi "hijau tanpa dasar".

---

## FASE 0 — Fix murah & deterministik

### 0.1 — `verify` tidak menggagalkan golden (vocabulary merge via references)

**Masalah:** verify v0.12.1 menandai kelas golden `mt-4`, `mt-0`, `mb-3`, `p-0` sebagai invented, dan `scssCoverage` 2/20 gagal karena golden sengaja tak memakai `ngx-select__toggle-caret`/`__toggle`. Corpus/vocabulary tak menyerap golden.

**Fix `src/commands/detect.mjs` (tambahkan `mergeGoldenClasses`):**

```js
// Setelah readConventions — baca references dari config, gabung kelasnya ke vocabulary
function readGoldenClasses(cwd) {
  const cfg = readJsonSafe(join(cwd, ".sliceui", "config.json"));
  const refs = cfg?.references ?? [];
  const golden = [];
  for (const r of refs) {
    // r bisa path file .html atau .component.* (prefix) — ambil folder & prefix
    const html = readFileSafe(r.endsWith(".html") ? r : guessHtmlPath(r));
    for (const m of html.matchAll(/class=["']([^"']+)["']/g)) {
      for (const raw of m[1].split(/\s+/)) golden.push(raw.trim());
    }
  }
  return [...new Set(golden)];
}
// klasifikasi: kelas yang muncul di golden → tambah ke classVocabulary dgn source:"golden"
```

**Fix `src/lib/conventions.mjs` (export + parameter):**
- `extractConventions(root, { goldenHtml = [] } = {})` → teruskan ke `extractClassVocabulary`.
- di `extractClassVocabulary(allHtml, goldenHtml)` → `counts` di-seed dari golden dengan count tinggi sintetis (agar tak jatuh ke cutoff top-N).

**Fix `src/lib/verify.mjs` checkInventedUtility (:360-407):** setelah `known` dari classVocabulary, tambahkan `goldenClasses` dari conventions (`known.add` untuk tiap). Jangan ubah aturan fail — cukup perluas himpunan legal.

**Fix `scssCoverage` advisory-vs-required:** saat ini `relevantCorpus` (:125-139) memilih block by family lalu `anyTokenPresent` gagal bila token hilang. Bedakan:
```js
// Ada block yang WAJIB (memengaruhi render inti) vs ADVISORY (efek minor):
// Required: .ngx-select__choices, .ngx-select__item_active, .dropdown-menu > li > a,
//           .label-custom-*, .fa-*, .gateway-table, pagination page-box
// Advisory: .ngx-select__toggle-caret, .ngx-select__toggle (golden menghilangkan; tak mengubah fungsi)
```
Implementasi: tambah `required: boolean` di setiap entry corpus (dari pola selector), check hanya fail untuk required-missing, advisory → warn.

**Test `test/verify.test.mjs`:** fixture golden yang omit toggle-caret → `pass: true, warnCount ≥ 1` (bukan fail).

---

### 0.2 — `verify` memakai scssCoverage asli (non-dead import) — block-body, bukan token

**Masalah:** `fidelity.mjs:268 scssCoverage(exemplar, generated)` diimpor di `verify.mjs:25` tapi tak pernah dipanggil; check #1 pakai `anyTokenPresent` token-presence yang bisa lolos oleh body salah / komentar / pseudo-state dibuang.

**Fix `src/lib/verify.mjs`:**
```js
import { scssCoverage as fidelityScssCoverage } from "./fidelity.mjs";
```
dan **ganti implementasi `checkScssCoverage` (:87-139)** untuk setiap `relevant` corpus block:
1. **Ekstrak body** block dari corpus (`block` field sudah ada) → parse declaration set.
2. **Normalisasi** kedua sisi: buang komentar, whitespace, lowercasing hex (`normalizeDecls`).
3. **Cek body-subset** (bukan selector-token): setiap deklarasi di block corpus (kecuali pseudo `:hover/:focus` bila block di sisi generated tak memuatnya TAPI bukan ini yang diminta — di sini justru kita *require* presence, bukan absence).
4. **Jangan flag pseudo-state absence otomatis** — hanya *hilangnya seluruh rule* yang gagal. Untuk aturan yang menyertakan `:hover` di corpus, wajib `:hover` versi generated ada.

Pertahankan family-gate (jangan regresi 0.11 bug): `relevantCorpus` tetap dipakai sebagai seleksi awal. Bedanya: dari "token ada di mana-mana" → "deklarasi block ada (normalisasi)".

**Test:** corpus `.search-options button { border-radius: 0 5px 5px 0 !important }`; generated SCSS berisi `.search-options button {}` (kosong) → FAIL. Generated berisi body identik → PASS. Generated hanya berisi string `search-options` di komentar → FAIL.

---

### 0.3 — `textCoverage` hanya elemen ter-render

**Masalah:** `verify.mjs:54 checkTextCoverage(html + " " + ts, …)` — label bisa lolos dari komentar TS/config, `title="…"`, elemen tak ter-render (`*ngIf="false"`).

**Fix:** buat extractor teks-ter-render dari HTML (bukan ts):
```js
function renderedText(html) {
  // 1) buang komentar html <!-- -->
  // 2) hanya teks langsung dalam elemen (bukan atribut)
  // 3) buang elemen di dalam *ngIf="false", [hidden], style="display:none"
  const clean = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/\s(?:placeholder|title|alt)=["'][^"']*["']/g, " ");
  // tokenisasi per <tag ...>…text…</tag>, hanya isi innerText
  const out = [];
  for (const m of clean.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>|<ngx-select\b[^>]*>|<input\b[^>]*>|<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi)) {
    if (m[2]) out.push(stripTags(m[2]));
  }
  return norm(out.join(" "));
}
```
`checkTextCoverage` (:146-168) lalu bandingkan `critical` terhadap `renderedText(html)` (plus teks di placeholder/aria). Drop ts dari concatenation.

**Test:** fixture ts berisi komentar `// Simpan` + html berisi `<button *ngIf="false">Simpan</button>` → FAIL (sebelumnya PASS).

---

### 0.4 — `filterRowButton` generik (bukan hardcode "Cari")

**Masalah:** `verify.mjs:483,489` hardcode `Cari`; label lain ("Search", "Terapkan") → skip total.

**Fix:** jadikan positional, bukan literal. Dalam raw XML, tombol filter = `<Button_FNC>` yang berada **di dalam grup filter** (parent frame berisi `Input`/select tetangga), bukan di area aksi. Ekstrak **label** dari `characters` tiap Button_FNC di grup filter; generated html harus memuat tombol dengan label itu:
```js
function filterButtonsFromXml(rawXml) {
  const labels = [];
  // cari <Button_FNC> yang punya saudara Input frame dalam 1 grup filter
  // fallback: semua Button_FNC yang posisi-x-nya di kanan field row terakhir
  for (const b of rawXml.matchAll(/<Button_FNC\b[\s\S]*?<\/Button_FNC>/gi)) {
    const chars = /characters="([^"]*)"/.exec(b[0])?.[1];
    if (chars && /^[A-Za-z ]+$/.test(chars)) labels.push(chars.trim());
  }
  return labels;
}
// check: untuk tiap label, generated html harus ada <button[^>]*>…label… (regex, bukan <button> literal saja)
```
**Test:** XML filter button "Terapkan" → output tanpa tombol → FAIL (sebelumnya skip).

---

### 0.5 — `gridColumns` dukung `col-N` tanpa infix + stacked fallback

**Masalah:** `verify.mjs:561` regex `/col-(?:xs|sm|md|lg|xl|xxl)-(\d+)/` — `col-6` / bare `col` (BS4) sum 0 → PASS; fallback `col-12` tak diperiksa.

**Fix:**
```js
// 1) akui bare col-N / col (BS4/5):
const SPAN_RE = /col(?:-(?:xs|sm|md|lg|xl|xxl))?-(\d+)/g;
// 2) tiap row yang punya col-md-* harus punya col-xs-12 atau col-12 ATAU col-md-12... (fallback stacking)
```
**Tambahkan check** `requireStackingFallback`: bila ada `col-md-*` pada sebuah elemen, wajib ada pasangan `col-xs-12`/`col-12` (dalam class yang sama) — kecuali bila project global CSS tak mendukung `col-12` (lihat `loadedClassRegistry` Fase 1, maka fallback valid = `col-xs-12`).

**Test:** `col-md-3` saja → WARN/fail (no fallback). `col-md-3 col-xs-12` → pass.

---

### 0.6 — Gate math + stamp-and-pair (config & pasangan ground-truth)

**Masalah:** `commands/verify.mjs:50-54` memilih `.component.*` **pertama** (`.find`), membaca transcript/xml **pertama** di `.sliceui/` (:57-68) dari `process.cwd()`. Warning & skip tak memblok (gate math).

**Fix `src/commands/verify.mjs`:**
1. **resolve `.sliceui/` dari project root**: cari nearest `package.json`/`.sliceui/` dari `dir` naik (bukan `process.cwd()`):
   ```js
   function projectRoot(dir) {
     let d = dir;
     while (d && d !== "/") {
       if (existsSync(join(d, "package.json"))) return d;
       d = dirname(d);
     }
     return process.cwd();
   }
   ```
2. **`readTranscript`/`readRawXml`** → pakai `projectRoot(dir)`, dan cek **semua** transcript/xml di dir, pilih yang `meta.image` cocok dengan nama file yang sedang diverifikasi (kalau `name` diberikan).
3. **Komponen↔transkrip stamping**: baca header `// Generated by SliceUI from <name>.xml` di file; cocokkan dengan nama yang dipakai. Mismatch → fail "wrong ground truth".

**Fix gate math (`src/lib/verify.mjs:81-82`):**
```js
const pass = failCount === 0 && hasGroundTruth && (failCount + warnCount) >= 0 ? 
  (skipRatio < 0.5 ? true : false) : false;
// skipRatio = skipCount / applicableCount; >50% skip → non-green (anggap tak-terverifikasi)
```
Lepas `warn` sebagai blocker? Tetap *warn* bukan *fail*, tapi **exit code** perlu dibedakan: warn>0 → exit 2 (advisory), bukan 0. Ubah `commands/verify.mjs:44`:
```js
return result.pass ? 0 : (result.warnCount ? 2 : 1);
```
**Test:** dir berisi 2 komponen tanpa `name` → harus fail/minta `name` (jangan ambil pertama).

---

### 0.7 — `iconColor`: netral-tapi-salah + format warna lain

**Masalah:** `verify.mjs:637-641` whitelist netral mem-PASS ikon berwarna salah (`#333` untuk badge `#f44444`); regex `:629` hanya `#rrggbb` (bukan `#f44`/rgba/hsl/variabel).

**Fix:**
1. **Hapus whitelist netral dari jalur "semantik"**: warna netral hanya diizinkan untuk ikon *struktural* (search/pencil/eye #03337b sudah di map; white/black untuk ikon di atas bg gelap). Bila transkrip mendeklarasikan icon `bg:#f44444`, maka SCSS yang mewarnai `fa-*` apapun `#333/#000/#fff` → **FAIL** (kecuali itu ikon di atas latar yang memang butuh kontras).
2. **Perluas parser warna**: normalisasi `#rgb`→`#rrggbb`, `rgba(…,a)`→ambil rgb, hsl→rgb, dan variabel `$x`→resolve via `designTokens` bila ada.

**Test:** badge design `#f44444`; generated `.fa-exclamation-circle { color: #333 }` → FAIL. `#f44` (3-hex) pada generated → diekstrak, dibanding → sesuai.

---

### 0.8 — Resolve: teks-sibling & nama-komponen dulu, warna tie-breaker (0c dari analisis)

**Masalah:** `resolve.mjs` color-first: `FA_ICON_COLORS['#03337b'][0] = fa-search` untuk caret & pencil; `resolveStatus` label by co-occurrence pertama. Terbukti salah 18/30 (indikasi, bukan statistik).

**Fix `src/lib/resolve.mjs`:**
1. **Untuk icon**: cari nama komponen XML (`attrs.name`) atau teks sibling — `Icon_Font_Awesome_Free_Solid_C_caret-down` → `fa-caret-down`, bukan `fa-search`; teks dekat tombol aksi "edit" → `fa-pencil`. Buat `resolveIconByContext(node)` yang konsultasi `node.description` + sibling text **sebelum** color-map.
2. **Untuk status badge**: `resolveStatus` saat ini ambil `cooccur[0]`. Ubah: cari label yang **teksnya cocok** (status text: "Dibatalkan"/"Belum bayar"/"Lunas") di sibling text; baru co-occurrence. Bila ambigu, pertahankan `candidates` (jangan `cooccur[0]` sembarangan), dan tandai `ambiguity: true`.
3. **Jangan buang teks**: badge node yang punya text child → sertakan dalam evidence (`statusText`).

**Test `test/resolve.test.mjs`:** fixture icon `Icon_..._caret-down` → resolve `fa-caret-down`. Badge text "Dibatalkan" → label `label-custom-cancel`.

---

### 0.9 — `::ng-deep` tanpa `:host` = fail (perluas noHashedSelectors → `noBareNgDeep`)

**Masalah:** `verify.mjs:277-291` hanya regex `_ngcontent`; `::ng-deep` telanjang (bocor global) tak di-flag. Corpus bill sendiri punya block telanjang; generator seharusnya tidak mereplikasi leak.

**Fix:** tambah check baru:
```js
function checkNoBareNgDeep(scss) {
  const bare = [...scss.matchAll(/(?<!:host\s)::ng-deep/g)].map((m) => m[0]);
  if (bare.length) return { name: "noBareNgDeep", status: "fail", detail: "::ng-deep tanpa :host (bocor global) — tambahkan :host ::ng-deep" };
  return { name: "noBareNgDeep", status: "pass" };
}
```
**Catatan keseimbangan:** bila conventions corpus sendiri berisi block telanjang, `scssCoverage` memaksa menyalinnya → konflik. Solusi: saat menyuntik corpus ke prompt, **normalisasi dulu ke `:host ::ng-deep`** di `renderConventionsMd`/`init`. Jangan sampai check baru memblok output yang benar (copy corpus).

**Test:** `.fa-x { color:red }` + `::ng-deep .foo {}` → fail. `:host ::ng-deep .foo {}` → pass.

---

### 0.10 — Compile-before-gate (syntax SCSS / template tak bisa exit hijau)

**Masalah:** verify exit 0 walau SCSS syntax-error (tanda kurung tak seimbang).

**Fix:** di `commands/verify.mjs` (sebelum panggil verifyComponent), lakukan **syntax smoke**:
```js
// 1) SCSS: brace-balance + tak ada '/*' tanpa '*/'
function scssSyntaxOk(scss) {
  let depth = 0, inStr = null, comment = false;
  for (let i=0;i<scss.length;i++) {
    const c = scss[i], n = scss[i+1];
    if (comment) { if (c==='*'&&n==='/'){comment=false;i++;} continue; }
    if (inStr) { if (c===inStr&&scss[i-1]!=='\\') inStr=null; continue; }
    if (c==='"'||c==="'") inStr=c;
    else if (c==='/'&&n==='*') comment=true;
    else if (c==='{') depth++;
    else if (c==='}'){ depth--; if(depth<0) return false; }
  }
  return depth===0 && !inStr && !comment;
}
```
Opsional: panggil `sass` bila ada (`child_process`) dengan `--load-path=node_modules`; kalau tak ada, brace-check cukup (deterministik, no dep). Masukkan hasil ke detail check `scssCompiles`.

**Test:** `scss = ".foo { color: red"` → check fail.

---

## FASE 1 — Nilai & kelas-mati tertangkap (masih statis, tanpa browser)

### 1.1 — `styleFidelity` (check #18): literal numerik/hex SCSS vs fakta transkrip

**Masalah:** transkrip punya `style{size,weight,color}`, `padding:t/r/b/l`, `gap`, `radius`, `x/y/w/h` per node; verify tidak membaca satupun. `.h1 #555` vs desain `#000` tak terdeteksi.

**Fix `src/lib/verify.mjs` — check #18 `styleFidelity`:**

Rancangan matching node→SCSS: transkrip tak berisi selector class (itu di domain agent). Matching paling andal = **melalui teks/label** (title → rule `.h1`; label field → rule `.control-label`) + posisi/urutan. Terapkan **keberadaan nilai**, bukan semua node (terlalu banyak false-positive):

```js
function checkStyleFidelity(scss, html, transcript) {
  // Ambil fakta kunci dari transkrip:
  //  - title text + style {size,weight,color}
  //  - divider bg (hr)
  //  - container padding (top frame)
  //  - radius tiap frame r:N
  //  - gap tiap group gap:N
  const facts = extractDesignFacts(transcript);  // [{kind:'title', text, color, size}, ...]
  // Cari di SCSS: nilai-nilai yang sama ada?
  const missing = [];
  for (const f of facts) {
    const s = normalizeScss(scss);  // lowercase hex, strip ws
    if (f.kind === 'title-color' && !hasHex(s, f.color)) missing.push(...);
    if (f.kind === 'radius' && !/\b6px\b|6/.test(...)) ...
  }
  // Threshold: minimal nilai kunci ada (≥80%?); jangan hard-fail pada radius kecil
}
```

**Detail konkret & nilai aktual (slice-11):**
- `title: "Ubah tagihan" #000000 16px 500` → cek SCSS punya `.h1 { color: #000(#000000); font-size: 16px; font-weight: 500 }`. slice-11 `#555` → fail.
- `divider bg:#fdd835` → cek ada `#fdd835` di SCSS/inline html.
- Container: `group#… pad:20/20/20/20`? (slice-11 .content `padding: 5px 20px 20px` — XML frame `paddingTop:20`; konflik corpus diselesaikan di 0.11)
- Filter field: `r:6` → cek `.form-control` radius 6px (atau via registry custom).
- Bulk `gap:10` → cek `.bulk-actions { gap:10px }` atau margin idiom project.

**Penting — avoid false-positive**: transkrip mengukur **desain**, tapi output **harus pakai idiom project** (token/class, bukan hex mentah). `styleFidelity` tak boleh menuntut nilai persis untuk tiap node; tuntut **keberadaan nilai kunci yang tak bisa diganti idiom** (warna aksen yang bukan token, radius yang bukan standar, dst). Tambah `designTokens` dari conventions → nilai yang cocok token dianggap hadir.

**Test:** slice-11 fixture → check fail `h1 #555`. Golden → pass (nilai cocok/idiom ada).

---

### 1.2 — `loadedClassRegistry` — kelas ter-load nyata (bukan vocab HTML usage)

**Masalah:** vocabulary dari `class="…"` usage, bukan dari stylesheet. `col-12`, `search-col` dipakai tapi tak menghasilkan CSS di bill → kelas mati lolos verify & `col-12` lolos TRIVIAL_CLASS.

**Fix `src/commands/detect.mjs` (tambah registry) — resolve `angular.json` → style chain → selector:**

```js
async function extractLoadedClasses(projectDir) {
  // 1) baca angular.json → architect.build.options.styles[] (bisa node_modules path)
  // 2) resolve tiap file .scss/.css; follow @import chain (relative + node_modules)
  // 3) parse selector di tiap file (regex naive selector-extractor)
  // 4) tambahkan ke project-context.json sebagai `loadedClassRegistry`: [{name, file}]
}
```
SCSS yang di-import via `@import "bootstrap"` (pilar `styles.scss:2`) — parse file SCSS yang **benar-benar** ter-referensi dari styles list (bukan seluruh repo). Untuk file SCSS yang `@import` variabel/mixin, parse setelah **resolve nilai util**; butuh scope kecil: registry cukup untuk **class** (bukan nilai). Bila parse SCSS murni susah (mixin), **fallback kompilasi**: jalankan `sass --load-path` bila tersedia; kalau tidak, file `.css` di `dist/` (sudah ter-kompilasi) bisa jadi sumber (bill punya `dist/…/styles.css`).

**Data yang dihasilkan (contoh bill dist css):**
```
{ "loadedClasses": ["row","col-md-1",…,"mt-0","mt-1",…,"btn-block","d-flex","justify-content-end",…],
  "absent": { "col-12": "hanya .p-col-12 ada (PrimeNG prefix)", "mr-2": "0 rule", "gap-2": "0 rule", "w-100": "0 rule" } }
```

**Fix `verify.mjs:383-407 checkInventedUtility`:**
- Ganti dasar legalitas dari `TRIVIAL_CLASS` + `classVocabulary` → **`loadedClassRegistry`**. Kelas yang dipakai di HTML tapi tak ada di registry & bukan dari SCSS komponen sendiri → FAIL.
- Khusus `col-*`: hapus `col-(-N)` dari TRIVIAL_CLASS bila registry bilang tak ada; bila `col-12` tak ter-load → fail dengan hint "pakai `col-xs-12` (BS3)".

**Fix `conventions.mjs:19 TRIVIAL_CLASS`:** jangan hardcode whitelist grid abadi; biarkan registry yang memutuskan. Pertahankan hanya base benar-umum (`row`, `container`, `col-xs-12` kalau BS3).

**Test:** fixture html pakai `col-12` dengan registry yang tak memuatnya → fail. `col-xs-12` (ada di BS3) → pass. **Test integrasi** bill: detect pada repo bill → registry berisi `.mt-4`, tak berisi `.mr-2`.

---

## FASE 2 — Stamping & rendering oracle

### 2.1 — `stamp-and-pair` ground-truth yang benar

**Masalah:** `verify`/`referee` menautkan komponen dengan transkrip/XML pertama di `.sliceui/` (lihat 0.6 #2-3). Tak ada jaminan pasangan yang benar.

**Fix (sudah di 0.6)** plus: saat **generasi**, agent harus menulis header `// Generated by SliceUI from <name>.xml` di setiap file. `verify` membaca header dan **menggunakan transkrip `meta.image` / file xml yang namanya cocok** — bukan first-match. `referee` ikut.

### 2.2 — Rendering oracle: jawab fork (a)/(b) dulu

**Masalah (dari analisis):** tak tahu apakah miss muncul di komponen ter-isolasi (a) atau baru di shell nyata (b) — bill membuktikan visual 100% dari global class → hipotesis (b).

**Implementasi minimum yang menjawab fork — `sliceui render-probe`:**

Di dalam repo sliceui (bukan plugin) tambah command `render-probe` yang **bukan** bagian dari pipeline wajib, tapi dipakai user/CI:

```js
// src/commands/render-probe.mjs (baru)
// Prasyarat: project sudah jalan (ng serve) ATAU ada route harness yang dimuat.
// 1) buka URL: <devserver>/sliceui-preview/<name>  (route throwaway yang instansiasi komponen
//    dengan global styles + library nyata — tambahkan route ts di project bila perlu)
// 2) Playwright (devDependency) navigasi, networkidle + fonts.ready + 250ms
// 3) dua viewport: 1280×832 desktop + 342×684 mobile
// 4) export: screenshot PNG + probe getComputedStyle/getBoundingClientRect utk sejumlah
//    invariant (radius select, warna hover dropdown, posisi tombol Cari, box table)
// 5) simpan .sliceui/render/<name>/{desktop,mobile}.png + probe.json
```

Perbandingan deterministik dengan **transkrip**:
```js
// probe.json: { element:'cari-button', box:{x,y,w,h}, computed:{display,color,background,…} }
// diff vs transkrip: box.w ≈ col-width (matching by posisi), radius, warna — toleransi 1-2px / hex
```
Mode B (agent-in-loop, opsional): kirim screenshot + "bandingkan dgn desain, perbaiki" (pola s2c system_prompt) — max N iterasi.

**Anti-false-negative**: buat probe **fail-closed**: kalau Playwright tak bisa launch, exit merah + pesan "install playwright" (JANGAN disable diam-diam seperti s2c).

---

## FASE 3 — Hulu & ekosistem

### 3.1 — Schema kaya: variant + border/stroke + shadow/opacity

**Masalah:** `figml-parse.mjs:119` DROP `VARIANT/BOOLEAN/INSTANCE_SWAP`; `:87` SKIP `strokes/fills/componentProperties`. XML deklarasi `Type="secondary"` (bulk button bill) hilang → resolve tak bisa pilih `btn-secondary`.

**Fix `figml-parse.mjs`:**
```js
// 1) jangan drop variasi bukti-nyata:
if (type === "VARIANT" && attrs.name === "Type") {
  // simpan sebagai node.variant = attrs.value (bukan drop)
}
// 2) SKIP_TAGS: hapus "strokes" dari skip utk node yang perlu; parse stroke → node.border = {color, weight}
//    (stroke weight: attrs strokeWeight / child; bila absen, simpan color saja)
// 3) opacity: parse attrs.opacity → node.opacity
```
**Transcript schema (`transcript-schema.mjs:68-77`):** tambah field opsional `variant`, `border`, `opacity`, `shadow` di validasi layout node. `LAYOUT_TYPES` jangan diubah (type tetap group/button); variant = properti tambahan.

**Update resolve untuk membaca `variant`:** bila node punya `variant:"secondary"` dan vocab punya `btn-secondary` → resolve ke situ (0.8).

### 3.2 — Fidelity non-self-referential + nilai (bukan boolean)

**Masalah:** `fidelity.mjs:46` `transcript = parseFigml(xml)` — oracle sama; `preservedFor` (:153-168) hanya boolean (`Boolean(node.padding)`), tak bandingkan nilai.

**Fix `fidelity.mjs`:**
```js
// 1) extractGroundTruth: walker XML INDEPENDEN (parse langsung, bukan via parseFigml)
//    — duplikasi SKIP/DROP logic di walker uji, supaya blind spot parser terdeteksi.
// 2) preservedFor: bandingkan NILAI (dengan toleransi rounding 1px / hex case-insensitive).
//    padding 4 vs 24 → 'drifted', bukan 'preserved'.
```

### 3.3 — `resolveNode` diperluas: button/input/text/card

**Masalah:** `resolve.mjs:41-60` hanya 2 cabang (badge/icon); tombol `btn-primary`/`btn-secondary`, input `form-control`, text heading tak ter-resolve → agent mengarang.

**Fix `resolve.mjs`:**
```js
function resolveNode(node, corpus, vocab) {
  if (badge...) ...
  if (icon...) ...
  // BARU:
  if (node.type === "button") {
    const variant = node.variant;                     // "primary"|"secondary"|"default" (dari 3.1)
    const classes = corpus.filter((c)=>/\.btn(-|_)/.test(c.selector)).map(...);
    if (variant === "primary" && vocab.has("btn-primary")) return {kind:"button", resolved:[{kind:"class",value:"btn btn-primary"}]};
    if (variant === "secondary" && vocab.has("btn-secondary")) return ...btn-secondary;
    // fallback native: button + inline style (bg/radius dari node)
  }
  if (node.type === "input" && vocab.has("form-control")) return form-control;
  if (node.type === "text" && node.style?.size) return typography from designTokens;
  return null;
}
```
**Test:** node button variant primary + vocab btn-primary → resolve `btn btn-primary`.

### 3.4 — `loadedClassRegistry` → registry sebagai kebenaran class (bukan TRIVIAL whitelist)

Digabung dengan 1.2. Selain verify, ini jadi **sumber pemilihan idiom di resolve & prompt** — agent membaca "kelas mana yang hidup di CSS", bukan mengarang.

---

## Matriks verifikasi test (per fase)

| Fix | File test | Fixture | Expected |
|---|---|---|---|
| 0.1 | `test/verify.test.mjs` | golden omit toggle-caret | `warn≥1, fail=0` |
| 0.2 | `test/verify.test.mjs` | corpus block vs body kosong/benar | FAIL / PASS |
| 0.3 | `test/verify.test.mjs` | ts-comment "Simpan" | FAIL |
| 0.4 | `test/verify.test.mjs` | XML filter "Terapkan" | FAIL (no button) |
| 0.5 | `test/verify.test.mjs` | `col-md-3` tanpa fallback | WARN/FAIL |
| 0.6 | `test/verify.test.mjs` | dir 2 komponen tanpa name | FAIL minta name |
| 0.7 | `test/verify.test.mjs` | `fa-x {color:#333}` vs design `#f44444` | FAIL |
| 0.8 | `test/resolve.test.mjs` | icon caret-down; badge "Dibatalkan" | `fa-caret-down`; `-cancel` |
| 0.9 | `test/verify.test.mjs` | `::ng-deep` tanpa `:host` | FAIL |
| 0.10 | `test/verify.test.mjs` | SCSS brace unbalanced | FAIL |
| 1.1 | `test/verify.test.mjs` | slice-11 `h1 #555` | FAIL |
| 1.2 | `test/detect.test.mjs` | bill repo fixture | registry benar |
| 3.3 | `test/resolve.test.mjs` | button variant primary | `btn btn-primary` |

## Urutan commit yang disarankan

1. `feat(v0.13.0): styleFidelity check #18 + loadedClassRegistry` (inti: nilai & kelas mati — ini yang paling langsung menutup keluhan user).
2. `fix: scssCoverage block-body + textCoverage rendered + filterRowButton generik + gridColumns col-N`
3. `feat: golden vocabulary merge via references + advisory/required corpus split`
4. `fix: resolve context-first (teks/variant) + schema variant/border/opacity + noBareNgDeep + scssCompiles`
5. `fix: stamp-and-pair + gate math (skip-ratio) + project-root resolution`
6. `feat: render-probe (render oracle) — jawab fork (a)/(b)`
7. `feat: resolve button/input + fidelity value-equality`

> **Catatan:** item 3–7 saling mempengaruhi test; jalankan seluruh suite `node --test test/` di tiap commit. Jangan commit golden/expectation tanpa validasi manual.
