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

## 4. Peta — pengetahuan Angular/UII tinggal (graf v0.13.1, PASCA-Jalur-A)

> **Status: Jalur A SUDAH DIEKSEKUSI** (commit `3ed3963` + `ad98033` di `feat/framework-reorg`). Peta ini = **hasil akhir**, bukan lagi "target". Yang tersisa dari plan = Jalur B + cleanup opsional.

| File | Isi (v0.13.1) | Sifat |
|---|---|---|
| `src/framework/angular/verify.mjs` | **21 check** gate Angular+org (monolit; pindah dari `src/lib/`). Impor relatif: `./conventions.mjs`, `./uii-profile.mjs`. `fidelity.scssCoverage` dead-import **sudah dihapus** | org/Angular |
| `src/framework/angular/conventions.mjs` | export = aggregate `extractConventions` + 6 named. Corpus extractor privat | ~90% Angular |
| `src/framework/angular/uii-profile.mjs` | Home grammar org: `UII_REGISTRY_ENTRIES`, `UII_ACTION_AUTH_ICON`, `UII_AUTHKEY_BY_ACTION`, `renderUiiProfileMd()` | 100% org/Angular |
| `src/framework/angular/detect-angular.mjs` | 5 fungsi Angular deep-detect (detectAngularDetails, collectSelectors, selectorPrefix, resolvePrefix, detectModuleStructure) — dipisah dari orchestrator | 100% Angular |
| `src/commands/detect.mjs` | Orchestrator generik: `detectProject`, `uiiFingerprint`, `detectFramework`, `detectUiLibrary` (dipanggil semua fw), `findSampleComponents`/`readGoldenReferences`. Impor Angular dari `../framework/angular/` | CAMPUR |
| `src/lib/detect-utils.mjs` | Helper fs/walk/token bersama (`walkFiles`, `readJsonSafe`, `readFileSyncSafe`, `extOf`, `toRel`, `extractTsconfigPaths`, `SKIP_DIRS`) — di-share detect.mjs + detect-angular.mjs (hindari circular import) | GENERIK |
| `src/lib/library-registry.mjs` | `REGISTRY` generic + `CATEGORIES` + `registryEntries`/`withUiiEntries`. **TIDAK pindah** (generic pasca-WS5; keputusan user). `UII_REGISTRY_ENTRIES` di-merge dari profile | GENERIK |
| `src/lib/library-scan.mjs` | Resolver capabilities. Impor `registryEntries`/`withUiiEntries` (lib) + `UII_REGISTRY_ENTRIES` (`../framework/angular/uii-profile.mjs`) | CAMPUR |
| `src/lib/loaded-classes.mjs`, `style-tokens.mjs`, `prompt-rules/frameworks.mjs`, transkripsi | TETAP di `src/lib/` (generik/shared) | GENERIK |

**Dependen yang meng-import (pasca-Jalur-A):**
- `framework/angular/conventions.mjs` di-import oleh: `framework/angular/verify.mjs` (satu folder), `commands/detect.mjs`, `commands/init.mjs`, + `test/conventions.test.mjs`. `resolve.mjs`/`referee.mjs` TIDAK (nol import).
- `framework/angular/uii-profile.mjs` di-import oleh: `framework/angular/verify.mjs` (`UII_AUTHKEY_BY_ACTION`), `lib/library-scan.mjs` (`UII_REGISTRY_ENTRIES`), `commands/init.mjs` (`renderUiiProfileMd`), + `test/uii-profile.test.mjs`.
- `framework/angular/detect-angular.mjs` di-import oleh: `commands/detect.mjs` (`detectAngularDetails`).
- `lib/detect-utils.mjs` di-import oleh: `commands/detect.mjs` + `framework/angular/detect-angular.mjs`.

## 5. Jalur A — pindah-murni (step by step, desain final 2026-09-05)

> **Prinsip desain yang menyelesaikan masalah audit:** *whole-file move untuk modul yang monolit org/Angular; split HANYA untuk modul yang seam fungsi Angular-nya nyata.* Pengecekan `checkIconColor` membuktikan verify monolit: ia hardcode `FA_ICON_COLORS` (warna status + glyph org) — 21 check-nya saling berbagi helper & mengasumsikan output Angular. **Split verify (7-vs-generik versi lama) tidak akan compilable** — `iconColor` yang diklaim "generik murni" ternyata org-specific. Maka verify pindah **utuh**, bukan di-split. Batas "framework-agnostik" baru relevan saat framework #2 punya verify sendiri.

### A1. Whole-file moves — modul monolit org/Angular → `src/framework/angular/` ✅ SELESAI (commit `3ed3963`)

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

> **Status: SELESAI (commit `ad98033`).** Fungsi yang benar-benar dipindah (5, bukan 6): `detectAngularDetails`, `collectSelectors`, `selectorPrefix`, `resolvePrefix`, `detectModuleStructure`. **`detectUiLibrary` TETAP di detect.mjs** — saat eksekusi terbukti dipanggil utk semua framework (daftar `uiLibs` berisi mui/antd/vuetify), jadi BUKAN Angular-only (koreksi dari desain awal di A2). Helper fs generik dipindah ke `src/lib/detect-utils.mjs` (bukan duplikasi) agar `detect-angular.mjs` tak impor balik ke orchestrator.

**Yang TETAP di `src/commands/detect.mjs`** (orchestrator + generik): `detectProject`, `uiiFingerprint`, `detectFramework`, `parseMajor`, `detectUiLibrary`, `guessComponentDir`, `detectStyleExt`, `findSampleComponents`/`readGoldenReferences` (orchestrator-level; blok `if (fw.id==='angular')` inline tetap di orchestrator & memanggil `detectAngularDetails` yang di-import). **Catatan jujur:** sebagian Angular inline (branch `if angular`, `readGoldenReferences` `.component.ts`) tetap berada di orchestrator — ini batas realistis dari pindah-murni; membersihkannya butuh refactor perilaku (di luar scope reorg).

### A3. Rewire import ✅ SELESAI (commit `3ed3963` + `ad98033`)

- `library-scan.mjs`: `CATEGORIES, registryEntries, withUiiEntries` tetap dari `./library-registry.mjs` (TIDAK pindah). `UII_REGISTRY_ENTRIES` → `from "../framework/angular/uii-profile.mjs"` (path baru).
- `commands/init.mjs`: `renderConventionsMd/mergeGoldenClasses/goldenCompanionFiles` dari `../framework/angular/conventions.mjs`; `renderUiiProfileMd` dari `../framework/angular/uii-profile.mjs`.
- `commands/detect.mjs`: `extractConventions` dari `../framework/angular/conventions.mjs`; `detectAngularDetails` dkk dari `../framework/angular/detect-angular.mjs`.
- `commands/verify.mjs`: `verifyComponent` dari `../framework/angular/verify.mjs` (path berubah karena verify-lib pindah).
- `lib/verify.mjs` TIDAK ada lagi (pindah). Impor `conventions`/`uii` di dalamnya ikut jadi relatif ke `framework/angular/` (satu folder).
- **Dead import `scssCoverage` dari `fidelity.mjs`** di verify — hapus (sudah ditandai audit; bukan behavior).
- `frameworks.mjs` (opsional, low-value): entri `angular` di `FRAMEWORK_RULES` → `../framework/angular/rules.mjs`; `getFrameworkRules` import & tetap dispatcher. Boleh ditunda bila ingin scope minimal.
- **Koreksi final:** `resolve.mjs`/`referee.mjs` nol-import modul tsb — tak perlu rewire. `library-registry` tidak import profile — tak perlu rewire.
- **WAJIB (path-only, larang ubah asersi):** `test/conventions.test.mjs` (→ framework/angular/conventions), `test/verify.test.mjs` + `test/eval-hope-sliceui.test.mjs` (→ framework/angular/verify), `test/uii-profile.test.mjs` (→ framework/angular/uii-profile), `test/library-scan.test.mjs` (import scanLibraryUsage — path library-scan tak berubah, tapi bila impor profile ikut). `detect.test.mjs`/`init.test.mjs` TIDAK perlu (via fungsi).

### A4. Test + commit ✅ SELESAI — 179/181 hijau, zero behavior change

```
npm test          # 179/181 hijau (2 skip) — ZERO behavior change ✓
git add -A && git commit
```

**Catatan post-reorg (BUKAN bagian move, hindari scope-creep):** dedup `walkNodes` (3×: verify/resolve/figml-parse) → satu home shared; verifikasi byte-identity golden JSON v4 utk `angular13` + `angular13-rootprefix` (bukan sekadar unit-green). *(Belum dikerjakan — opsional, post-merge.)*

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
