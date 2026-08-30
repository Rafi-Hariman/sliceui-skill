import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { computeFidelity, scssCoverage } from "../src/lib/fidelity.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const EXEMPLAR = readFileSync(join(HERE, "fixtures", "scss-exemplar.scss"), "utf8");

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

test("scssCoverage: full coverage when all ::ng-deep selectors survive", () => {
  const r = scssCoverage(EXEMPLAR, EXEMPLAR); // generated = exemplar verbatim
  assert.equal(r.score, 1, "all selectors present");
  assert.equal(r.missing.length, 0);
  assert.ok(r.total >= 6, "extracted at least the 6 regression selectors");
});

test("scssCoverage: flags dropped library-internal selectors", () => {
  // Simulate the "inverted familiarity filter": keep recognized selectors, drop unfamiliar ones.
  const generated = `
:host ::ng-deep .form-control { border-radius: 6px; }
:host ::ng-deep .ngx-select__toggle-caret { color: #03337b; }
::ng-deep .ngx-select__item_active { color: #fff; }
:host ::ng-deep .table-footer { margin: 0; }
`;
  const r = scssCoverage(EXEMPLAR, generated);
  assert.ok(r.score < 1, "dropped selectors lower the score");
  assert.ok(r.missing.some((s) => s.includes("li.page-box")), "li.page-box flagged missing");
  assert.ok(r.missing.some((s) => s.includes("dropdown-menu")), "dropdown-menu hover flagged missing");
  assert.ok(r.missing.some((s) => s.includes("search-options")), "search-options flagged missing");
  assert.ok(r.missing.some((s) => s.includes("limit-options")), "limit-options flagged missing");
});

test("scssCoverage: null exemplar is a hard FAIL, never score 1", () => {
  // The false-confidence machine: a missing reference used to return score: 1.
  const r = scssCoverage(null, ".x { color: red }");
  assert.equal(r.score, null, "null exemplar → score null");
  assert.equal(r.status, "no-exemplar", "null exemplar → loud no-exemplar state");
  assert.equal(r.total, 0);
  assert.equal(r.present, 0);
});
