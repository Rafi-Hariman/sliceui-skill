import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { refereeArtifacts } from "../src/lib/referee.mjs";

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
