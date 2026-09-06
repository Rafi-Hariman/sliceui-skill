// pilar-golden — the E2E oracle that BINDS Fase 1 + F2 together.
//
// A hand-written, senior-engineer pilar slice (uii-table + ngx-select + uii-pagination wiring,
// TableColumn[] typing, per-row auth, literal text) is the "correct output" the machine should
// reproduce. This test proves the gate is NOT false-negative on a real pilar slice: verifyComponent
// (names + policy + catalog) and typeCheckSlice (types) must BOTH pass it. If either fails, the
// gate rejects correct pilar code — a bug as serious as accepting wrong code.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyComponent } from "../src/framework/angular/verify.mjs";
import { typeCheckSlice } from "../src/framework/angular/pilar-typecheck.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SLICE = join(HERE, "fixtures", "pilar-golden", "bill-list");
const GT = join(HERE, "fixtures", "pilar-golden", "ground-truth");

function readComponent() {
  const read = (ext) => readFileSync(join(SLICE, `bill-list.component.${ext}`), "utf8");
  return { scss: read("scss"), html: read("html"), ts: read("ts") };
}
function readJson(p) { return JSON.parse(readFileSync(p, "utf8")); }

function groundTruth() {
  return {
    conventions: readJson(join(GT, "conventions.json")),
    transcript: readJson(join(GT, "transcript.json")),
    rawXml: readFileSync(join(GT, "raw.xml"), "utf8"),
  };
}

test("pilar-golden: hand-written pilar slice passes verify (gate not false-negative)", () => {
  const { scss, html, ts } = readComponent();
  const r = verifyComponent({ scss, html, ts, ...groundTruth() });

  const failures = r.checks.filter((c) => c.status === "fail");
  assert.deepEqual(
    failures.map((c) => ({ name: c.name, detail: c.detail })),
    [],
    `golden slice must pass every check; failing: ${JSON.stringify(failures)}`,
  );
});

test("pilar-golden: hand-written pilar slice passes the catalog type-check", () => {
  const { ts } = readComponent();
  const r = typeCheckSlice({ ts });
  assert.equal(r.ok, true, `golden slice must type-check clean: ${JSON.stringify(r.diagnostics.slice(0, 3))}`);
});

test("pilar-golden: a drifted slice (wrong columns type) is rejected by the type-check", () => {
  const { ts } = readComponent();
  const bad = ts.replace("columns: TableColumn[]", "columns: string[]");
  const r = typeCheckSlice({ ts: bad });
  assert.equal(r.ok, false, "wrong columns type must be caught");
  assert.ok(r.diagnostics.some((d) => /not assignable to type 'string'/.test(d.message)), "diagnostic flags the type mismatch");
});
