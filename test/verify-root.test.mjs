import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nearestProjectRoot, parseArgs, pairGroundTruth, readOwningModules } from "../src/commands/verify.mjs";

test("nearestProjectRoot: skips projects/*/package.json and finds the workspace .sliceui/", () => {
  const root = mkdtempSync(join(tmpdir(), "sliceui-root-"));
  try {
    // Workspace root with ground truth + angular.json.
    writeFileSync(join(root, "angular.json"), "{}\n");
    mkdirSync(join(root, ".sliceui"));
    // A library leaf that would have masked the root under the old package.json-first rule.
    const leaf = join(root, "projects", "uiigateway", "bill");
    mkdirSync(leaf, { recursive: true });
    writeFileSync(join(leaf, "package.json"), "{}\n");

    assert.equal(nearestProjectRoot(join(leaf, "src", "lib")), root,
      "walks past the library package.json to the workspace .sliceui/");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("nearestProjectRoot: workspace root (angular.json) wins over a library package.json", () => {
  const root = mkdtempSync(join(tmpdir(), "sliceui-root-"));
  try {
    writeFileSync(join(root, "angular.json"), "{}\n"); // no .sliceui/ — but still the workspace root
    const leaf = join(root, "projects", "bill");
    mkdirSync(leaf, { recursive: true });
    writeFileSync(join(leaf, "package.json"), "{}\n");
    assert.equal(nearestProjectRoot(join(leaf, "src", "lib")), root,
      "angular.json marks the workspace root regardless of .sliceui/");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("nearestProjectRoot: plain repo still finds the nearest package.json with .sliceui/", () => {
  const root = mkdtempSync(join(tmpdir(), "sliceui-root-"));
  try {
    writeFileSync(join(root, "package.json"), "{}\n");
    mkdirSync(join(root, ".sliceui"));
    assert.equal(nearestProjectRoot(join(root, "src", "app")), root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("parseArgs: accepts --conventions alongside --xml/--transcript", () => {
  const a = parseArgs(["src/app", "hero", "--conventions", "/x/conventions.json", "--xml", "/x/d.xml"]);
  assert.equal(a.conventions, "/x/conventions.json");
  assert.equal(a.xml, "/x/d.xml");
  assert.equal(a.dir, "src/app");
  assert.equal(a.name, "hero");
  assert.equal(parseArgs(["src/app", "hero", "--conventions=/x/c.json"]).conventions, "/x/c.json", "equals form works");
});

test("pairGroundTruth: pairs by artifact folder name (a name → a folder)", () => {
  const root = mkdtempSync(join(tmpdir(), "sliceui-pair-"));
  try {
    // New layout: one folder per design.
    mkdirSync(join(root, ".sliceui", "artifacts", "hero"), { recursive: true });
    mkdirSync(join(root, ".sliceui", "inputs", "xml"), { recursive: true });
    writeFileSync(join(root, ".sliceui", "artifacts", "hero", "transcript.json"), JSON.stringify({ layout: [{ type: "text", text: "Hi" }] }));
    writeFileSync(join(root, ".sliceui", "inputs", "xml", "hero.xml"), "<frame/>");

    const r = pairGroundTruth(root, "hero", {});
    assert.ok(r.transcript, "transcript found in artifacts/hero/transcript.json");
    assert.ok(r.rawXml, "raw XML found in inputs/xml/hero.xml");
    assert.equal(r.warnings.length, 0, "no warnings when both pair cleanly");
    assert.equal(r.unpaired, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("F1: unpaired name → null artifacts + unpaired flag, never a wrong-design fallback", () => {
  const root = mkdtempSync(join(tmpdir(), "sliceui-pair-"));
  try {
    mkdirSync(join(root, ".sliceui", "artifacts", "scholarship-deduction"), { recursive: true });
    mkdirSync(join(root, ".sliceui", "inputs", "xml"), { recursive: true });
    writeFileSync(join(root, ".sliceui", "artifacts", "scholarship-deduction", "transcript.json"), JSON.stringify({ layout: [] }));
    writeFileSync(join(root, ".sliceui", "inputs", "xml", "scholarship-deduction.xml"), "<frame/>");

    // A completely different name (no token overlap) must NOT pick up the other design's files.
    const r = pairGroundTruth(root, "student-rates-extends", {});
    assert.equal(r.transcript, null, "no fallback to another design's transcript");
    assert.equal(r.rawXml, null, "no fallback to another design's XML");
    assert.equal(r.unpaired, true, "unpaired flagged so checks can skip");
    assert.ok(r.warnings.some((w) => w.includes("PAIRING FAILED")), "warning names the failure");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("F1: token-overlap pairs word-order differences (modal-detail-x ≈ x-modal-detail)", () => {
  const root = mkdtempSync(join(tmpdir(), "sliceui-pair-"));
  try {
    mkdirSync(join(root, ".sliceui", "artifacts", "scholarship-deduction-modal-detail"), { recursive: true });
    mkdirSync(join(root, ".sliceui", "inputs", "xml"), { recursive: true });
    writeFileSync(join(root, ".sliceui", "artifacts", "scholarship-deduction-modal-detail", "transcript.json"), JSON.stringify({ layout: [] }));
    writeFileSync(join(root, ".sliceui", "inputs", "xml", "scholarship-deduction-modal-detail.xml"), "<frame/>");

    // Component named with different word order — same token set → must pair.
    const r = pairGroundTruth(root, "modal-detail-scholarship-deduction", {});
    assert.ok(r.transcript, "token-overlap finds the transcript");
    assert.ok(r.rawXml, "token-overlap finds the XML");
    assert.equal(r.unpaired, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("F1: config pairings map overrides when the name shares nothing with the design stem", () => {
  const root = mkdtempSync(join(tmpdir(), "sliceui-pair-"));
  try {
    mkdirSync(join(root, ".sliceui", "artifacts", "deduction-form-v2"), { recursive: true });
    mkdirSync(join(root, ".sliceui", "inputs", "xml"), { recursive: true });
    mkdirSync(join(root, ".sliceui"), { recursive: true });
    writeFileSync(join(root, ".sliceui", "artifacts", "deduction-form-v2", "transcript.json"), JSON.stringify({ layout: [] }));
    writeFileSync(join(root, ".sliceui", "inputs", "xml", "deduction-form-v2.xml"), "<frame/>");
    writeFileSync(join(root, ".sliceui", "config.json"), JSON.stringify({
      pairings: { "modal-detail-scholarship-deduction-postgraduates": "deduction-form-v2" },
    }));

    const r = pairGroundTruth(root, "modal-detail-scholarship-deduction-postgraduates", {});
    assert.ok(r.transcript, "pairings map resolves the transcript");
    assert.ok(r.rawXml, "pairings map resolves the XML");
    assert.equal(r.unpaired, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ---------- readOwningModules: scoped, never a root traversal (P0-2) ----------

test("readOwningModules: reads modules at and above componentDir, not the whole repo", () => {
  const root = mkdtempSync(join(tmpdir(), "sliceui-mod-"));
  try {
    // Root module declares app-wide components.
    writeFileSync(join(root, "app.module.ts"), "declarations: [RootCmp]\n");
    // The component's own subtree: a nested module is a legitimate owner.
    const compDir = join(root, "src", "app", "billing", "history");
    mkdirSync(compDir, { recursive: true });
    writeFileSync(join(compDir, "history.module.ts"), "declarations: [HistoryAgreementComponent]\n");
    // An ANCESTOR module (between componentDir and root) is a legitimate owner too.
    mkdirSync(join(root, "src", "app"), { recursive: true });
    writeFileSync(join(root, "src", "app", "app.module.ts"), "declarations: []\n");
    // A SIBLING subtree that must NOT be read — this is the traversal being removed.
    const sibling = join(root, "src", "app", "payments");
    mkdirSync(sibling, { recursive: true });
    writeFileSync(join(sibling, "payments.module.ts"), "declarations: [PaymentsComponent]\n");

    const out = readOwningModules(root, "src/app/billing/history");
    assert.ok(out.includes("HistoryAgreementComponent"), "reads the component's own module");
    assert.ok(out.includes("RootCmp"), "reads the root module");
    assert.ok(!out.includes("PaymentsComponent"), "does NOT read a sibling subtree (the old traversal)");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("readOwningModules: declines to read at all without componentDir (no silent root fallback)", () => {
  const root = mkdtempSync(join(tmpdir(), "sliceui-mod-"));
  try {
    writeFileSync(join(root, "app.module.ts"), "declarations: [RootCmp]\n");
    // An empty componentDir must yield no reads — falling back to root would reinstate the
    // unbounded traversal this scoping exists to remove.
    assert.equal(readOwningModules(root, ""), "", "no componentDir → no read");
    assert.equal(readOwningModules(root, undefined), "", "undefined componentDir → no read");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
