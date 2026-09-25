import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { splitProjectContext, loadConventionsSnapshot } from "../src/lib/snapshot.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, "..", "src", "cli.mjs");

/** Build a temp `.sliceui` root with the given project-context.json + conventions.json bodies. */
function tmpSnapshot({ projectContext, conventions }) {
  const root = mkdtempSync(join(tmpdir(), "sliceui-snapshot-"));
  const sliceui = join(root, ".sliceui");
  mkdirSync(sliceui, { recursive: true });
  if (projectContext !== undefined) writeFileSync(join(sliceui, "project-context.json"), JSON.stringify(projectContext));
  if (conventions !== undefined) writeFileSync(join(sliceui, "conventions.json"), JSON.stringify(conventions));
  return root;
}

const LCR = { classes: ["material-icons", "btn"], source: "dist", files: [] };
const CONVENTIONS = { classVocabulary: [{ name: "label-custom-success" }], ngDeepCorpus: [], componentAnatomy: { mockRowsFloor: 15 } };

test("snapshot: splitProjectContext removes the duplicate blobs from project-context", () => {
  const ctx = { framework: { id: "angular" }, conventions: CONVENTIONS, loadedClassRegistry: LCR, capabilities: {} };
  const { projectContext, conventions } = splitProjectContext(ctx);
  assert.ok(!("loadedClassRegistry" in projectContext), "project-context no longer carries loadedClassRegistry");
  assert.ok(!("conventions" in projectContext), "project-context no longer carries nested conventions");
  assert.ok("framework" in projectContext, "project-context keeps the WHAT facts");
  assert.equal(conventions.loadedClassRegistry, LCR, "loadedClassRegistry moved to conventions");
  assert.deepEqual(conventions.classVocabulary, CONVENTIONS.classVocabulary, "convention facts preserved");
});

test("snapshot: loadConventionsSnapshot reads the canonical file (new snapshot)", () => {
  const root = tmpSnapshot({
    projectContext: { framework: { id: "angular" } }, // no legacy blobs
    conventions: { ...CONVENTIONS, loadedClassRegistry: LCR },
  });
  const r = loadConventionsSnapshot(root);
  rmSync(root, { recursive: true, force: true });
  assert.equal(r.source, "canonical");
  assert.equal(r.conflict, false);
  assert.deepEqual(r.conventions.loadedClassRegistry, LCR, "loaded classes from canonical file");
});

test("snapshot: legacy snapshot falls back to project-context.json when conventions.json missing", () => {
  const root = tmpSnapshot({
    projectContext: { framework: { id: "angular" }, conventions: CONVENTIONS, loadedClassRegistry: LCR },
    // no conventions.json
  });
  const r = loadConventionsSnapshot(root);
  rmSync(root, { recursive: true, force: true });
  assert.equal(r.source, "legacy");
  assert.deepEqual(r.conventions.loadedClassRegistry, LCR, "loaded classes recovered from legacy location");
  assert.deepEqual(r.conventions.classVocabulary, CONVENTIONS.classVocabulary, "legacy conventions recovered");
});

test("snapshot: legacy loadedClassRegistry fills an incomplete canonical file", () => {
  const root = tmpSnapshot({
    projectContext: { framework: { id: "angular" }, loadedClassRegistry: LCR },
    conventions: CONVENTIONS, // no loadedClassRegistry in canonical file
  });
  const r = loadConventionsSnapshot(root);
  rmSync(root, { recursive: true, force: true });
  assert.equal(r.source, "canonical", "canonical file still the primary source");
  assert.deepEqual(r.conventions.loadedClassRegistry, LCR, "legacy lcr filled in from project-context");
  assert.ok(r.diagnostics.length >= 1, "a diagnostic notes the legacy fill");
});

test("snapshot: mixed identical copies are stable and non-conflicting", () => {
  const root = tmpSnapshot({
    projectContext: { framework: { id: "angular" }, conventions: CONVENTIONS, loadedClassRegistry: LCR },
    conventions: { ...CONVENTIONS, loadedClassRegistry: LCR },
  });
  const r = loadConventionsSnapshot(root);
  rmSync(root, { recursive: true, force: true });
  assert.equal(r.conflict, false, "identical copies are not a conflict");
  assert.deepEqual(r.conventions.loadedClassRegistry, LCR, "canonical chosen");
});

test("snapshot: canonical and legacy conflict → canonical wins + diagnostic (never silent)", () => {
  const legacyLcr = { classes: ["legacy-only"], source: "dist", files: [] };
  const root = tmpSnapshot({
    projectContext: { framework: { id: "angular" }, loadedClassRegistry: legacyLcr },
    conventions: { ...CONVENTIONS, loadedClassRegistry: LCR },
  });
  const r = loadConventionsSnapshot(root);
  rmSync(root, { recursive: true, force: true });
  assert.equal(r.conflict, true, "conflict flagged");
  assert.deepEqual(r.conventions.loadedClassRegistry, LCR, "canonical wins");
  assert.ok(r.diagnostics.some((d) => /conflict/i.test(d)), "diagnostic describes the conflict");
});

test("snapshot: present-but-empty canonical is NOT missing (valid snapshot)", () => {
  const root = tmpSnapshot({
    projectContext: { framework: { id: "angular" } },
    conventions: {}, // present but empty — a legitimate thin-corpus project
  });
  const r = loadConventionsSnapshot(root);
  rmSync(root, { recursive: true, force: true });
  assert.equal(r.source, "canonical", "empty canonical file is still the canonical source");
  assert.deepEqual(r.conventions, {}, "empty-but-valid canonical object is preserved, not replaced by null");
  assert.equal(r.diagnostics.length, 0, "no missing diagnostic for a present-but-empty canonical file");
});

test("snapshot: truly missing (no canonical, no legacy) returns null + source none + diagnostic", () => {
  const root = tmpSnapshot({
    projectContext: { framework: { id: "angular" } }, // no conventions, no loadedClassRegistry
    // no conventions.json written
  });
  const r = loadConventionsSnapshot(root);
  rmSync(root, { recursive: true, force: true });
  assert.equal(r.source, "none", "source is none, not canonical/legacy");
  assert.equal(r.conventions, null, "conventions is null, not a truthy empty object (VER-001)");
  assert.ok(r.diagnostics.some((d) => /SUI-SNAPSHOT-001|No conventions ground truth/i.test(d)), "missing diagnostic present");
});

test("snapshot: malformed canonical + no legacy → null + corruption diagnostic (not silent empty)", () => {
  const root = mkdtempSync(join(tmpdir(), "sliceui-snapshot-"));
  mkdirSync(join(root, ".sliceui"), { recursive: true });
  writeFileSync(join(root, ".sliceui", "conventions.json"), "{ NOT VALID JSON");
  writeFileSync(join(root, ".sliceui", "project-context.json"), JSON.stringify({ framework: { id: "angular" } }));
  const r = loadConventionsSnapshot(root);
  rmSync(root, { recursive: true, force: true });
  assert.equal(r.source, "none", "malformed canonical + no legacy → none");
  assert.equal(r.conventions, null, "malformed canonical must not be treated as a valid empty snapshot");
  assert.ok(r.diagnostics.some((d) => /malformed/i.test(d)), "corruption diagnostic present");
});

test("snapshot: malformed canonical + valid legacy falls back to legacy (with corruption diagnostic)", () => {
  const root = mkdtempSync(join(tmpdir(), "sliceui-snapshot-"));
  mkdirSync(join(root, ".sliceui"), { recursive: true });
  writeFileSync(join(root, ".sliceui", "conventions.json"), "{ NOT VALID JSON");
  writeFileSync(join(root, ".sliceui", "project-context.json"), JSON.stringify({ framework: { id: "angular" }, conventions: CONVENTIONS, loadedClassRegistry: LCR }));
  const r = loadConventionsSnapshot(root);
  rmSync(root, { recursive: true, force: true });
  assert.equal(r.source, "legacy", "legacy fallback still applies when the canonical file is corrupt");
  assert.deepEqual(r.conventions.loadedClassRegistry, LCR, "legacy loadedClassRegistry recovered");
  assert.ok(r.diagnostics.some((d) => /malformed/i.test(d)), "corruption diagnostic still surfaces (never silent)");
});

test("snapshot: splitProjectContext is a no-op on a malformed/empty ctx", () => {
  const { projectContext, conventions } = splitProjectContext(null);
  assert.deepEqual(projectContext, {});
  assert.deepEqual(conventions, {});
});

test("snapshot: CLI verify exits non-zero (NOT green) when no ground truth exists (VER-001)", () => {
  const root = mkdtempSync(join(tmpdir(), "sliceui-verify-empty-"));
  const comp = join(root, "comp");
  mkdirSync(join(root, ".sliceui"), { recursive: true }); // empty .sliceui
  mkdirSync(comp, { recursive: true });
  writeFileSync(join(comp, "a.component.ts"), `// Generated by SliceUI\nimport { Component } from "@angular/core";\n@Component({ selector: "x-a", templateUrl: "./a.component.html", styleUrls: ["./a.component.scss"] })\nexport class AComponent {}\n`);
  writeFileSync(join(comp, "a.component.html"), `<!-- Generated by SliceUI -->\n<div class="well">Ubah tagihan</div>\n`);
  writeFileSync(join(comp, "a.component.scss"), `/* Generated by SliceUI */\n:host { display: block; }\n`);
  try {
    // The real CLI process, with an empty .sliceui/ — must NOT exit 0.
    let out = "";
    let exit = 0;
    try {
      out = execFileSync(process.execPath, [CLI, "verify", comp], { encoding: "utf8" });
    } catch (e) {
      exit = e.status ?? 1;
      out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
    }
    assert.notEqual(exit, 0, "empty .sliceui must exit non-zero (not green)");
    assert.match(out, /NO GROUND TRUTH|NOT VERIFIABLE|not verifiable/i, "output states the run is unverifiable");
    assert.doesNotMatch(out, /SliceUI verify — generated component fidelity \+\n$/, "no bare green headline");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
