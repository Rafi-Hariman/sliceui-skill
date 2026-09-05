# Brainstorming — SliceUI Reality

> **Tanggal:** 2026-09-05 · **Branch:** `feat/framework-reorg` (sudah di-merge dengan `main` = v0.13.x)
> **Metode:** audit mendalam kode 4 lensa (paralel) + riset internet 4 topik (paralel) + 2 sintesis adversarial (10 agen, 253 tool call, ~752k token).
> **Status baseline:** 168 pass / 0 fail / 2 skip (setelah merge, sebelum tulisan ini).
> **Bahasa:** Indonesia (istilah teknis dibiarkan Inggris).
> **Tujuan dokumen:** menjawab 7 pertanyaan case ini — realitas Angular-focus, kematangan `PLAN-framework-reorg-e2e.md`, akar masalah presisi XML→code yang "looping", cara paling efektif meraih presisi tinggi, perlu-tidaknya riset eksternal — lalu menelurkan rekomendasi & keputusan yang menunggu Anda.

---

## 0. Ringkasan eksekutif (TL;DR)

1. **"Terlalu Angular?"** → Ya, tapi **hanya di lapisan adaptasi**. Skor 74/100. Transkripsi netral & codegen-rule 8 framework sudah benar. Yang 100% Angular/org adalah *spine* adaptasi: registry library, convention-mining, resolve, verify, referee. Untuk proyek React, `sliceui verify` bahkan **gagal total (exit 2)** karena hanya membaca `*.component.{scss,html,ts}`. Klaim README "*degrades gracefully*" = **tidak akurat** untuk verify.
2. **"Plan framework-reorg matang?"** → **"Apa"-nya benar & tervalidasi riset industri; "bagaimana"-nya basi.** Plan ditulis di v0.9.0; kode kini v0.13.x (verify 9→21 check, `conventions.mjs` berubah, muncul `loaded-classes.mjs`). Dieksekusi verbatim akan gagal (import patah, split tidak sesuai). Keputusan council (veto schema/initCore sampai framework #2) **tetap benar**. Kesimpulan: **revisi dulu lapisan mekanisnya, baru eksekusi — bukan verbatim, bukan parkir.**
3. **"Kenapa XML→code looping tidak presisi?"** → **Verify hijau ≠ UI benar** karena `verify` mengukur **teks/selector**, bukan **render**. Ini kelas cacat yang terdokumentasi luas di industri (bukan keanehan SliceUI). `loadedClassRegistry` (pendeteksi kelas mati) **dibangun tapi tak pernah tersambung** ke gate → selalu skip di produksi. Tidak ada satupun dep browser → *render oracle* tidak ada → manusia satu-satunya oracle → loop tidak bisa konvergen.
4. **"Cara paling efektif meraih presisi tinggi?"** → **Ukur computed output, bukan source token**, berlapis: **L1** cek statik murah (fakta teks/geometri), **L2** probe *computed-style + geometry* di browser hangat (~100–200ms, tanpa token vision — ini workhorse-nya), **L3** screenshot render sebagai gate terminal. Sertai **fail-closed** (no-artifact/no-coverage ≠ hijau) & maksimal 1–2 putaran *repair* otonom.
5. **"Perlu riset internet?"** → **Ya, dan sudah dijalankan.** Riset 2024–2026 (Design2Code, WebSight/WAFFLE, ReLook, RILA, render-loop, s2c, dll.) **mengonfirmasi** diagnosis internal Anda, bukan menambah arah baru. Yang riset **tidak bisa jawab**: keputusan bisnis (produk umum vs internal one-customer) & fork arsitektur render (harness vs shell nyata) — itu butuh keputusan Anda + akses ke project bill.
6. **Realitas yang paling penting & belum disebut eksplisit:** SliceUI di-tuning ke **satu proyek Angular bill** (UII Gateway Bill / SPP-UKS). Registry, golden reference, truth-table verify, data mock — semua diangkat dari codebase itu. Pertanyaan "produk umum atau internal tool" menentukan hampir semua rekomendasi M/L di bawah. **Ada juga exposure kerahasiaan**: grammar library org (pilar/`@uiigateway`) ter-enkode di repo **MIT publik**.
7. **Kondisi git (selesai):** `feat/framework-reorg` sudah fast-forward ke `main` (v0.13.x), dan `PLAN-framework-reorg-e2e.md` **dipulihkan** di branch ini (commit `cb24f39`) — plan tidak hilang.

---

## 1. Realitas terbesar yang harus disebut dulu: satu-customer

Sebelum menjawab "terlalu Angular?", nama dulu fakta yang hampir semua lensa lewatkan:

- `test/e2e.test.mjs` menyebut proyek validasi nyata sebagai **(bill)** — paruh manualnya "runs in a real Angular project (bill) and ends in ng build".
- `testing/hope-result/reference-bulk-filter-table/*.component.ts` adalah **screen bill verbatim** (SPP/UKS 2023/2024 Angs 3, total_tagihan, batas_akhir) dan ada baris mock bernama **"RAFI HARIMAN"** (pemilik repo).
- `src/lib/library-registry.mjs`: 26 entri semuanya Angular/org (`ngx-select-ex`, `ngx-datatable`, `mat-table`, `primeng`, `pilar`, `@uiigateway/core ugw-*`). **Nol** library React/Vue/Svelte.
- `skill/SKILL.md`:223–242 meng-hardcode truth-table `pilar action → authKey → icon` + semantik `@uiigateway/core AuthorizationModel`.
- Repo berada di `freelance/sliceui-skill`, bersebelahan skill `bill-api-usage` & memory "UII Gateway Bill".

**Implikasi:** "terlalu Angular" sebenarnya = "terlalu ke satu layar bill Angular". Golden reference, corpus `::ng-deep`, taxonomi `label-custom-*`, dan sebagian besar 21 check verify semuanya diangkat dari codebase tunggal itu. Trace React di bawah benar secara teknis, tapi menjawab **pengguna hipotetis yang belum ada dalam bukti**.

> ⚠️ **Exposure kerahasiaan (belum disorot lensa mana pun):** kontrak internal library org (action→authKey→icon pilar, semantik AuthorizationModel) ada verbatim di repo **MIT publik** (`github.com/Rafi-Hariman/sliceui-skill`). Kalau ini deliverable freelance ber-NDA, itu potensi kebocoran. `testing/` berisi baris mahasiswa bill yang terlihat nyata (termasuk nama owner) — saat ini ter-gitignore, tapi tidak ada guard CI yang mencegah slip ke commit publik.

---

## 2. Pertanyaan 1 — Apakah SliceUI terlalu Angular-focused?

**Jawaban terukur: 74/100 Angular-centric di lapisan adaptasi; transkripsi netral; codegen-rule multi-framework.** Breakdown per lapisan:

| Lapisan | Sifat | Bukti kunci |
|---|---|---|
| CLI & lifecycle | ✅ generik | dispatch framework-neutral; doctor tanpa Angular |
| **Transkripsi** (schema/prompt/render/figml) | ✅ **generik** | LAYOUT_TYPES murni desain; prompt "design facts only"; nol vocab framework |
| Deteksi framework | 🟡 campur | `detectFramework` kenal react/next/svelte/vue/angular (benar); TAPI `if (fw.id==='angular')` meng-gate SEMUA deep-detect (prefix, styleExt, module) — framework lain cuma dapat directory-guess (`detect.mjs:51`) |
| **Capabilities registry + scan** | 🔴 Angular | 26 entri semua ngx/pilar/mat/@uiigateway; scan glob hanya `**/*.ts/.html/.scss` → import JSX/SFC **tak terlihat** (`library-scan.mjs:23`) |
| **Conventions mining** | 🔴 Angular | vocab dari `class=`/`(click)=`/`::ng-deep`; anatomy cuma `uii-table\|ngx-datatable\|mat-table`; tak pernah membaca `.tsx/.vue/.svelte` |
| Loaded-class | 🟡 campur | registry digerakkan `angular.json styles[]` (hanya Angular) |
| Design-token mining | ✅ generik | `$scss`/`--css-var`/`@mixin` dari `.scss/.css` mana pun |
| **Resolve idiom** | 🔴 Angular | peta ikon→`fa-*`, status→`label-custom-*` org; corpus `::ng-deep` → di proyek non-Angular kosong → degradasi ke native-plain |
| Referee | 🟡 campur | overwrite-guard cari hanya `<name>.component.ts` → **silent no-op** di React |
| **Verify gate** | 🔴 Angular | `readComponent` hanya terima `*.component.{scss,html,ts}` → React `.tsx` = **exit 2** |
| Fidelity scorer | 🟡 campur | XML→transcript netral; `scssCoverage` Angular-only |
| Codegen RULES (`frameworks.mjs`) | ✅ **multi** | 8 framework (tailwind/react/vue/bootstrap/native/next/svelte/angular) — ini yang bikin klaim "8 framework" benar |
| Skill references | 🟡 campur | satu-satunya cheatsheet per-framework = **Angular 13** |
| README claim | 🟡 campur | tabel ✅ React/Vue/Svelte hanya benar untuk 2 kolom (detect + rules); caveat adaptation-only-Angular ada & jujur, **kecuali** untuk verify (bukan "graceful", tapi "break") |

**Trace React 18 + Tailwind + react-select + tanstack-table (end-to-end, apa yang terjadi hari ini):**
1. `init`/`detect` → jalan, framework terdeteksi `react-tsx`. Bagus.
2. `capabilities` → **semua null** (`react-select`/`@tanstack/react-table` tak ada di registry & file `.tsx` tak pernah di-scan) → codegen disuruh pakai `<select>/<table>` native.
3. Golden reference `.tsx` → **di-skip** dengan warning (butuh `.component.ts`).
4. `resolve` → setiap badge jatuh ke native-plain; ikon tetap disaran `fa-*` walau proyek pakai lucide/heroicons.
5. `verify` → **hard break**: "no component files found", exit 2. Kalau file dipaksa dinamai `*.component.ts`, hampir semua check skip → *vacuous green*.
6. `referee` → hijau-kosong (pass by absence).

**Kesimpulan:** klaim multi-framework di README **over-stated** untuk lapisan adaptasi; untuk `verify` bahkan menyesatkan (bukan "degradasi anggun", tapi "rusak" / "hijau kosong"). Arsitektur dua-lapis Anda (transkripsi netral + codegen-rule multi) benar; yang kurang adalah **kejujuran per-lapis** + **fail-closed**, bukan membangun React sekarang.

---

## 3. Pertanyaan 2 — Apakah PLAN-framework-reorg-e2e.md sudah matang?

**Jawaban: belum eksekutabel apa adanya.** Keputusan council ("apa") tetap benar & **divalidasi riset eksternal**; lapisan mekanis ("bagaimana") basi karena kode maju 10 commit (v0.9.0 → v0.13.x) tanpa plan ikut direvisi.

### Yang MASIH VALID (jangan dibuang)
- **Keputusan council 1–5** — semua masih tepat. Veto `index.mjs` descriptor, `initCore()`, schema `capabilities` statis, target "not equal" (React dalam dulu), & "framework abstraction menunggu framework #2" → **semuanya diperkuat**, bukan dilemahkan, oleh pelajaran remediasi (verify-green ≠ rendered; fork render belum terjawab & Angular-spesifik).
- **Jalur B** (init interaktif + `--framework`/`--yes`) → valid & **belum diimplementasikan sama sekali** (init cuma parse `--key-from`; tidak ada `--framework`/`--yes`/`isTTY` di repo).
- **Follow-up #1** (re-scope "never add wrappers") → **sudah selesai** oleh remediasi (SKILL.md Pass-1 + `checkPhantomWrapper` menyempit ke `.well`/`page-canvas`).
- Kerangka **"refactor-murni, zero behavior change"** → tetap test yang tepat untuk reorg tata-letak murni.

### Yang BASI (harus direvisi sebelum eksekusi)
| Bagian plan | Masalah vs kode hari ini |
|---|---|
| §4 peta 6 file | `conventions.mjs` export berubah total: corpus extractor (`extractNgDeepCorpus/extractAnatomy/extractNaming`) **kini privat** di balik `extractConventions()` aggregate; muncul file baru **`loaded-classes.mjs`** (miner Angular-fed) yang tak ada di peta; `style-tokens` dipanggil di `detect.mjs:92` (bukan 88); verify 21 check, bukan 9 |
| §4 "dependen yang import" | **Salah faktual**: `resolve.mjs` **nol import** (murni); `referee.mjs` tidak import conventions (baca `ctx`). Yang benar import conventions: `lib/verify.mjs` (LIBRARY_INTERNAL/WRAPPER_GUARD/TRIVIAL_CLASS), `commands/detect.mjs`, `commands/init.mjs`, + **test** — `lib/verify.mjs` dan semua test **tercecer dari daftar plan** |
| §5 Jalur A | `git mv`+rewire prod-only → **test import specifier patah** (`test/conventions.test.mjs` import `../src/lib/conventions.mjs`, dst.). Split verify tak lagi cocok (21 check + helper bersama `requiredAuthKeysFromXml`, `normalizeFigmaAction`, `detectAuthFlags`, `divTree`, `filterButtonsFromXml`, `titleNode` …). Pengetahuan Angular kini tersebar > 6 file: `loaded-classes.mjs`, heuristik `resolve.mjs` (FA_ICON_COLORS, `label-custom-*`), validasi `referee.mjs`, `fidelity.mjs scssCoverage`. Move 6-file menyisakan ~separuh pengetahuan Angular di `src/lib` → **gagal mencapai tujuannya sendiri** |
| §7/10 baseline | 103/103 → **170 test (168 pass, 2 skip)**; "project-context identik" kini berarti schema v4 di **dua** fixture (angular13 & angular13-rootprefix); init sekarang juga menulis conventions.json/md + referee artifacts; **package.json masih 0.12.1** padahal fitur v0.13.0 sudah landed |
| §9 follow-up #2 | **Masih terbuka**: `nextjs` tetap bucket FRAMEWORK_RULES & detect-id terpisah (belum dilipat ke react); `tailwind` punya peran ganda (fallback id + styleExt). Ini pre-kondisi sebelum menambah folder `src/framework/<id>/` non-angular |

### Yang ditegaskan lensa plan (kutipan inti)
> "Verify green ≠ rendered-correct dan fork arsitektur (isolated vs app-shell) UNANSWERED dan Angular/pilar-spesifik — tak satu pun menghasilkan jalur codegen+verify framework kedua yang nyata, jadi field-set untuk shared descriptor masih tak diketahui."

> "Yang dibangun sejak (project-context `capabilities` map: category→library+sample) adalah **runtime per-project instance data**, BUKAN descriptor statis per-framework yang diveto (styleScoping/componentModel/eventModel/verifyChecks/tokenMining) — veto tak sengaja terpenuhi."

**Kesimpulan: revise-then-execute.** Jangan verbatim (pasti gagal), jangan parkir (pengetahuan Angular terus menumpuk di `src/lib` tanpa rumah). Revisi: gambar ulang §4 di graf module saat ini, izinkan edit path-only di import test (larang ubah asersi), kunci golden JSON v4 untuk kedua fixture, naikkan baseline ke 168/0, dan — **keputusan Anda** — tentukan cakupan move-set: 6 file plan saja, atau "beri rumah ke SEMUA pengetahuan Angular" (termasuk loaded-classes, heuristik resolve, validasi referee, scssCoverage fidelity).

---

## 4. Pertanyaan 3 — Akar masalah "looping XML→code tidak presisi"

### Diagnosis inti (dikonfirmasi audit internal + 3 riset eksternal independen)
> **Verify hijau ≠ UI benar, karena verify mengukur teks/selector, bukan render.**

Transkrip membawa fakta numerik kaya (`x/y/w/h`, `pad`, `gap`, `r` radius, `style{size,weight,color}` per node). Verify membaca hampir **nol** angka itu — hanya `n.text`, `n.type`, `n.bg`. Satu-satunya check berbasis nilai (`styleFidelity`) menguji **2 fakta** (warna judul, warna divider). Radius 7 vs desain 6, padding 15 vs 20, lebar badge 92 vs 100 — semua lolos hijau.

### Mekanisme loop (persis)
1. Agent memotong dari transkrip dengan **keleluasaan penuh atas angka CSS** (harus meniru idiom project, tapi tak ada yang mengunci radius/padding/gap/utility-class mana yang benar-benar memproduksi CSS).
2. `verify` hijau karena teks/class/structure cocok.
3. Render di localhost salah karena **cascade CSS global 3-sistem** (Bootstrap 3 pilar + Bootstrap 5 grid + utilitas pilar), **kelas mati** (`col-12`, `mr-2`, `.gap-N` tanpa CSS ter-load), **`::ng-deep`** yang menembus library, **specificity view-encapsulation**.
4. Manusia lihat, komplain, regenerate → me-reslice XML yang sama lewat gate yang sama → **hijau lagi sebelum & sesudah**; tak ada sinyal di pipeline yang berkorelasi dengan dimensi komplain manusia (nilai visual saat render).
5. Manusia = satu-satunya *render oracle* → **loop tak bisa konvergen**: tidak ada yang mengubah "salah di localhost" menjadi check yang gagal.

### Yang SUDAH diselesaikan v0.13 (jangan dikerjakan ulang)
Fase 0–1 remediasi yang landed (deterministik, statis): `scssCoverage` live-rule (bukan token-di-komentar), `textCoverage` hanya elemen ter-render, `filterRowButton` label-agnostik (bukan hardcode "Cari"), `mergeGoldenClasses` (kelas golden tak lagi "invented"), `noBareNgDeep`, `scssCompiles` (keseimbangan brace), `gridColumns` per-breakpoint + div-tree, resolve context/name/variant-first, nearest-project-root + stamp-and-pair by name, `styleFidelity` (2 fakta).

### Yang MASIH JADI MASALAH (urut dampak)
| # | Defect | Kenapa masih lolos | Dampak |
|---|---|---|---|
| 1 | **Fidelity nilai numerik ~absent** — radius/pad/gap/font/per-node width tak dibaca; styleFidelity hanya 2 fakta | gate tak pernah membaca field numerik transkrip; remediasi FASE 1.1 (≥80% value-presence, mapping node→rule) mayoritas **tidak diimplementasikan** | **Tinggi — akar dominan** |
| 2 | **`loadedClassRegistry` mati di CLI** — dibangun & di-persist di `project-context.json`, tapi `commands/verify.mjs` hanya baca `conventions.json` yang tak pernah memuatnya → `checkLoadedClass` **selalu SKIP di produksi** | wiring bug (registry ditulis sebagai sibling top-level, gate baca file lain). Bukti: fixture `conventions.json` tak punya key itu | **Tinggi — "fix unggulan" yang skip di tiap run** |
| 3 | **Tidak ada render/cascade oracle** — tanpa dep browser, computed-style/specificity/::ng-deep-reach/grid runtime/mobile **tak terobservasi** | remediasi FASE 2 (render gate/render-probe) **tak pernah dibangun** | **Tinggi — loop tak bisa ditutup, hanya diredam** |
| 4 | Border/shadow/opacity di-drop di hulu (`SKIP_TAGS` masih buang `strokes`; opacity tak diparse) sementara schema **menerima** `.border/.opacity` | hanya separuh FASE 3.1 landed | Sedang — *false assurance* |
| 5 | Stamp-and-pair parsial (by filename-prefix optional, bukan header `// Generated from <xml>`); gate math tanpa skip-ratio; **eval-hope tests mati** (selalu `t.skip` karena `testing/` kosong/gitignored) | remediasi 0.6 & harness golden-vs-slice tak selesai | Sedang |
| 6 | `scssCoverage` masih token-in-live-rule (bukan block-body/declaration compare); `import { scssCoverage } from './fidelity.mjs'` di `verify.mjs:25` **dead** (tak pernah dipanggil) | remediasi 0.2 tak selesai | Sedang |
| 7 | Grid stacking fallback (`col-md-*` tanpa `col-xs-12`) tak di-enforce | 0.5 separuh | Rendah |
| 8 | `package.json` 0.12.1 (mislabel v0.13.0) | tak ada bump commit | Rendah |

### Kelas cacat ini di industri (bukti riset)
- **LLEM** menskor 99.74% & CLIP 90.67 pada halaman yang *"structurally different from ground truth"* sementara CW-SSIM 0.29 → metric text/position/DOM lulus persis saat struktur visual salah (WAFFLE/WebSight, arXiv 2410.18362).
- **HTML-Match sengaja membuang CSS** ("overlooks CSS styling") — WebSight.
- **Design2Code** hanya mencocokkan pusat text-block & warna teks (tak pernah padding/gutter/background) → buta ke cacat cascade.
- **QwenLM/qwen-code CI bot** mencetak green 3× padahal *"no test scenario actually rendered the changed UI"* (PR #7375) — persis pola *vacuous green* SliceUI.
- **korelasi functional-pass vs visual-correctness rho < 0.32** (InteractScience).

---

## 5. Pertanyaan 4 — Cara paling efektif meraih presisi kemiripan sangat tinggi

### Prinsip yang menyatukan semua bukti
> **Ukur *computed output* (apa yang browser hasilkan), bukan source token (apa yang tertulis). Deterministik dulu, render belakangan; render harus fail-closed.**

### Rekomendasi 3-langkah (urut, browser-free dulu)
- **Langkah 1 (S)** — **Sambungkan `loadedClassRegistry` ke gate verify.** Buat `commands/verify.mjs` ikut membaca `project-context.json` (atau merge registry ke `conventions.json` saat init). Detektor kelas-mati yang sudah jadi langsung hidup. **Syarat anti-false-positive** (penting!): check hanya *fail* bila registry benar-benar meresolusi rantai stylesheet & sebuah class yang dipakai **terbukti absen**; **warn-not-fail** bila registry kosong/under-resolved; gate di `fw.id==='angular'`.
- **Langkah 2 (M)** — **Perluas `styleFidelity` dari 2 fakta → value-coverage pass.** Baca field numerik transkrip (radius, pad, gap, ukuran/berat font, width/hex per node) dan map node→rule SCSS by label/posisi (remediasi FASE 1.1 yang mayoritas belum diimplementasikan). Ini menutup **akar dominan** (check lemah) tanpa browser, CI-able.
- **Langkah 3 (L, kemudian, human/CI-invoked)** — **`render-probe` computed-style-first**: mount komponen di **shell app nyata** (`ng serve` + route throwaway), probe `getComputedStyle`/`getBoundingClientRect` pada properti diskriminatif — *specificity inflation view-encapsulation* (`.col-6[_ngcontent…]` vs `.row > *[_ngcontent…]`) adalah pemecah cascade Angular yang khas dan **hanya terlihat di computed width**. Screenshot hanya sebagai lapisan terminal (CW-SSIM + pixelmatch), fail-closed kalau Playwright tak ada. Path vision (jika ada) = **satu putaran** human-invoked "verify & repair once" (render → screenshot → model → ≤1 auto-fix → diff disodorkan).

### Perbandingan opsi (kenapa urutan ini menang)
| Opsi | Biaya | Menutup kelas cacat? | Catatan |
|---|---|---|---|
| Check statik murah (teks/selector/value) | ~0 | Sebagian — **buta ke cascade** | metric class yang semua studi bilang miss defect |
| **Probe computed-style/DOM-geometry** (L2) | S–M, ~100–200ms hangat, **nol token vision** | **Ya — workhorse** | menamai property+element yang salah; ~700 token jika diserialisasi |
| Screenshot render (L3) | M–L | Terminal/arbiter | CW-SSIM > SSIM > CLIP; pixel pure tak bisa converge |
| Loop screenshot-feedback (model lihat render & fix) | L + token vision | Membantu **hanya** model kuat | gains ~53% front-loaded di putaran 1; collpase 2–3 putaran tanpa RL |

### Mengapa bukan pixel-diff sebagai penentu?
- **render-loop** (github): pixel/SSIM murni **tidak bisa converge** — render identik struktural berbeda ribuan piksel (font-shaping/half-pixel), dan harus **return best-so-far, bukan last**.
- **Design2Code regression**: Block-Match (coef 0.74) & Position (0.76) paling memprediksi penilaian manusia; **Text similarity justru NEGATIF**; warna hanya di teks.
- **ReLook**: zero-reward untuk *invalid render* menaikkan valid-render 40%→80%; forced-optimization (hanya terima revisi yang strictly lebih baik) → monotonik. Tapi itu **RL-trained** (skala riset), bukan prompting.

### Mekanisme terbaik yang bisa "dicuri" dari screenshot-to-code (dengan syarat)
Transferable (urut ROI): (1) **EmptyOutputError** — "tools ran but no artifact = failure, not success" → port ke SliceUI (S); (2) model-as-comparator + reference-first ordering (S, wajib opsional/vision-gated); (3) multi-viewport render desktop+mobile (S); (4) **asset crop-and-reuse** — SliceUI mentranskripsi teks/warna/layout tapi **tidak pernah me-reuse visual aset** (logo/hero) → Gemini bounding-box crop + content-addressed save `.sliceui/assets/` (M, browser-free, saat ini hilang total); (5) per-request observability `.sliceui/runs/` (S); (6) exact-string edit-file yang balikin diff, bukan regenerate seluruh file (S); (7) golden eval harness human-rated (M).
**Tidak transferable**: render-artifact-di-blank-page (output SliceUI multi-file + module + library + global-SCSS **tak bisa render di blank** → butuh shell nyata), pixel-parity whole-image (input full-page, output component slice), verify binding/idiom via render (sifatnya struktural), vision-required loop sebagai base.

### Jumlah iterasi otonom yang realistis
**1–2 putaran; hard-cap ~3.** ~53% gain tertangkap di putaran 1; meluruh 2–3; >3 butuh mesin monotonic RL-trained. Jadi jangan pernah loop otonom tanpa batas — 1 putaran + sodorkan diff ke manusia.

---

## 6. Pertanyaan 5 — Perlu tesis / riset internet?

**Ya — dan sudah dieksekusi (4 riset paralel, semua dengan source URL).** Jawaban per sub-pertanyaan:

| Sub-pertanyaan | Hasil | Confidence |
|---|---|---|
| Mekanisme fidelity terbaik? | **Render→screenshot/probe→model-lihat→fix** + structural-probe, bukan pixel murni; fail-closed; best-so-far | Tinggi |
| Struktur multi-framework codegen? | **Per-framework folder = benar** (Mitosis per-target serializer, Plasmic rich-IR tapi React-only, Builder per-fw component map, CMSgov menolak sentralisasi). Veto schema sampai framework #2 **tervalidasi**. Satu hal yang bisa dishare sejak awal: **design tokens** (DTCG/Style Dictionary) | Tinggi |
| Metrik kemiripan mana yang benar? | **Berlapis**: L1 statik (murah, buta cascade) → L2 computed-style/geometry (workhorse) → L3 screenshot CW-SSIM (terminal) + opsional tree-edit-distance | Tinggi |
| Hapus loop human-in-the-loop? | Blind/text-only regen = terlemah; screenshot-as-signal hanya reliabel jika RL-trained (skala riset); ROI tertinggi untuk CLI = **measure DOM/computed via browser hangat** + 1 putaran opsional | Tinggi |

**Yang riset TIDAK bisa jawab** (jangan over-index menambah riset): keputusan bisnis produk-umum-vs-internal-one-customer (bukti repo, bukan literatur) dan fork arsitektur render isolated-vs-shell (butuh akses project bill + keputusan Anda).

---

## 7. Rekomendasi terkonvergensi (sintesis kritik adversarial)

1. **[Tinggi] Re-scope klaim multi-framework per-lapis + buat non-Angular `verify` fail-closed.** Ubah tabel README jadi matriks per-lapis (detect + transkripsi netral + 8-framework rules = ✅ semua; library-wiring/conventions/golden/verify = Angular-only hari ini). `readComponent` yang miss → pesan eksplisit "verify hanya memvalidasi output `*.component.{scss,html,ts}` — Angular-only hari ini" + escape `--force`. Ini membetulkan bug claim-vs-reality, ~S, decision-reversible, dan menghapus efek terburuk (agent React dapat gate hijau-kosong yang menyiratkan QA padahal tak ada).
2. **[Tinggi] Revisi-lalu-eksekusi reorg** (detail §3) — bukan verbatim, bukan parkir; baseline 168/0; izinkan path-only import edit; kunci golden v4 dua fixture; bump package.json 0.12.1→0.13.x.
3. **[Tinggi] Tutup loop verify-green-but-render-wrong 3 langkah** (§5): wire loadedClassRegistry (S) → broaden styleFidelity value-coverage (M) → render-probe computed-style-first + 1 putaran repair (L).
4. **[Tinggi] Adopsi semantik fail-closed** "no-artifact / no-coverage ≠ green" + skip-ratio: referee tidak boleh pass-by-absence; verify bedakan "checks ran & passed" vs "checks skipped" (skip-ratio < threshold baru boleh hijau). Sekunder: asset crop-and-reuse.
5. **[Tinggi] Stop-list:** (a) berhenti menyebut non-Angular verify "graceful"; (b) berhenti menganggap check statik endgame — check baru harus mengukur computed output; (c) hapus `import { scssCoverage } from './fidelity.mjs'` dead di `verify.mjs:25`; (d) berhenti menaruh pengetahuan Angular baru di `src/lib` (loaded-classes, heuristik resolve, validasi referee, fidelity scssCoverage → harus mengalir ke `src/framework/angular/`); (e) populate field `.border/.opacity` atau buang (schema yang memvalidasi bentuk yang tak pernah diisi = false assurance); (f) pensiunkan/beri fixture nyata untuk 2 test eval yang selalu `t.skip`.
6. **[Sedang] Pertahankan veto council verbatim + satu penyempurnaan:** veto mencakup schema codegen-CAPABILITY ("apa yang backend butuhkan untuk emit idiom"), **BUKAN** lapisan design-token/spec netral yang mendeskripsikan INPUT. Pertimbangkan men-corve-out lapisan token (DTCG-style) lebih awal — satu-satunya yang industri share lintas framework sejak hari pertama.

---

## 8. Red-team atas rekomendasi teratas

**Rekomendasi #3-Langkah-1 (wire loadedClassRegistry) paling mungkin gagal dengan mengubah *vacuous-green* menjadi *red-untuk-alasan-salah*:** class legitimate kena-fail karena registry tak pernah melihatnya (project baru → registry kosong → semua class tampak "mati"; import vendor/global yang tak ke-scan). Ini persis regresi yang remediasi FASE 0.1 (kelas golden `mt-4/col-12/btn-block` diflag invented) diciptakan untuk cegah.
**Mitigasi:** gate di `fw.id==='angular'`; fail hanya bila registry benar-benar meresolusi chain stylesheet **dan** class terbukti absen; warn-not-fail saat registry kosong/under-resolved (catat di skip-ratio); pertahankan `mergeGoldenClasses`; landing di tier WARN dulu, jalankan fixture angular13 + angular13-rootprefix + monorepo + satu slice nyata, baru promote ke FAIL.
**Red-team ordo-2:** bahkan ter-wire benar, detektor hanya tahu "class ada di stylesheet ter-load" — pada arsitektur bill (own-SCSS komponen kosong, 100% visual dari global), registry akan benar melaporkan class ter-load → gate lulus padahal cacat sesungguhnya (komposisi global-utility yang salah memenangi cascade) tak tersentuh. Labeli jujur: gate ini menangkap "class tak ada di stylesheet mana pun" (subset drift nilai), **bukan** render oracle.

---

## 9. Keputusan yang menunggu Anda (open questions — tak bisa diturunkan dari bukti)

1. **Identitas produk:** SliceUI itu *accelerator internal/for-hire untuk satu codebase Angular bill* (UII Gateway Bill), atau *skill multi-framework publik yang sungguhan*? — Bukti (registry 100% pilar/@uiigateway, golden reference = screen bill, mock row nama pemilik, repo freelance/sliceui-skill) **kuat condong ke depth**, dan keputusan ini harus mendahului belanja effort M/L (broaden styleFidelity, render-probe, reorg). Kalau depth → klaim multi-framework tinggal *claims hygiene*; reorg (Q2) pun bisa jadi churn.
2. **Akses shell bill:** Bisakah Anda menjalankan `ng serve` app bill + menambah route preview throwaway? Fork render (a) isolated-harness vs (b) app-shell **belum terjawab & Angular/pilar-spesifik** (komponen bill terbukti 100% visual dari global class → probe isolated menyesatkan). Jika tidak bisa serve → Steps 1–2 deterministik ADALAH seluruh penutupan loop jangka dekat; render tier harus di-scope ke CI fixture app, bukan project nyata.
3. **UX harness agent:** Haruskan CLI tetap sepenuhnya otonom & vision-free, atau satu putaran "verify & repair once" interaktif (render → screenshot → model → ≤1 fix) bisa diterima? Ini menentukan apakah render tier rilis sebagai escape hatch interaktif, perintah CI, atau tidak sama sekali.
4. **Cakupan move-set reorg:** "pindahkan 6 file plan" atau "beri rumah ke SEMUA pengetahuan Angular yang tersebar di src/lib"? Menjalankan scope 6-file hari ini menyisakan ~separuh pengetahuan Angular → gagal mencapai tujuan plan sendiri.
5. *(Tambahan dari gap-critic, sebaiknya diputuskan terpisah)* **Kerahasiaan:** pisahkan grammar org (pilar/`@uiigateway`) ke profile privat/de-identifikasi vs inti umum yang boleh publik; dan pastikan baris data mahasiswa di `testing/` tak pernah bocor ke commit publik.

---

## 10. Risiko & catatan kelengkapan

- **Kelas cacat verify-hijau-salah render** terdokumentasi di industri (Qwen CI, InteractScience, Design2Code/WebSight/WAFFLE, ReLook) — bukan keanehan SliceUI; jangan dibaca sebagai kegagalan unik.
- **Screenshot-to-code** yang di-vendor (`screenshot-to-code/`) adalah **repo MIT © 2023 Abi Raja, ter-gitignore, tidak ter-commit** — mekanisme yang dianalisis datang dari snapshot tak-versioned di disk Anda. Adopsi apa pun darinya (EmptyOutputError, crop-reuse, dst.) wajib menjaga atribusi MIT di file yang disalin.
- **CI hanya `npm test` di node20/ubuntu**: tidak menguji jalur macOS (sips/swiftc), flow install skill ke `~/.claude/skills`, maupun e2e render. E2E validasi inti bergantung project bill yang **di luar repo** → CI tak bisa regression-guard output produk sesungguhnya.
- **Manusia = bottleneck throughput:** tiap generate hijau tetap menelan satu putaran mata manusia. Untuk freelancer solo, memangkas putaran per slice (≤1 auto-fix lalu sodorkan) bisa lebih tinggi leverage-nya daripada menyempurnakan verify.
- **Riset eksternal (Q5)** menyelesaikan pertanyaan metrik/render-loop dengan confidence tinggi; riset **tidak** menyelesaikan keputusan bisnis & fork shell — dua hal itu bukan pertanyaan literatur.

---

## 11. Referensi riset (source URL utama)

- Design2Code (paper): huggingface.co/papers/2403.03163 · ar5iv 2403.03163
- WebSight / WAFFLE (HTML-Match strip CSS, LLEM 99.74%, CW-SSIM): arxiv.org/html/2410.18362 · arxiv.org/abs/2403.09029
- ReLook (zero-reward invalid-render 40→80%, forced-optimization): huggingface.co/papers/2510.11498 · ar5iv 2510.11498
- RILA (AIV, ERS via Playwright); WebGen-Agent (Step-GRPO screenshot+GUI); VAGEN (active verification > passive judging)
- render-loop (pixel diff tak bisa converge; best-so-far; generator tak lihat jawaban): github.com/dev48v/render-loop
- visual-parity-mcp (computed-style/rect probes + clustering root-cause): npmjs.com/package/visual-parity-mcp
- Playwright visual comparisons (`toHaveScreenshot`, pixelmatch, mask, animations:disabled): playwright.dev/docs/test-snapshots
- computed-css-diff (computed-style differential, viewports, pseudo): npmjs.com/package/computed-css-diff
- design-quality-gate ("visual regression isn't enough"): dev.to/jaydrao215/…
- Argos CI (Visual Testing for AI Coding Agents); QwenLM/qwen-code PR #7375 (green-but-unrendered ×3)
- abi/screenshot-to-code (engine loop, screenshot_preview, Evaluation.md): deepwiki.com/abi/screenshot-to-code · github.com/abi/screenshot-to-code · blog/evaluating-claude.md
- Mitosis (JSON IR + per-target serializers; issue #498): github.com/dcerniglia/mitosis · BuilderIO/mitosis/issues/498
- CMSgov design-system (menolak sentralisasi Mitosis): github.com/CMSgov/design-system/discussions/3525
- Plasmic (rich design-IR, production codegen React-only): deepwiki.com/plasmicapp/plasmic/10.1-react-codegen-pipeline
- Builder.io (content-as-data, per-framework component map); IgniteUI theming (design tokens cross-fw, DTCG/Style Dictionary)
- Debugging Decay Index / iteration decay: icml.cc/virtual/2026/77879 · link.springer.com/article/10.1038/s41598-025-27846-5
- Biaya token screenshot vs structured data: nameocean.net/article/… ; dev.to/stevez/how-fast-can-browser-automation-be-…

---

## 12. Lampiran — metode & artefak

- **Audit 4 lensa (kode v0.13.x post-merge):** Angular-focus (74/100 + trace React), kematangan plan reorg, root-cause presisi, mesin screenshot-to-code.
- **Riset 4 topik (internet, dengan source):** mekanisme fidelity, multi-framework/IR, metrik kemiripan berlapis, loop evaluasi-driven.
- **Sintesis 2:** kritik adversarial (agreement/conflict/recommendation/red-team/open-questions) + completeness critic (single-customer, confidentiality, konflasi sumbu, CI-blocked, license, human-bottleneck).
- File output workflow: `fa91c790…/tasks/wai8lrr9a.output` (hasil JSON lengkap 10 agen, ~150KB).
- Dokumen terkait di repo: `SLICEUI-GAP-ANALYSIS-2026-09-05.md`, `REMEDIATION-PLAN-2026-09-05.md`, `PLAN-framework-reorg-e2e.md`.
