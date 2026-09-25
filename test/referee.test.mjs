import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { refereeArtifacts, classNameToFileStem } from "../src/lib/referee.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

function tmpProject(files) {
  const dir = join(HERE, "fixtures", "_referee_tmp");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
  }
  return dir;
}

const XML = `<frame name="Page" width="600" height="400" type="FRAME"><children>
<Text id="t1" name="T" x="10" y="10" width="100" height="16" fontSize="14" fontWeight="500" characters="Ubah tagihan" type="TEXT"><fills><fill color="#000000"/></fills></Text>
</children></frame>`;

test("referee: flags duplicate component selectors (silent hazard)", () => {
  // 2026-09-10 C2: two components with the same selector is a latent bug Angular won't error on.
  const root = tmpProject({
    "src/app/a.component.ts": `@Component({ selector: "app-edit-bill" })\nexport class AComponent {}`,
    "src/app/b.component.ts": `@Component({ selector: "app-edit-bill" })\nexport class BComponent {}`,
    "src/app/c.component.ts": `@Component({ selector: "app-unique" })\nexport class CComponent {}`,
  });
  const ctx = { cwd: root, conventions: { ngDeepCorpus: [] }, sampleComponents: [] };
  const r = refereeArtifacts(root, ctx, XML, "x.xml", null);
  const dup = r.findings.find((f) => f.artifact === "component selectors");
  assert.equal(dup.status, "fail", "duplicate selector is a fail finding");
  assert.ok(dup.detail.includes("app-edit-bill"), "names the duplicate selector");
  assert.ok(!dup.detail.includes("app-unique"), "unique selector is not reported");
  rmSync(root, { recursive: true, force: true });
});

test("referee: no duplicate-selector finding when all selectors are unique", () => {
  const root = tmpProject({
    "src/app/a.component.ts": `@Component({ selector: "app-a" })\nexport class AComponent {}`,
    "src/app/b.component.ts": `@Component({ selector: "app-b" })\nexport class BComponent {}`,
  });
  const ctx = { cwd: root, conventions: { ngDeepCorpus: [] }, sampleComponents: [] };
  const r = refereeArtifacts(root, ctx, XML, "x.xml", null);
  assert.equal(r.findings.some((f) => f.artifact === "component selectors"), false, "no duplicate → no finding");
  rmSync(root, { recursive: true, force: true });
});

test("referee: F12 — duplicate selectors are repo-preexisting (non-blocking), target-exists is blocking", () => {
  // Duplicate selectors are pre-existing debt; they must not block the slice (exit stays 0).
  // A target that already has code IS blocking.
  const root = tmpProject({
    "src/app/a.component.ts": `@Component({ selector: "app-edit-bill" })\nexport class AComponent {}`,
    "src/app/b.component.ts": `@Component({ selector: "app-edit-bill" })\nexport class BComponent {}`,
    "src/app/edit-bill.component.ts": `import { HttpClient } from "@angular/common/http";\n@Component({ selector: "app-edit-bill" })\nexport class EditBillComponent { constructor(private http: HttpClient) {} load() { this.http.get("/api/bill").subscribe(); } }`,
  });
  const ctx = { cwd: root, conventions: { ngDeepCorpus: [] }, sampleComponents: [] };
  // No target → only the duplicate-selector finding, which is non-blocking.
  const noTarget = refereeArtifacts(root, ctx, XML, "x.xml", null);
  assert.equal(noTarget.pass, true, "repo-preexisting duplicate selectors do not block the slice");
  assert.equal(noTarget.blockingRedCount, 0);
  // With a target that already exists → blocking red.
  const withTarget = refereeArtifacts(root, ctx, XML, "x.xml", null, "edit-bill");
  assert.equal(withTarget.pass, false, "target-exists is slice-blocking");
  assert.ok(withTarget.blockingRedCount >= 1);
  rmSync(root, { recursive: true, force: true });
});

test("referee: wellAvailable=stale when claimed but absent from templates", () => {
  const root = tmpProject({
    "src/app/x.component.html": `<div class="content"><h1>Ubah tagihan</h1></div>`, // no well here
    "src/app/x.component.scss": `::ng-deep .label-custom-waiting { background: #fef2f2; }`,
  });
  const ctx = {
    cwd: root,
    conventions: {
      componentAnatomy: { wellAvailable: true, mockRowsFloor: 15 }, // claims well idiom
      ngDeepCorpus: [{ selector: "label-custom-waiting", source: "x" }],
    },
    sampleComponents: [{ path: "src/app/app.component.ts", selector: "app-root" }],
  };
  const transcript = { layout: [{ type: "text", text: "Ubah tagihan" }] };

  const r = refereeArtifacts(root, ctx, XML, "x.xml", transcript);
  const well = r.findings.find((f) => f.artifact === "conventions.componentAnatomy.wellAvailable");
  assert.equal(well.status, "stale", "wellAvailable claimed but not found in templates");

  rmSync(root, { recursive: true, force: true });
});

test("referee: mockRowsFloor 15 is a sane floor (transcript 20 handled by verify, not stale)", () => {
  const root = tmpProject({
    "src/app/x.component.html": `<div class="content">Menampilkan 1-10 dari 20 data</div>`,
    "src/app/x.component.scss": `::ng-deep .label-custom-waiting { background: #fef2f2; }`,
  });
  const ctx = {
    cwd: root,
    conventions: {
      componentAnatomy: { wellAvailable: false, mockRowsFloor: 15 },
      ngDeepCorpus: [{ selector: "label-custom-waiting", source: "x" }],
    },
    sampleComponents: [],
  };
  const transcript = { layout: [{ type: "text", text: "Menampilkan 1-10 dari 20 data" }] };

  const r = refereeArtifacts(root, ctx, XML, "x.xml", transcript);
  const rows = r.findings.find((f) => f.artifact === "conventions.componentAnatomy.mockRowsFloor");
  assert.equal(rows.status, "pass", "floor 15 is a sane floor; slice total 20 is verify's job");

  rmSync(root, { recursive: true, force: true });
});

test("referee: flags mockRowsFloor=0 as an insane floor", () => {
  const root = tmpProject({
    "src/app/x.component.html": `<div class="content">Menampilkan 1-10 dari 20 data</div>`,
    "src/app/x.component.scss": `::ng-deep .label-custom-waiting { background: #fef2f2; }`,
  });
  const ctx = {
    cwd: root,
    conventions: {
      componentAnatomy: { wellAvailable: false, mockRowsFloor: 0 },
      ngDeepCorpus: [{ selector: "label-custom-waiting", source: "x" }],
    },
    sampleComponents: [],
  };
  const r = refereeArtifacts(root, ctx, XML, "x.xml", null);
  const rows = r.findings.find((f) => f.artifact === "conventions.componentAnatomy.mockRowsFloor");
  assert.equal(rows.status, "fail", "floor 0 is not a sane positive minimum");

  rmSync(root, { recursive: true, force: true });
});

test("referee: cell-html absent from project is informational, not a fail", () => {
  const root = tmpProject({
    "src/app/x.component.html": `<div class="content">Menampilkan 1-10 dari 20 data</div>`,
    "src/app/x.component.scss": `::ng-deep .label-custom-waiting { background: #fef2f2; }`,
  });
  const ctx = {
    cwd: root,
    conventions: {
      componentAnatomy: { wellAvailable: false, mockRowsFloor: 20 },
      ngDeepCorpus: [{ selector: "label-custom-waiting", source: "x" }],
    },
    sampleComponents: [],
  };
  const r = refereeArtifacts(root, ctx, XML, "x.xml", null);
  const cell = r.findings.find((f) => f.artifact === "conventions.ngDeepCorpus.cell-html");
  assert.equal(cell.status, "info", "cell-html absent from project is info (hope-author's own), not corruption");

  rmSync(root, { recursive: true, force: true });
});

test("referee: flags app shell in sampleComponents", () => {
  const root = tmpProject({
    "src/app/x.component.html": `<div class="content">Menampilkan 1-10 dari 20 data</div>`,
    "src/app/x.component.scss": `::ng-deep .label-custom-waiting { background: #fef2f2; }`,
  });
  const ctx = {
    cwd: root,
    conventions: {
      componentAnatomy: { wellAvailable: false, mockRowsFloor: 20 },
      ngDeepCorpus: [{ selector: "label-custom-waiting", source: "x" }],
    },
    sampleComponents: [{ path: "src/app/app.component.ts", selector: "app-root" }],
  };
  const r = refereeArtifacts(root, ctx, XML, "x.xml", null);
  const sample = r.findings.find((f) => f.artifact === "project-context.sampleComponents");
  assert.equal(sample.status, "fail", "app shell sample should fail");

  rmSync(root, { recursive: true, force: true });
});

test("referee: all green on a correct project", () => {
  const root = tmpProject({
    "src/app/list.component.html": `<div class="content">Menampilkan 1-10 dari 20 data</div>`,
    "src/app/list.component.scss": `::ng-deep .label-custom-waiting { background: #fef2f2; }\n:host ::ng-deep .gateway-table .row-container .cell-html .label { font-size: 10px; }`,
  });
  const ctx = {
    cwd: root,
    conventions: {
      componentAnatomy: { wellAvailable: false, mockRowsFloor: 20 },
      ngDeepCorpus: [{ selector: "label-custom-waiting", source: "list" }],
    },
    sampleComponents: [{ path: "src/app/list.component.ts", selector: "app-list" }],
  };
  const r = refereeArtifacts(root, ctx, XML, "x.xml", null);
  assert.equal(r.pass, true, `expected all green, got ${JSON.stringify(r.findings.filter((f) => f.status !== "pass"))}`);

  rmSync(root, { recursive: true, force: true });
});

test("referee: target-exists flags a real-API component (STOP, don't overwrite)", () => {
  const root = tmpProject({
    "src/app/edit-bill.component.ts": `import { HttpClient } from "@angular/common/http";\n@Component({ selector: "app-edit-bill" })\nexport class EditBillComponent { constructor(private http: HttpClient) {} load() { this.http.get("/api/bill").subscribe(); } }`,
  });
  const ctx = { cwd: root, componentDir: "src/app", conventions: {}, sampleComponents: [] };
  const r = refereeArtifacts(root, ctx, XML, "x.xml", null, "edit-bill");
  const finding = r.findings.find((f) => f.artifact === "component target");
  assert.ok(finding, "target-exists finding present");
  assert.equal(finding.status, "fail");
  assert.equal(finding.mode, "real API");
  assert.equal(r.pass, false, "existing real-API component must halt");
  rmSync(root, { recursive: true, force: true });
});

test("referee: target-exists flags a mock-data component", () => {
  const root = tmpProject({
    "src/app/list.component.ts": `@Component({ selector: "app-list" })\nexport class ListComponent { mockRows = [{ id: 1 }, { id: 2 }]; }`,
  });
  const ctx = { cwd: root, componentDir: "src/app", conventions: {}, sampleComponents: [] };
  const r = refereeArtifacts(root, ctx, XML, "x.xml", null, "list");
  const finding = r.findings.find((f) => f.artifact === "component target");
  assert.equal(finding.status, "fail");
  assert.equal(finding.mode, "mock data");
  rmSync(root, { recursive: true, force: true });
});

test("referee: target-exists fires on a CLASS name, not just the file basename", () => {
  // 2026-09-24 field bug: the agent passed the class name `TestingcomponentComponent`, but the
  // file is `testingcomponent.component.ts`. locateTargetTs never normalized, so the STOP gate
  // stayed inert and the agent nearly overwrote an existing component without knowing.
  const root = tmpProject({
    "src/app/testingcomponent.component.ts": `@Component({ selector: "app-testingcomponent" })\nexport class TestingcomponentComponent { rows = []; }`,
  });
  const ctx = { cwd: root, componentDir: "src/app", conventions: {}, sampleComponents: [] };
  const r = refereeArtifacts(root, ctx, XML, "x.xml", null, "TestingcomponentComponent");
  const finding = r.findings.find((f) => f.artifact === "component target");
  assert.ok(finding, "class name is normalized and the component is found");
  assert.equal(finding.status, "fail", "an existing component named by class name halts");
  rmSync(root, { recursive: true, force: true });
});

test("referee: target-exists finds a component outside componentDir (monorepo library)", () => {
  // componentDir may point at the wrong tree in a monorepo; the repo-wide fallback must still
  // locate the component when the name is right.
  const root = tmpProject({
    "projects/uiigateway/bill/src/lib/testingcomponent/testingcomponent.component.ts": `@Component({ selector: "ugw-bill-testingcomponent" })\nexport class TestingcomponentComponent { rows = []; }`,
  });
  const ctx = { cwd: root, componentDir: "src/app", conventions: {}, sampleComponents: [] };
  const r = refereeArtifacts(root, ctx, XML, "x.xml", null, "testingcomponent");
  const finding = r.findings.find((f) => f.artifact === "component target");
  assert.ok(finding, "monorepo library component found via fallback");
  assert.equal(finding.status, "fail");
  rmSync(root, { recursive: true, force: true });
});

test("referee: classNameToFileStem normalizes Angular class names to kebab stems", () => {
  assert.equal(classNameToFileStem("TestingcomponentComponent"), "testingcomponent");
  assert.equal(classNameToFileStem("testingcomponent"), "testingcomponent", "kebab passes through");
  assert.equal(classNameToFileStem("EditBillComponent"), "edit-bill");
  assert.equal(classNameToFileStem("HTTPClientComponent"), "http-client", "acronym run collapsed");
});

test("referee: no target-exists when --target is a NEW component", () => {
  const root = tmpProject({ "src/app/other.component.ts": `export class OtherComponent {}` });
  const ctx = { cwd: root, componentDir: "src/app", conventions: {}, sampleComponents: [] };
  const r = refereeArtifacts(root, ctx, XML, "x.xml", null, "brand-new");
  assert.equal(r.findings.find((f) => f.artifact === "component target"), undefined, "no finding for new component");
  rmSync(root, { recursive: true, force: true });
});

test("referee: target-exists PASSES (does not red-flag) a SliceUI-generated component (re-run safe)", () => {
  // SliceUI output carries a `// Generated by SliceUI` first-line marker. Re-running referee on it
  // must NOT halt — overwrite is the normal regenerate flow, not a silent clobber of user code.
  const root = tmpProject({
    "src/app/change-bill.component.ts": `// Generated by SliceUI\nimport { Component } from "@angular/core";\n@Component({ selector: "app-change-bill" })\nexport class ChangeBillComponent {\n  billRows = [\n    { nim: "1", status: "Sudah bayar" },\n    { nim: "2", status: "Belum bayar" },\n  ];\n  // TODO: wire to service\n}`,
  });
  const ctx = { cwd: root, componentDir: "src/app", conventions: {}, sampleComponents: [] };
  const r = refereeArtifacts(root, ctx, XML, "x.xml", null, "change-bill");
  const finding = r.findings.find((f) => f.artifact === "component target");
  assert.ok(finding, "target-exists finding present");
  assert.equal(finding.status, "pass", "SliceUI-generated target must NOT halt the re-run");
  assert.equal(finding.sliceuiGenerated, true, "finding tagged as SliceUI-generated");
  rmSync(root, { recursive: true, force: true });
});
