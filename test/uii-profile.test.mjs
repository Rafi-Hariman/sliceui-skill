import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectProject } from "../src/commands/detect.mjs";
import { initProject } from "../src/commands/init.mjs";
import { UII_AUTHKEY_BY_ACTION } from "../src/framework/angular/uii-profile.mjs";

// UII profile gating: org-private grammar (pilar / @uiigateway / AuthorizationModel / ugw-*)
// must only be resolved and taught when the project fingerprints as UII. A generic project must
// never surface pilar/uii-table idiom — even if a stray template contains a <uii-table> tag.

function tmpRoot(rel = "generic-app") {
  const base = mkdtempSync(join(tmpdir(), "sliceui-uii-"));
  const root = join(base, rel);
  mkdirSync(root, { recursive: true });
  return { base, root };
}

test("generic project (name w/o uii, no uii deps, no uii .npmrc) → profile generic, pilar invisible", () => {
  const { base, root } = tmpRoot("generic-app");
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "generic-app", version: "1.0.0", dependencies: { react: "^18" } }));
  // A stray <uii-table> tag in source would previously resolve to pilar by `test` regex; a
  // generic project must NOT learn the org table idiom from an unrelated tag collision.
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "src", "App.tsx"), `export const x = <div><uii-table /></div>;`);
  writeFileSync(join(root, ".npmrc"), "registry=https://registry.npmjs.org/\n");

  const ctx = detectProject(root);
  rmSync(base, { recursive: true, force: true });

  assert.equal(ctx.isUii, false, "generic project is not UII");
  assert.equal(ctx.profile, "generic");
  assert.ok(Array.isArray(ctx.uiiSignals) && ctx.uiiSignals.length === 0, "no uii signals");
  const blob = JSON.stringify(ctx.capabilities) + JSON.stringify(ctx.libraries);
  assert.ok(!blob.includes("pilar"), "pilar not resolved for generic project");
  assert.ok(!blob.includes("AuthorizationModel"), "AuthorizationModel grammar not served to generic project");
  assert.ok(!blob.includes("@uiigateway"), "@uiigateway not served to generic project");
});

test("UII project (folder name uii-gateway) → profile uii, pilar resolves", () => {
  const { base, root } = tmpRoot("myapp-uii-gateway");
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "x", version: "1.0.0", dependencies: { "@angular/core": "^13", pilar: "^1.0.0" } }));

  const ctx = detectProject(root);
  rmSync(base, { recursive: true, force: true });

  assert.equal(ctx.isUii, true, "uii-named folder fingerprints UII");
  assert.equal(ctx.profile, "uii");
  // pilar is installed → table capability resolves to the org table.
  const table = ctx.capabilities?.table?.library ?? "";
  assert.ok(table.includes("pilar"), `table resolves to pilar for uii project (got "${table}")`);
});

test("UII project via @uiigateway/core dep (repo name not uii) → profile uii", () => {
  const { base, root } = tmpRoot("bill-portal");
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "bill-portal", version: "1.0.0", dependencies: { "@angular/core": "^13", "@uiigateway/core": "^1.0.0" } }));

  const ctx = detectProject(root);
  rmSync(base, { recursive: true, force: true });

  assert.equal(ctx.isUii, true, "@uiigateway/core dependency fingerprints UII even when the folder name is generic");
  assert.equal(ctx.profile, "uii");
  assert.ok(ctx.uiiSignals.some((s) => s.startsWith("dep:")), "dep signal present");
});

test("init writes .sliceui/uii-profile.md only for a UII project (not for generic)", () => {
  // Generic project → no uii-profile.md on disk.
  const g = tmpRoot("generic-app");
  writeFileSync(join(g.root, "package.json"), JSON.stringify({ name: "generic-app", version: "1.0.0", dependencies: { "@angular/core": "^13" } }));
  mkdirSync(join(g.root, "src", "app"), { recursive: true });
  writeFileSync(join(g.root, "src", "app", "a.html"), "<div>hi</div>");
  initProject(g.root);
  assert.ok(!existsSync(join(g.root, ".sliceui", "uii-profile.md")), "generic project must NOT receive uii-profile.md");
  rmSync(g.base, { recursive: true, force: true });

  // UII project → uii-profile.md present and carries the org grammar.
  const u = tmpRoot("portal-uii-gateway");
  writeFileSync(join(u.root, "package.json"), JSON.stringify({ name: "x", version: "1.0.0", dependencies: { "@angular/core": "^13", pilar: "^1.0.0" } }));
  mkdirSync(join(u.root, "src", "app"), { recursive: true });
  writeFileSync(join(u.root, "src", "app", "a.html"), "<div>hi</div>");
  initProject(u.root);
  const profile = join(u.root, ".sliceui", "uii-profile.md");
  assert.ok(existsSync(profile), "uii project receives uii-profile.md");
  const text = readFileSync(profile, "utf8");
  assert.match(text, /action → authKey → icon/, "profile carries the org truth table");
  rmSync(u.base, { recursive: true, force: true });
});

test("UII_AUTHKEY_BY_ACTION is the org alias map (single home for the grammar)", () => {
  assert.equal(UII_AUTHKEY_BY_ACTION.edit, "canUpdate");
  assert.equal(UII_AUTHKEY_BY_ACTION.verifivation, "canVerify", "Figma misspelling mapped");
  assert.equal(UII_AUTHKEY_BY_ACTION.unposting, "canUnposting");
  assert.equal(UII_AUTHKEY_BY_ACTION.activate, "canActivate");
});
