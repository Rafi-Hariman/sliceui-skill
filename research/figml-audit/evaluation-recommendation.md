# Evaluasi Transcript & Rekomendasi Arsitektur (FASE 8-9)

## A. Evaluasi transcript (rubric berbobot)

Skala: 5 lengkap-terselusur · 4 minor loss · 3 loss nyata tapi bisa pulih · 2 loss data penting · 1 tidak andal · N/A belum bisa diuji.

### Structural fidelity (25%)
- **Hierarchy**: 4/5 — parent-child & child order terjaga (`preserveOrder`), tapi root frame sendiri di-drop di jalur legacy (padding-nya di-re-attach ke child pertama, figml-parse.mjs:51-56).
- **Child order**: 5/5 — DOM/scene order terjaga.
- **Node identity**: 4/5 — id Figma tersanitasi (`:`→`_`), tapi node tanpa id pakai counter global (non-deterministik lintas panggilan).
- **Component-instance relationship**: **1/5** — `mainComponent.id` hilang di KEDUA parser; agent tidak bisa memetakan instance→komponen.

### Content fidelity (20%)
- **Exact text**: 5/5 — `characters` verbatim.
- **Line breaks**: N/A — tidak ada fixture.
- **Rich text**: 1/5 — mixed-font spans hilang (hanya string tunggal).
- **Unicode**: 4/5 — verbatim, tapi PUA glyph FA (``) bocor sebagai char tak-tampak, bukan nama glyph.
- **Visibility**: 4/5 — hidden disurfing, tapi `inspect` (primary read) **skip silent** node hidden tanpa penanda.

### Layout fidelity (25%)
- **Geometry**: 4/5 — x/y/w/h di-round (presisi desimal sub-pixel hilang untuk icon kecil).
- **Auto Layout**: 4/5 — axis/gap/padding/justify terjaga; alignment CENTER/MAX hilang.
- **Sizing (FILL/HUG)**: 2/5 — `sizingV` mati, `sizingH` hanya reword padding.
- **Absolute positioning / constraints**: 1/5 — `layoutPositioning=ABSOLUTE` dan `<constraints>` hilang dari legacy transcript.

### Visual style fidelity (15%)
- **Colors**: 4/5 — fill/stroke hex-6 terjaga (lowercase), tapi alpha/opacity parsial hilang.
- **Typography**: 3/5 — size/weight/lineHeight/letterSpacing terjaga, **family hilang**.
- **Radius**: 5/5 — uniform + per-corner.
- **Effects (shadow/blur)**: N/A — tidak ada fixture.
- **Blend mode**: 2/5 — `NORMAL` default diabaikan; non-NORMAL akan hilang (belum teramati).

### Agent usability (10%)
- **Context size**: 2/5 — 10k node ≈ 1.37 MB JSON ≈ 340k token (over window); tidak ada chunking per batas desain; repeated instance diduplikasi penuh.
- **Navigability**: 3/5 — id stabil tapi provenance per-properti tidak ada.
- **Repetition**: 2/5 — 15× `Status_Beasiswa` dll diduplikasi.
- **Ambiguity reporting**: 3/5 — `inspect`/`spec` jujur soal FALLBACK/degraded, tapi inference (icon/status/pagination) tidak selalu diberi label "guessed".

### Safety & determinism (5%)
- **Determinism**: 4/5 — deterministik (byte-identical 3×) untuk node ber-id; counter global = kualifikasi.
- **Parser safety**: 5/5 — XXE/depth/prototype/malformed diblokir.
- **Prompt-injection isolation**: 1/5 — hanya instruksi SKILL.md:62, tanpa isolasi teknis.

### Skor agregat (dipisah, bukan satu angka)

| Dimensi | Skor |
|---|---|
| Structural fidelity | 14/25 (56%) |
| Content fidelity | 14/20 (70%) |
| Layout fidelity | 11/25 (44%) |
| Visual style fidelity | 14/15 (93%, dengan N/A di effects) |
| Agent usability | 10/20 (50%) → diskala dari 10 |
| Safety & determinism | 10/15 (67%) |

**Pemisahan akurasi:**
- **Extraction accuracy (XML→transcript)**: tinggi untuk field yang dikurasi; rendah untuk family/alpha/sizing/constraints/mainComponent.
- **Transcript accuracy (render)**: `transcript.md`/`spec.md` faithful terhadap transcript object, TAPI drop field yang diparse (family, sizingV, variant, required) — jadi ada loss di lapisan render juga.
- **Agent interpretation accuracy**: rendah untuk komponen/ikon/status/pagination (ditebak dari nama/warna/geometri).
- **Angular implementation accuracy**: belum diukur langsung (diluar scope fase 1; diverifikasi lewat `sliceui check`/render probe yang honest-skip).

## B. Rekomendasi arsitektur (FASE 9)

### Perbandingan tiga pilihan

| Kriteria | A: FigML→transcript langsung (status quo) | B: FigML→versioned adapter→SliceIR→transcript (rekomendasi awal) | C: Exporter Figma milik SliceUI→SliceIR→transcript |
|---|---|---|---|
| Fidelity | **Tinggi untuk subset; rendah untuk field yang drop** | Tinggi + provenance per-properti | Tertinggi (kontrol penuh field) |
| Implementation effort | 0 (existing) | Sedang (adapter + SliceIR + kontrak) | Besar (plugin Figma + distribusi) |
| Maintenance | Ada dua parser divergen (figml-parse vs raw-graph) | Satu kontrak IR, dua sumber jadi satu | Plugin + IR dua artefak |
| Versioning | `?figml version` tidak dibaca | `schemaVersion` + exporter version | `schemaVersion` + plugin version |
| Dependency | `fast-xml-parser` (aman) | sama | + plugin Figma |
| Compatibility | Semua export FIGML | adapter menormalisasi export | hanya export dari plugin sendiri |
| Security | aman parser; injection terbuka | + delimitasi data | + kontrol field |
| Vendor lock-in | bergantung format exporter pihak ketiga | rendah | tinggi (plugin sendiri) |
| Ribuan UI | tidak ada chunking/dedup | SliceIR + scene index + subtree hash memungkinkan chunk/dedup | sama |
| AI text-only | transcript langsung dipakai | transcript hierarkis + index | sama |
| Migration risk | — | rendah (adapter wrap parser existing) | tinggi (migrasi exporter) |

### Rekomendasi utama: **Pilihan B** (dengan konfirmasi bukti)

Bukti audit mendukung arah `FigML → versioned adapter → SliceIR → scene index → hierarchical transcript`, karena:
1. **Ada dua parser divergen** (`figml-parse.mjs` lossy + `raw-graph.mjs` "lossless") yang sudah mendekati "adapter + IR" tapi tanpa kontrak bersama — SliceIR menyatukannya.
2. **`mainComponent.id`, `constraints`, `layoutPositioning`, `sizing`, `alignment`, `opacity`, `fontName`** sudah dibaca `raw-graph.mjs` tapi tidak pernah jadi transcript agent-facing — adapter+IR adalah tempat yang tepat untuk menyalurkannya.
3. **Versioning kosong**: `?figml version="1.0"` tidak di-gate; kontrak `schemaVersion` wajib untuk eksport yang berevolusi.

Pilihan C ditunda: eksport Figma milik sendiri menjanjikan fidelity tertinggi tapi memerlukan distribusi plugin + migrasi; belum dibenarkan oleh kebutuhan "thousands of UI" sebelum adapter+IR membuktikan nilainya. Pilihan A dipertahankan hanya sebagai fast-path sampai B siap (bukan target jangka panjang).

### Kontrak minimum SliceIR (jika diadopsi)

```
schemaVersion, sourceFormat+exporterVersion, sourceChecksum,
stableNodeId, structuralPath, nodeType,
rawProperties (verbatim), normalizedProperties, provenance[] per property,
diagnostics[], componentRelationships[] (mainComponentId),
variableBindings[], assetReferences[], subtreeHash
```

### Perubahan minimum yang disarankan (fase berikutnya, BUKAN fase 1)

1. **Hentikan drop `mainComponent.id`** di kedua parser — ekspos sebagai `componentId` pada node instance (P0, paling berdampak).
2. **Salurkan `fontName.family`** dari child `<fontName>` ke `style.family` + `tokens.fonts` (P1).
3. **Salurkan `layoutSizingH/V`, `alignPrimary/alignCounter`, `layoutPositioning`, `constraints`** dari `raw-graph.mjs` ke transcript/agent-facing (P1 responsive).
4. **Salurkan `opacity` non-zero** sebagai `node.opacity` (schema sudah punya field, parser tidak mengisinya).
5. **Salurkan `required`** (sudah diparse) ke `inspect`/`spec` sebagai fakta, bukan hanya hidden-asterisk.
6. **Tambahkan `schemaVersion`** gate yang membaca `?figml version`.
7. **Chunking per Page/Section/Frame + dedup repeated instance** untuk scale ribuan node.
8. **Delimitasi data desain** (prompt-injection isolation) di render layer.

Semua di atas adalah perubahan minimum yang dibuktikan langsung oleh field-coverage + trace — bukan refactor arsitektur.
