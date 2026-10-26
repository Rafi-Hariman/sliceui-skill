import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderHandoffMd } from "../src/lib/handoff.mjs";
import { initProject } from "../src/commands/init.mjs";

const ANGULAR_PC = {
  framework: { id: "angular", label: "Angular", version: "^13.3.0", versionMajor: 13 },
  moduleOrStandalone: "module",
  styleExt: "scss",
  componentDir: "src/app",
  prefix: "app",
  capabilities: {
    select: { library: "ngx-select", samplePath: "src/app/filter.component.html" },
    table: { library: "pilar (uii-table)", libSourcePath: "node_modules/@uii/pilar/index.d.ts" },
    modal: { library: null, note: "no modal library detected — use native HTML for this element and flag it in the output" },
  },
  designTokens: { scss: [{ name: "$primary", value: "#005AAB" }], cssProps: [{ name: "--radius", value: "6px" }], mixins: [] },
  sampleComponents: [{ path: "src/app/list.component.ts", golden: true, selector: "app-list" }],
};

test("handoff renders framework, convention, and resolved capabilities", () => {
  const md = renderHandoffMd(ANGULAR_PC);
  assert.ok(md.includes("Angular ^13.3.0"), "framework + version");
  assert.ok(md.includes("NgModule architecture"), "module model");
  assert.ok(md.includes("selector prefix: `app`"), "selector prefix");
  assert.ok(md.includes("componentDir: `src/app`"), "write target");
  assert.ok(md.includes("### select"), "select capability listed");
  assert.ok(md.includes("Implementation: ngx-select"), "select library");
  assert.ok(md.includes("Reference: `src/app/filter.component.html`"), "select reference path");
  assert.ok(md.includes("Implementation: pilar (uii-table)"), "table library");
});

test("handoff excludes null capabilities and never inlines the corpus", () => {
  const md = renderHandoffMd(ANGULAR_PC);
  assert.ok(!md.includes("### modal"), "null capability is not a project fact to list");
  assert.ok(!md.includes("no modal library detected"), "null note does not leak into the handoff");
  assert.ok(md.includes("`.sliceui/conventions.md`"), "corpus is referenced, not inlined");
});

test("handoff bounds design tokens and marks golden references", () => {
  const md = renderHandoffMd(ANGULAR_PC);
  assert.ok(md.includes("`$primary`: #005AAB"), "scss token");
  assert.ok(md.includes("`--radius`: 6px"), "css custom prop");
  assert.ok(md.includes("**GOLDEN reference; read FIRST**"), "golden reference marked");
  assert.ok(md.includes("`src/app/list.component.ts`"), "reference path");
});

test("handoff degrades honestly for a non-Angular project", () => {
  const md = renderHandoffMd({
    framework: { id: "react-tsx", label: "React", version: "^18.2.0" },
    moduleOrStandalone: "n/a",
    styleExt: "css",
    componentDir: "src/components",
    prefix: "",
    capabilities: {},
    designTokens: {},
    sampleComponents: [],
  });
  assert.ok(md.includes("React ^18.2.0"), "framework + version");
  assert.ok(!md.includes("::ng-deep"), "no Angular corpus reference for React");
  assert.ok(!md.includes("selector prefix"), "no selector prefix for React");
  assert.ok(md.includes("React syntax only"), "honest non-Angular constraint note");
});

test("init writes .sliceui/handoff.md as the canonical contract", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sliceui-handoff-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x", version: "1.0.0", dependencies: { "@angular/core": "^13" } }));
  mkdirSync(join(dir, "src", "app"), { recursive: true });
  writeFileSync(join(dir, "src", "app", "a.html"), '<div class="well">hi</div>');
  await initProject(dir);
  const handoffPath = join(dir, ".sliceui", "handoff.md");
  const written = existsSync(handoffPath);
  const md = written ? readFileSync(handoffPath, "utf8") : "";
  rmSync(dir, { recursive: true, force: true });
  assert.ok(written, "handoff.md written by init");
  assert.ok(md.startsWith("# SliceUI Project Handoff"), "handoff has the canonical header");
  assert.ok(md.includes("## UI capabilities"), "handoff has the capability section");
});
