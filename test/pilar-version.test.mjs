// Drift guard tests — the pilar catalogs are a snapshot at PILAR_VERSION; a UII project with a
// different installed pilar must surface a LOUD warning at init/doctor, never drift silently.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pilarVersionStatus, pilarDoctorCheck } from "../src/lib/pilar-version.mjs";
import { initProject } from "../src/commands/init.mjs";
import { runDoctor } from "../src/commands/doctor.mjs";
import { PILAR_VERSION } from "../src/framework/angular/pilar-catalog.mjs";

function tmpRoot(rel) {
  const base = mkdtempSync(join(tmpdir(), "sliceui-pv-"));
  const root = join(base, rel);
  mkdirSync(join(root, "src", "app"), { recursive: true });
  return { base, root };
}

// installedPilarVersion prefers node_modules (exact) over the package.json range.
test("version status: exact match → no skew, no message", () => {
  const { base, root } = tmpRoot("portal-uii-gateway");
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "x", dependencies: { pilar: `^${PILAR_VERSION}` } }));
  const st = pilarVersionStatus(root, { pilar: `^${PILAR_VERSION}` });
  rmSync(base, { recursive: true, force: true });
  assert.equal(st.present, true);
  assert.equal(st.skew, false);
  assert.equal(st.message, null);
});

test("version status: installed newer than catalog → skew warning with regen command", () => {
  const { base, root } = tmpRoot("portal-uii-gateway");
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "x", dependencies: { pilar: "^3.9.0" } }));
  const st = pilarVersionStatus(root, { pilar: "^3.9.0" });
  rmSync(base, { recursive: true, force: true });
  assert.equal(st.skew, true);
  assert.match(st.message, /3\.9\.0/);
  assert.match(st.message, /extract-pilar\.mjs/, "carries the regeneration command");
});

test("version status: catalog newer than installed → also skew (bindings may not exist yet)", () => {
  const { base, root } = tmpRoot("portal-uii-gateway");
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "x", dependencies: { pilar: "^1.0.0" } }));
  const st = pilarVersionStatus(root, { pilar: "^1.0.0" });
  rmSync(base, { recursive: true, force: true });
  assert.equal(st.skew, true);
  assert.match(st.message, /newer than/);
});

test("version status: no pilar dep → not present, silent (generic project)", () => {
  const { base, root } = tmpRoot("generic-app");
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "x", dependencies: { "@angular/core": "^13" } }));
  const st = pilarVersionStatus(root, { "@angular/core": "^13" });
  rmSync(base, { recursive: true, force: true });
  assert.equal(st.present, false);
  assert.equal(st.message, null);
});

test("init surfaces the skew warning for a UII project with mismatched pilar", async () => {
  const { base, root } = tmpRoot("portal-uii-gateway");
  writeFileSync(join(root, "package.json"), JSON.stringify({
    name: "x", dependencies: { "@angular/core": "^13", pilar: "^3.9.0" },
  }));
  writeFileSync(join(root, "src", "app", "a.html"), "<div>hi</div>");
  const r = await initProject(root);
  rmSync(base, { recursive: true, force: true });
  assert.equal(r.profile, "uii");
  assert.ok(r.warnings.some((w) => /extract-pilar\.mjs/.test(w)), `skew warning in init result: ${JSON.stringify(r.warnings)}`);
});

test("init is silent on skew when versions match", async () => {
  const { base, root } = tmpRoot("portal-uii-gateway");
  writeFileSync(join(root, "package.json"), JSON.stringify({
    name: "x", dependencies: { "@angular/core": "^13", pilar: `^${PILAR_VERSION}` },
  }));
  writeFileSync(join(root, "src", "app", "a.html"), "<div>hi</div>");
  const r = await initProject(root);
  rmSync(base, { recursive: true, force: true });
  assert.ok(!r.warnings.some((w) => /extract-pilar\.mjs/.test(w)), "no skew warning when versions match");
});

test("doctor reports a Pilar catalog line (warn on skew, ok on match, n/a on generic)", async () => {
  // skew
  const s = tmpRoot("portal-uii-gateway");
  writeFileSync(join(s.root, "package.json"), JSON.stringify({ name: "x", dependencies: { pilar: "^3.9.0" } }));
  const rs = await runDoctor(s.root);
  rmSync(s.base, { recursive: true, force: true });
  const skewCheck = rs.checks.find((c) => c.label.startsWith("Pilar catalog"));
  assert.ok(skewCheck, "doctor has a Pilar catalog check");
  assert.equal(skewCheck.warn, true);
  assert.match(skewCheck.detail, /extract-pilar/);

  // match
  const m = tmpRoot("portal-uii-gateway");
  writeFileSync(join(m.root, "package.json"), JSON.stringify({ name: "x", dependencies: { pilar: `^${PILAR_VERSION}` } }));
  const rm2 = await runDoctor(m.root);
  rmSync(m.base, { recursive: true, force: true });
  const okCheck = rm2.checks.find((c) => c.label.startsWith("Pilar catalog"));
  assert.equal(okCheck.ok, true);
  assert.equal(okCheck.warn, undefined);

  // generic
  const g = tmpRoot("generic-app");
  writeFileSync(join(g.root, "package.json"), JSON.stringify({ name: "x", dependencies: { react: "^18" } }));
  const rg = await runDoctor(g.root);
  rmSync(g.base, { recursive: true, force: true });
  const naCheck = rg.checks.find((c) => c.label.startsWith("Pilar catalog"));
  assert.equal(naCheck.ok, true);
  assert.match(naCheck.detail, /generic project/);
});
