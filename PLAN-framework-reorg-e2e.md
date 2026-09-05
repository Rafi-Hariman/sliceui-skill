# Plan: Framework Reorg + Interactive Init (E2E)

> **Status:** DIREVISI (2026-09-05) terhadap graf module v0.13.x — "apa" masih benar, "bagaimana" sudah di-rebaseline. Eksekusi di branch `feat/framework-reorg` (BUKAN `main`).
> **Sumber keputusan:** 3× LLM Council (2026-08-31) + audit 10-agen + LLM Council strategis (2026-09-05). Verdict final dikunci.
> **Baseline asli:** v0.9.0 (`96f7689`), 103/103 test hijau. **Baseline saat ini (revisi):** v0.13.0, **181 test (179 pass / 2 skip)**. Test bertambah +2 (init), +1 (verify loadedClass source-none), +4 (styleFidelity value-coverage), +3 (uii-profile).

---

## 1. Tujuan

SliceUI saat ini Angular-first: pengetahuan framework tersebar di beberapa file `src/lib/` yang berisi hardcode Angular/`.component.*`. Tujuannya **bukan** membuat framework-neutral abstraction, tapi menata ulang repo supaya tiap framework punya "rumah" sendiri (`src/framework/<id>/`), sehingga nanti React/Vue/Svelte/Next bisa ditambah satu-per-satu tanpa mengacak file yang sudah ada.

> **Status pasca-WS1–WS6 (v0.13.1):** sebagian relokasi SUDAH terjadi — grammar org UII sudah dikeluarkan dari shared & di-gate ke `src/lib/profiles/uii.mjs`; klaim README sudah per-lapis jujur; verify sudah ter-wire loadedClass + value-coverage. Plan ini kini berfokus pada relokasi struktur Angular yang tersisa (`framework/angular/`) — bukan lagi "mulai dari nol".

## 2. Keputusan council (DIKUNCI — jangan dilanggar)

1. **Folder `framework/` sebagai tata letak murni = murah & aman → KERJAKAN.**
2. **`index.mjs` descriptor + skema `capabilities` = prematur → JANGAN ditulis sekarang.** Ini abstraction yang ditolak council; hanya boleh muncul SETELAH React membuktikan field mana yang nyata.
3. **`initCore()` shared = prematur → JANGAN diekstrak sekarang.** Ekstrak setelah React jalan, dari diff yang benar-benar identik.
4. **Konfirmasi interaktif `init` = plumbing murni, independen → KERJAKAN (Jalur B).**
5. **Target bukan "equal".** React dikerjakan mendalam dulu, baru Vue → Svelte → Next.

> **Catatan revisi (2026-09-05):** grammar org UII sudah di-gate ke `src/lib/profiles/uii.mjs` (keputusan kerahasiaan user). Saat reorg dieksekusi, file ini pindah utuh ke `src/framework/angular/uii-profile.mjs` — seam-nya sudah siap. Catatan penting: `project-context` `capabilities`/`libraries` map (v4) adalah **runtime per-project instance data**, BUKAN descriptor statis per-framework yang diveto (styleScoping/componentModel/eventModel/verifyChecks/tokenMining) — veto tidak "sengaja terpenuhi" olehnya.

## 3. Scope

**MASUK (dikerjakan di plan ini):**
- **Jalur A** — pindahkan pengetahuan Angular/UII yang tersisa → `src/framework/angular/` (refactor murni, 179/181 test hijau, zero behavior change).
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
- `conventions.mjs` di-import oleh: **`src/lib/verify.mjs`** (LIBRARY_INTERNAL/WRAPPER_GUARD/TRIVIAL_CLASS), `src/commands/detect.mjs` (extractConventions), `src/commands/init.mjs` (renderConventionsMd/mergeGoldenClasses/goldenCompanionFiles), + **file test**: `test/conventions.test.mjs` (impor `../src/lib/conventions.mjs`). **`resolve.mjs` TIDAK import conventions** (nol import — murni, terima param). **`referee.mjs` TIDAK import conventions** (impor hanya `fidelity.mjs`). **`detect.test.mjs` TIDAK import conventions.** Plan lama keliru mencantumkan resolve/referee/detect.test & melupakan verify.
- `library-registry.mjs` di-import oleh `library-scan.mjs` **saja** (detect TIDAK mengimpornya; registry dipakai via `scanLibraryUsage`). File test yang import langsung: **tidak ada** (`library-scan.test.mjs` import `scanLibraryUsage` dari library-scan, bukan registry).
- `profiles/uii.mjs` di-import oleh: **`src/lib/verify.mjs`** (`UII_AUTHKEY_BY_ACTION`), **`src/lib/library-scan.mjs`** (`UII_REGISTRY_ENTRIES`), **`src/commands/init.mjs`** (`renderUiiProfileMd`), + `test/uii-profile.test.mjs`. **`library-registry.mjs` TIDAK mengimpornya** (hanya `withUiiEntries` yang terima param dari library-scan) — koreksi dari revisi pertama.

## 5. Jalur A — pindah-murni (step by step, desain final 2026-09-05)

> **Prinsip desain yang menyelesaikan masalah audit:** *whole-file move untuk modul yang monolit org/Angular; split HANYA untuk modul yang seam fungsi Angular-nya nyata.* Pengecekan `checkIconColor` membuktikan verify monolit: ia hardcode `FA_ICON_COLORS` (warna status + glyph org) — 21 check-nya saling berbagi helper & mengasumsikan output Angular. **Split verify (7-vs-generik versi lama) tidak akan compilable** — `iconColor` yang diklaim "generik murni" ternyata org-specific. Maka verify pindah **utuh**, bukan di-split. Batas "framework-agnostik" baru relevan saat framework #2 punya verify sendiri.

### A1. Whole-file moves — modul monolit org/Angular → `src/framework/angular/`

```
git mv src/lib/profiles/uii.mjs      src/framework/angular/uii-profile.mjs   # grammar org 100%
git mv src/lib/conventions.mjs       src/framework/angular/conventions.mjs   # corpus ::ng-deep / uii-table anatomy / (click) naming (~90%)
git mv src/lib/verify.mjs            src/framework/angular/verify.mjs        # 21-check gate Angular+org (monolit — JANGAN split)
```

**Yang TETAP di `src/lib/` (lapisan shared/generic):**
- `library-registry.mjs` — generic pasca-WS5 (org entry keluar). **KEPUTUSAN USER:** tetap shared. `withUiiEntries()` tinggal (terima param dari library-scan).
- `loaded-classes.mjs` — `extractClassSelectors` generik; sisi "Angular-fed" (styles[] chain) datang dari stylePaths yang diisi detect. TETAP shared.
- `library-scan.mjs` — resolver; tetap shared, tapi meng-import `uii-profile` (kondisi profile). Layering ini diterima: library-scan memang resolver yang sadar profile.
- `style-tokens.mjs`, `fidelity.mjs`, `render-transcript.mjs`, `figml-parse.mjs` — generik/transkripsi. TETAP.

### A2. Split move — hanya `detect.mjs` (seam fungsi Angular nyata)

Pindahkan **fungsi yang self-contained** (tak memanggil balik ke orchestrator) ke `src/framework/angular/detect-angular.mjs`:
`detectAngularDetails`, `detectModuleStructure`, `collectSelectors`, `selectorPrefix`, `resolvePrefix`, `detectUiLibrary`.
Mereka hanya butuh helper fs generik (`readJsonSafe`/`readFileSyncSafe`/`existsSync`) — export & import bersih, zero behavior change.

**Yang TETAP di `src/commands/detect.mjs`** (orchestrator + generik): `detectProject`, `uiiFingerprint`, `detectFramework`, `parseMajor`, `guessComponentDir`, `detectStyleExt`, `extractTsconfigPaths`, `walkFiles`, helpers fs, `findSampleComponents`/`readGoldenReferences` (orchestrator-level; blok `if (fw.id==='angular')` inline tetap di orchestrator & memanggil fungsi Angular yang di-import). **Catatan jujur:** sebagian Angular inline (branch `if angular`, `readGoldenReferences` `.component.ts`) tetap berada di orchestrator — ini batas realistis dari pindah-murni; membersihkannya butuh refactor perilaku (di luar scope reorg).

### A3. Rewire import (daftar FINAL — setelah A1/A2)

- `library-scan.mjs`: `CATEGORIES, registryEntries, withUiiEntries` tetap dari `./library-registry.mjs` (TIDAK pindah). `UII_REGISTRY_ENTRIES` → `from "../framework/angular/uii-profile.mjs"` (path baru).
- `commands/init.mjs`: `renderConventionsMd/mergeGoldenClasses/goldenCompanionFiles` dari `../framework/angular/conventions.mjs`; `renderUiiProfileMd` dari `../framework/angular/uii-profile.mjs`.
- `commands/detect.mjs`: `extractConventions` dari `../framework/angular/conventions.mjs`; `detectAngularDetails` dkk dari `../framework/angular/detect-angular.mjs`.
- `commands/verify.mjs`: `verifyComponent` dari `../framework/angular/verify.mjs` (path berubah karena verify-lib pindah).
- `lib/verify.mjs` TIDAK ada lagi (pindah). Impor `conventions`/`uii` di dalamnya ikut jadi relatif ke `framework/angular/` (satu folder).
- **Dead import `scssCoverage` dari `fidelity.mjs`** di verify — hapus (sudah ditandai audit; bukan behavior).
- `frameworks.mjs` (opsional, low-value): entri `angular` di `FRAMEWORK_RULES` → `../framework/angular/rules.mjs`; `getFrameworkRules` import & tetap dispatcher. Boleh ditunda bila ingin scope minimal.
- **Koreksi final:** `resolve.mjs`/`referee.mjs` nol-import modul tsb — tak perlu rewire. `library-registry` tidak import profile — tak perlu rewire.
- **WAJIB (path-only, larang ubah asersi):** `test/conventions.test.mjs` (→ framework/angular/conventions), `test/verify.test.mjs` + `test/eval-hope-sliceui.test.mjs` (→ framework/angular/verify), `test/uii-profile.test.mjs` (→ framework/angular/uii-profile), `test/library-scan.test.mjs` (import scanLibraryUsage — path library-scan tak berubah, tapi bila impor profile ikut). `detect.test.mjs`/`init.test.mjs` TIDAK perlu (via fungsi).

### A4. Test + commit

```
npm test          # harus 179/181 hijau (2 skip) — ZERO behavior change
git add -A && git commit   # satu commit per file-move bila memudahkan bisect
```

**Catatan post-reorg (BUKAN bagian move, hindari scope-creep):** dedup `walkNodes` (3×: verify/resolve/figml-parse) → satu home shared; verifikasi byte-identity golden JSON v4 utk `angular13` + `angular13-rootprefix` (bukan sekadar unit-green).

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

> **Status verifikasi (audit 2026-09-05):** Jalur B **belum diimplementasikan sama sekali** — `init.mjs` hanya parse `--key-from`; tak ada `--framework`/`--yes`/`isTTY`. Plan §6 utuh & valid. **Gap tambahan:** keputusan UII-gating (WS3) menyimpan `profile` otomatis dari fingerprint, tapi **belum ada flag override** `sliceui init --profile uii|generic|auto` untuk koreksi misdeteksi — tambahkan di Jalur B bila diinginkan. Catatan: `bootstrap5`/`native-html` tak pernah jadi output `detectFramework` (hanya angular/nextjs/svelte/vue-sfc/react-tsx/tailwind) — semantik `--framework bootstrap5|native-html` perlu didefinisikan.

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
