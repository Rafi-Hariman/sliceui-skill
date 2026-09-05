# Plan: Framework Reorg + Interactive Init (E2E)

> **Status:** DIREVISI (2026-09-05) terhadap graf module v0.13.x — "apa" masih benar, "bagaimana" sudah di-rebaseline. Eksekusi di branch `feat/framework-reorg` (BUKAN `main`).
> **Sumber keputusan:** 3× LLM Council (2026-08-31) + audit 10-agen + LLM Council strategis (2026-09-05). Verdict final dikunci.
> **Baseline asli:** v0.9.0 (`96f7689`), 103/103 test hijau. **Baseline saat ini (revisi):** v0.13.0, **181 test (179 pass / 2 skip)**. Test bertambah +2 (init), +1 (verify loadedClass source-none), +4 (styleFidelity value-coverage), +3 (uii-profile).

---

## 1. Tujuan

SliceUI saat ini Angular-first: pengetahuan framework tersebar di 6 file, semuanya berisi hardcode Angular. Tujuannya **bukan** membuat framework-neutral abstraction, tapi menata ulang repo supaya tiap framework punya "rumah" sendiri (`src/framework/<id>/`), sehingga nanti React/Vue/Svelte/Next bisa ditambah satu-per-satu tanpa mengacak file yang sudah ada.

## 2. Keputusan council (DIKUNCI — jangan dilanggar)

1. **Folder `framework/` sebagai tata letak murni = murah & aman → KERJAKAN.**
2. **`index.mjs` descriptor + skema `capabilities` = prematur → JANGAN ditulis sekarang.** Ini abstraction yang ditolak council; hanya boleh muncul SETELAH React membuktikan field mana yang nyata.
3. **`initCore()` shared = prematur → JANGAN diekstrak sekarang.** Ekstrak setelah React jalan, dari diff yang benar-benar identik.
4. **Konfirmasi interaktif `init` = plumbing murni, independen → KERJAKAN (Jalur B).**
5. **Target bukan "equal".** React dikerjakan mendalam dulu, baru Vue → Svelte → Next.

> **Catatan revisi (2026-09-05):** grammar org UII sudah di-gate ke `src/lib/profiles/uii.mjs` (keputusan kerahasiaan user). Saat reorg dieksekusi, file ini pindah utuh ke `src/framework/angular/uii-profile.mjs` — seam-nya sudah siap. Catatan penting: `project-context` `capabilities`/`libraries` map (v4) adalah **runtime per-project instance data**, BUKAN descriptor statis per-framework yang diveto (styleScoping/componentModel/eventModel/verifyChecks/tokenMining) — veto tidak "sengaja terpenuhi" olehnya.

## 3. Scope

**MASUK (dikerjakan di plan ini):**
- **Jalur A** — pindahkan pengetahuan Angular → `src/framework/angular/` (refactor murni, 103 test hijau, zero behavior change).
- **Jalur B** — `sliceui init` konfirmasi interaktif + flag `--framework <id>` / `--yes`.

**KELUAR (ditunda — jangan disentuh):**
- `index.mjs` descriptor, skema `capabilities`, `initCore()`.
- Kode React/Vue/Svelte/Next apa pun.

## 4. Peta saat ini — di mana pengetahuan Angular/UII tinggal (graf v0.13.x)

> **Pembaruan kunci vs v0.9.0:** pengetahuan org kini sebagian sudah dipindah ke `src/lib/profiles/uii.mjs` (ter-gate UII, lihat §5-A3). Sisa yang perlu direlokasi ke `src/framework/angular/` berkurang untuk grammar org, tapi lapisan Angular struktural (file-split, `.component.*`, decorator, template syntax) masih tersebar.

| File | Isi (v0.13.x) | Sifat |
|---|---|---|
| `src/lib/library-registry.mjs` | `REGISTRY` generic (`ngx-*`, `mat-*`, `primeng`, Bootstrap) + `CATEGORIES`; **org entries sudah keluar** → `profiles/uii.mjs` `UII_REGISTRY_ENTRIES` (ter-gate) | CAMPUR |
| `src/lib/profiles/uii.mjs` | **BARU (v0.13.1)** — home grammar org: `UII_REGISTRY_ENTRIES`, `UII_ACTION_AUTH_ICON`, `UII_AUTHKEY_BY_ACTION`, `renderUiiProfileMd()` | 100% org/Angular |
| `src/lib/conventions.mjs` | export = aggregate `extractConventions(root,{prefix})` + 6 named (`TRIVIAL_CLASS`, `mergeGoldenClasses`, `goldenCompanionFiles`, `LIBRARY_INTERNAL`, `LIBRARY_INTERNAL_WRAPPER_GUARD`, `renderConventionsMd`). Corpus extractor (`extractNgDeepCorpus`/anatomy/naming) **privat** di balik aggregate | ~90% Angular |
| `src/commands/detect.mjs` | `detectFramework` generik + `uiiFingerprint` (BARU) + branch `fw.id==='angular'` meng-gate deep-detect (prefix/module/styles/loaded-classes/golden `.component.ts`) | CAMPUR |
| `src/lib/verify.mjs` | **21 check** + impor `fidelity.scssCoverage` (dead), `conventions` (LIBRARY_INTERNAL/WRAPPER_GUARD/TRIVIAL_CLASS), `profiles/uii` (`UII_AUTHKEY_BY_ACTION`); check `rowAuth` = org auth | CAMPUR |
| `src/lib/loaded-classes.mjs` | **BARU (v0.11+)** — miner kelas-ter-load, digerakkan `angular.json styles[]` (Angular-fed) | CAMPUR |
| `src/lib/prompt-rules/frameworks.mjs` | `FRAMEWORK_RULES` — 8 framework. Sudah multi-framework | CAMPUR |
| `src/lib/style-tokens.mjs` | `extractStyleTokens` — GENERIK, tapi hanya dipanggil saat `stylePaths.length` (diisi branch Angular; `detect.mjs:92`) | GENERIK |

**Dependen yang meng-import file di atas** (koreksi v0.13 — **bukan** daftar v0.9.0):
- `conventions.mjs` di-import oleh: **`src/lib/verify.mjs`** (LIBRARY_INTERNAL/WRAPPER_GUARD/TRIVIAL_CLASS), `src/commands/detect.mjs` (extractConventions), `src/commands/init.mjs` (renderConventionsMd/mergeGoldenClasses/goldenCompanionFiles), + **file test** (`conventions.test.mjs`, `detect.test.mjs`, `verify.test.mjs`…). **`resolve.mjs` TIDAK import conventions** (nol import — murni, terima param). **`referee.mjs` TIDAK import conventions** (impor hanya `fidelity.mjs`). Plan lama keliru mencantumkan resolve/referee & melupakan verify.
- `library-registry.mjs` di-import oleh `library-scan.mjs` + `commands/detect.mjs`.
- `profiles/uii.mjs` di-import oleh `verify.mjs`, `library-registry.mjs`, `library-scan.mjs`, `commands/init.mjs` (+ `resolve.mjs`-kelak via corpus).

## 5. Jalur A — pindah-murni (step by step)

### A1. Whole-file moves (file 100% Angular → pindah utuh)

```
git mv src/lib/library-registry.mjs  src/framework/angular/registry.mjs
git mv src/lib/conventions.mjs       src/framework/angular/conventions.mjs
```

### A2. Split moves (ekstrak bagian Angular/UII, sisakan yang generik) — inventaris v0.13

- **`detect.mjs`** — pindahkan ke `src/framework/angular/detect.mjs`: `detectAngularDetails`, `detectModuleStructure`, `collectSelectors`, `selectorPrefix`, `resolvePrefix`, `detectUiLibrary`, cabang `readGoldenReferences` (`.component.ts`), cabang Angular `findSampleComponents`, dan blok `if (fw.id === "angular") { … }` (yang juga mengisi `stylePaths` → `loadedClassRegistry`). `uiiFingerprint` (murni generik, di `detect.mjs`) TETAP. Yang TETAP generik: `detectFramework`, `parseMajor`, `guessComponentDir`, `detectStyleExt`, `extractTsconfigPaths`, `walkFiles`, helpers fs, `detectProject` (orchestrator). **Catatan v0.13:** deep-detect Angular kini mengalir ke `extractLoadedClasses` & `extractConventions` — seam pindah harus ikut mencakup orkestrasi itu.
- **`verify.mjs`** — pindahkan ke `src/framework/angular/verify.mjs`. Inventaris v0.13: **21 check**, bukan 7-vs-2. Check org/Angular-substansi: `scssCoverage`, `noBareNgDeep`, `noHashedSelectors`, `noHashedSelectors`, `tableBindings`, `ngxSelectBinding`, `rowAuth` (auth pilar — via `UII_AUTHKEY_BY_ACTION`), `filterRowButton`, `buttonOrder`, `tableOptions`, `gridColumns`, `noTranslation`, `inventedUtility`, `loadedClass` (registry Angular-fed), `classVocabulary`, `anatomy`, `mockRowCount`, `phantomWrapper`. Check generik murni: `textCoverage` (rendered), `styleFidelity` (value-coverage, authored-rule — **framework-agnostik**, kejujuran ini penting), `iconColor`. Helper bersama yang harus diinventaris sebelum split: `requiredAuthKeysFromXml`, `normalizeFigmaAction`, `detectAuthFlags`, `divTree`/`isRow`/`isCol`/`classOf`, `filterButtonsFromXml`, `stripComments`/`cssEscape`, `renderedText`, `declMap`/`resolveHex`/`pxNum`/`weightNum`. `verifyComponent` (orchestrator) memanggil dari dua tempat. **`walkNodes` duplikat 3×** (verify/resolve/figml-parse) — pilih satu home shared, jangan anggap verify-local.
- **`conventions.mjs`** — pindahkan ke `src/framework/angular/conventions.mjs` bila tujuannya "semua knowledge Angular satu rumah". Export aggregate `extractConventions` + 6 named ikut. **Catatan:** corpus extractor (`extractNgDeepCorpus`/anatomy/naming) privat di balik aggregate — module tetap kohesif; importers pindah ke aggregate.
- **`loaded-classes.mjs`** — Angular-fed miner (styles[] chain). Pindah ke framework/angular bila dalam scope; `extractClassSelectors` sendiri generik.
- **`profiles/uii.mjs`** — grammar org 100%. Pada reorg ini → `src/framework/angular/uii-profile.mjs` (seam sudah disiapkan; importer: verify, library-registry, library-scan, init).
- **`frameworks.mjs`** — entri `angular` di `FRAMEWORK_RULES` → `src/framework/angular/rules.mjs`. 7 rules lain tetap di dispatcher. `getFrameworkRules(id)` tetap titik masuk tunggal.

### A3. Rewire import (daftar BENAR v0.13 — perbaiki yang lama)

- `library-scan.mjs`: `import { CATEGORIES, registryEntries, withUiiEntries } from "./library-registry.mjs"` + `UII_REGISTRY_ENTRIES` dari profile → path baru.
- `verify.mjs` (lib): impor `conventions` (LIBRARY_INTERNAL/WRAPPER_GUARD/TRIVIAL_CLASS) + `fidelity.scssCoverage` (dead import — hapus/aktifkan) + `profiles/uii` (`UII_AUTHKEY_BY_ACTION`) → path baru.
- `detect.mjs` / `init.mjs`: impor `conventions` (`extractConventions`/`renderConventionsMd`/`mergeGoldenClasses`/`goldenCompanionFiles`), `loaded-classes`, `profiles/uii` (`renderUiiProfileMd`) → path baru.
- `commands/verify.mjs`: import `verifyComponent` dari lib → tak berubah bila orchestrator tetap di lib; update hanya bila verify-lib pindah.
- **Koreksi daftar lama:** `resolve.mjs` TIDAK import conventions (nol import) — tak perlu rewire. `referee.mjs` TIDAK import conventions (hanya `fidelity.mjs`) — tak perlu rewire. Daftar lama keliru.
- **WAJIB:** semua file **test** yang import path `../src/lib/{conventions,library-registry,library-scan,verify,loaded-classes}.mjs` harus di-update **path-only** (larang ubah asersi) — `conventions.test.mjs`, `library-scan.test.mjs`, `detect.test.mjs`, `verify.test.mjs`, `init.test.mjs`, `uii-profile.test.mjs`, `eval-hope-sliceui.test.mjs`.

### A4. Test + commit

```
npm test          # harus 179/181 hijau (2 skip) — ZERO behavior change
git add -A && git commit
```

## 6. Jalur B — konfirmasi interaktif + flag

Di `src/commands/init.mjs`:

```
sliceui init                      # deteksi framework → prompt "Init SliceUI for Next.js? [Y/n]"
sliceui init                      # (ambigu: >1 framework) → pilih nomor
sliceui init --framework nextjs   # skip deteksi + konfirmasi, langsung jalankan
sliceui init --yes                # skip konfirmasi (untuk agent non-interaktif)
```

Aturan:
- Konfirmasi **hanya aktif jika `process.stdin.isTTY`** DAN tidak ada `--framework`/`--yes`.
- `--framework <id>` memaksa framework id (valid: `angular`, `react-tsx`, `nextjs`, `vue-sfc`, `svelte`, `tailwind`, `bootstrap5`, `native-html`).
- Ambigu (multi-framework terdeteksi) → prompt pilih, bukan diam-diam `present[0]`.
- Jalankan `detect` TETAP sama (output `.sliceui/project-context.json` tidak berubah).

## 7. Acceptance criteria (SEMUA harus terpenuhi) — di-rebaseline v0.13

- [ ] `npm test` → **179 pass / 2 skip (~181)** (baseline v0.13.0; bukan 103/103 lagi). Tidak ada test yang berubah **makna/asersi**; hanya edit **path-only** pada import test bila perlu.
- [ ] Zero behavior change: `sliceui detect` di fixture `test/fixtures/angular13` **dan** `angular13-rootprefix` menghasilkan `project-context.json` v4 yang identik (kunci golden JSON v4 utk KEDUA fixture; objek kini memuat `loadedClassRegistry`, `conventions`, `designTokens`, `profile`).
- [ ] `sliceui init --framework nextjs` di proyek Next.js fixture menghasilkan `.sliceui/` + `project-context.json` framework `nextjs` + `conventions.json/md` + referee. *(Catatan: tak ada fixture nextjs di test/fixtures — tambah atau reword.)*
- [ ] `sliceui init --yes` berjalan tanpa prompt (non-interaktif).
- [ ] Tidak ada file `index.mjs` baru, tidak ada skema `capabilities`, tidak ada `initCore()`.
- [ ] Jalur UII tidak berubah: proyek uii tetap resolve pilar/uii + profile aktif; proyek generic tak pernah memuat grammar org (regresi `uii-profile.test.mjs`).

## 8. DO NOT (anti-pattern yang sudah diveto council)

- ❌ Tulis `index.mjs` descriptor / skema `capabilities` (`styleScoping`, `componentModel`, `eventModel`, `verifyChecks`, `tokenMining`).
- ❌ Ekstrak `initCore()` shared.
- ❌ Tambah kode React/Vue/Svelte/Next.
- ❌ Ubah perilaku `detect`/`verify`/`conventions` — ini refactor murni, bukan redesign.
- ❌ Hapus test yang ada atau kendurkan asersi untuk "membuat hijau".

## 9. Follow-up (SETELAH plan ini selesai, SEBELUM framework kedua)

1. **Koreksi prinsip "never add wrappers"** — ✅ **SELESAI (v0.10–0.13):** SKILL.md Pass-1 STRUCTURE + `checkPhantomWrapper` (menyempit ke `.well`/`page-canvas`) sudah di-re-scope ke "conventions never ADD structural wrappers; struktur dari XML/transcript only".
2. **Selesaikan kategori** — ⏳ **MASIH TERBUKA.** `tailwind` = styling layer (bukan framework setara Angular); `nextjs` = React + conventions (putuskan: folder sendiri atau flag di React). Putuskan SEBELUM menambah folder `src/framework/<id>/` non-angular.

## 10. Cara verifikasi akhir (di branch)

```
npm test
node src/cli.mjs detect   # di test/fixtures/angular13 → bandingkan output
node src/cli.mjs init --framework nextjs   # di proyek Next.js sementara → cek .sliceui/
```

Setelah semua hijau + acceptance criteria terpenuhi → buka PR dari `feat/framework-reorg` ke `main` (jangan push/publish tanpa konfirmasi user).
