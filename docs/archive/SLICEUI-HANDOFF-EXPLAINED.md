# SliceUI Handoff — Penjelasan Lengkap (briefing untuk diskusi lintas-agent)

> **Untuk siapa dokumen ini:** agent/AI lain yang diajak brainstorming soal *handoff*
> (menyerahkan pekerjaan slicing ke agent yang tidak bisa menjalankan command). Isinya
> self-contained. **Status fakta:** sesuai source `sliceui-skill` v0.15.0 + perubahan
> skill-handoff yang baru dibuat, 2026-09-19. **Bahasa:** Indonesia; istilah teknis Inggris.

---

## 1. TL;DR

**SliceUI Handoff** adalah skill agent `/sliceui-handoff` yang menghasilkan **satu file
markdown ringkas** — `.sliceui/handoff.md` — berisi seluruh pengetahuan project yang
dibutuhkan agent web **tanpa CLI** (mis. custom agent Microsoft Copilot) untuk menghasilkan
kode komponen yang idiomatik. File itu di-upload sebagai attachment chat, bersama gambar
desain; agent web membacanya lalu menulis kode — tanpa repo, tanpa tool, tanpa `sliceui verify`.

Tiga hal yang membuatnya bukan sekadar "ringkasan JSON":

1. **Ditulis oleh agent yang bisa membaca codebase asli.** Skill menginstruksikan agent
   untuk memverifikasi (dan melengkapi) artifacts `.sliceui/` dengan membaca 2–3 komponen
   sungguhan — langkah yang justru mengisi kekosongan pada project non-Angular.
2. **Adaptif per framework.** Section styling diterjemahkan ke mekanisme framework target
   (`:deep()` untuk Vue, komposisi utility untuk Tailwind, korpora `::ng-deep` untuk Angular) —
   bukan boilerplate Angular yang ditempel ke semua project.
3. **Jujur soal absennya gate.** File diakhiri pernyataan eksplisit: agent tujuan tidak punya
   `sliceui verify`, manusia yang harus me-review hasilnya.

---

## 2. Masalah yang dipecahkan

Alur kerja yang melahirkan fitur ini:

- Model utama (mis. GLM via API) dipakai bersama banyak orang → **sering kena rate limit**.
- Solusinya: eskalasi pekerjaan slicing ke **agent web** — custom agent di Microsoft Copilot.
- Tapi agent web itu **tidak bisa menjalankan command apa pun**. Ia hanya membaca file yang
  di-upload sebagai knowledge/attachment, lalu menulis kode dari instruksi + gambar desain di chat.

Sumber pengetahuan SliceUI yang ada — `project-context.json` (kontrak mesin; di project nyata
bisa 479 KB, melebihi batas baca tool) dan `conventions.json` (ground truth gate) — tidak cocok
untuk dibaca model di percakapan biasa: terlalu besar dan formatnya untuk CLI parse, bukan untuk
dikonsumsi cepat.

**Handoff.md menjawab itu:** cukup lengkap agar agent web menghasilkan kode yang mengikuti
konvensi project, cukup ringkas untuk di-upload sebagai attachment chat biasa (target ≤ ~20 KB).

---

## 3. Sejarah singkat: kenapa versi CLI diganti skill (pelajaran menariknya)

Fitur ini sempat diimplementasikan sebagai **CLI command** `sliceui handoff` — renderer
deterministik yang membaca artifacts dan merangkumnya ke markdown. Hasilnya pada project
**Vue 3 + Tailwind** terbukti gagal, dan penyebabnya struktural, bukan bug:

| # | Mode kegagalan versi CLI | Akar masalah |
|---|---|---|
| 1 | 13 kategori capability _"not detected"_, class vocabulary cuma 1 utility class | Penambangan `conventions.json`/capabilities memakai heuristik **Angular-first**; untuk Vue hasilnya nyaris kosong → handoff ikut kosong |
| 2 | Aturan invariant memakai istilah Angular: "salin korpora `::ng-deep`", "jangan karang class" | Di Vue mekanismenya `:deep()`, bukan `::ng-deep`; di Tailwind justru **wajib** mengomposisi utility class — aturannya jadi menyesatkan |
| 3 | Renderer deterministik tidak bisa mengisi yang tidak ditambang | CLI tidak bisa "membaca" komponen dan menyimpulkan pola — hanya bisa mentransformasi data yang ada |

**Keputusan desain (2026-09-19):** ganti jalur. CLI command dihapus; handoff menjadi **skill
agent** `/sliceui-handoff`. Agent pemegang skill punya Read/Glob/Grep — ia bisa membaca
komponen Vue sungguhan dan menulis polanya, mengisi persis apa yang tidak bisa ditambang CLI.
Struktur output dikunci oleh skeleton + checklist di skill; **substansi** diisi penilaian LLM.

> **Trade-off yang disengaja:** output LLM itu nondeterministik — dua run bisa sedikit beda.
> Diterima karena dokumen kosong yang deterministik tidak berguna; dokumen berguna yang
> sedikit bervariasi itu.

---

## 4. Bentuknya: agent skill, bukan CLI

- **Sumber:** `skill/handoff/SKILL.md` di repo `sliceui-skill`.
- **Ter-install** sebagai `~/.claude/skills/sliceui-handoff/` — **sibling** dari skill utama
  `sliceui` — sehingga aktif sebagai command sendiri: `/sliceui-handoff`.
- Satu paket npm mengirim dua skill: `sliceui install` meng-install keduanya
  (output-nya menyebut dua path); `sliceui uninstall --skill` menghapus keduanya.
- Skill diberi `tools: Read, Glob, Grep, Write` — persis kebutuhannya: baca artifacts, scan
  codebase, tulis satu file.

### Cara pakai

```bash
sliceui install            # sekali — memasang skill sliceui + sliceui-handoff
```

Lalu di dalam project yang sudah `sliceui init`:

> /sliceui-handoff

Agent menjalankan workflow skill, lalu menulis `.sliceui/handoff.md`. Upload file itu +
gambar desain ke agent web. Selesai.

---

## 5. Workflow skill — tiga langkah

### Langkah 1 — Baca ground truth `.sliceui/` (berurutan, hemat konteks)

1. `.sliceui/context/INDEX.md` — framework, `componentDir`, profile, prefix, warnings.
2. `.sliceui/conventions.json` — `classVocabulary`, `ngDeepCorpus` (tandai yang
   `reusable: true`), `componentAnatomy`, `naming`.
3. `.sliceui/context/capabilities.md` — library per kategori elemen.
4. `package.json` — **versi framework aktual**. Kalau INDEX dan package.json tidak cocok,
   package.json menang dan perbedaannya dicatat di file.
5. **Project UII saja** (INDEX bilang `profile: uii`): baca `.sliceui/uii-profile.md`
   (tabel action→authKey→icon — masuk verbatim), lalu **grep** `pilar-reference.md` +
   `pilar-showcase.md` hanya untuk komponen yang disebut capabilities. Dilarang full-read —
   54 KB + 184 KB.

**Precondition keras:** `.sliceui/project-context.json` tidak ada → agent menyuruh user
`sliceui init` dulu dan STOP. Handoff adalah kondensasi; init adalah sumbernya.

### Langkah 2 — Verifikasi codebase (langkah kunci; ini yang menyembuhkan kasus Vue)

Artifacts CLI itu Angular-first; di project Vue/React/Svelte/Tailwind bisa nyaris kosong —
dan handoff **tidak boleh** ikut kosong. Agent pemegang skill punya tool; agent web tidak.
Maka:

1. Baca 2–3 komponen nyata. Prioritas dari daftar samples di INDEX; kalau kosong atau
   Angular-shaped padahal projectnya bukan, cari sendiri:
   `Glob src/components/**/*.vue` / `**/*.tsx` / `**/*.svelte`.
2. Dari file asli, ekstrak pola yang dibutuhkan pendatang baru:
   - Anatomi komponen (urutan blok SFC, `script setup` vs options, bentuk FC, runes).
   - Konvensi penamaan file/folder (PascalCase vs kebab-case, index files, feature dirs).
   - Cara deklarasi & wiring props/events/inputs.
   - **Bagaimana styling benar-benar bekerja** di project ini (lihat §6).
   - Pola store/composable/service yang berulang.
3. Kalau codebase **berlawanan** dengan artifacts (conventions kosong padahal komponen
   jelas-jelas memakai ulang class) → **codebase menang**, dan file menyatakannya.

### Langkah 3 — Tulis `.sliceui/handoff.md`

Baris pertama: marker provenance `<!-- Generated by SliceUI handoff (agent skill) … -->`.
Lalu skeleton wajib §7. Setiap section **harus ada** — kalau tidak ada isinya, tulis
`_(none detected — …)_` eksplisit; dilarang membuang section secara diam-diam.

---

## 6. Section "Styling system" — adaptif per framework

Ini inti perbaikan atas kegagalan versi CLI. Konsepnya tetap satu — *styling reusable +
efek yang tidak terlihat di desain* (hover, open-state dropdown, warna status, radius tabel) —
tapi **mekanismenya diterjemahkan** ke framework target, dibaca dari komponen asli:

| Framework | Yang ditulis ke handoff |
|---|---|
| Angular | classVocabulary + korpora `::ng-deep` reusable (dari conventions.json) |
| Vue | blok `:deep(...)` di dalam `<style scoped>`, `<style module>`, stylesheet global |
| React | CSS modules / styled-components / komposisi Tailwind — mana yang file tunjukkan |
| Tailwind | pola komposisi utility yang berulang + tema token (v3 `tailwind.config.*`; v4 CSS-first `@theme`) — **bukan** "daftar class" |

Dan skill-nya memasang anti-pattern eksplisit: dilarang memakai mekanisme framework lain dalam
file (`::ng-deep` di project Vue, "class vocabulary" di project Tailwind, `@if` di Angular ≤ 16).
Seluruh file ditulis dalam istilah framework target.

---

## 7. Struktur file output

```
<!-- Generated by SliceUI handoff (agent skill) — regenerate with /sliceui-handoff. -->
> staleness: timestamp generate + generatedAt init + instruksi regenerasi

# Handoff — <Framework> <version> (for a CLI-less agent)

## How to use this file          — 2–3 baris: pengganti artifacts JSON; desain = gambar di chat
## Project & framework           — label + versi eksak, module/standalone, componentDir,
                                    styleExt, aturan sintaks yang relevan codegen
## How this project writes components  — pola dari scan codebase (anatomi, naming, wiring,
                                    provenance path file nyata) [BARU — tidak ada di versi CLI]
## Capabilities                  — per kategori: library + snippet ≤ 6 baris; null dinyatakan
## Styling system                — adaptif per framework (§6), termasuk efek tak terlihat
## Page anatomy & naming         — hanya yang terdeteksi; omit jujur kalau tidak ada
## Design tokens                 — yang sering dipakai (warna/tema dulu), cap ~20
## Org component grammar         — UII SAJA: tabel action→authKey→icon verbatim + wiring pilar
                                    ter-scope; project non-UII tidak menyebut pilar sama sekali
## References (writing samples)  — pointer path file; golden ditandai READ FIRST
## Aturan untuk Agent Tanpa CLI  — 5 invariant (§8) diterjemahkan ke framework target
```

**Aturan kekompakan:** target ≤ ~20 KB; dedup blok mirip (body sama, selector beda → satu +
"(+N variants)"); blok outlier dapat selector + ringkasan efek + pointer file sumber; sample
mengajarkan **pola** (≤ 6 baris), bukan dump body; **dilarang membungkus JSON mentah dalam
code block sebagai "konten"** — naratif + snippet pendek saja; capability null tidak
disembunyikan.

---

## 8. Lima invariant — payload section terakhir

Ditulis sebagai instruksi imperatif bernomor, **masing-masing diterjemahkan agent ke istilah
framework target** (bukan template Angular):

1. **Reproduksi hanya yang desain tunjukkan.** Tidak ada struktur/wrapper/elemen yang
   diciptakan.
2. **Style dengan cara project ini style.** Pakai ulang class/pattern dari section atas —
   di project Tailwind itu berarti mengomposisi utility yang sudah mapan (bukan mengarang
   class CSS); di Angular berarti member classVocabulary yang eksak.
3. **Salin efek yang tak terlihat.** Efek hover/open-state/status/radius tidak kelihatan di
   gambar desain; ia hidup di section styling-system — tanpa itu UI-nya salah.
4. **Semua data mock.** Tandai `// TODO: wire to <service>` / `<!-- mock data -->`. Jangan
   pernah menebak bentuk API atau endpoint.
5. **Teks literal dari desain.** Tanpa key translasi, tanpa wrapper i18n — slicing itu kode
   mock, bukan i18n produksi.

Ditutup satu kalimat yang wajib: **tidak ada `sliceui verify` yang akan berjalan** — manusia
yang harus me-review output terhadap desain. File tidak boleh menyiratkan verifikasi pernah
terjadi.

---

## 9. Penanganan org-privat (UII)

Mengikuti keputusan pemilik product (2026-09-19): **full fingerprint boleh** — logikanya,
gate-nya ada di `sliceui init` (yang menjalankan init di project UII pasti orang UII), dan
orang UII boleh meng-handoff source UI-nya sendiri.

- Skill **tidak mendeteksi sendiri** — ia membaca `profile` dari output init (init memang
  prasyarat keras).
- `profile: uii` → tabel action→authKey→icon masuk **verbatim** (kecil tapi load-bearing:
  kolom aksi `uii-table` bergantung padanya) + wiring pilar di-scope ke komponen yang
  capabilities sebut. File 54 KB/184 KB tidak pernah di-dump utuh.
- `profile` bukan uii → seluruh section org **hilang total**; dilarang menyebut vocabulary
  pilar/uii untuk project non-UII.

---

## 10. Perbandingan: versi CLI (dihapus) vs skill (sekarang)

| Aspek | `sliceui handoff` (CLI, dihapus) | `/sliceui-handoff` (skill, sekarang) |
|---|---|---|
| Penulis output | Renderer deterministik | Agent LLM (dibimbing skeleton + checklist) |
| Sumber pengetahuan | Hanya artifacts `.sliceui/` | Artifacts **+ komponen asli** (Read/Glob/Grep) |
| Project non-Angular | Ikut kosong (heuristik Angular-first) | Diisi dari scan codebase |
| Istilah framework | Sebagian hard-code Angular | Adaptif; anti-pattern lintas-framework eksplisit |
| Determinisme | Penuh (byte-identical per input) | Tidak — struktur terkunci, substansi bervariasi |
| Exit code / gate | 0/2/3, bagian kontrak CLI | Tidak berlaku — skill agent, bukan command |
| Distribusi | Verb CLI di `src/cli.mjs` | File skill, di-install `sliceui install` sebagai sibling |

---

## 11. Batasan yang diakui

1. **Nondeterministik by design.** Dua run bisa menghasilkan file yang sedikit beda.
   Mitigasi: skeleton wajih + checklist + larangan eksplisit mengecilkan ruang variansi —
   tapi tidak menghilangkannya.
2. **Tidak ada gate di ujung.** Agent web tidak punya `sliceui verify`; kualitas akhir
   bergantung pada (a) kelengkapan handoff.md dan (b) kepatuhan agent web membaca aturan.
   File-nya sendiri yang menyatakan ini.
3. **Kualitas bergantung kualitas scan.** Kalau project nyaris tanpa komponen contoh
   (fresh scaffold), scan codebase juga tipis — handoff jujur melaporkannya, tapi tidak bisa
   mengarang.
4. **Bergantung skill ter-install.** Skill companion hanya ada setelah `sliceui install`
   versi baru; instalasi lama tidak memilikinya.
5. **Privasi: isi file mengikuti project.** handoff.md berisi detail konvensi (dan grammar
   org untuk UII) dan **di-upload ke layanan eksternal** (Copilot). `.sliceui/` di-gitignore,
   jadi tidak ter-commit — tapi keputusan meng-upload adalah keputusan user.

---

## 12. Yang menarik untuk didiskusikan (kalau mau brainstorming)

1. **Deterministik vs LLM-generated untuk artifact.** Versi CLI deterministik tapi kosong di
   non-Angular; skill variatif tapi bisa mengisi. Adakah arsitektur hibrida yang layak —
   mis. CLI menulis skeleton + fakta deterministik, skill hanya mengisi bagian yang butuh
   penilaian?
2. **Round-trip feedback.** Saat ini searah (project → agent web). Bagaimana kalau hasil
   agent web direview manusia lalu pola perbaikannya dimasukkan kembali sebagai `references`
   (golden) di init — menutup loop?
3. **Format sebagai kontrak.** Bagian akhir handoff.md adalah prompt untuk agent lain —
   sampai seberapa jauh ini bergerak dari "dokumen" menjadi "protokol antar-agent"?
   Perlukah versioning khusus untuk format ini?
4. **Ukuran vs kelengkapan.** Cap ~20 KB itu heuristik. Adakah cara mengukur "agent web
   kehilangan X% akurasi per KB yang dipotong" untuk menempatkan cap secara empiris?

---

## 13. Ringkasan satu paragraf (untuk di-quote)

> SliceUI Handoff menjembatani dua dunia: pipeline slicing yang penuh tool (CLI + gate
> deterministik) dan agent web yang hanya bisa membaca attachment. Skill `/sliceui-handoff`
> membuat agent CLI membaca artifacts `.sliceui/` **dan** komponen asli project — lalu
> menulis satu file `.sliceui/handoff.md` yang ringkas (≤ ~20 KB), adaptif per framework,
> dan diakhiri lima invariant inti SliceUI sebagai instruksi langsung — plus pernyataan jujur
> bahwa agent tujuan tidak punya gate verifikasi, jadi manusialah gate terakhirnya.
