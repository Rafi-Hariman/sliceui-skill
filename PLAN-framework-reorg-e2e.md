# Plan: Framework Reorg + Interactive Init (E2E)

> **Status:** siap dieksekusi di branch `feat/framework-reorg` (BUKAN `main`).
> **Sumber keputusan:** 3× LLM Council (2026-08-31) + keputusan user. Verdict final dikunci.
> **Baseline:** v0.9.0 committed (`96f7689`), **103/103 test hijau**.

---

## 1. Tujuan

SliceUI saat ini Angular-first: pengetahuan framework tersebar di 6 file, semuanya berisi hardcode Angular. Tujuannya **bukan** membuat framework-neutral abstraction, tapi menata ulang repo supaya tiap framework punya "rumah" sendiri (`src/framework/<id>/`), sehingga nanti React/Vue/Svelte/Next bisa ditambah satu-per-satu tanpa mengacak file yang sudah ada.

## 2. Keputusan council (DIKUNCI — jangan dilanggar)

1. **Folder `framework/` sebagai tata letak murni = murah & aman → KERJAKAN.**
2. **`index.mjs` descriptor + skema `capabilities` = prematur → JANGAN ditulis sekarang.** Ini abstraction yang ditolak council; hanya boleh muncul SETELAH React membuktikan field mana yang nyata.
3. **`initCore()` shared = prematur → JANGAN diekstrak sekarang.** Ekstrak setelah React jalan, dari diff yang benar-benar identik.
4. **Konfirmasi interaktif `init` = plumbing murni, independen → KERJAKAN (Jalur B).**
5. **Target bukan "equal".** React dikerjakan mendalam dulu, baru Vue → Svelte → Next.

## 3. Scope

**MASUK (dikerjakan di plan ini):**
- **Jalur A** — pindahkan pengetahuan Angular → `src/framework/angular/` (refactor murni, 103 test hijau, zero behavior change).
- **Jalur B** — `sliceui init` konfirmasi interaktif + flag `--framework <id>` / `--yes`.

**KELUAR (ditunda — jangan disentuh):**
- `index.mjs` descriptor, skema `capabilities`, `initCore()`.
- Kode React/Vue/Svelte/Next apa pun.

## 4. Peta saat ini — di mana pengetahuan Angular tinggal

| File | Isi | Sifat |
|---|---|---|
| `src/lib/library-registry.mjs` | `REGISTRY` (semua `ngx-*`, `mat-*`, `primeng`, `pilar`, `@uiigateway`) + `CATEGORIES` | 100% Angular |
| `src/lib/conventions.mjs` | `extractNgDeepCorpus` (`::ng-deep`), `extractAnatomy` (tabel Angular), `extractNaming` (`(click)=`), `renderConventionsMd` | ~90% Angular |
| `src/commands/detect.mjs` | `detectFramework` (generik) + `detectAngularDetails`/`detectModuleStructure`/`collectSelectors`/`resolvePrefix`/`selectorPrefix` (Angular) + `guessComponentDir`/`detectStyleExt`/`extractTsconfigPaths`/helpers (generik) | CAMPUR |
| `src/lib/verify.mjs` | 9 check; `scssCoverage`/`tableBindings`/`classVocabulary`/`anatomy`/`noHashedSelectors`/`iconColor`/`phantomWrapper` (Angular) + `textCoverage`/`mockRowCount` (generik) + `walkNodes` (shared) | CAMPUR |
| `src/lib/prompt-rules/frameworks.mjs` | `FRAMEWORK_RULES` — 8 framework (Angular + React/Vue/Svelte/Next/Tailwind/bootstrap/native). Sudah multi-framework | CAMPUR |
| `src/lib/style-tokens.mjs` | `extractStyleTokens` (SCSS var + CSS prop + mixin) — GENERIK, tapi dipanggil hanya kalau Angular (`detect.mjs:88`) | GENERIK |

**Dependen yang meng-import file di atas** (harus di-update import-nya): `src/lib/library-scan.mjs` (import `library-registry`), `src/lib/resolve.mjs` + `src/lib/referee.mjs` (import `conventions`), `src/commands/init.mjs`/`detect.mjs`/`verify.mjs`, `src/cli.mjs`.

## 5. Jalur A — pindah-murni (step by step)

### A1. Whole-file moves (file 100% Angular → pindah utuh)

```
git mv src/lib/library-registry.mjs  src/framework/angular/registry.mjs
git mv src/lib/conventions.mjs       src/framework/angular/conventions.mjs
```

### A2. Split moves (ekstrak bagian Angular, sisakan yang generik)

- **`detect.mjs`** — pindahkan ke `src/framework/angular/detect.mjs`: `detectAngularDetails`, `detectModuleStructure`, `collectSelectors`, `selectorPrefix`, `resolvePrefix`, `detectUiLibrary`, dan blok `if (fw.id === "angular") { … }`. Yang TETAP di `src/commands/detect.mjs`: `detectFramework`, `parseMajor`, `guessComponentDir`, `detectStyleExt`, `extractTsconfigPaths`, `walkFiles`, `readJsonSafe`/`readFileSyncSafe`/`extOf`/`toRel`, dan `detectProject` (orchestrator).
- **`verify.mjs`** — pindahkan ke `src/framework/angular/verify.mjs`: 7 check Angular (`scssCoverage`, `tableBindings`, `classVocabulary`, `anatomy`, `noHashedSelectors`, `iconColor`, `phantomWrapper`). Yang TETAP: `textCoverage`, `mockRowCount`, `walkNodes`, dan `verifyComponent` (orchestrator, harus tetap bisa memanggil check dari dua tempat). Catatan: `walkNodes` dipakai oleh check generik DAN Angular — pindahkan ke modul shared (mis. `src/lib/walk-nodes.mjs`) atau biarkan di file asal dan export.
- **`frameworks.mjs`** — pindahkan entri `angular` di `FRAMEWORK_RULES` ke `src/framework/angular/rules.mjs`. 7 rules lainnya tetap di `src/lib/prompt-rules/frameworks.mjs` sebagai dispatcher. `getFrameworkRules(id)` tetap jadi titik masuk tunggal.

### A3. Rewire import

- `library-scan.mjs`: `import { REGISTRY, CATEGORIES, … } from "./library-registry.mjs"` → `from "../framework/angular/registry.mjs"`.
- `resolve.mjs` / `referee.mjs`: import `conventions` → path baru.
- `init.mjs` / `cli.mjs` / `commands/verify.mjs`: update path import `detect` / `verify` / `conventions`.
- `verify.mjs` (orchestrator) meng-import check Angular dari `framework/angular/verify.mjs`.

### A4. Test + commit

```
npm test          # harus 103/103 hijau — ZERO behavior change
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

## 7. Acceptance criteria (SEMUA harus terpenuhi)

- [ ] `npm test` → **103/103 hijau** (sama dengan baseline, tidak ada test yang berubah makna).
- [ ] Zero behavior change: `sliceui detect` di fixture `test/fixtures/angular13` menghasilkan `project-context.json` yang identik sebelum/sesudah reorg.
- [ ] `sliceui init --framework nextjs` di proyek Next.js fixture menghasilkan `.sliceui/` + konteks framework `nextjs`.
- [ ] `sliceui init --yes` berjalan tanpa prompt (non-interaktif).
- [ ] Tidak ada file `index.mjs` baru, tidak ada skema `capabilities`, tidak ada `initCore()`.

## 8. DO NOT (anti-pattern yang sudah diveto council)

- ❌ Tulis `index.mjs` descriptor / skema `capabilities` (`styleScoping`, `componentModel`, `eventModel`, `verifyChecks`, `tokenMining`).
- ❌ Ekstrak `initCore()` shared.
- ❌ Tambah kode React/Vue/Svelte/Next.
- ❌ Ubah perilaku `detect`/`verify`/`conventions` — ini refactor murni, bukan redesign.
- ❌ Hapus test yang ada atau kendurkan asersi untuk "membuat hijau".

## 9. Follow-up (SETELAH plan ini selesai, SEBELUM framework kedua)

1. **Koreksi prinsip "never add wrappers"** — re-scope jadi "jangan tambah DOM struktural yang tak ada di desain; konstruk idiomatik framework (hooks, `<script setup>`, provider tree) BOLEH & WAJIB". Sentuh `skill/SKILL.md` (Pass 1) + `verify.mjs` `checkPhantomWrapper` + `conventions.mjs` `renderConventionsMd`.
2. **Selesaikan kategori** — `tailwind` = styling layer (bukan framework setara Angular); `nextjs` = React + conventions (putuskan: folder sendiri atau flag di React). Putuskan SEBELUM menambah folder baru.

## 10. Cara verifikasi akhir (di branch)

```
npm test
node src/cli.mjs detect   # di test/fixtures/angular13 → bandingkan output
node src/cli.mjs init --framework nextjs   # di proyek Next.js sementara → cek .sliceui/
```

Setelah semua hijau + acceptance criteria terpenuhi → buka PR dari `feat/framework-reorg` ke `main` (jangan push/publish tanpa konfirmasi user).
