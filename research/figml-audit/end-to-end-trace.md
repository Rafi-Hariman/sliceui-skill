# End-to-End Trace — `mahasiswa-tarif/raw.xml`

Menelusuri properti P0/P1 melalui: XML → parser (`parseFigml`) → transcript → render (`transcript.md`/`spec.md`/`inspect`) → skill → konsekuensi Angular.

Fixture: `test/fixtures/mahasiswa-tarif/raw.xml` (FIGML asli, 120 KB, 157 node transcript).

## Tabel trace

| Node path/ID | Property | Raw FigML | Parsed | Normalized | Transcript | Status | Angular impact | Evidence |
|---|---|---|---|---|---|---|---|---|
| `16601:46205` "Tambah mahasiswa tarif" | text | `characters="Tambah mahasiswa tarif"` | `attrs.characters` | `text="Tambah mahasiswa tarif"` | `text#… "Tambah mahasiswa tarif"` | preserved-exact | OK | figml-parse.mjs:233; spec.md |
| `16601:46205` | fontSize | `fontSize="16"` | `num("16")=16` | `style.size=16` | `16px` | preserved-exact | OK | figml-parse.mjs:224 |
| `16601:46205` | fontWeight | `fontWeight="500"` | `Number("500")=500` | `style.weight=500` | `w500` | preserved-exact | OK | figml-parse.mjs:225 |
| `16601:46205` | font family | `<fontName family="Roboto" style="Medium"/>` | **SKIP** | — | **tidak muncul** | omitted-critical | font-family hilang | figml-parse.mjs:124 SKIP_TAGS; render styleSummary tanpa family |
| `16601:46204` (root content) | padding | `paddingTop="20"…` (pada root `<frame>`) | `findRootAttrs` | re-attach ke layout[0].padding | `pad:20/20/20/20` | preserved-normalized | padding root tersalur | figml-parse.mjs:51-56 |
| `16601:46491` (card) | bg | `<fill color="#e0f7fa"/>` | `colorOf` | `bg="#e0f7fa"` | `bg:#e0f7fa` | preserved-exact | OK | figml-parse.mjs:200,277 |
| `16601:46491` | border | `<stroke color="#01579b"/>` + strokeWeight | `borderOf` | `border={color,width}` | `border:#01579b` | preserved-exact | OK | figml-parse.mjs:456 |
| `16601:46491` | radius | `cornerRadius="4"` | `num=4` | `radius=4` | `r:4` | preserved-exact | OK | figml-parse.mjs:204 |
| `16601:46491` | mainComponent | `<mainComponent id="10095:20674"/>` | **SKIP** | — | **tidak muncul** | omitted-critical | agent tidak tahu card = instance komponen apa | figml-parse.mjs:125; raw-graph.mjs:119 |
| `16601:46211` (Field) | required | `<variantProperties … required="true"/>` | `requiredOf→true` | `node.required=true` | **dead — tidak dirender** | omitted-critical | agent rekonstruksi asterisk dari hidden `*` | figml-parse.mjs:329; agent report: nobody reads `.required` |
| `I16601_46211_8231_12466` | hidden asterisk | `*` visible=false? | `isHidden` | `hidden:true` | `[HIDDEN] "*"` | preserved-exact (hidden) | agent lihat marker | spec.md `[HIDDEN] "*"` |
| `16601:46216` (footer row) | justify | `primaryAxisAlignItems="SPACE_BETWEEN"` | `justifyContentOf` | `justify="space-between"` | `justify:space-between` | preserved-normalized | flex justify | figml-parse.mjs:481-485 |
| `16601:46216` | itemSpacing | `itemSpacing="497"` | (tidak jadi gap) | — | tidak ada `gap:497` | preserved (correct) | gap-artifact dicegah | figml-parse.mjs:276 |
| `Field` instance | sizing | `layoutSizingHorizontal="FILL"` `layoutSizingVertical="FILL"` | `sizingFields` | `sizingH=FILL,sizingV=FILL` | **sizingV dead; sizingH hanya reword padding** | omitted-critical | responsive FILL/HUG tidak tersalur | figml-parse.mjs:347-348; inspect.mjs:62 |
| `Line` (divider) | absolute positioning | `layoutPositioning="ABSOLUTE"` | **tidak dibaca** | — | **tidak muncul** | omitted-critical | absolute child hilang | raw-graph.mjs:170 (hanya raw-graph) |
| `search_bar` icon glyph | glyph | `characters=""` (PUA) | `attrs.characters` | `text=""` | `""` | preserved-exact (raw PUA) | agent lihat char tak-tampak, bukan nama glyph | spec.md `"" 15px w900` |
| `I16601_46491_12_95` (Vector icon) | glyph name | `name="Vector"` (generik) | `glyphName="Vector"` | `glyph:Vector` | `glyph:Vector` | inferred (generic) | resolve tebak `fa-info-circle` dari warna | resolve.mjs FA_ICON_COLORS |
| Table `16601_46224` | table flag | `<Frame>` generic | `markTables` geometry | `table:true` | `[TABLE]` | inferred | mapping ke uii-table | figml-parse.mjs:494-515 |
| Row 2-5 (table) | cell content | `"00000002"…` dst | diparse penuh | ada di transcript.json | **spec.md penuh; inspect hanya `row 2/5: [2]`** | flattened (inspect) | agent via inspect kehilangan isi baris 2-5 | inspect.mjs:120-133 |

## Kesimpulan trace

1. **Text, geometry, color, border, radius, padding, gap, justify, hidden** tersalur akurat (exact/normalized) — ini fondasi P0 yang solid.
2. **Font family, mainComponent, required, sizing, alignment, absolute-positioning, opacity** hilang sebelum mencapai agent-facing output. Provenance id (Figma node id) masih ada di `layout[].id`, sehingga tiap node bisa ditelusuri ke XML, tapi **properti yang hilang tidak punya provenance** (tidak ada jejak bahwa field itu ada).
3. Ada **dua surface agent dengan konsistensi berbeda**: `spec.md` menampilkan semua baris tabel, `inspect` (yang disebut "primary read" di SKILL.md:26,79) mengompres baris 2-5 jadi index. Risiko: agent yang hanya baca `inspect` kehilangan isi baris.
4. `resolve` menambahkan **interpretasi warna→ikon** yang bukan dari XML (fa-check-circle dari `#3e82f3`), dan `inspect`/`plan` menambahkan klasifikasi komponen dari nama layer — ini adalah sumber utama "loss + guess".
