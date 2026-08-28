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
