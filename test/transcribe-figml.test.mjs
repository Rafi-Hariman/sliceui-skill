import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { transcribe } from "../src/commands/transcribe.mjs";

const SAMPLE = `<?xml version="1.0"?>
<frame id="1:1" name="Page" width="400" height="300" layoutMode="VERTICAL" type="FRAME">
  <children>
    <Text id="1:2" name="T" x="0" y="0" width="400" height="19" fontSize="16" characters="Hello" type="TEXT">
      <fills><fill color="#03337b" /></fills>
    </Text>
  </children>
</frame>`;

test("transcribe auto-detects XML → figml (tier 0, exact, no key)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sliceui-tr-"));
  const xmlPath = join(dir, "design.xml");
  writeFileSync(xmlPath, SAMPLE);
  const r = await transcribe(xmlPath, dir, {});
  rmSync(dir, { recursive: true, force: true });
  assert.equal(r.ok, true, r.message);
  assert.equal(r.source, "figml");
  assert.equal(r.tier, 0);
  assert.equal(r.transcript.meta.textQuality, "exact");
});

test("transcribe surfaces a fidelity score on the FIGML path", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sliceui-tr-"));
  const xmlPath = join(dir, "design.xml");
  writeFileSync(xmlPath, SAMPLE);
  const r = await transcribe(xmlPath, dir, {});
  rmSync(dir, { recursive: true, force: true });
  assert.equal(r.ok, true);
  assert.ok(r.fidelity, "fidelity object present on the FIGML path");
  assert.equal(typeof r.fidelity.score, "number", "fidelity.score is a number");
  assert.ok(r.fidelity.total >= 0, "fidelity.total is a non-negative count");
});

test("transcribe reports read-error for a missing XML path", async () => {
  const r = await transcribe("/nonexistent/design.xml", "/tmp", {});
  assert.equal(r.ok, false);
  assert.equal(r.reason, "read-error");
});
