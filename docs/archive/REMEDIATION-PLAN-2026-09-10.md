# SliceUI Remediation Plan — Monorepo Verify Trust

> **Dari:** `sliceui-experience.md` (sesi slicing di `lib-uii-gateway-bill-angular`, Angular 13 monorepo)
> **Tanggal:** 2026-09-10 · **Status:** DRAFT — menunggu review sebelum eksekusi
> **Tujuan:** memulihkan kepercayaan pada `sliceui verify` di monorepo library, dan menghilangkan
> false-positive yang memancing "perbaikan" kode yang sebenarnya sudah benar.

---

## 0. Status vs laporan (jangan kerja dobel)

Beberapa poin di laporan **sudah tertangani** di sesi perbaikan sebelumnya (2026-09-10, commit lokal
belum di-commit). Diverifikasi langsung ke source saat ini:

| Item laporan | Status | Bukti |
|---|---|---|
| **C3** resolve ikon ambigu berulang | ✅ **Sudah** | `resolve` kini mengeluarkan `groups[]` dengan `count`/`ids` (dedup leaf identik) — `src/lib/resolve.mjs` |
| **A2** `target-exists` hardcode `src/app` | ✅ **Sebagian** | `detect-angular` kini memilih project **library** (`componentDirSource: angularJsonLibrary`); `referee.locateTargetTs` punya fallback `fast-glob` repo-wide — `src/lib/referee.mjs:202` |
| **A1, B1, B2, B3, B4, B5, C1, C2, C4, C5** | ❌ **Terbuka** | lihat di bawah |

**Catatan A2:** perlu diverifikasi ulang di repo nyata — pastikan `angular.json`-nya punya
`projectType: "library"` atau `sourceRoot` tanpa `architect.build.options.main`, supaya
`pickProject()` benar-benar memilih `projects/uiigateway/bill`. Kalau tidak, `componentDir`
masih jatuh ke host app.

---

## 1. Prioritas & urutan kerja (dikunci)

| # | Item | Dampak | Usaha |
|---|---|---|---|
| 1 | **A1** `nearestProjectRoot` berhenti di `projects/*/package.json` | Bloker — verify tidak bisa dipercaya | S |
| 2 | **B1** `rowAuth` guard + `visible=false` (termasuk `<override>`) | Bikin kode salah | M |
| 3 | **B2** `mockRowCount` menghitung trailing comma | Bikin kode salah | S |
| 4 | **B3** `classVocabulary` match `id="btn-*"` | Noise | S |
| 5 | **B4** `iconColor` menolak warna struktural `#03337b` | Bikin kode salah | S |
| 6 | **B5** `styleFidelity` boundary kelas (`.summary-row` vs `.summary-row-danger`) | Pesan error menyesatkan | S |
| 7 | **C5** `init` re-ingest `::ng-deep` hasil generate sendiri | Korpus tercemar | S |
| 8 | **C1** gate build library = **app build** (+ check "declared in module") | Friction → bug diam | M |
| 9 | **C2** check duplicate selector / duplicate class name | Bug diam berbahaya | M |
| 10 | **C4** dokumentasi: class framework membawa default + aturan modal (pertahankan `.modal-*`, netralkan default yang bentrok dengan XML) | Friction | S |

**Prinsip:** A1 dulu — tanpa ground truth yang ketemu, semua check konvensi jalan buta, dan
memperbaiki B1–B5 sebelum A1 berarti menguji di lingkungan yang salah.

---

## 2. BLOKER

### A1 — `nearestProjectRoot` tidak menemukan `.sliceui/` di monorepo

**Masalah.** `src/commands/verify.mjs:132` naik ke atas dan berhenti di `package.json` **pertama**.
Di repo ini `projects/uiigateway/bill/package.json` menaungi root repo → `.sliceui/` root tak pernah
ketemu. Akibatnya `conventions.json = null` → `noBareNgDeep`, `classVocabulary`, `loadedClass` jalan
buta; footer mencetak `⚠ NO GROUND TRUTH ... NOT verifiable`; dan `noBareNgDeep` false-fail karena
korpus kosong (semua `::ng-deep` dianggap "agent-added leak").

**Fix (2 lapis — keduanya dikerjakan):**

1. **Workspace-aware root walk** — di `nearestProjectRoot` (`src/commands/verify.mjs`), jangan
   berhenti di `package.json` yang berada di dalam subdir `projects/*`; terus naik sampai workspace
   root (dir yang memuat `.sliceui/`, atau `angular.json`/`nx.json`/`workspace.json`).

   ```js
   /** Root yang memuat .sliceui/ (ground truth) bila ada; else workspace root; else first pkg. */
   function nearestProjectRoot(startDir) {
     let d = resolve(startDir);
     let fallback = null;
     for (;;) {
       if (!fallback && existsSync(join(d, "package.json"))) fallback = d;
       if (existsSync(join(d, ".sliceui"))) return d;   // ← ground truth menang
       if (existsSync(join(d, "angular.json")) || existsSync(join(d, "nx.json")) || existsSync(join(d, "workspace.json"))) {
         return existsSync(join(d, ".sliceui")) ? d : d;
       }
       const up = dirname(d);
       if (up === d) return fallback ?? process.cwd();
       d = up;
     }
   }
   ```

   Prioritas: **`.sliceui/` terdekat ke atas** > workspace root (`angular.json`) > `package.json`
   pertama > cwd. Ini menyelesaikan kasus library tanpa perlu konfigurasi.

2. **Flag eksplisit `--conventions <path>`** — tambal termudah dan jalur melarikan diri saat
   auto-detect salah. Di `parseArgs` (`src/commands/verify.mjs:71`) tambahkan `--conventions[=]`,
   dipakai menggantikan pembacaan root-walk (sejajar dengan `--xml`/`--transcript` yang sudah ada).
   Update `HELP` di `src/cli.mjs`.

**Test (`test/verify.test.mjs`):**
- Monorepo fixture: `projects/lib-a/package.json` + root `angular.json` + root `.sliceui/conventions.json`
  → verify dari dalam `projects/lib-a/src/lib/...` menemukan `.sliceui/` root.
- `--conventions <path>` menang atas root-walk.
- Regresi: repo ber-`.sliceui/` di root tetap ketemu (kasus saat ini tidak berubah).

---

## 3. BUG yang memancing "perbaikan" salah

### B1 — `rowAuth` dua bug

**B1a — guard regex tidak membedakan true/false.**
`src/framework/angular/verify.mjs:716`: `if (!/\[actionColumn\]/.test(html)) return skip;`
Regex cocok juga untuk `[actionColumn]="false"` → check tetap menuntut `canRead`/`canDelete`
padahal kolom aksi sengaja dimatikan sesuai design.

```js
// hanya aktif bila atribut BENAR-benar true (bukan sekadar hadir)
if (!/\[actionColumn\]\s*=\s*"(?:true|)"|\[actionColumn\]\s*=\s*'?(?:true|)'?|\[actionColumn\](?!\s*=)/.test(html)) {
  return { name: "rowAuth", status: "skip", detail: "no action column emitted ([actionColumn] not truthy)" };
}
```
Aturan: `[actionColumn]` tanpa nilai = true (idiom Angular), `="true"` = true, `="false"` = **skip**.

**B1b — `visible="false"` lewat `<override>` tidak dihormati.**
`requiredAuthKeysFromXml` (`verify.mjs:740`) hanya membaca `value="true"` dari `componentProperties`,
tanpa memeriksa apakah node `<Aksi>`-nya tersembunyi. Lebih dalam lagi: parser **membuang override
sepenuhnya** — `src/lib/figml-parse.mjs:88` memasukkan `"overrides", "override", "overriddenFields",
"overriddenField"` ke `SKIP_TAGS`.

Fix berurutan:
1. **Parser** (`src/lib/figml-parse.mjs`) — baca `<overrides>`/`<override>`: bila
   `overriddenField="visible"` dengan nilai `false`, tandai node `hidden: true` (konsisten dengan
   `isHidden()` yang sudah ada). Jangan biarkan `SKIP_TAGS` menelan sinyal ini.
2. **Verify** (`requiredAuthKeysFromXml`) — lewati `<Aksi>` yang berada di subtree `visible="false"`
   (langsung maupun via override). Simetri dengan aturan `[HIDDEN]` yang sudah berlaku di
   `textCoverage`/`title`.
3. **Konservatif** — bila override tak bisa di-parse dengan yakin, **skip** daripada memaksa auth
   (false-positive lebih mahal daripada false-negative di sini).

**Test:** (a) `actionColumn="false"` → `rowAuth` status `skip`; (b) `<Aksi>` dengan
`<override overriddenField="visible">false` → tidak ada key yang diwajibkan; (c) regresi: Aksi
terlihat dengan `edit=true` tetap mewajibkan `canUpdate`.

### B2 — `mockRowCount` menghitung trailing comma

`src/framework/angular/verify.mjs:1129` `countArrayElements` menaikkan `count` pada setiap koma
top-level, sehingga `[a, b, c,]` terbaca **4**, bukan 3 → 15 baris mock terbaca 16 → fail, dan agent
terpaksa menghapus trailing comma (padahal itu idiom TS yang valid).

**Fix:** abaikan elemen kosong. Cara paling aman: hitung elemen, bukan koma — potong `body`,
buang trailing whitespace/koma, dan perlakukan `count = 0` bila body kosong.

```js
function countArrayElements(body) {
  const trimmed = String(body ?? "").replace(/[\s,]+$/, "");   // buang koma/spasi di ujung
  if (!trimmed) return 0;
  // …lanjutkan hitung koma top-level seperti sekarang, mulai dari count = 1…
}
```

**Test:** `[a,b,c,]` → 3; `[a,b,c]` → 3; `[]` → 0; nested `[{x:1},{y:2},]` → 2.

### B3 — `classVocabulary` menganggap `id="btn-*"` sebagai class

`src/framework/angular/verify.mjs:452` menjalankan `/\bbtn-([a-z0-9-]+)/gi` atas **seluruh teks**
HTML+SCSS+TS, sehingga `id="btn-foo"` terhitung class. Repo ini punya 46 `id="btn-*"` → hampir semua
temuan "invented button class" adalah noise.

**Fix:** batasi pemindaian `btn-*` ke **nilai atribut `class="..."`** (dan `[ngClass]`), bukan seluruh
teks. Pola yang sudah dipakai di tempat lain: `html.matchAll(/class=["']([^"']+)["']/g)`
(lihat `verify.mjs:641`, `:686`). Untuk SCSS, `.btn-*` selector tetap valid.

**Test:** `id="btn-foo"` → **tidak** dilaporkan; `class="btn-gray"` → tetap fail; `class="btn-primary"`
→ tetap legal.

### B4 — `iconColor` menolak `fa-*` berwarna struktural biru

`src/framework/angular/verify.mjs:953` mengecualikan `#03337b` di sisi **design colors**, tetapi sisi
**generated code** (`:974`) memakai `neutral = {#303030, #333333, #000000, #ffffff, #f5f5f5}` —
`#03337b` tidak ada di sana. Jadi `fa-pencil { color: #03337b }` (ikon aksi, biru struktural project)
difailkan, dan agent terpaksa memindah warna ke class semantik hanya agar check hijau.

**Fix:** warna struktural harus mencakup **accent/surface project yang dominan**, bukan hardcode.
Sumbernya sudah tersedia: `project-context.json` → `tokens.colors` (census FIGML) dan/atau
`designTokens`. Alirkan daftar warna struktural ke `checkIconColor` dan tambahkan ke `neutral` di
sisi generated.

**Test:** `#03337b` dari design census → `fa-pencil { color: #03337b }` lulus; warna status
`#f44444` untuk glyph status tetap fail bila salah.

### B5 — `styleFidelity` boundary kelas salah

`src/framework/angular/verify.mjs:1422` `authoredRule` memakai `\.${cssEscape(cls)}\b`. `\b` cocok
antara `w` dan `-`, sehingga mencari `.summary-row` juga menemukan `.summary-row-danger` → warna
`#f44444` "menangkap" `.summary-row` dan pesan error menunjuk class yang salah.

**Fix:** tambahkan negative lookahead agar nama kelas tidak diikuti `-`/`_`:
```js
new RegExp(`(?:^|\\})[^{}]*\\.${cssEscape(cls)}(?![-\\w])[^{]*\\{([^{}]*)\\}`, "g");
```
Tambahan (opsional, rendah risiko): bila terdeteksi SCSS nesting (`&`) pada blok yang di-resolve,
keluarkan `warn` bahwa resolusi flatten belum sempurna — jangan diam-diam salah.

**Test:** SCSS dengan `.summary-row { color: #555 }` + `.summary-row-danger { color: #f44444 }` →
fact untuk `.summary-row` = `#555`, bukan `#f44444`.

---

## 4. Friction & pencegahan

### C5 — `init` memasukkan hasil generate sendiri ke korpus konvensi

`extractNgDeepCorpus` (`src/framework/angular/conventions.mjs`) memindai semua `.scss` tanpa
memeriksa header. Setelah generate, `sliceui init` menyerap `::ng-deep` hasil slice seolah konvensi
project lama → korpus otoritatif tercemar output sendiri.

**Fix:** lewati file yang baris pertamanya `// Generated by SliceUI` (atau `<!-- Generated by SliceUI -->`)
saat membangun `ngDeepCorpus`/`classVocabulary`. Penanda itu sudah menjadi kontrak Output #2 di SKILL.md.

**Test:** fixture dengan satu `.scss` ber-header SliceUI dan satu file project → selector dari file
SliceUI **tidak** masuk korpus.

### C1 — gate build untuk library = **app build**, bukan lib build

`ng build <lib>` melewati komponen yang tidak di-declare di NgModule → build hijau ≠ komponen
ter-compile; error `NG8001 'ngx-select' is not a known element` baru muncul saat `ng serve`/app build.

**Fix:**
1. **SKILL.md** — tegaskan: untuk library Angular, gate build yang benar adalah **app build**
   (`ng build <app-project>`), bukan `ng build <library>`. Konfirmasi ter-compile dengan grep marker
   unik di `dist/.../fesm2015/*.mjs`, bukan sekadar exit 0.
2. **Check baru `declaredInModule`** (verify) — pakai `moduleStructure`/`appModulePath` dari
   `project-context.json` untuk memastikan `declarations` memuat komponen target. Data sudah ada di
   context, tinggal dipakai.

**Test:** komponen tidak ter-declare → `declaredInModule` fail dengan nama modul yang benar.

### C2 — check duplicate selector / duplicate class

Dua komponen beda file dengan selector sama (`ugw-student-rates-extends-edit`) tidak di-error Angular
(routing instansiasi by class), jadi hazard laten yang diam.

**Fix:** check baru `duplicateSelector` — pindai `.component.ts` yang di-declare, laporkan selector
atau nama class yang duplikat.

**Test:** dua `@Component` dengan selector sama → fail; unik → pass.

### C4 — class framework membawa default (dokumentasi + aturan modal)

Kelas framework/idiom project (`.modal-header`/`.modal-body`/`.modal-footer`, `.well`,
`.form-control`, `.btn`) membawa default (mis. `border-bottom` pada `.modal-header`) yang bisa
tabrakan dengan design. **Keputusan (2026-09-10): tetap pertahankan kelas modal, jangan larang** —
menghindari `.modal-*` justru bikin modal divergen dari idiom project. Yang diwajibkan adalah
**menetralkan default yang bertentangan dengan goal XML** secara eksplisit.

**Fix:** catatan di SKILL.md Pass Styling dengan tiga aturan:

1. **Dialog konfirmasi/alert/success/danger** → jangan hand-roll. Pakai komponen pilar yang sudah
   ada (`ConfirmdialogComponent` / `Successdialog2Component` / `Warningdialog2Component` /
   `Dangerdialog2Component` via `BsModalService.show()`). Markup modal datang dari komponen itu,
   bukan dari slice.
2. **Modal custom** → ikut idiom pilar (`.modal-header`/`.modal-body`/`.modal-footer`), lalu tulis
   **override eksplisit** untuk setiap default yang bertentangan dengan transcript. Contoh: XML
   tanpa divider di header → `.modal-header { border-bottom: none; }`. Prinsip: *transcript menang,
   default yang bentrok ditulis eksplisit, tidak diam-diam diwarisi.*
3. **Jangan pernah** memakai `.modal-content` sebagai wrapper yang *menambah* struktur — struktur
   hanya dari XML (aturan `phantomWrapper` yang sudah ada).

Tidak diotomasi sebagai check (deteksi cascade penuh berisiko false-positive; itu tugas
render-probe). Cukup dokumentasi + aturan kontrak di atas.

---

## 5. Verifikasi akhir

1. `node --test test/` → **278 pass (baseline) + test baru / 0 fail**.
2. Uji di repo nyata (`lib-uii-gateway-bill-angular`):
   - `sliceui verify projects/uiigateway/bill/src/lib/... <name>` → footer **tanpa** `NO GROUND TRUTH`,
     dan `conventions.json` terbaca (bukan `null`).
   - Komponen dengan `actionColumn=false` → `rowAuth` **skip** (bukan fail).
   - Mock 15 baris **dengan trailing comma** → `mockRowCount` pass.
3. `sliceui timing` setelah satu slice penuh untuk memastikan perbaikan tidak menambah waktu.

---

## 6. Ditunda (di luar scope)

- **C6/umum** — deteksi otomatis "class framework mewarisi default yang bertentangan" (butuh model
  cascade penuh; itu tugas render-probe).
- Aturan "tiga pass" → sudah digantikan alur `sliceui spec` satu-pass di pekerjaan sebelumnya;
  laporan menyebutnya "solid" sehingga tidak diubah di sini.
