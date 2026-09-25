import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFigml } from "../src/lib/figml-parse.mjs";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<?figml version="1.0"?>
<frame id="1:1" name="Page" x="0" y="0" width="400" height="300" layoutMode="VERTICAL" itemSpacing="20" type="FRAME">
  <children>
    <Text id="1:2" name="Judul" x="0" y="0" width="400" height="19" fontSize="16" fontWeight="500" characters="Tambah tarif manual" type="TEXT">
      <fills><fill blendMode="NORMAL" color="#000000" /></fills>
    </Text>
    <Button_FNC id="1:3" name="Button_FNC" cornerRadius="6" x="0" y="39" width="196" height="41" layoutMode="HORIZONTAL" type="INSTANCE">
      <children>
        <Text id="1:4" name="label" x="12" y="12" width="172" height="17" fontSize="14" fontWeight="700" characters="Get data" type="TEXT">
          <fills><fill blendMode="NORMAL" color="#ffffff" /></fills>
        </Text>
      </children>
    </Button_FNC>
    <Field id="1:5" name="Field" x="0" y="100" width="400" height="63" type="INSTANCE">
      <children>
        <Text id="1:6" name="label" x="0" y="0" width="400" height="18" fontSize="14" fontWeight="700" characters="Tahun akademik" type="TEXT">
          <fills><fill blendMode="NORMAL" color="#03337b" /></fills>
        </Text>
      </children>
    </Field>
    <Line id="1:7" name="Line" x="0" y="180" width="400" height="1" type="LINE" />
  </children>
</frame>`;

function walkText(nodes, out = []) {
  for (const n of nodes) {
    if (n.type === "text" && n.text) out.push(n.text);
    if (n.children) walkText(n.children, out);
  }
  return out;
}

test("parses FIGML into a valid exact-text transcript", () => {
  const r = parseFigml(SAMPLE, "sample.xml");
  assert.equal(r.ok, true, r.message);
  const t = r.transcript;
  assert.equal(t.meta.source, "figml");
  assert.equal(t.meta.tier, 0);
  assert.equal(t.meta.textQuality, "exact");
  assert.equal(t.meta.width, 400);
  assert.equal(t.meta.height, 300);
});

test("extracts exact text strings (no OCR guessing)", () => {
  const r = parseFigml(SAMPLE, "sample.xml");
  const texts = walkText(r.transcript.layout);
  assert.ok(texts.includes("Tambah tarif manual"));
  assert.ok(texts.includes("Tahun akademik"));
  assert.ok(texts.includes("Get data"));
});

test("maps component instances to button/input semantics", () => {
  const r = parseFigml(SAMPLE, "sample.xml");
  const types = [];
  const walk = (nodes) => { for (const n of nodes) { types.push(n.type); if (n.children) walk(n.children); } };
  walk(r.transcript.layout);
  assert.ok(types.includes("button"), "button mapped");
  assert.ok(types.includes("input"), "input mapped");
  assert.ok(types.includes("divider"), "line → divider");
});

test("captures the fill color census", () => {
  const r = parseFigml(SAMPLE, "sample.xml");
  const hexes = r.transcript.tokens.colors.map((c) => c.hex);
  assert.ok(hexes.includes("#03337b"), "#03337b captured");
  assert.ok(hexes.includes("#000000"), "#000000 captured");
});

test("fails gracefully on non-FIGML XML", () => {
  const r = parseFigml("<root><foo/></root>", "x.xml");
  assert.equal(r.ok, false);
  assert.equal(r.reason, "no-root");
});

// --- glyph identity: empty-TEXT icon glyphs carry the node name as glyphName ---

const GLYPH_XML = `<?xml version="1.0" encoding="UTF-8"?>
<?figml version="1.0"?>
<frame id="g:1" name="Actions" x="0" y="0" width="600" height="200" type="FRAME">
  <children>
    <Instance_toggle id="g:2" name="Icon_Font_Awesome_Free_Solid_T_toggle-on" x="0" y="0" width="16" height="16" type="INSTANCE">
      <children>
        <Text id="g:3" name="glyph" x="0" y="0" width="16" height="16" fontSize="15" fontWeight="900" characters="" type="TEXT">
          <fills><fill blendMode="NORMAL" color="#1b3680" /></fills>
        </Text>
      </children>
    </Instance_toggle>
    <Vector id="g:4" name="Icon_Font_Awesome_Free_Solid_C_caret-down" x="0" y="40" width="12" height="12" type="VECTOR">
      <fills><fill blendMode="NORMAL" color="#03337b" /></fills>
    </Vector>
    <Text id="g:5" name="Real label" x="0" y="80" width="200" height="18" fontSize="14" fontWeight="500" characters="Ubah tagihan" type="TEXT">
      <fills><fill blendMode="NORMAL" color="#03337b" /></fills>
    </Text>
  </children>
</frame>`;

test("glyph: empty-TEXT inside a named icon INSTANCE keeps type/style and gains glyphName", () => {
  const r = parseFigml(GLYPH_XML, "glyph.xml");
  assert.equal(r.ok, true, r.message);
  const nodes = [];
  const walk = (ns) => { for (const n of ns) { nodes.push(n); if (n.children) walk(n.children); } };
  walk(r.transcript.layout);
  const glyphText = nodes.find((n) => n.id === "g_3");
  assert.ok(glyphText, "glyph text node present");
  assert.equal(glyphText.type, "text", "stays a text node (fidelity style preserved)");
  assert.equal(glyphText.glyphName, "Icon_Font_Awesome_Free_Solid_T_toggle-on", "inherits the wrapper glyph name");
  assert.equal(glyphText.style.color, "#1b3680", "style.color untouched");
  assert.equal(glyphText.style.size, 15, "style.size untouched");
  const label = nodes.find((n) => n.id === "g_5");
  assert.equal(label.glyphName, undefined, "real text does NOT get a glyphName");
});

test("glyph: VECTOR node carries its Figma name as glyphName", () => {
  const r = parseFigml(GLYPH_XML, "glyph.xml");
  const nodes = [];
  const walk = (ns) => { for (const n of ns) { nodes.push(n); if (n.children) walk(n.children); } };
  walk(r.transcript.layout);
  const vector = nodes.find((n) => n.id === "g_4");
  assert.equal(vector.glyphName, "Icon_Font_Awesome_Free_Solid_C_caret-down");
});

// --- v3 regressions: frame fills, colored dividers, hidden layers ---

const FILLS_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<?figml version="1.0"?>
<frame id="f:1" name="Modal" x="0" y="0" width="950" height="802" layoutMode="VERTICAL" type="FRAME">
  <children>
    <Frame id="f:2" name="Header" x="0" y="0" width="950" height="59" layoutMode="HORIZONTAL" type="FRAME">
      <children>
        <Text id="f:3" name="Title" x="20" y="20" width="910" height="19" fontSize="16" fontWeight="700" characters="Ubah massal" type="TEXT">
          <fills><fill blendMode="NORMAL" color="#555555" /></fills>
        </Text>
      </children>
      <fills><fill blendMode="NORMAL" color="#ffffff" /></fills>
    </Frame>
    <Frame id="f:4" name="DividerWrap" x="0" y="59" width="950" height="1" layoutMode="VERTICAL" type="FRAME">
      <children>
        <Rectangle id="f:5" name="Rect" x="20" y="0" width="910" height="1" type="RECTANGLE">
          <fills><fill blendMode="NORMAL" color="#fbc02d" /></fills>
        </Rectangle>
      </children>
      <fills><fill blendMode="NORMAL" color="#ffffff" /></fills>
    </Frame>
    <Frame id="f:6" name="Detail" x="0" y="60" width="950" height="40" layoutMode="HORIZONTAL" type="FRAME">
      <children>
        <Text id="f:7" name="Label" x="30" y="0" width="107" height="16" fontSize="14" fontWeight="700" characters="Detail perubahan" type="TEXT">
          <fills><fill blendMode="NORMAL" color="#03337b" /></fills>
        </Text>
        <Frame id="f:8" name="edit" visible="false" x="172" y="0" width="26" height="26" layoutMode="VERTICAL" type="FRAME">
          <fills><fill blendMode="NORMAL" color="#0299b7" /></fills>
        </Frame>
      </children>
      <fills><fill blendMode="NORMAL" color="#ffffff" /></fills>
    </Frame>
  </children>
  <fills><fill blendMode="NORMAL" color="#ffffff" /></fills>
</frame>`;

test("v3: captures frame fill colors (header/body containers)", () => {
  const r = parseFigml(FILLS_FIXTURE, "f.xml");
  assert.equal(r.ok, true, r.message);
  const t = r.transcript;
  assert.equal(t.version, 3);
  const header = t.layout[0];
  assert.equal(header.bg, "#ffffff", "header frame fill captured");
  const body = t.layout[2];
  assert.equal(body.bg, "#ffffff", "detail row frame fill captured");
});

test("v3: colored divider rectangle keeps its fill (bg:#fbc02d)", () => {
  const r = parseFigml(FILLS_FIXTURE, "f.xml");
  const divWrap = r.transcript.layout[1];
  const rect = divWrap.children[0];
  assert.equal(rect.type, "divider");
  assert.equal(rect.bg, "#fbc02d", "yellow divider fill captured");
});

test("v3: hidden layer (visible=false) is surfaced as hidden:true, not dropped", () => {
  const r = parseFigml(FILLS_FIXTURE, "f.xml");
  const detail = r.transcript.layout[2];
  const hidden = detail.children.find((c) => c.id === "f_8" || /edit/i.test(c.id || ""));
  assert.ok(hidden, "hidden edit frame is transcribed (not dropped)");
  assert.equal(hidden.hidden, true, "hidden:true surfaced on the node");
});

test("v3: fills/fill metadata wrappers are NOT emitted as nodes", () => {
  const r = parseFigml(FILLS_FIXTURE, "f.xml");
  const ids = [];
  const walk = (ns) => { for (const n of ns) { ids.push(n.id || n.name || n.type); if (n.children) walk(n.children); } };
  walk(r.transcript.layout);
  assert.ok(!ids.some((x) => /^(fills|fill)_/.test(x)), "no fills_/fill_ noise nodes");
});

// --- table detection: a group of ≥3 flush, full-width rows is a table ---

const TABLE_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<?figml version="1.0"?>
<frame id="t:1" name="Page" x="0" y="0" width="1117" height="600" type="FRAME">
  <children>
    <Frame id="t:2" name="Table" x="20" y="100" width="1117" height="120" type="FRAME">
      <children>
        <Frame id="t:3" name="row" x="20" y="100" width="1117" height="40" type="FRAME">
          <children><Text id="t:4" name="c" x="20" y="100" width="50" height="40" fontSize="14" characters="1" type="TEXT"><fills><fill color="#303030"/></fills></Text></children>
        </Frame>
        <Frame id="t:5" name="row" x="20" y="140" width="1117" height="40" type="FRAME">
          <children><Text id="t:6" name="c" x="20" y="140" width="50" height="40" fontSize="14" characters="2" type="TEXT"><fills><fill color="#303030"/></fills></Text></children>
        </Frame>
        <Frame id="t:7" name="row" x="20" y="180" width="1117" height="40" type="FRAME">
          <children><Text id="t:8" name="c" x="20" y="180" width="50" height="40" fontSize="14" characters="3" type="TEXT"><fills><fill color="#303030"/></fills></Text></children>
        </Frame>
      </children>
    </Frame>
  </children>
</frame>`;

test("table: repeated flush full-width rows mark the container as table", () => {
  const r = parseFigml(TABLE_FIXTURE, "t.xml");
  assert.equal(r.ok, true, r.message);
  const table = r.transcript.layout[0];
  assert.equal(table.table, true, "container flagged as table");
});

// --- visual fidelity: radius/padding/gap/lineHeight survive the parse ---

const FIDELITY_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<?figml version="1.0"?>
<frame id="fid:1" name="Page" x="0" y="0" width="1157" height="600" type="FRAME">
  <children>
    <Frame id="fid:2" name="Card" cornerRadius="8" x="20" y="20" width="400" height="200" layoutMode="VERTICAL" paddingLeft="20" paddingRight="20" paddingTop="16" paddingBottom="16" itemSpacing="10" type="FRAME">
      <children>
        <Text id="fid:3" name="label" x="0" y="0" width="100" height="24" fontSize="14" fontWeight="500" characters="Judul" type="TEXT">
          <lineHeight unit="PIXELS" value="20" />
          <letterSpacing unit="PERCENT" value="0" />
          <fills><fill color="#000000" /></fills>
        </Text>
        <Rectangle id="fid:4" name="btn" cornerRadius="6" x="0" y="40" width="120" height="40" type="RECTANGLE">
          <fills><fill color="#03337b" /></fills>
        </Rectangle>
      </children>
    </Frame>
  </children>
</frame>`;

test("fidelity: radius/padding/gap captured on frames", () => {
  const r = parseFigml(FIDELITY_FIXTURE, "fid.xml");
  assert.equal(r.ok, true, r.message);
  const card = r.transcript.layout[0];
  assert.equal(card.radius, 8, "cornerRadius 8 → radius 8");
  assert.deepEqual(card.padding, { top: 16, right: 20, bottom: 16, left: 20 }, "padding 16/20/16/20");
  assert.equal(card.gap, 10, "itemSpacing 10 → gap 10");
});

test("fidelity: rectangle keeps its cornerRadius", () => {
  const r = parseFigml(FIDELITY_FIXTURE, "fid.xml");
  const rect = r.transcript.layout[0].children[1];
  assert.equal(rect.radius, 6, "rectangle cornerRadius 6 captured");
});

test("fidelity: lineHeight captured; zero letterSpacing + AUTO lineHeight dropped", () => {
  const r = parseFigml(FIDELITY_FIXTURE, "fid.xml");
  const text = r.transcript.layout[0].children[0];
  assert.equal(text.style.lineHeight, 20, "pixel lineHeight 20 captured");
  assert.equal(text.style.letterSpacing, undefined, "zero letterSpacing not surfaced");
});

test("fidelity: spacing census from padding + itemSpacing", () => {
  const r = parseFigml(FIDELITY_FIXTURE, "fid.xml");
  const sp = r.transcript.tokens.spacing;
  assert.equal(sp.base, 16, "mode padding = 16 (from 16/16/20/20)");
  assert.equal(sp.gap, 10, "mode itemSpacing = 10");
});

test("table: layout-grid metadata is NOT flagged as a table", () => {
  // A FIGML export names its grid-guide layers "layoutGrids" — the word-boundary table
  // classifier must not treat that as a table, and zero-size nodes are never flagged.
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?figml version="1.0"?>
<frame id="g:1" name="Page" x="0" y="0" width="1117" height="600" type="FRAME">
  <children>
    <Frame id="g:2" name="content" x="0" y="0" width="1117" height="600" type="FRAME">
      <children>
        <Frame id="g:3" name="layoutGrids" x="962" y="792" width="0" height="0" type="INSTANCE">
          <children>
            <Frame id="g:4" name="layoutGrid" x="962" y="792" width="0" height="0" type="INSTANCE" />
            <Frame id="g:5" name="layoutGrid" x="962" y="792" width="0" height="0" type="INSTANCE" />
            <Frame id="g:6" name="layoutGrid" x="962" y="792" width="0" height="0" type="INSTANCE" />
          </children>
        </Frame>
      </children>
    </Frame>
  </children>
</frame>`;
  const r = parseFigml(xml, "g.xml");
  const flags = [];
  const walk = (ns) => { for (const n of ns) { if (n.table) flags.push(n.id || n.name); if (n.children) walk(n.children); } };
  walk(r.transcript.layout);
  assert.deepEqual(flags, [], "layoutGrids must not be flagged as a table");
});

// --- defect #6: Checkbox_FNC semantics preserved (not dropped to a bare card) ---

const CHECKBOX_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<?figml version="1.0"?>
<frame id="cb:1" name="Page" x="0" y="0" width="600" height="200" type="FRAME">
  <children>
    <Frame id="cb:2" name="row" x="0" y="0" width="600" height="40" type="FRAME">
      <children>
        <Checkbox_FNC id="cb:3" name="Checkbox_FNC" x="15" y="12.5" width="15" height="15" cornerRadius="2" type="INSTANCE">
          <fills><fill blendMode="NORMAL" color="#ffffff" /></fills>
          <variantProperties Checked="False" Indeterminate="False" Type="Checkbox" State="Default" />
        </Checkbox_FNC>
      </children>
    </Frame>
  </children>
</frame>`;

test("defect #6: Checkbox_FNC is typed `checkbox`, not a bare `card`", () => {
  const r = parseFigml(CHECKBOX_FIXTURE, "cb.xml");
  assert.equal(r.ok, true, r.message);
  const row = r.transcript.layout[0];
  const checkbox = row.children[0];
  assert.equal(checkbox.type, "checkbox", "checkbox semantics preserved");
  assert.equal(checkbox.bg, "#ffffff", "checkbox fill captured");
  assert.notEqual(checkbox.type, "card", "must not degrade to card");
});

// --- defect #3: VECTOR icon fill color carried into the transcript ---

const ICON_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<?figml version="1.0"?>
<frame id="ic:1" name="Page" x="0" y="0" width="600" height="200" type="FRAME">
  <children>
    <Frame id="ic:2" name="badge" x="0" y="0" width="100" height="40" type="FRAME">
      <children>
        <Vector id="ic:3" name="Vector" x="1" y="3" width="12" height="12" type="VECTOR">
          <fills><fill blendMode="NORMAL" color="#f44444" /></fills>
        </Vector>
      </children>
    </Frame>
  </children>
</frame>`;

test("defect #3: VECTOR icon carries its fill color", () => {
  const r = parseFigml(ICON_FIXTURE, "ic.xml");
  assert.equal(r.ok, true, r.message);
  const icon = r.transcript.layout[0].children[0];
  assert.equal(icon.type, "icon");
  assert.equal(icon.bg, "#f44444", "icon fill color preserved");
});

// --- layout fidelity: per-corner radius, stroke/border, space-between ---

const LAYOUT_FIDELITY_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<?figml version="1.0"?>
<frame id="lf:1" name="Page" x="0" y="0" width="900" height="400" type="FRAME">
  <children>
    <Frame id="lf:2" name="Table" cornerRadius="4" x="20" y="20" width="860" height="200" type="FRAME">
      <children>
        <Rectangle id="lf:3" name="header" strokeWeight="1" topLeftRadius="4" topRightRadius="4" bottomLeftRadius="0" bottomRightRadius="0" x="20" y="20" width="860" height="40" type="RECTANGLE">
          <fills><fill color="#eef6ff" /></fills>
          <strokes><stroke color="#bdbdbd" /></strokes>
        </Rectangle>
        <Frame id="lf:4" name="toolbar" primaryAxisAlignItems="SPACE_BETWEEN" itemSpacing="497" x="20" y="60" width="860" height="40" layoutMode="HORIZONTAL" type="FRAME">
          <children>
            <Text id="lf:5" name="t" x="0" y="0" width="100" height="20" fontSize="14" characters="Tampilkan data" type="TEXT">
              <fills><fill color="#000000" /></fills>
            </Text>
          </children>
        </Frame>
      </children>
    </Frame>
  </children>
</frame>`;

test("layout: per-corner radius + stroke/border + space-between preserved", () => {
  const r = parseFigml(LAYOUT_FIDELITY_FIXTURE, "lf.xml");
  assert.equal(r.ok, true, r.message);
  const header = r.transcript.layout[0].children[0];
  // Asymmetric radius → cornerRadius {tl,tr,br,bl}; uniform radius is a separate number.
  assert.deepEqual(header.cornerRadius, { tl: 4, tr: 4, br: 0, bl: 0 }, "asymmetric per-corner radius captured");
  assert.equal(header.radius, undefined, "no uniform cornerRadius on the header (per-corner only)");
  // Stroke is a border, distinct from the fill bg.
  assert.deepEqual(header.border, { color: "#bdbdbd", width: 1 }, "stroke → border {color,width}");
  assert.equal(header.bg, "#eef6ff", "fill stays as bg, not confused with stroke");
  const toolbar = r.transcript.layout[0].children[1];
  assert.equal(toolbar.justify, "space-between", "SPACE_BETWEEN → justify:space-between");
  assert.equal(toolbar.gap, undefined, "wide itemSpacing is NOT emitted as a literal gap when space-between");
});

// --- design-6 real-format regressions: GROUP subtree, node-level strokeWeight, LINE stroke ---

const GROUP_TABLE_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<?figml version="1.0"?>
<frame id="g1:1" name="Page" x="0" y="0" width="800" height="400" type="FRAME">
  <children>
    <Frame id="g1:2" name="content" x="0" y="0" width="800" height="300" type="FRAME">
      <children>
        <Group id="g1:3" name="Group_1222" x="0" y="0" width="760" height="180" type="GROUP">
          <children>
            <Frame id="g1:4" name="Frame_1654" cornerRadius="4" x="0" y="0" width="760" height="180" layoutMode="VERTICAL" type="FRAME">
              <children>
                <Rectangle id="g1:5" name="header" topLeftRadius="4" topRightRadius="4" bottomLeftRadius="0" bottomRightRadius="0" x="0" y="0" width="760" height="60" type="RECTANGLE">
                  <fills><fill color="#ffffff" /></fills>
                </Rectangle>
                <Rectangle id="g1:5b" name="row" x="0" y="60" width="760" height="40" type="RECTANGLE">
                  <fills><fill color="#f5f5f5" /></fills>
                </Rectangle>
                <Rectangle id="g1:5c" name="row" x="0" y="100" width="760" height="40" type="RECTANGLE">
                  <fills><fill color="#ffffff" /></fills>
                </Rectangle>
                <Rectangle id="g1:5d" name="row" x="0" y="140" width="760" height="40" type="RECTANGLE">
                  <fills><fill color="#f5f5f5" /></fills>
                </Rectangle>
                <Line id="g1:6" name="Line_1" x="0" y="60" width="760" height="0" type="LINE">
                  <strokes><stroke blendMode="NORMAL" color="#bdbdbd" /></strokes>
                </Line>
              </children>
              <strokes><stroke blendMode="NORMAL" color="#bdbdbd" /></strokes>
            </Frame>
          </children>
        </Group>
      </children>
    </Frame>
  </children>
</frame>`;

test("design-6: a bare GROUP container is traversed, not dropped (nested table preserved)", () => {
  const r = parseFigml(GROUP_TABLE_FIXTURE, "g1.xml");
  assert.equal(r.ok, true, r.message);
  const ids = [];
  const walk = (ns) => { for (const n of ns) { ids.push(n.id); if (n.children) walk(n.children); } };
  walk(r.transcript.layout);
  assert.ok(ids.includes("g1_4"), "Frame_1654 inside the GROUP is preserved");
  assert.ok(ids.includes("g1_5"), "header rectangle preserved");
  assert.ok(ids.includes("g1_6"), "Line divider preserved");
});

test("design-6: GROUP-wrapped frame still detected as a table", () => {
  const r = parseFigml(GROUP_TABLE_FIXTURE, "g1.xml");
  const walk = (ns, out = []) => { for (const n of ns) { if (n.table) out.push(n.id); if (n.children) walk(n.children, out); } return out; };
  const tables = walk(r.transcript.layout);
  assert.ok(tables.length >= 1, "the nested frame is flagged as a table");
});

test("design-6: LINE divider takes its visible stroke color as bg", () => {
  const r = parseFigml(GROUP_TABLE_FIXTURE, "g1.xml");
  const walk = (ns, out = []) => { for (const n of ns) { if (n.type === "divider") out.push(n); if (n.children) walk(n.children, out); } return out; };
  const dividers = walk(r.transcript.layout);
  const line = dividers.find((d) => d.id === "g1_6");
  assert.equal(line.bg, "#bdbdbd", "LINE stroke #bdbdbd surfaced as divider bg");
});

const NODE_STROKE_WEIGHT_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<?figml version="1.0"?>
<frame id="sw:1" name="Page" x="0" y="0" width="400" height="200" type="FRAME">
  <children>
    <Rectangle id="sw:2" name="box" strokeWeight="2" strokeAlign="INSIDE" x="10" y="10" width="100" height="100" type="RECTANGLE">
      <fills><fill color="#ffffff" /></fills>
      <strokes><stroke blendMode="NORMAL" color="#bdbdbd" /></strokes>
    </Rectangle>
    <Rectangle id="sw:3" name="ghost" strokeWeight="2" strokeAlign="INSIDE" x="120" y="10" width="100" height="100" type="RECTANGLE">
      <fills><fill color="#ffffff" /></fills>
      <strokes><stroke visible="false" blendMode="NORMAL" color="#979797" /></strokes>
    </Rectangle>
  </children>
</frame>`;

test("design-6: node-level strokeWeight + visible stroke captured; invisible stroke skipped", () => {
  const r = parseFigml(NODE_STROKE_WEIGHT_FIXTURE, "sw.xml");
  assert.equal(r.ok, true, r.message);
  const box = r.transcript.layout[0];
  assert.deepEqual(box.border, { color: "#bdbdbd", width: 2 }, "stroke → border {color,width} (width from node-level strokeWeight)");
  const ghost = r.transcript.layout[1];
  assert.equal(ghost.border, undefined, "invisible stroke is not a border");
});

// --- design-2/3/7 real-format: SPACE_BETWEEN + wide itemSpacing is a flex distribution ---

const SPACE_BETWEEN_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<?figml version="1.0"?>
<frame id="sb:1" name="Page" x="0" y="0" width="1209" height="100" type="FRAME">
  <children>
    <Frame id="sb:2" name="toolbar" primaryAxisSizingMode="FIXED" primaryAxisAlignItems="SPACE_BETWEEN" itemSpacing="497" x="0" y="0" width="1209" height="41" layoutMode="HORIZONTAL" type="FRAME">
      <children>
        <Text id="sb:3" name="a" x="0" y="0" width="100" height="20" fontSize="14" characters="kiri" type="TEXT">
          <fills><fill color="#000000" /></fills>
        </Text>
      </children>
    </Frame>
  </children>
</frame>`;

test("design-2/3/7: SPACE_BETWEEN + wide itemSpacing → justify, NOT gap:497", () => {
  const r = parseFigml(SPACE_BETWEEN_FIXTURE, "sb.xml");
  assert.equal(r.ok, true, r.message);
  const toolbar = r.transcript.layout[0];
  assert.equal(toolbar.justify, "space-between", "primaryAxisAlignItems SPACE_BETWEEN → justify:space-between");
  assert.equal(toolbar.gap, undefined, "wide itemSpacing (497) is NOT emitted as a literal gap");
});

// --- B1: hidden-by-override (FIGML encodes visibility as <override overriddenField="visible">) ---

const OVERRIDE_HIDDEN_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<?figml version="1.0"?>
<frame id="oh:1" name="Page" x="0" y="0" width="400" height="200" type="FRAME">
  <children>
    <Frame id="oh:2" name="Hidden section" x="0" y="0" width="400" height="50" type="FRAME">
      <overrides>
        <override overriddenField="visible" value="false" />
      </overrides>
    </Frame>
    <Frame id="oh:3" name="Visible section" x="0" y="50" width="400" height="50" type="FRAME">
      <overrides>
        <override overriddenField="fill" value="#000000" />
      </overrides>
    </Frame>
  </children>
</frame>`;

test("B1: override overriddenField=visible false marks the node hidden; other overrides do not", () => {
  const r = parseFigml(OVERRIDE_HIDDEN_FIXTURE, "oh.xml");
  assert.equal(r.ok, true, r.message);
  const hidden = r.transcript.layout.find((n) => n.id === "oh_2");
  const visible = r.transcript.layout.find((n) => n.id === "oh_3");
  assert.equal(hidden.hidden, true, "visible=false override → hidden:true");
  assert.equal(visible.hidden, undefined, "a fill override must NOT hide the node");
});

const REQUIRED_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<frame id="1:1" name="Page" x="0" y="0" width="400" height="300" type="FRAME">
  <children>
    <Field id="1:2" name="Field" required="true" x="0" y="0" width="400" height="60" type="INSTANCE">
      <children><Text id="1:3" name="label" x="0" y="0" width="200" height="18" fontSize="14" characters="Tahun akademik" type="TEXT" /></children>
    </Field>
    <Field id="1:4" name="Field" required="false" x="0" y="60" width="400" height="60" type="INSTANCE">
      <children><Text id="1:5" name="label" x="0" y="0" width="200" height="18" fontSize="14" characters="Program studi" type="TEXT" /></children>
    </Field>
    <Field id="1:6" name="Field" x="0" y="120" width="400" height="60" type="INSTANCE">
      <children><Text id="1:7" name="label" x="0" y="0" width="200" height="18" fontSize="14" characters="NIM" type="TEXT" /></children>
    </Field>
  </children>
</frame>`;

test("required: the XML's explicit required flag is surfaced (absent stays distinguishable)", () => {
  // 2026-09-24 (report §4.5): the generator reconstructed the design's HIDDEN asterisk and shipped
  // it as `<span class="required-mark hidden">*</span>` on an optional field. The flag must reach
  // the transcript so the generator emits a marker for `true` and nothing at all for `false`.
  const r = parseFigml(REQUIRED_FIXTURE, "req.xml");
  assert.equal(r.ok, true, r.message);
  const byId = new Map(r.transcript.layout.map((n) => [n.id, n]));
  assert.equal(byId.get("1_2").required, true, "required=\"true\" → true");
  assert.equal(byId.get("1_4").required, false, "required=\"false\" → false");
  assert.equal("required" in byId.get("1_6"), false, "an absent attribute must not be invented as false");
});

// The real field export (root <frame> padding + <variantProperties required>) lives in
// test/fixtures/mahasiswa-tarif/raw.xml and is exercised end-to-end by
// test/mahasiswa-tarif.test.mjs — those shapes are no longer re-approximated here as synthetic
// fixtures, so the parser and the regression can never drift from the field data.
