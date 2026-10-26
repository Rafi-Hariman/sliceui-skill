import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFigml } from "../src/lib/figml-parse.mjs";
import { buildInspect } from "../src/commands/inspect.mjs";

// Focused remediation F — layout semantics. A FIGML `layoutSizingHorizontal` tells us whether a
// node's width is layout-determined (FILL) or content-determined (HUG). Combined with a centered
// alignment, a FILL node's horizontal padding is RESULTING geometry, not an unconditional CSS
// `padding-left/right` — the G6 button defect.

test("parser: captures FILL sizing + centered alignment on a fill-width button", () => {
  const xml = `<frame id="1:1" name="Page" width="400" height="300" type="FRAME">
    <children>
      <Button_FNC id="1:2" name="Button_FNC" x="0" y="0" width="300" height="41" layoutSizingHorizontal="FILL" layoutGrow="1" primaryAxisAlignItems="CENTER" paddingLeft="12" paddingRight="12" type="INSTANCE">
        <children><Text id="1:3" name="label" characters="Cari" type="TEXT" /></children>
      </Button_FNC>
    </children>
  </frame>`;
  const r = parseFigml(xml, "x.xml");
  assert.equal(r.ok, true, r.message);
  const btn = r.transcript.layout.find((n) => n.type === "button");
  assert.equal(btn.sizingH, "FILL", "fill sizing captured");
  assert.equal(btn.alignPrimary, "CENTER", "centered alignment captured");
});

test("parser: captures HUG sizing (content-determined) for a hug button", () => {
  const xml = `<frame id="1:1" name="Page" width="400" height="300" type="FRAME">
    <children>
      <Button_FNC id="1:2" name="Button_FNC" x="0" y="0" width="83" height="40" layoutSizingHorizontal="HUG" primaryAxisAlignItems="CENTER" paddingLeft="25" paddingRight="25" type="INSTANCE">
        <children><Text id="1:3" name="label" characters="Cari" type="TEXT" /></children>
      </Button_FNC>
    </children>
  </frame>`;
  const r = parseFigml(xml, "x.xml");
  const btn = r.transcript.layout.find((n) => n.type === "button");
  assert.equal(btn.sizingH, "HUG", "hug sizing captured");
});

test("inspect: fill-width + centered button padding is marked geometry-sensitive", () => {
  const transcript = {
    meta: { source: "figml", tier: 0, image: "d.xml", textQuality: "exact" },
    tokens: { colors: [], fonts: [] },
    layout: [
      { id: "btn", type: "button", text: "Cari", sizingH: "FILL", alignPrimary: "CENTER", padding: { top: 12, right: 55, bottom: 12, left: 55 } },
    ],
    images: [],
    icons: [],
  };
  const { markdown } = buildInspect(transcript, {});
  assert.match(markdown, /geometry-sensitive/, "fill+centered padding flagged");
  assert.match(markdown, /not unconditional CSS/, "explains it is not an unconditional authored padding");
});

test("inspect: hug-content button padding stays a normal authored padding", () => {
  const transcript = {
    meta: { source: "figml", tier: 0, image: "d.xml", textQuality: "exact" },
    tokens: { colors: [], fonts: [] },
    layout: [
      { id: "btn", type: "button", text: "Cari", sizingH: "HUG", alignPrimary: "CENTER", padding: { top: 12, right: 25, bottom: 12, left: 25 } },
    ],
    images: [],
    icons: [],
  };
  const { markdown } = buildInspect(transcript, {});
  assert.ok(!markdown.includes("geometry-sensitive"), "hug padding is not geometry-sensitive");
  assert.match(markdown, /padding: 12\/25\/12\/25/, "hug padding rendered as a normal authored value");
});
