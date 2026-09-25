import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildRefereeVerdict,
  assessRefereeVerdict,
  snapshotFingerprint,
  REFEREE_VERDICT_SCHEMA,
  REFEREE_VERDICT_FILE,
} from "../src/lib/referee-verdict.mjs";
import { codebaseEvidenceFindings, liveRefereeFindings } from "../src/lib/referee.mjs";

/** A `.sliceui`-bearing temp root with the given conventions.json + project-context.json. */
function tmpRoot({ conventions, projectContext }) {
  const root = mkdtempSync(join(tmpdir(), "sliceui-verdict-"));
  const s = join(root, ".sliceui");
  mkdirSync(s, { recursive: true });
  if (conventions !== undefined) writeFileSync(join(s, "conventions.json"), JSON.stringify(conventions));
  if (projectContext !== undefined) writeFileSync(join(s, "project-context.json"), JSON.stringify(projectContext));
  return root;
}

const CTX = { inputHash: "abc123", cwd: "/tmp/x", conventions: { componentAnatomy: { mockRowsFloor: 15 }, ngDeepCorpus: [] } };

function writeVerdict(root, verdict) {
  writeFileSync(join(root, ".sliceui", REFEREE_VERDICT_FILE), JSON.stringify(verdict));
}

test("verdict: buildRefereeVerdict produces a versioned, source-body-free verdict", () => {
  const verdict = buildRefereeVerdict({
    ctx: CTX,
    codebaseFindings: [{ head: "codebase", artifact: "component selectors", status: "fail", detail: "dup", evidencePath: "app-a", duplicates: [{ selector: "app-a", files: ["x.component.ts", "y.component.ts"] }] }],
    evidence: { filesConsidered: 5, selectorsChecked: 3, conventionClaimsChecked: 0, duplicateSelectors: ["app-a"] },
  });
  assert.equal(verdict.schemaVersion, REFEREE_VERDICT_SCHEMA, "schema version present");
  assert.equal(verdict.status, "fail", "a red codebase finding makes the verdict fail");
  assert.ok(verdict.projectFingerprint.value, "project fingerprint bound");
  assert.ok(verdict.snapshotFingerprint.value, "snapshot fingerprint bound");
  const serialized = JSON.stringify(verdict);
  assert.ok(!serialized.includes("</"), "no source bodies (no markup) in the verdict");
  assert.ok(!serialized.includes(":host"), "no SCSS bodies in the verdict");
});

test("verdict: snapshotFingerprint changes when conventions.json changes", () => {
  const root = tmpRoot({ conventions: { classVocabulary: ["a"] }, projectContext: { inputHash: "abc" } });
  const before = snapshotFingerprint(root).value;
  writeFileSync(join(root, ".sliceui", "conventions.json"), JSON.stringify({ classVocabulary: ["b"] }));
  const after = snapshotFingerprint(root).value;
  rmSync(root, { recursive: true, force: true });
  assert.notEqual(before, after, "snapshot fingerprint reflects a changed conventions.json");
});

test("verdict: assessRefereeVerdict returns missing when the verdict file is absent", () => {
  const root = tmpRoot({ conventions: {}, projectContext: { inputHash: "abc" } });
  const a = assessRefereeVerdict(root, { inputHash: "abc" });
  rmSync(root, { recursive: true, force: true });
  assert.equal(a.state, "missing");
  assert.equal(a.verdict, null);
  assert.ok(a.diagnostics.length >= 1, "missing diagnostic present");
});

test("verdict: assessRefereeVerdict returns fresh-pass for a matching fingerprint", () => {
  const root = tmpRoot({ conventions: {}, projectContext: { inputHash: "abc" } });
  const ctx = { ...CTX, inputHash: "abc", cwd: root };
  const v = buildRefereeVerdict({ ctx, codebaseFindings: [], evidence: {} });
  writeVerdict(root, v);
  const a = assessRefereeVerdict(root, ctx);
  rmSync(root, { recursive: true, force: true });
  assert.equal(a.state, "fresh-pass");
});

test("verdict: assessRefereeVerdict returns stale on snapshot fingerprint mismatch", () => {
  const root = tmpRoot({ conventions: { classVocabulary: ["a"] }, projectContext: { inputHash: "abc" } });
  const ctx = { ...CTX, inputHash: "abc", cwd: root };
  const v = buildRefereeVerdict({ ctx, codebaseFindings: [], evidence: {} });
  writeVerdict(root, v);
  // Mutate the snapshot AFTER the verdict is written.
  writeFileSync(join(root, ".sliceui", "conventions.json"), JSON.stringify({ classVocabulary: ["changed"] }));
  const a = assessRefereeVerdict(root, ctx);
  rmSync(root, { recursive: true, force: true });
  assert.equal(a.state, "stale", "snapshot change makes the verdict stale");
});

test("verdict: assessRefereeVerdict returns stale on project fingerprint mismatch", () => {
  const root = tmpRoot({ conventions: {}, projectContext: { inputHash: "abc" } });
  const ctx = { ...CTX, inputHash: "abc", cwd: root };
  writeVerdict(root, buildRefereeVerdict({ ctx, codebaseFindings: [], evidence: {} }));
  const a = assessRefereeVerdict(root, { ...ctx, inputHash: "def456" });
  rmSync(root, { recursive: true, force: true });
  assert.equal(a.state, "stale");
});

test("verdict: assessRefereeVerdict returns invalid for malformed JSON and unknown schema", () => {
  const root = tmpRoot({ conventions: {}, projectContext: { inputHash: "abc" } });
  writeFileSync(join(root, ".sliceui", REFEREE_VERDICT_FILE), "{ NOT VALID");
  const malformed = assessRefereeVerdict(root, { inputHash: "abc" });
  assert.equal(malformed.state, "invalid", "malformed JSON → invalid");

  writeVerdict(root, { schemaVersion: 999, status: "pass", projectFingerprint: { value: "abc" }, snapshotFingerprint: { value: "x" } });
  const unknown = assessRefereeVerdict(root, { inputHash: "abc" });
  assert.equal(unknown.state, "invalid", "unknown schemaVersion → invalid");
  rmSync(root, { recursive: true, force: true });
});

test("verdict: assessRefereeVerdict returns fresh-fail for a stored failed verdict", () => {
  const root = tmpRoot({ conventions: {}, projectContext: { inputHash: "abc" } });
  const ctx = { ...CTX, inputHash: "abc", cwd: root };
  const v = buildRefereeVerdict({ ctx, codebaseFindings: [{ head: "codebase", artifact: "component selectors", status: "fail", detail: "dup" }], evidence: {} });
  writeVerdict(root, v);
  const a = assessRefereeVerdict(root, ctx);
  rmSync(root, { recursive: true, force: true });
  assert.equal(a.state, "fresh-fail");
});

test("referee split: codebaseEvidenceFindings scans but liveRefereeFindings does not glob the repo", () => {
  // A temp project with one duplicate selector + a well template.
  const root = mkdtempSync(join(tmpdir(), "sliceui-cb-"));
  mkdirSync(join(root, "src", "app"), { recursive: true });
  writeFileSync(join(root, "src", "app", "a.component.ts"), `@Component({ selector: "app-dup" })\nexport class A {}`);
  writeFileSync(join(root, "src", "app", "b.component.ts"), `@Component({ selector: "app-dup" })\nexport class B {}`);
  writeFileSync(join(root, "src", "app", "x.component.html"), `<div class="well">hi</div>`);
  writeFileSync(join(root, "src", "app", "x.component.scss"), `:host ::ng-deep .x { color: red; }`);

  const conv = { componentAnatomy: { wellAvailable: true, mockRowsFloor: 15 }, ngDeepCorpus: [] };
  const codebase = codebaseEvidenceFindings(root, conv, {});
  const dup = codebase.findings.find((f) => f.artifact === "component selectors");
  assert.ok(dup, "duplicate selector detected by the codebase head");
  assert.equal(codebase.evidence.duplicateSelectors[0], "app-dup");
  // No source bodies in the finding detail (only selectors + counts).
  assert.ok(!JSON.stringify(codebase.findings).includes("export class"), "no source bodies retained");

  rmSync(root, { recursive: true, force: true });
});

test("referee split: liveRefereeFindings (bounded) does not flag a target in a different directory", () => {
  const root = mkdtempSync(join(tmpdir(), "sliceui-live-"));
  const ctx = { cwd: root, componentDir: "src/app" };
  // Bounded lookup only checks componentDir/<name>.component.ts — no repo-wide glob.
  const findings = liveRefereeFindings(ctx, {}, null, null, null, "somewhere-else", { deep: false });
  rmSync(root, { recursive: true, force: true });
  assert.ok(!findings.some((f) => f.artifact === "component target"), "bounded lookup finds nothing outside componentDir");
});
