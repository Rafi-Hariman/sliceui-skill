import { test } from "node:test";
import assert from "node:assert/strict";
import { computeFidelity } from "../src/lib/fidelity.mjs";

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<?figml version="1.0"?>
<frame id="1:1" name="Page" x="0" y="0" width="400" height="300" layoutMode="VERTICAL" itemSpacing="20" type="FRAME">
  <children>
    <Frame id="1:2" name="Card" cornerRadius="8" x="0" y="0" width="400" height="120" layoutMode="HORIZONTAL" paddingLeft="20" paddingRight="20" paddingTop="16" paddingBottom="16" itemSpacing="10" type="FRAME">
      <children>
        <Text id="1:3" name="Title" x="0" y="0" width="100" height="24" fontSize="14" fontWeight="500" characters="Judul" type="TEXT">
          <lineHeight unit="PIXELS" value="20" />
          <fills><fill color="#000000" /></fills>
        </Text>
        <Rectangle id="1:4" name="btn" cornerRadius="6" x="0" y="40" width="120" height="40" type="RECTANGLE">
          <fills><fill color="#03337b" /></fills>
        </Rectangle>
      </children>
    </Frame>
    <Frame id="1:5" name="hidden" visible="false" x="0" y="0" width="10" height="10" type="FRAME" />
  </children>
</frame>`;

test("fidelity: full coverage for a well-formed FIGML doc", () => {
  const r = computeFidelity(XML, "x.xml");
  assert.equal(r.score, 1, "100% visual attributes preserved");
  assert.equal(r.preserved, r.total);
  assert.equal(r.droppedNodes, 0, "hidden node excluded before comparison (not a real loss)");
  assert.ok(r.byAttr.radius, "radius tracked");
  assert.ok(r.byAttr.padding, "padding tracked");
  assert.ok(r.byAttr.gap, "gap tracked");
});

test("fidelity: AUTO lineHeight is not scored (not a real visual value)", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?figml version="1.0"?>
<frame id="1:1" name="Page" x="0" y="0" width="400" height="100" type="FRAME">
  <children>
    <Text id="1:2" name="T" x="0" y="0" width="100" height="24" fontSize="14" characters="hi" type="TEXT">
      <lineHeight unit="AUTO" />
      <fills><fill color="#000000" /></fills>
    </Text>
  </children>
</frame>`;
  const r = computeFidelity(xml, "x.xml");
  assert.equal(r.byAttr.lineHeight, undefined, "AUTO lineHeight not in the denominator");
  assert.equal(r.score, 1, "still 100% — AUTO contributes no visual value");
});
