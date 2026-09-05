# SliceUI Gap Analysis — "Verify hijau di terminal, UI tetap miss di localhost"

> ⚠️ **SUPERSEDED (2026-09-05, v0.13.1):** catatan point-in-time dari audit **v0.12.1**. Sebagian besar fix-nya sudah dilaksanakan, dan **path yang dirujuk (`src/lib/verify.mjs`, `src/lib/conventions.mjs`) sudah pindah** ke `src/framework/angular/` oleh reorg. Lihat `PLAN-framework-reorg-e2e.md` + `src/framework/angular/` utk kondisi terkini; jangan pakai path di sini sbg acuan kerja.

> **Tanggal:** 2026-09-05 · **Versi diaudit:** sliceui-skill 0.12.1 (HEAD `a6ca11a`)
> **Metode:** audit 10-agen (9 riset paralel — verify gates, SKILL.md, diff artefak hasil-vs-golden, realita CSS project bill, 3 lensa benchmark `screenshot-to-code`, taksonomi defect Angular field, mesin resolve — + 1 kritisi independen) + verifikasi mandiri.
> **Pertanyaan pusat:** mengapa `sliceui verify` exit 0 padahal di localhost button/padding/margin/layout masih miss?

---

## 0. Executive Summary

**Verify hijau ≠ UI benar karena verify mengukur teks, bukan render.** Semua 17 check di `verify.mjs` adalah regex/string-matching terhadap isi file `.html/.scss/.ts`. Tidak ada satu pun yang mengeksekusi, me-render, atau memuat komponen — `package.json` bahkan tidak punya dependency browser (hanya `fast-glob`, `fast-xml-parser`, `typescript`). Sementara defect yang dikeluhkan user (button salah, padding/margin off, layout patah) hidup persis di ruang yang tidak bisa dilihat analisis teks: **CSS cascade, computed style, grid runtime, specificity `::ng-deep`, dan kelas mati**.

Tiga fakta yang menjelaskan hampir semua kejadian "hijau tapi salah":

1. **Transkrip PUNYA data untuk menangkap miss — verify tidak memakainya.** Transkrip membawa geometri absolut `[x,y W×H]`, `pad:t/r/b/l`, `gap:`, `r:` (radius), dan `style {size,weight,color}` per node (203 node bergaya di slice-11). Nol check membaca field numerik ini. `verify.mjs` hanya membaca `n.text`, `n.type`, `n.bg`, `n.children` dari transkrip.
2. **Fidelity mengukur XML→transkrip, bukan desain→kode.** `computeFidelity()` membandingkan XML dengan transkrip yang dihasilkan parser yang sama (self-referential). Satu-satunya fungsi yang membandingkan kode ter-generate (`scssCoverage(exemplar, generated)` di `fidelity.mjs:268`) **diimpor di `verify.mjs:25` tapi tidak pernah dipanggil** — check #1 memakai versi lemah buatan sendiri (token-presence).
3. **CSS global project bill adalah campuran 3 sistem** — Bootstrap 3.3.7 (pilar) + **Bootstrap Grid 5.1.3** (menyelipkan `mt-1..mt-5` rem-scale `!important`) + utilitas pilar sendiri (`.margin-top-N` step 5px). Konsekuensi: `mt-4` valid, tapi `mr-2`/`.gap-N`/`col-12` polos **tidak ada di CSS yang di-load** — mati diam-diam. `col-12` bahkan lolos dari check #17 karena dianggap `TRIVIAL_CLASS`.

Benchmark `screenshot-to-code` tidak menyelesaikan ini dengan metrik — merek juga tidak punya pixel-diff otomatis. Yang mereka punya dan SliceUI tidak: **loop render → lihat → fix**. Headless Chromium merender output, screenshot kembali masuk ke konteks model sebagai gambar, system prompt memaksa model membandingkan dan memperbaiki. Itu mekanisme tunggal dengan ROI tertinggi untuk dicuri.

**Rekomendasi inti (urut dampak):**
1. **Jawab dulu fork arsitektur (kritisi mengangkatnya sebagai pertanyaan belum-terjawab):** apakah miss render terjadi (a) di komponen ter-isolasi atau (b) baru muncul di app-shell nyata di bawah global stylesheet pilar/BS3-hybrid. Semua agen independen konvergen ke "bangun render layer" — tapi arsitekturnya (static geometry check vs browser-render gate) ditentukan oleh jawaban (a) vs (b). Karena bill-repo membuktikan visuals 100% datang dari global classes (komponen asli stylesheet-nya kosong), hipotesis kuat = **(b)** → gate harus berjalan di shell nyata, bukan harness ter-isolasi.
2. **Render gate (Layer 2)** — Playwright + route nyata app (bukan harness kosong): komponen ter-mount dengan pilar/BS3-hybrid global CSS + library. Mode A deterministik: probe `getComputedStyle`/box geometry vs transkrip. Mode B: screenshot kembali ke agent untuk bandingkan-dan-fix (pola s2c). **Catatan kritisi:** computed-style probe tidak bisa melihat cascade di harness ter-isolasi — cascade ADALAH konteks stylesheet di sekitarnya; probe hanya bermakna di shell nyata.
3. **Style-fact check statis (Layer 1.5, gratis)** — bandingkan literal numerik SCSS (padding/margin/radius/hex) dengan fakta transkrip; tangkap `h1 #555` vs desain `#000` tanpa browser.
4. **Tutup false-green murah** — nilai binding (bukan nama), textCoverage hanya di elemen ter-render, dead-import `scssCoverage` dipakai, perluas `relevantCorpus` ke family label/icon (badge `success`/`cancel` tanpa definisi CSS kini lolos hijau), `col-12`/kelas mati divalidasi terhadap CSS ter-load.
5. **Urutkan 3 akar penyebab (kritisi run-2)** — bundel mendukung tiga cerita berbeda: (a) check statis terlalu lemah untuk melihat render, (b) agent TIDAK PERNAH diberi nilai benar (SKILL.md:180 vs :218 kontradiktif, mt-4 diperintahkan sekaligus difailkan), (c) ground-truth XML/transcript salah-vektor (first-file `.find`, komponen↔transkrip tak di-stamp). **Fiksnya berbeda per penyebab** (perkuat value-level check / rewrite prompt rules dengan precedence terkunci / stamp-and-match source). Laporan memilih dominan = **(a) check lemah** sebagai masalah struktural inti, dengan (b) kontradiksi instruksi sebagai penguat yang harus dibereskan di Fase 0 #8, dan (c) mis-vectoring sebagai perangkap yang harus ditutup (Fase 0 #6, #15).

---

## 1. Anatomi masalah: di mana informasi hilang dan di mana verifikasi tidak melihat

```
XML (FIGML, exact)
  │  parseFigml — SKIP_TAGS buang strokes/fills detail, DROP VARIANT/BOOLEAN states
  ▼
Transcript (kaya: x/y/w/h, pad, gap, r, style per node; miskin: border, shadow, opacity, align, states)
  │  agent LLM — keleluasaan tak terbatas di: spacing→CSS, typography scale, warna widget, states, responsive
  ▼
Kode (.html/.scss/.ts)
  │  verify: 17 regex — hanya n.text/n.type/n.bg dari transkrip; 0 field numerik; 0 render
  ▼
"GREEN" ──▶ localhost: cascade BS3+BS5-grid+pilar, kelas mati, ::ng-deep, runtime library ≠ ekspektasi
```

### 1.1 Yang verify TIDAK bisa lihat (per check, dengan bukti)

Audit lengkap mekanisme 17 check (semua bukti `verify.mjs`):

| # | Check | Mekanisme actual | Kelas defect yang MUSTAHIL ditangkap |
|---|-------|------------------|--------------------------------------|
| 1 | scssCoverage | token selector `scss.includes(t)` — nama token muncul di mana saja, termasuk komentar | body dikosongkan/salah nilai; `::ng-deep` hilang (no-op di bawah encapsulation); block `:hover`/`:focus` dibuang (PSEUDO set diabaikan) |
| 2 | textCoverage | substring di `html + " " + ts` | teks ada di komentar TS / atribut `title` / elemen salah; dua label identik jadi satu tombol |
| 3 | tableBindings | nama atribut tag table PERTAMA saja | `[searchOptions]="false"` PASS; `[rows]="dataz"` (undefined) PASS → tabel kosong di localhost; table kedua tak terlihat; NgModule tak diimpor |
| 4 | classVocabulary | regex `-custom-` saja, status **warn** | kelas karangan di luar taksonomi (`filter-panel-new`); kelas di vocabulary tapi tak punya rule CSS (kelas mati) |
| 5 | anatomy | 2 regex ko-presensi tag | skeleton tak pernah bisa muncul (`isLoading` tak pernah true); table di bawah `*ngIf` always-false |
| 6 | mockRowCount | array literal terbesar + hitung koma | `Array.from({length:20})` → skip; array columns 20-entry memenuhi syarat padahal rows = 3 |
| 7 | noHashedSelectors | regex `_ngcontent` | `:host` hilang dari `:host ::ng-deep` (bocor global); `ViewEncapsulation.None` (tak pernah dibaca) |
| 8 | iconColor | regex `fa-X {color:#6hex}` | **warna netral salah tetap PASS** (`#333` untuk badge yang desainnya merah — whitelist netral); `#f44` 3-digit/rgba/variabel tak terlihat; warna di parent selector tak terlihat |
| 9 | phantomWrapper | 2 hardcoded string (`well`, `page-canvas`) | SEMUA wrapper lain (`content-body`, `card-wrapper`, extra `.row`) lolos; tidak ada perbandingan DOM-tree |
| 10 | ngxSelectBinding | presence `[(ngModel)]`+`(select)` per tag | FormsModule tak diimpor → dropdown mati runtime; handler typo `onSelet` tak ada di TS |
| 11 | rowAuth | regex `auth.X = true` di seluruh TS | flag di komentar/dead code PASS; flag di objek lain; override `= false` belakangan |
| 12 | filterRowButton | **hardcoded literal "Cari"** | label lain ("Search", "Terapkan") → check skip total; `<button *ngIf="false">Cari` PASS |
| 13 | buttonOrder | grep `row-reverse` — **tak pernah baca urutan XML** | DOM terbalik + `justify-content: flex-end` (idiom SKILL.md sendiri!) → skip green; check tak punya status pass yang reachable |
| 14 | tableOptions | nama atribut + regex bukti XML | `[paginationOptions]="null"` PASS |
| 15 | gridColumns | jumlah span `col-*-*` ≤ 12 per blok `.row` | `col-6` tanpa infix (BS4 style) → sum 0 → PASS; lebar via SCSS `flex: 0 0 40%` tak dihitung; nested row mis-segment |
| 16 | noTranslation | grep `\| translate` | `{{ t('key') }}`, `[innerText]` → teks jadi key di localhost |
| 17 | inventedUtility | whitelist + vocabulary + UTILITY_SHAPE | **kelas di vocabulary tapi tak punya rule CSS** (kelas mati: `search-col`, `col-12`) PASS; utility via `[ngClass]` tak terlihat; nilai salah (`mt-4` untuk gap 8px) PASS |

**Amplifier sistemik (aritmetika gate):**
- `pass = failCount === 0 && hasGroundTruth` — **warn dan skip tidak pernah memblok**. Komponen tanpa table/select/icon bisa 8/17 check skip dan tetap exit 0.
- `commands/verify.mjs:50-54` memilih file `.component.*` **pertama** yang cocok — memverifikasi dir yang berisi 2 komponen tanpa nama eksak bisa meng-gate komponen yang salah.
- verify/referee memasangkan komponen dengan transkrip/XML **pertama** ditemukan di `.sliceui/` — tanpa cek bahwa itu pasangan yang benar.

### 1.2 Dua false-green yang terbukti secara empiris (agen audit menjalankannya)

1. **scssCoverage pas walau idiom mati**: SCSS yang menulis `::ng-deep` hilang (→ no-op di bawah emulated encapsulation, styles tak menembus DOM library), atau menaruh nama token di komentar, atau membuang block `:hover`/`:focus` — semuanya **pass** check #1, karena cukup satu token bernama muncul di mana pun.
2. **textCoverage dipenuhi komentar TS**: label tombol fidelity-critical yang hanya muncul di komentar/config TS (bukan elemen ter-render) tetap menghasilkan pass.

### 1.3 Transkrip kaya, verify buta angka

`render-transcript.mjs` memancarkan per node: `[x,y w×h]`, `bg`, axis, `r:`, `gap:`, `pad:t/r/b/l`, `align`, dan `style {size/weight/color}`. `figml-parse.mjs` menghitung koordinat absolut dengan akumulasi offset parent. Artinya **data untuk menegakkan "padding 20px, radius 6, title #000 16px/500" sudah ada** — yang tidak ada adalah konsumennya di verify. Grep `n.padding|n.radius|n.gap|n.x|n.w|n.style` di `verify.mjs` = nol hit.

### 1.4 Kebocoran di hulu transkrip (schema gap)

- `SKIP_TAGS` membuang `strokes` (border), `effects` (shadow) tidak dibaca, opacity hanya di placeholder text, text-align tidak masuk schema.
- `DROP_TYPES` membuang `VARIANT/BOOLEAN` → **state hover/disabled/variant hilang total dari ground truth** — agent tidak diberi tahu bahwa design punya state.
- `Math.round` pada x/y/w/h (subpixel loss), `fonts: []` selalu kosong.
- Fidelity oracle self-referential: `computeFidelity` menghasilkan transkrip-uji dengan `parseFigml` yang sama dengan yang dipakai ekstraksi ground truth — blind spot parser tidak mungkin terdeteksi (<100% tak akan pernah terjadi karena bug parser). `preservedFor` menguji kebenaran boolean (`Boolean(node.padding)`), bukan kesetaraan nilai — padding 4 tercatat "preserved" untuk XML padding 24.

---

## 2. Studi kasus terukur: slice-11 vs golden vs desain (ubah-tagihan.xml)

Perbandingan tiga arah (desain = transkrip/XML, slice-11 = output lama, golden = referensi terkurasi user). **Temuan empiris (diverifikasi jalankan ulang verify dari git, `Lampiran C`):**

> **Bentuk kegagalan yang reprodusibel** (framing yang disarankan kritisi run-2 dan bertahan terhadap sengketa state): slice-11 **lulus 16/16 @ v0.11.1** (generation-time, sebelum check #17 ada — dijalankan ulang dari `f2089b4`: 0 fail, 0 warn). Di **HEAD v0.12.1** slice-11 **merah — tetapi hanya untuk 1 alasan**: `inventedUtility` (`mt-4`, `w-100`, `mr-2`, `mt-2`). Artinya: verify merah untuk alasan yang **salah** (kelas utility atomik) sementara **semua defect visual** yang dikeluhkan (title `#555`, radius 7px, missing `(selectedRow)`, `table-wrapper`, no `col-12`) **lolos tanpa satu fail pun**. Ini lebih tajam daripada sekadar "green palsu" — verify tidak membedakan kelas yang benar dari spacing/warna yang salah pada output yang sama.

| Fakta desain (transkrip/XML) | slice-11 (verify green) | golden | Klasifikasi |
|---|---|---|---|
| Title `#000000` 16px/500 | `.h1 { color: #555 }` ❌ | `#000` ✓ | **(2) statis-catchable** — XML `fill color="#000000"`, tidak ada check warna teks |
| Radius select `r:6` (XML `cornerRadius="6"` di 8 field) | `border-radius: 7px` ❌ | `6px` ✓ | **(2)** — konflik corpus (7px) vs XML (6px) tak terdeteksi |
| Label field `#555` 12px/600 | tak di-style (default BS3) ⚠️ | `.control-label` corpus | **(2)** |
| Tombol Cari full-width kolom | `w-100` (BS4! mati di CSS bill) ❌ | `btn-block` (BS3) ✓ | **(1)** — v0.12.0 menangkap, hanya via vocabulary, bukan via pengetahuan CSS hidup |
| Tombol bulk outline — **XML mendeklarasikan `variantProperties Type="secondary"`** | kelas karangan `bulk-btn-outline` + SCSS tulisan tangan ❌ | `btn-secondary` ✓ | **(2)** — evidence XML eksplisit diabaikan; `classVocabulary` hanya scan `-custom-*` |
| Jarak tombol bulk (XML `gap:10`) | `mr-2` (mati — 0 rule `.mr-N`) ❌ | `gap: 10px` SCSS ✓ | **(1)** ditangkap v0.12.0 |
| Alignment tombol Cari — **XML button `height="40"`** | `mt-4` + hack `height: 41px` (angka salah: 41 = tinggi field, bukan tombol) ❌ | `mt-4` ✓ | **(2)+(3)** — magic number tak berprovenans; `mt-4` valid hanya via lapisan BS5-grid |
| Fallback mobile | tanpa `col-12` ❌ | `col-md-N col-12` (10 kolom) ✓ | **(2)** — `col-12` lolos #17 (TRIVIAL_CLASS) padahal **mati di CSS bill** (hanya `p-col-12` PrimeNG) |
| Binding seleksi baris (`[checkboxColumn]` ON) | `(selectedRow)` hilang ⚠️ | ada ✓ | **(2)** — asymmetris: checkboxColumn ⇒ selectedRow seharusnya required (mirror tableOptions) |
| Wrapper table | `table-wrapper` phantom ⚠️ | tanpa ✓ | **(2)** — phantomWrapper hanya tahu `well`/`page-canvas` |
| Status label width (XML badge w:100 `r:5`) | `92px` fixed ❌ | `auto` ✓ | **(2/3)** |
| SCSS duplikat | `.search-options button` dobel (byte-identik 2×) ⚠️ | sekali ✓ | **(2)** — dedup lint |

**Tiga temuan sistemik tambahan dari diff empiris:**

1. **Verify v0.12.1 GAGAL golden reference — TAPI hanya bersyarat pada ground-truth eksternal.** Diverifikasi mandiri (`Lampiran C`): golden `reference-bulk-filter-table` **tidak punya conventions.json/transcript/XML sendiri** (repo `hope-result` hanya berisi komponen). Diuji terhadap ground-truth slice-11 (desain yang sama), golden merah 2: `scssCoverage` (2/20 `ngx-select__toggle-caret`/`__toggle` — advisory yang sengaja tak dipakai golden) + `inventedUtility` (`mt-4`, `mt-0`, …). **Nuansa kritisi run-2:** di repo golden sendiri, `inventedUtility`/`scssCoverage` akan SKIP (no conventions) → "gate memblok output benar" tidak bisa berdiri sebagai klaim tak-bersyarat; yang pasti benar adalah **vocabulary/corpus ground-truth belum menyerap golden** — kelas yang user kurasi (`mt-4`, `col-12`, `gap`) tak terdaftar legal.
2. **`references: []` — mekanisme golden (fitur terbesar v0.12.0) belum ter-wiring** di `.sliceui/` slice-11; konfigurasi bill juga masih `references: []`. `readGoldenReferences` ada tapi tidak pernah dibaca agent karena tak didaftarkan.
3. **Corpus menang atas XML secara de-facto**: `.content padding 5px 20px 20px` (SKILL.md:151 + kedua output) padahal XML `paddingTop="20"` tanpa top-5 — instruksi prose meng-override "XML owns appearance" tanpa check yang menegakkan siapa yang menang.
4. **Belum ada rendering oracle** (kritisi run-2, pertanyaan paling penting): tak ada agen yang me-render desain untuk menetapkan ground-truth visual nyata. XML (r:6, badge w:100), golden, dan corpus **saling tidak sepakat** (lebar badge 92 vs 100 vs auto; border 1 vs 1.3px karena XML mengomit strokeWeight; alignment `mt-4`). Klaim "salah di localhost" selama ini diadili terhadap teks XML/golden yang — menurut bundel sendiri — tidak konsisten dengan desain pada border/badge/alignment. Sebelum membangun perbaikan, langkah audit berikut harus (a) screenshot export desain sebagai oracle, (b) render komponen di shell nyata, (c) diff keduanya.

**Kesimpulan studi kasus:** dari ~14 selisih visual material, v0.12.x menutup 4 (semua via satu check). Sisanya: ~9 statis-catchable, ~5 render-only. Bahkan golden drift dari XML (padding, radius library) — golden lebih baik karena kurasi manusia, bukan karena pipeline menegakkannya. `resolved.json` (v0.12.0) baru men-resolve 30 leaves — dan **18/30 resolusi salah** (caret/pencil `#03337b` → `fa-search` karena color-first; badge teks "Dibatalkan" → `label-custom-warning` padahal `-cancel`): teks sibling + nama komponen XML harus jadi sinyal utama, warna tie-breaker.

---

## 3. Realita lapangan: CSS global project bill (temuan paling tak terduga)

> ⚠️ **Koreksi metodologi (dari agen bill-repo):** "komponen kanonik" `edit-bill-end-date` di working-tree yang dipakai sebagai pola adalah **output SliceUI yang belum di-commit**. Asli buatan tangan di git HEAD stylesheet-nya **kosong** — 100% visualnya datang dari kelas global; satu-satunya styling lokal adalah taksonomi badge `label-custom-*` via `:host ::ng-deep`. Konfirmasi: di repo itu nyaris semua visual = global classes. Menemukan "kanonik" yang salah = risiko metodologis nyata bagi detect/golden reference — verifikasi bahwa pola yang dibaca bukan output SliceUI sendiri adalah prasyarat.

Global styles bill (`angular.json` → `pilar/styles.scss` → compiled `dist/styles.css` 1.15MB) adalah **sandwich tiga era**:

| Lapisan | Asal | Kelas yang dibawa | Efek |
|---|---|---|---|
| Bootstrap 3.3.7 | vendored pilar `_bootstrap.scss` | `col-md-*`, `row` (gutter 15px), `btn-block`, `form-group`, `control-label` | grid utama, idiom BS3 |
| **Bootstrap Grid 5.1.3** | `grid-system/` pilar ("experimental") | `mt-1..mt-5`, `p-1..p-5`, `mx-auto` (**rem scale + `!important`**) | **menyelipkan utilitas BS4/5-style** — `mt-4` jadi valid!
| Utilitas pilar | `_utilities.scss` | `.margin-top-N`, `.padding-x-N` (px step 5, 0-100) | namespace sendiri, jarang dipakai komponen |

Verifikasi hitung-hitungan di `dist/styles.css`:

```
.mt-N rules        : 6   (mt-0..mt-5, dari BS5-grid)  → mt-4 VALID
.mr-N rules        : 0   → mr-2 MATI
.gap-N rules       : 0   → gap-2 MATI
col-12 (non-p-)    : 0   → col-12 MATI (hanya p-col-12 PrimeNG)
.btn-block rules   : 6   → VALID
.d-flex / justify-content-end : ada → VALID
```

**Implikasi desain untuk SliceUI:**
- Check #17 `inventedUtility` bertanya "apakah project MEMAKAI kelas ini di HTML-nya" (vocabulary dari pemakaian) — pertanyaan yang benar untuk Angular monorepo adalah **"apakah kelas ini MENGHASILKAN CSS di stylesheet yang ter-load"**. `search-col` dipakai di HTML kanonik (vocabulary ✓, pass #17) tapi tidak punya definisi CSS di mana pun — kelas mati yang di-copy turun-temurun (cargo cult). `col-12` lolos sebagai trivial — dan mati di project ini. `TRIVIAL_CLASS` (conventions.mjs:19) meng-whitelist SEMUA `col-*-N` — termasuk yang tidak pernah di-generate project.
- **False-green baru (ditemukan agen bill-repo):** `relevantCorpus` (verify.mjs:125-139) hanya mengikutsertakan corpus family **select|table|layout** — jadi badge `label-custom-success`/`label-custom-cancel` yang di-emit TS string-template tapi **tidak punya definisi CSS apa pun yang reachable** (slice-11 hanya mendefinisikan `-warning`) tetap hijau. Perluas ke family label/icon dengan requirement per-kelas-terpakai, bukan token-presence.
- **`references: []` di config bill** — golden tidak ter-wire di production; dan skill's own golden (`reference-bulk-filter-table`) juga berlabel "Generated by SliceUI" → verifikasi golden bukan output generator adalah prasyarat sebelum golden dipakai sebagai pola.
- Determinisme: sumber kebenaran kelas-utility bisa **dibaca dari CSS ter-kompilasi/ter-load** (`angular.json` styles + import chain SCSS) — ini deterministic, lokal, tanpa browser. Detect/init bisa membangun `loadedClassRegistry` (parse selector dari CSS yang benar-benar di-compile) dan verify #17/`classVocabulary` bertanya ke registry itu, bukan ke vocabulary pemakaian HTML. **Kaveat kritisi:** jangan andalkan "baca versi CSS dari package.json" — tidak ada package `bootstrap`; versi hanya tersirat dari pilar hybrid (BS3.3.7 + port BS5-grid + utilitas sendiri). Registry harus dari stylesheet nyata, bukan dari nama package.

---

## 4. Benchmark screenshot-to-code: apa yang dicuri, apa yang tidak

### 4.1 Arsitektur feedback loop mereka (yang SliceUI tidak punya)

Tiga pilar (bukti: `backend/preview_screenshot/`, `backend/agent/tools/screenshot_preview.py`, `backend/prompts/system_prompt.py:19`):

1. **`screenshot_preview` = tool untuk model.** Headless Chromium (Playwright) merender file HTML saat ini pada **dua viewport** (desktop 1280×832, mobile 342×684), full-page, dengan disiplin tunggu: `wait_until="networkidle"` (timeout 15s, fail-soft), `document.fonts.ready`, + 250ms settle. PNG dikembalikan **sebagai gambar multimodal ke dalam konteks percakapan model yang sama** — bukan ke diff-engine. Detail wiring: `ToolMultimodalPart(display_name, mime_type, data)` dilekatkan ke `ToolExecutionResult`; setiap provider meng-inline-kan bytes sebagai image block (`openai.py:496-534`, anthropic `provider.py:445-493`). Browser tunggal di-share lintas capture (lazily launched, `--no-sandbox`).
2. **Mandat di system prompt:** "always call screenshot_preview once after create_file or after edit_file … If you spot visual problems (broken layout, overlapping elements, wrong spacing or colors), fix them with edit_file." Loop koreksi model-driven sampai 30 tool-turn, dengan ceiling biaya (`GENERATION_MAX_COST_USD`) dan filosofi fail-loud (`EmptyOutputError` — run tanpa output = failure yang di-retry, bukan sukses kosong).
3. **Preview live untuk manusia:** iframe side-by-side input vs output sepanjang waktu; pilihan varian (2 model paralel) oleh user.

### 4.2 Apa yang TIDAK mereka punya (anti-target)

- **Tidak ada pixel-diff/SSIM otomatis.** Metrik satu-satunya = rating manusia 1-4, rata-rata 3 run, dataset 16 gambar (di-drop manual ke folder; link download masih "TODO"). Satu threshold numerik di seluruh codebase (IoU ≥ 0.5) hanya menilai asset-extraction, bukan halaman.
- **Prompt MEREKA lebih miskin daripada SliceUI.** "Make the web page look exactly like the screenshot" — tanpa disiplin pixel/grid/warna. Fidelity visual mereka datang DARI LOOP RENDER, bukan dari prompt. (Kontras: transkrip SliceUI jauh lebih kaya sebagai grounding artifact.)
- Render gate mereka bisa **hilang diam-diam**: probe Chromium gagal → tool di-disable tanpa error → generation jalan tanpa verifikasi. Jangan tiru ini.

### 4.3 Pelajaran per-mekanisme → aplikabilitas ke Angular monorepo

| Mekanisme s2c | Nilai untuk SliceUI | Adaptasi yang perlu |
|---|---|---|
| Render + screenshot kembali ke model | **Tinggi — the big steal** | Bukan `set_content(html)` — butuh harness Angular (route throwaway yang instansiasi komponen + import global styles project + library) atau navigasi ke dev server yang sudah jalan |
| Dua viewport (desktop+mobile) | Tinggi — miss padding/layout muncul asimetris antar viewport | Sama persis; tambahkan width dari meta transkrip |
| `networkidle` + `fonts.ready` + settle 250ms | Tinggi — render deterministik | Tambah: tunggu skeleton→table swap, `setTimeout` CD Angular |
| Asset extraction (crop deterministik dari pixel sumber) | Sedang | Untuk logo/gambar di screenshot tier; XML path sudah punya fills — kurang relevan |
| Update-prompt file-snapshot (`<current_file>` + `<change_request>`) | Sedang | Pola bagus untuk loop fix verify: sertakan file + temuan check |
| Design-system injection `<design_system>` + prioritas eksplisit | **Tinggi** | SliceUI sudah punya `conventions.json` lebih kaya — tapi belum di-inject sebagai blok ber-tag dengan klausa prioritas ke prompt generate |
| Fail-closed render gate, budget ceiling, EmptyOutputError | Tinggi | Prasyarat loop otonom apa pun |
| Rating manusia + varian paralel | Rendah-sekarang | Nanti, kalau eval set XML SliceUI dibekukan |

### 4.4 Prompt-engineering yang layak diadopsi langsung

- **Checklist properti** dari mode video mereka ("Pay close attention to background colors, text colors, border styles…") → tambahkan ke transcribe-prompt/instruksi generate.
- **Anti-cheat**: melarang menempel raster fill desain sebagai `<img>` pengganti layout nyata; larangan guess asset.
- **Hasil tool = diff + baris berubah** (pola `edit_file`): temuan verify sebaiknya menyertakan snippet yang menyalahi + saran perbaikan, bukan hanya nama check.
- **Normalisasi referensi yang merusak render** (pola `babel_cdn.py`): normalisasi pin CDN icon-font/material theme sebelum render.

---

## 5. Taksonomi defect field (Angular + BS3 + shared library) — top 8 penyebab "green tapi salah"

Dari taksonomi lengkap 20+ kelas, diurut berdasarkan frekuensi field, dengan deteksi termurah:

| # | Defect | Contoh nyata | Deteksi termurah |
|---|---|---|---|
| 1 | **`::ng-deep` under-/over-reach** | `:host` hilang → styles bocor global/salah target; block state dibuang | Statis: full-chain + pseudo-block matching (perbaiki check #1) |
| 2 | **Utility/class version drift** | `w-100`/`mr-2`/`gap-2` BS4 di project BS3 | Statis: loadedClassRegistry dari CSS ter-kompilasi |
| 3 | **Kelas mati / cargo cult** | `search-col` dipakai kanonik tanpa definisi CSS | Statis: cross-check vocabulary ↔ CSS ter-load |
| 4 | **Grid stacking fallback hilang** | `col-md-3` tanpa `col-xs-12`/`col-12` → tak pernah stack di mobile | Statis: require fallback saat ada `col-md-*` |
| 5 | **Binding mati runtime** | `[rows]="dataz"` undefined; `(select)="onSelet"` typo; FormsModule tak diimpor | Statis-TS: resolve binding target ke deklarasi; module check |
| 6 | **Spacing scale mismatch** | desain 8px → `mt-4` (24px); padding 20 → 15 | Render probe / statis literal-vs-transkrip |
| 7 | **Cascade/specificity collision** | theme global menimpa `border-radius` komponen | Render: `getComputedStyle` probe pada selektor corpus |
| 8 | **State hilang** (hover/focus/disabled/loading/empty) | tak ada karena parser DROP VARIANT | Schema fix di hulu + checklist properti di prompt |

---

## 6. Peta jalan yang direkomendasikan (win solution)

### Fase −1 — Perbaiki regresi v0.12.1 (segera, sebelum apa pun)
0a. **Verify jangan gagalkan golden**: masukkan kelas golden (`mt-4`, `mt-0`, `mb-3`, `p-0`, `btn-block`, `col-12`) ke vocabulary legal via merge `references` (bukan hardcode), dan turunkan corpus block yang sifatnya advisory (`ngx-select__toggle-caret`, `__toggle`) ke warn — required vs advisory harus terpisah.
0b. **Wire `references`**: config bill harus menunjuk `reference-bulk-filter-table`; tanpa itu fitur golden = mati di lapangan. Validasi golden bukan output generator (komponen kanonik working-tree bill ternyata output SliceUI — lihat §3).
0c. **resolve.mjs color-first menyesatkan** (dari sampel resolved slice-11 — indikasi, bukan statistik; §7): resolusi icon mengutamakan warna (`FA_ICON_COLORS['#03337b'][0]` menang) sehingga caret & pencil ikut jadi `fa-search`, dan badge berteks "Dibatalkan" ter-resolve `label-custom-warning`. Perbaikan terstruktur: sinyal utama = teks sibling + nama komponen XML, warna = tie-breaker; validasi silang dengan TS yang di-emit agent (yang justru memakai `label-custom-cancel`/`fa-pencil` dengan benar di beberapa tempat).
0d. **Perluas `relevantCorpus` ke family label/icon** (verify.mjs:125-139) dengan requirement per-kelas-terpakai: badge `label-custom-success`/`-cancel` yang di-emit tapi tak punya definisi CSS reachable → MERAH, bukan hijau.

### Fase 0 — Tutup false-green murah (deterministik, tanpa browser, ~1-2 hari)
1. **Pakai dead import**: ganti `anyTokenPresent` dengan `scssCoverage(exemplar, generated)` dari `fidelity.mjs` — full-chain + block-body, bukan token-presence. (Kaveat kritisi: model token-presence sudah family-gated di HEAD — pertahankan gate itu sambil menaikkan persyaratan dari kehadiran token ke kehadiran body/effect.)
2. **Binding values + targets**: ekstrak nilai `[x]="v"` (bukan nama), resolve `v` ke deklarasi TS (ts-ast sudah ada); `(evt)="h"` → `h` harus ada di class.
3. **textCoverage hanya elemen ter-render** (HTML button/placeholder/innerText), bukan `html+ts`.
4. **filterRowButton generik**: tombol filter = tombol `<Button_FNC>` di grup filter (positional), bukan literal "Cari".
5. **gridColumns**: dukung `col-N` tanpa infix + hitung fallback stacking wajib.
6. **Gate math**: warn>0 → exit code berbeda (advisory); file-selection exact-match; pasangan komponen↔transkrip distempel di header `// Generated by SliceUI from <name>.xml` dan dimatch.
7. **iconColor**: hapus whitelist netral untuk ikon yang desainnya berwarna semantik; terima 3-hex/rgba.
8. **Resolusi kontradiksi SKILL.md:180 vs :218** — mandat `mt-4` per-widget vs `align-items: flex-end` (never margin-top). Pilih SATU aturan berbasis realita CSS: karena pilar menyediakan `mt-4` (BS5-grid) dan kanonik memakainya, aturan "button col dapat `mt-N` bila field kolom sejajar label" menang; hapus kalimat bertentangan.
9. **`::ng-deep` tanpa `:host` = fail** (bocor global; corpus punya block telanjang yang tidak boleh direplikasi generator).
10. **Compile sebelum gate**: `sass --load-path` + template parse → braket tak seimbang/syntax error tak bisa exit hijau.

### Fase 1 — Style-fact check (statis, gratis, menutup kelas "padding/warna/radius off")
11. **Check #18 `styleFidelity`**: ekstrak literal SCSS+inline (padding/margin/radius/width/font-size/hex) dan bandingkan ke fakta transkrip per node ter-mapping (via teks label/posisi). Threshold keberadaan (≥80% nilai desain muncul di output) → menangkap `h1 #555`, radius 7 vs 6, label tak di-style.
12. **`loadedClassRegistry`** di detect/init: resolve `angular.json` styles → SCSS import chain → kumpulkan selector yang benar-benar ter-compile. Verify: setiap kelas di HTML generated harus ada di registry ATAU di SCSS komponen; `col-12`/kelas mati jadi merah dengan hint ("BS3 grid — gunakan `col-xs-12` — atau `.p-col-12` bila memakai grid pilar"). Registry dari stylesheet nyata, BUKAN dari versi package (pilar hybrid tanpa package `bootstrap`).

### Fase 2 — Render gate (Layer 2, the big steal)
13. **Jawab fork dulu: di mana miss terjadi?** Sebelum membangun probe, ukur apakah defect (a) ada di komponen ter-isolasi atau (b) baru muncul di shell nyata di bawah pilar/BS3-hybrid. Karena bill-repo membuktikan komponen asli stylesheet-nya kosong (visual = global classes), hipotesis kuat = (b) → render WAJIB di route app nyata, bukan harness kosong. Uji cepat: muat komponen di harness kosong vs route app; bila (b), harness ter-isolasi menyesatkan.
14. **`sliceui render --port N`**: Playwright buka route dev-server nyata yang meng-instan-siasi komponen. Screenshot 2 viewport.
    - **Mode A (deterministik)**: probe `getComputedStyle`/`getBoundingClientRect` pada invariant corpus + box geometry vs transkrip. Hanya bermakna DI SHELL NYATA — di harness ter-isolasi cascade tak ada.
    - **Mode B (multimodal, agent-in-the-loop)**: screenshot kembali sebagai gambar ke agent + instruksi bandingkan-dan-fix (pola s2c system_prompt:19) — max N iterasi, fail-closed kalau Playwright tak ada (merah + pesan actionable, JANGAN disable diam-diam ala probe s2c).
15. **Stamp & pair**: header generated menempel nama XML; render/verify menolak pasangan mismatch.

### Fase 3 — Hulu & ekosistem
16. **Schema kaya + jangan drop variant**: baca `variantProperties Type="VARIANT" value="primary|secondary|…"` → `node.variant` (XML bulk button bill menyatakan `Type="secondary"` — resolve harus bisa memetakannya ke `btn-secondary`); baca `strokes` → fakta border (bukan skip subtree); tambah shadow/opacity/text-align. `DROP VARIANT/BOOLEAN` hari ini menghapus ground-truth state yang §5 butuh.
17. **Fidelity non-self-referential**: walker XML independen + `preservedFor` banding nilai (toleransi rounding), bukan boolean.
18. **Resolve diperluas**: buttons/inputs/text/cards/dividers (bg+radius+size → kandidat kelas project); OOV path emit `native-plain` (bukan `resolved:[]` + `fallback:null`); turunkan `FA_ICON_COLORS`/badge-bg dari corpus saat init (co-occurrence `.fa-*`+warna) bukan hardcode 4+4 hex; dedup tabel yang dibagi resolve/verify.
19. **Registry + kategori**: tambah `button`, `text-input` ke library-registry; perluas conventions ke SCSS non-`::ng-deep` (`:hover`/`:focus`/`@media`/`@keyframes`) — di situ padding/typography/button idiom team hidup.
20. **Eval set beku** (pola evals mereka): simpan XML + golden terverifikasi-manusia di repo, run n=3, skor box-IoU vs transkrip — baseline regress untuk tiap perubahan prompt/check. Plus wire cypress yang sudah ter-install bill ke CI: screenshot per-route vs baseline dari asli buatan tangan — satu-satunya mekanisme yang mengobservasi miss localhost yang check statis tak bisa.

### Urutan investasi (justifikasi)
- **Sebelum semuanya: bangun rendering oracle ringan** (kritisi run-2): screenshot export desain + render komponen di shell nyata + diff — karena klaim "salah di localhost" belum punya ground-truth render; XML/golden/corpus saling tak sepakat pada border/badge/alignment. Ini juga yang menjawab fork (a)/(b) Fase 2 #13.
- Fase 0 (0-10) = **biaya kecil, deterministik, CI-able**; menutup false-green terdokumentasi + menghentikan "merah untuk alasan yang salah" (badge family, ::ng-deep tanpa :host, syntax, kontradiksi mt-4, resolve salah).
- Fase 1 = menutup ~6 kelas miss statis studi kasus (`h1 #555`, radius drift) tanpa browser — penyebab dominan (a) check lemah dibereskan di sini.
- Fase 2 = menutup cascade/computed yang mustahil statis — hanya setelah oracle ada & fork (a)/(b) terjawab, dan di shell nyata (harness ter-isolasi buta cascade). Mode B = menyamai mekanisme terkuat benchmark dengan grounding transkrip lebih kaya.
- Fase 3 = mencegah defect lahir di hulu (variant/button-secondary ter-buang, border/shadow tak terpresentasikan, resolve color-first salah) + bereskan penguat (b) instruksi kontradiktif & (c) mis-vectoring yang sudah mulai di Fase 0.

---

## 7. Self-red-team terhadap analisis ini

- **Overstatement yang dikoreksi kritisi:** (a) "fidelity tak pernah melihat generated code" terlalu tegas — `scssCoverage(exemplar, generated)` di `fidelity.mjs:268` memang membandingkan SCSS tapi dead-import (substansinya benar, formulasinya dilembutkan). (b) klaim "scssCoverage = token-presence" berlaku v0.11.x; di HEAD sudah family-gated (`relevantCorpus` select|table|layout) — tabel §1.1 sudah mencerminkan state HEAD. (c) SKILL.md tidak pernah menyuruh `w-100`/`mr-2` (0 hit grep); yang disuruh hanya `mt-4` di :180 — kontradiksi nyata ada di pasangan :180 vs :218, dan sudah diberi rekomendasi resolusi di Fase 0 #8.
- **Kontradiksi idiom yang harus disurface (kritisi):** agen berbeda menyimpulkan model berlawanan — "verify mandat BS4 utility (mt-4) padahal tanpa Bootstrap" vs "mt-4 valid via BS5-grid layer pilar". Kebenaran lapangan: `mt-4` (1.5rem !important) ADA di dist styles.css (lapisan BS5-grid) dan dipakai kanonik — jadi mandatnya legal. Yang keliru adalah vocab-only detection: `mt-4` hijau HANYA kalau project memakainya di HTML; dasar yang benar = ada-rule-di-CSS-ter-load.
- **Bias agen riset**: agen diminta skeptis dan menghasilkan temuan; beberapa klaim severity "critical" mungkin over-stated (mis. pentingnya rating 1-4 bagi SliceUI minim). Sintesis menyeleksi berdasarkan bukti file:line yang bisa diverifikasi + koreksi kritisi.
- **Render gate bukan peluru perak**: harness Angular monorepo punya biaya setup tinggi (module wiring, dev server, auth guard) DAN, yang lebih mendasar, harness ter-isolasi buta terhadap cascade — hanya bermakna di shell nyata (fork §6.13). mitigasi: jawab fork dulu dengan uji cepat sebelum bangun infrastruktur penuh.
- **loadedClassRegistry bisa false-negative** pada CSS dinamis/kelas yang dibuat via `@mixin` bersyarat — perlu digabung dengan vocabulary pemakaian (union, bukan replace).
- **Analisis ini sendiri tak me-render apa pun** — temuan cascade runtime (bagian 3) diverifikasi via CSS ter-kompilasi statis, bukan browser. Tepat untuk konteks; bukan substitusi render. Temuan "kanonik = output SliceUI" juga koreksi mandiri atas kesalahan identifikasi file pada draft awal.
- **Koreksi kritisi run-2 (workflow kedua, dua kritisi independen dijalankan):** (a) framing "16/16 green" hanya berlaku generation-time @ v0.11.1; di HEAD slice-11 merah 1 (inventedUtility) — laporan §2 sudah dipindah ke bentuk reprodusibel "merah untuk alasan yang salah". (b) "gate memblok golden" direproduksi mandiri dan benar hanya bila diberi ground-truth slice-11; di repo golden tanpa conventions.json, check akan SKIP — klaim dibatasi di §2 #1. (c) "resolved 18/30 salah" = sampel kecil yang di-overstate; angka dari TS lama yang dipakai agent (label-custom-cancel, fa-pencil) menunjukkan sebagian "kesalahan" adalah artifact sampling — pertahankan sebagai indikasi, bukan statistik. (d) fakta "label-custom-success/cancel tanpa definisi CSS reachable" bergantung state repo yang tidak direproduksi git-SHA — ditandai sebagai kondisi working-tree, bukan klaim permanen.
- **Urutan kausal 3 akar penyebab (kritisi run-2):** laporan mengkomit dominan = check statis lemah (struktural), dengan instruksi kontradiktif + mis-vectoring sebagai penguat — bukan daftar setara; lihat §0 #5.

---

## Lampiran A — Bukti kunci (file:line)

- `verify.mjs:51` — API strings-in (`{scss,html,ts}` konten file, tanpa eksekusi).
- `verify.mjs:116-120` — `anyTokenPresent` token-presence; `verify.mjs:25` + `fidelity.mjs:268-286` — dead import versi kuat.
- `verify.mjs:54` — `checkTextCoverage(html + " " + ts, …)`.
- `verify.mjs:205,523` — ekstraksi nama atribut binding (tanpa nilai).
- `verify.mjs:82` — `pass: failCount === 0 && hasGroundTruth` (warn/skip tak memblok).
- `verify.mjs:117` — PSEUDO set diabaikan `anyTokenPresent`.
- `verify.mjs:483,489` — literal "Cari" hardcoded.
- `verify.mjs:502` — buttonOrder = grep row-reverse (rawXml tak dipakai).
- `verify.mjs:561` — regex col infix-mandatory.
- `verify.mjs:629,637-641` — iconColor 6-hex + whitelist netral.
- `fidelity.mjs:46` — `transcript = parseFigml(xml)` (oracle self-referential); `:153-168` boolean-presence.
- `figml-parse.mjs:84-88` — SKIP_TAGS (strokes dll); `:119` DROP VARIANT/BOOLEAN.
- `resolve.mjs:41-60` — hanya 2 cabang resolve (badge/icon); `:13-18,107-112` — 4 hex hardcode.
- `conventions.mjs:159-198` — corpus `::ng-deep`-only.
- `library-registry.mjs:9-12` — 13 kategori (tanpa button/text-input).
- `commands/verify.mjs:50-54` — pemilihan file `.find` pertama.
- `SKILL.md:180 vs 218` — kontradiksi mt-4 vs align-items:flex-end.
- `SKILL.md:214` (render opsional-prosa) vs `SKILL.md:255` (verify blocking) — inkonsistensi penegakan.
- `frameworks.mjs:22-24` vs `detect.mjs:155-166` — rule bootstrap5 unreachable.
- Empiris: slice-11 lulus 16/16 @ v0.11.1 (`f2089b4`), hanya 4/8+ defect ditangkap v0.12.1 (semua via inventedUtility); **golden GAGAL verify v0.12.1** (scssCoverage 2/20 + inventedUtility mt-4/mt-0/mb-3/p-0); `references: []` belum ter-wiring.
- XML bukti: `ubah-tagihan.xml:5-8` title `#000000`; `:36` field `cornerRadius="6"`; Button_FNC bulk `variantProperties Type="secondary"`; tombol Cari `height="40"` vs field `height="41"`.
- s2c multimodal wiring: `agent/tools/screenshot_preview.py` `ToolMultimodalPart`; provider inlining `openai.py:496-534`/`provider.py:445-493`.
- s2c: `preview_screenshot/playwright_backend.py:13-14,73-88`; `agent/tools/screenshot_preview.py:20-24`; `prompts/system_prompt.py:19`; `agent/engine.py:25-32`; `evals/asset_extraction_benchmark.py:44`.
- bill: `dist/.../styles.css` — sandwich BS3.3.7 + BS5.1.3-grid + utilitas pilar (hitungan rule di §3); `angular.json` styles chain via `pilar/styles.scss`.
- bill-repo: tidak ada dep `bootstrap` (package.json); pilar 3.3.22 + @uiigateway/core 4.1.1; **komponen kanonik working-tree = output SliceUI uncommitted; git HEAD asli css-nya KOSONG**; badge `success`/`cancel` di-emit tapi tak ada definisi reachable (hanya `-warning`); `.gitlab-ci.yml` tak punya job test/screenshot (cypress ter-install tapi tak dipakai).
- Kritisi run-1 (wf `wsik4tbft`): koreksi 3 overstatement + surface kontradiksi idiom (mt-4 valid vs vocab-only) + pertanyaan fork (a)/(b) sebagai anchor sintesis + demote "baca versi CSS dari package" (tak ada) dan "computed-probe di harness ter-isolasi" (buta cascade).
- Kritisi run-2 (wf `wqbn7d97w`): framing "merah untuk alasan yang salah" (bukan green palsu); batasi "gate memblok golden" (butuh ground-truth eksternal — direproduksi mandiri); "belum ada rendering oracle" (XML/golden/corpus saling tak sepakat — butuh screenshot desain sbg ground truth); urutkan 3 akar penyebab & komit satu dominan; demote "resolved 18/30" & "badge tanpa definisi CSS" sbg artifact-state dependent.

## Lampiran B — Metodologi

**20 agen** dari **2 run workflow independen** atas script yang sama (`wf_25e63427-553` → run `wf_21f484e5-c43` [journal dipantau live] dan run lanjutan `wqbn7d97w`), masing-masing 9 riset + 1 kritisi. Lensa riset: audit verify-gates · audit SKILL.md/instruksi · diff slice11-vs-golden-vs-XML · realita repo bill (dengan eksperimen runtime node) · arsitektur feedback s2c · eval+failure-mode s2c · prompt-engineering s2c · taksonomi defect field Angular · audit mesin resolve/conventions/registry. **Dua kritisi independen** — keduanya meng-grounding klaim terhadap repo; temuan run-2 yang bertentangan/mengoreksi run-1 disintesis (§2, §7). Ditambah verifikasi mandiri: hitungan rule CSS ter-kompilasi, penelusuran import chain styles, reproduksi verify golden-vs-slice11, pembacaan transkrip/resolved/golden/slice-11, dan pembacaan langsung modul preview/prompt s2c.

## Lampiran C — Status verifikasi (apa yang sudah dieksekusi vs hanya dibaca)

Temuan yang DIVERIFIKASI dengan eksekusi (tidak hanya dibaca):
- slice-11 lulus **16/16 @ v0.11.1** (generation-time, checkout `f2089b4`): 0 fail 0 warn, padahal ≥8 defect visual.
- Verify **HEAD v0.12.1** pada slice-11: merah **1 fail** — `inventedUtility` (w-100/mr-2/mt-2/mt-4); **nol** dari defect visual (title #555, radius 7px, missing selectedRow, table-wrapper) menghasilkan fail. Bentuk "merah untuk alasan yang salah".
- **Golden vs ground-truth slice-11** (dijalankan mandiri): merah 2 — `scssCoverage` 2/20 (`ngx-select__toggle-caret`/`__toggle`) + `inventedUtility` (mt-4/mt-0/mb-3/p-0). Di repo golden sendiri (`hope-result/` TANPA conventions.json/xml/transcript): check `inventedUtility`/`scssCoverage` SKIP → klaim "gate memblok golden" hanya berlaku dengan ground-truth eksternal, bukan tak-bersyarat.
- Count rule CSS di `dist/styles.css` ter-kompilasi: mt-N=6, mr-N=0, gap-N=0, col-12 non-p=0, btn-block=6, d-flex/justify-content-end ada.
- Resolve ulang slice-11 → 30 leaves ter-resolve, **18/30 salah** (fa-search untuk caret/pencil; warning untuk "Dibatalkan") — dibatasi sebagai indikasi (sampel kecil, TS lama agent memakai sebagian label yang "benar").

Temuan yang berdasar pada pembacaan kode (bukan eksekusi — ditandai sebagai analisis statis): mekanisme 17 check, dead-import scssCoverage, arsitektur feedback s2c, sandwich CSS pilar, resolusi variant XML `Type="secondary"`.

**Keterbatasan:** analisis ini tidak me-render komponen di browser — kesimpulan runtime (fork (a)/(b), perilaku cascade) adalah hipotesis kuat yang belum diukur; itulah item #1 Fase 2.
