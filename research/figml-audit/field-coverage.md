# Field Coverage Matrix — FIGML → SliceUI → Angular

Matriks lengkap ada di `field-coverage.csv` (49 baris, 15 kolom). Dokumen ini merangkum skor coverage dan temuan.

## Cara membaca status
- `preserved-exact` — nilai mentah dipertahankan byte-for-byte (atau hanya lowercase).
- `preserved-normalized` — dipertahankan dengan transformasi (id `:`→`_`, decimal→round, dll).
- `renamed` — dipertahankan dengan nama baru (mis. `layoutMode`→`axis`).
- `omitted-critical` — ada di XML, dibaca/diabaikan parser, HILANG dari agent-facing output, berdampak pada implementasi.
- `omitted-noncritical` / `omitted-default` — hilang tapi dampak kecil (editor-only / nilai default).
- `needs-fixture` / `not-observed` — tidak bisa diverifikasi karena tidak ada di fixture (dikecualikan dari denominator).

## Coverage (denominator = field terverifikasi, tanpa needs-fixture/not-observed)

| Prioritas | Terverifikasi | exact | usable | exact coverage | usable coverage |
|---|---|---|---|---|---|
| **P0** (hierarchy, text, component identity, fundamental layout) | 13 | 8 | 11 | **61.5%** | **84.6%** |
| **P1** (responsive, typography, colors, variables, assets) | 17 | 7 | 8 | **41.2%** | **47.1%** |

- **Critical loss count:** 10 field (lihat daftar di bawah).
- **Ambiguous field count:** 1 (`duplicate layer names` → fallback id dari counter global).
- **Total observed coverage:** 38 dari 49 field memiliki representasi di XML fixture.

## 10 Critical Loss (omitted-critical) — informasi desain yang hilang

| # | Property | Priority | Dampak Angular |
|---|---|---|---|
| 1 | `mainComponent.id` (relasi component→instance) | P0 | Agent tidak tahu sebuah instance menunjuk komponen mana → tidak bisa reuse komponen existing. **Hilang di KEDUA parser.** |
| 2 | Rich text / mixed font (`fontName` mixed spans) | P1 | Teks dengan campuran font/weight/color dalam satu node hilang menjadi string tunggal. |
| 3 | Font family | P1 | `family="Roboto"` di child `<fontName>` di-skip; transcript hanya punya size/weight/color. |
| 4 | `layoutSizingHorizontal/Vertical` (FILL/HUG) | P1 | Responsive: agent tidak tahu node harus FILL lebar atau HUG konten. `sizingV` mati total; `sizingH` hanya dipakai inspect.mjs:62 untuk reword padding. |
| 5 | Alignment `primaryAxisAlignItems`/`counterAxisAlignItems` | P1 | CENTER/MAX/SPACE_BETWEEN hanya SPACE_BETWEEN yang tersalur (sebagai justify); CENTER/MAX tidak tersalur ke agent. |
| 6 | `layoutPositioning="ABSOLUTE"` | P1 | Absolute child di dalam Auto Layout tidak tersalur ke agent (legacy transcript). |
| 7 | `constraints` (SCALE/CENTER/MIN) | P1 | Perilaku resize/constraint antar sibling hilang. |
| 8 | Opacity (selain 0) | P1 | `opacity="0.4"` hanya dipakai untuk deteksi hidden (`==0`); nilai parsial tidak pernah masuk transcript. |
| 9 | `required` flag | P1 | Diparse jadi `node.required` tapi **tidak pernah dibaca** siapapun (dead field). Hanya hidden-asterisk yang tersalur. |
| 10 | Instance overrides non-visible (fill/text swap) | P1 | Hanya `overriddenField="visible"` yang dipakai; override fill/text/styleStyleId dibuang. |

## Inference sites (heuristik, di luar field coverage)

Field coverage mencatat preservasi **field**; di samping itu ada ~11 lokasi di mana kode menambahkan interpretasi yang TIDAK berasal langsung dari XML (dibuktikan di end-to-end-trace.md):

1. `classifyInstance` — klasifikasi komponen by regex nama (`Button|_btn|Btn`, dst) — `figml-parse.mjs:354-365`.
2. `markTables` — deteksi tabel by geometri (≥3 baris full-width flush) — `figml-parse.mjs:494-515`.
3. `resolve.mjs` `FA_ICON_COLORS` — warna→ikon FA (mis. `#3e82f3`→`fa-check-circle`) — `resolve.mjs:24-31`.
4. `resolve.mjs` `NAME_GLYPH` — alias nama→glyph — `resolve.mjs:365-396`.
5. Deteksi pagination by regex teks Indonesia — `inspect.mjs:32`, `content.mjs:109`.
6. Heading by `fontSize >= 18` — `inspect.mjs:33`.
7. Select vs input by `hasIconChild` — `agent-context.mjs:77`.
8. Badge status by warna/teks — `resolve.mjs:509-515,550-556`.
9. Button variant `bg`→`btn-primary/secondary` — `resolve.mjs:303-357`.
10. Color census role by luminance/saturation — `figml-parse.mjs:602-608`.
11. Table row count compression (hanya row 1 penuh di `inspect`, sisanya index) — `inspect.mjs:120-133`.

Ini berarti "usable coverage" di atas masih dibumbui interpretasi: komponen/ikon/status/pagination **ditebak** dari konvensi nama/warna/geometri, bukan dari field eksplisit (karena `mainComponent.id` dan `variantProperties` tidak tersalur penuh).

## Fidelity score adalah subset yang dikurasi (bukan ground truth penuh)

`sliceui fidelity` melaporkan "100% (361/361)" untuk `mahasiswa-tarif`, tetapi `computeFidelity` (`fidelity.mjs:32-36`) HANYA menskor 13 atribut: `text/fontSize/fontWeight/color/lineHeight/letterSpacing` (teks) dan `bg/axis/radius/cornerRadius/border/padding/gap/justify` (box/shape). Field yang hilang (font family, alignment, opacity, layoutGrow, mainComponent, blendMode, constraints) **tidak ada di denominator**, sehingga "100%" tidak berarti transcript lossless. Lihat `fidelity.mjs:32-36` vs `observed-figml-schema.md`.
