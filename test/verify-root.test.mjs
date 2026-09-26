import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nearestProjectRoot, parseArgs, pairGroundTruth, readOwningModules, loadSelectorMap } from "../src/commands/verify.mjs";
import { validateSelectorMap } from "../src/framework/angular/selector-map.mjs";

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

// --- PR 5: name normalization + ground-truth states ---

import { normalizeComponentName, resolveComponentStem } from "../src/lib/component-name.mjs";

test("PR5: normalizeComponentName accepts all equivalent target forms", () => {
  for (const [input, expected] of [
    ["testingcomponent", "testingcomponent"],
    ["TestingcomponentComponent", "testingcomponent"],
    ["testingcomponent.component", "testingcomponent"],
    ["testingcomponent.component.ts", "testingcomponent"],
    ["billing-history", "billing-history"],
    ["BillingHistoryComponent", "billing-history"],
    ["billing-history.component", "billing-history"],
    ["billing-history.component.ts", "billing-history"],
    ["HTTPClientComponent", "http-client"],
  ]) {
    const r = normalizeComponentName(input);
    assert.equal(r.ok, true, `${input} should normalize`);
    assert.equal(r.stem, expected, `${input} → ${expected}`);
  }
});

test("PR5: normalizeComponentName rejects path traversal and separators", () => {
  for (const bad of ["../foo", "a/b", "a\\b", "..", "."]) {
    assert.equal(normalizeComponentName(bad).ok, false, `${bad} rejected`);
  }
});

test("PR5: normalizeComponentName rejects an ambiguous non-name", () => {
  assert.equal(normalizeComponentName("not a name!").ok, false, "spaces/punctuation rejected");
  assert.equal(normalizeComponentName("").ok, false, "empty rejected");
});

test("PR5: resolveComponentStem does not collide with a similarly-prefixed name (boundary)", () => {
  // `billing-history.component.ts` resolves uniquely — `billing-history-extra` is a DIFFERENT
  // component (the `.component.` boundary separates them), not an ambiguity.
  const files = ["billing-history.component.ts", "billing-history-extra.component.ts", "billing-history.service.ts"];
  const r = resolveComponentStem(files, "billing-history");
  assert.equal(r.ok, true);
  assert.equal(r.stem, "billing-history");
  assert.equal(r.matches.length, 1);
  assert.equal(r.matches[0], "billing-history.component.ts");
});

test("PR5: resolveComponentStem surfaces true ambiguity, never first-picks", () => {
  const files = ["billing-history.component.ts", "billing-history.component.ts"];
  const r = resolveComponentStem(files, "billing-history");
  assert.equal(r.ok, false);
  assert.equal(r.ambiguous, true);
});

// --- PR 5 corrective patch: EXT-001 (unverifiable headline) via the CLI process ---

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { readFileSync as readFileSyncRaw, existsSync as existsSyncRaw } from "node:fs";

const CLI_ENTRY = fileURLToPath(new URL("../src/cli.mjs", import.meta.url));
const REPO = dirname(dirname(CLI_ENTRY)); // src/cli.mjs → the repository root
const readFileSyncCli = (p) => readFileSyncRaw(p, "utf8");
const existsSyncCli = existsSyncRaw;

function runVerify(dir, name) {
  return spawnSync(process.execPath, [CLI_ENTRY, "verify", dir, name], { encoding: "utf8" });
}

function writeFixture(root, { malformed = false, valid = false } = {}) {
  const dir = join(root, "comp");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "x.component.ts"), "export class XComponent {}\n");
  writeFileSync(join(dir, "x.component.html"), '<div class="x">hi</div>\n');
  writeFileSync(join(dir, "x.component.scss"), ".x { color: red; }\n");
  if (valid || malformed) {
    mkdirSync(join(root, ".sliceui", "artifacts", "x"), { recursive: true });
    writeFileSync(join(root, ".sliceui", "artifacts", "x", "transcript.json"), '{"layout":[]}');
    mkdirSync(join(root, ".sliceui", "inputs", "xml"), { recursive: true });
    writeFileSync(join(root, ".sliceui", "inputs", "xml", "x.xml"), '<frame name="x"></frame>');
    writeFileSync(join(root, ".sliceui", "conventions.json"), malformed ? "{ NOT VALID" : '{"classVocabulary":[],"ngDeepCorpus":[]}');
  }
  return dir;
}

test("PR5c EXT-001: malformed snapshot headline says UNVERIFIED and exits 3", () => {
  const root = mkdtempSync(join(tmpdir(), "pr5c-malformed-"));
  try {
    const dir = writeFixture(root, { malformed: true });
    const r = runVerify(dir, "x");
    assert.equal(r.status, 3, `malformed snapshot → exit 3 (got ${r.status})`);
    assert.match(r.stdout, /UNVERIFIED/, "headline says UNVERIFIED");
    assert.match(r.stdout, /malformed/, "malformed reason visible");
    assert.doesNotMatch(r.stdout, /generated component fidelity/, "no clean-pass wording");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("PR5c EXT-001: valid pass headline unchanged, exit 0", () => {
  const root = mkdtempSync(join(tmpdir(), "pr5c-valid-"));
  try {
    const dir = writeFixture(root, { valid: true });
    const r = runVerify(dir, "x");
    assert.equal(r.status, 0, `valid → exit 0 (got ${r.status})`);
    assert.match(r.stdout, /generated component fidelity/, "valid headline unchanged");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("PR5c EXT-001: invalid input headline/exit unchanged", () => {
  const root = mkdtempSync(join(tmpdir(), "pr5c-invalid-"));
  try {
    const dir = writeFixture(root);
    const r = runVerify(dir, "../evil");
    assert.equal(r.status, 2);
    assert.match(r.stdout + r.stderr, /invalid component name/, "invalid-input reason visible");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ---------- PR 6Cc corrective (MAP-002): production selector-map integration ----------

test("PR6Cc MAP-002: loadSelectorMap resolves the bounded sibling map and validates it strictly", () => {
  const root = mkdtempSync(join(tmpdir(), "pr6cc-map-"));
  try {
    const dir = join(root, "comp");
    mkdirSync(dir, { recursive: true });
    // Absent map is legal (map-optional) — no error, no map.
    assert.deepEqual(loadSelectorMap(dir, "widget", validateSelectorMap), { map: null, error: null }, "absent map → null/null");
    // A valid map loads.
    writeFileSync(join(dir, "widget.map.json"), JSON.stringify({
      version: 1,
      mappings: [{ designNodeId: "toolbar", renderLocator: { strategy: "css", selector: "[data-fx='toolbar']" } }],
    }));
    const ok = loadSelectorMap(dir, "widget", validateSelectorMap);
    assert.equal(ok.error, null);
    assert.equal(ok.map.mappings[0].designNodeId, "toolbar");
    // An expected-value field is rejected (the locator-only contract is enforced on this path too).
    writeFileSync(join(dir, "widget.map.json"), JSON.stringify({
      version: 1,
      mappings: [{ designNodeId: "toolbar", renderLocator: { strategy: "css", selector: ".toolbar" }, expectedGap: 12 }],
    }));
    const bad = loadSelectorMap(dir, "widget", validateSelectorMap);
    assert.equal(bad.map, null, "invalid map is not passed through");
    assert.match(bad.error, /invalid/, "invalid map reports a bounded error");
    // Unparseable JSON is invalid-input, never a silent skip.
    writeFileSync(join(dir, "widget.map.json"), "{ NOT VALID");
    const unparsed = loadSelectorMap(dir, "widget", validateSelectorMap);
    assert.match(unparsed.error, /not valid JSON/);
    // A traversal-shaped stem cannot escape: the resolved path stays inside the component dir.
    const trav = loadSelectorMap(dir, "../evil", validateSelectorMap);
    assert.equal(trav.map, null, "no map found at a traversal path");
    assert.equal(trav.error, null, "absence — not an error, and no read outside the component dir");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("PR6Cc MAP-002 (process): the CLI structural defect visual-fails when a map is present; direct and CLI paths agree", async (t) => {
  const mountReady = existsSyncCli(join(REPO, "test", "fixtures", "angular-mount", "node_modules", "@angular", "core"));
  if (!mountReady) { t.skip("angular-mount fixture deps missing — render path not exercised"); return; }
  const root = mkdtempSync(join(tmpdir(), "pr6cc-cli-"));
  try {
    // A production-shaped project: .sliceui ground truth + a component dir with its sibling map.
    mkdirSync(join(root, ".sliceui", "artifacts", "geometry"), { recursive: true });
    writeFileSync(join(root, ".sliceui", "conventions.json"), '{"classVocabulary":[],"ngDeepCorpus":[]}');
    const S = join(REPO, "test", "fixtures", "render-geometry", "structural");
    writeFileSync(join(root, ".sliceui", "artifacts", "geometry", "transcript.json"), readFileSyncCli(join(S, "transcript.json")));
    mkdirSync(join(root, ".sliceui", "inputs", "xml"), { recursive: true });
    writeFileSync(join(root, ".sliceui", "inputs", "xml", "geometry.xml"), '<frame name="geometry"></frame>');
    const dir = join(root, "comp");
    mkdirSync(dir, { recursive: true });
    for (const ext of ["html", "scss", "ts"]) {
      writeFileSync(join(dir, `geometry.component.${ext}`), readFileSyncCli(join(S, "defect", `geometry.component.${ext}`)));
    }
    writeFileSync(join(dir, "geometry.map.json"), readFileSyncCli(join(S, "geometry.map.json")));

    // Production path: the defect fixture (gap 20 vs 12, radius 16 vs 6, border #000 vs #b1bccc)
    // MUST visual-fail now that the CLI passes the map.
    const r = spawnSync(process.execPath, [CLI_ENTRY, "verify", dir, "geometry", "--render"], { encoding: "utf8" });
    assert.equal(r.status, 1, `CLI defect → exit 1 (got ${r.status})`);
    assert.match(r.stdout, /SliceUI render — visual-fail/, "CLI render headline");
    for (const fam of ["gap", "border-color", "radius"]) {
      assert.ok(r.stdout.includes(`${fam}: actual`), `CLI reports the ${fam} mismatch`);
    }
    assert.match(r.stdout, /SUI-RENDER-GAP-001/, "stable diagnostic id present");

    // Path parity: the same defect through direct renderVerify with the map fails identically.
    const { renderVerify } = await import("../src/framework/angular/render-verify.mjs");
    const direct = await renderVerify({
      html: readFileSyncCli(join(S, "defect", "geometry.component.html")),
      scss: readFileSyncCli(join(S, "defect", "geometry.component.scss")),
      ts: readFileSyncCli(join(S, "defect", "geometry.component.ts")),
      transcript: JSON.parse(readFileSyncCli(join(S, "transcript.json"))),
      fixtureDir: join(REPO, "test", "fixtures", "angular-mount"),
      selectorMap: JSON.parse(readFileSyncCli(join(S, "geometry.map.json"))),
    });
    assert.equal(direct.state, "visual-fail");
    assert.deepEqual(direct.checks.filter((c) => c.status === "fail").map((c) => c.family).sort(),
      ["border-color", "gap", "radius"], "direct and CLI paths agree on the failing families");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("PR6Cc MAP-002 (process): the CLI known-good structural fixture passes with a map", async (t) => {
  const mountReady = existsSyncCli(join(REPO, "test", "fixtures", "angular-mount", "node_modules", "@angular", "core"));
  if (!mountReady) { t.skip("angular-mount fixture deps missing — render path not exercised"); return; }
  const root = mkdtempSync(join(tmpdir(), "pr6cc-cli-kg-"));
  try {
    mkdirSync(join(root, ".sliceui", "artifacts", "geometry"), { recursive: true });
    writeFileSync(join(root, ".sliceui", "conventions.json"), '{"classVocabulary":[],"ngDeepCorpus":[]}');
    const S = join(REPO, "test", "fixtures", "render-geometry", "structural");
    writeFileSync(join(root, ".sliceui", "artifacts", "geometry", "transcript.json"), readFileSyncCli(join(S, "transcript.json")));
    mkdirSync(join(root, ".sliceui", "inputs", "xml"), { recursive: true });
    writeFileSync(join(root, ".sliceui", "inputs", "xml", "geometry.xml"), '<frame name="geometry"></frame>');
    const dir = join(root, "comp");
    mkdirSync(dir, { recursive: true });
    for (const ext of ["html", "scss", "ts"]) {
      writeFileSync(join(dir, `geometry.component.${ext}`), readFileSyncCli(join(S, "known-good", `geometry.component.${ext}`)));
    }
    writeFileSync(join(dir, "geometry.map.json"), readFileSyncCli(join(S, "geometry.map.json")));

    const r = spawnSync(process.execPath, [CLI_ENTRY, "verify", dir, "geometry", "--render"], { encoding: "utf8" });
    assert.equal(r.status, 0, `CLI known-good → exit 0 (got ${r.status})\n${r.stdout}\n${r.stderr}`);
    // The map-bound structural families EXECUTED on the shipped path (not merely passed).
    for (const fam of ["gap", "border-width", "border-color", "radius", "element-overflow", "off-viewport"]) {
      assert.ok(r.stdout.includes(`${fam} matches`), `${fam} executed and passed via the CLI`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("PR6Cc MAP-002 (process): an invalid map is invalid-input, exit 2, before any browser", async (t) => {
  const mountReady = existsSyncCli(join(REPO, "test", "fixtures", "angular-mount", "node_modules", "@angular", "core"));
  if (!mountReady) { t.skip("angular-mount fixture deps missing — render path not exercised"); return; }
  const root = mkdtempSync(join(tmpdir(), "pr6cc-cli-badmap-"));
  try {
    mkdirSync(join(root, ".sliceui", "artifacts", "geometry"), { recursive: true });
    writeFileSync(join(root, ".sliceui", "conventions.json"), '{"classVocabulary":[],"ngDeepCorpus":[]}');
    const S = join(REPO, "test", "fixtures", "render-geometry", "structural");
    writeFileSync(join(root, ".sliceui", "artifacts", "geometry", "transcript.json"), readFileSyncCli(join(S, "transcript.json")));
    mkdirSync(join(root, ".sliceui", "inputs", "xml"), { recursive: true });
    writeFileSync(join(root, ".sliceui", "inputs", "xml", "geometry.xml"), '<frame name="geometry"></frame>');
    const dir = join(root, "comp");
    mkdirSync(dir, { recursive: true });
    for (const ext of ["html", "scss", "ts"]) {
      writeFileSync(join(dir, `geometry.component.${ext}`), readFileSyncCli(join(S, "known-good", `geometry.component.${ext}`)));
    }
    // Semantic-exception field → the strict validator rejects it; the CLI must exit 2 with the
    // stable SUI-RENDER-MAP-001 diagnostic and never reach a browser launch.
    writeFileSync(join(dir, "geometry.map.json"), JSON.stringify({
      version: 1,
      mappings: [{ designNodeId: "panel", renderLocator: { strategy: "css", selector: ".panel" }, allowOverflow: true }],
    }));
    const r = spawnSync(process.execPath, [CLI_ENTRY, "verify", dir, "geometry", "--render"], { encoding: "utf8" });
    assert.equal(r.status, 2, `invalid map → exit 2 (got ${r.status})`);
    assert.match(r.stdout, /invalid-input/);
    assert.match(r.stdout, /SUI-RENDER-MAP-001/);
    assert.doesNotMatch(r.stdout, /SliceUI render — pass|visual-fail \(/, "no browser render ran");
    assert.doesNotMatch(r.stdout, /screenshot/, "no screenshot artifact was produced");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("PR6Cc MAP-002 (process): static verify without --render reads no selector map and launches no browser", () => {
  const root = mkdtempSync(join(tmpdir(), "pr6cc-cli-static-"));
  try {
    const dir = writeFixture(root, { valid: true });
    // A map that WOULD be invalid — a static run must not care (it must not read it at all).
    writeFileSync(join(dir, "x.map.json"), "{ NOT VALID");
    const r = runVerify(dir, "x");
    assert.equal(r.status, 0, "static verify passes without touching the map");
    assert.doesNotMatch(r.stdout, /SUI-RENDER-MAP-001/, "no map diagnostics on the static path");
    assert.doesNotMatch(r.stdout, /SliceUI render/, "no render ran");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
