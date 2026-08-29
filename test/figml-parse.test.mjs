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

test("v3: hidden layer (visible=false) is dropped from the transcript", () => {
  const r = parseFigml(FILLS_FIXTURE, "f.xml");
  const detail = r.transcript.layout[2];
  const desc = [];
  const walk = (ns) => { for (const n of ns) { desc.push(n.name || n.id || n.type); if (n.children) walk(n.children); } };
  walk(detail.children);
  assert.ok(!desc.some((d) => /edit|f:8/i.test(d)), "hidden edit icon should not be transcribed");
  assert.equal(detail.children.filter((c) => c.type === "icon").length, 0, "no icon node under detail header");
});
