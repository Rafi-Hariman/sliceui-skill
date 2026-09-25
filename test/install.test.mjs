import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { install } from "../src/commands/install.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

/** A dest dir nested in its own parent (so cleanup can rm the parent — the sibling
 *  sliceui-handoff install lives in dirname(dest), which must NOT be the system tmp root). */
function makeDest() {
  const parent = mkdtempSync(join(tmpdir(), "sliceui-install-"));
  return join(parent, "sliceui");
}

test("install copies the skill and writes a version manifest", () => {
  const dest = makeDest();
  const r = install(dest);
  assert.equal(r.ok, true);
  assert.ok(existsSync(join(dest, "SKILL.md")), "SKILL.md copied");
  assert.ok(existsSync(join(dest, "references", "angular13-cheatsheet.md")), "reference copied");
  assert.ok(existsSync(join(dest, ".sliceui-cli-version")), "version manifest written");
  const ver = readFileSync(join(dest, ".sliceui-cli-version"), "utf8").trim();
  assert.match(ver, /^\d+\.\d+\.\d+$/, "manifest is a semver");
  rmSync(dirname(dest), { recursive: true, force: true });
});

test("install backs up a user-modified SKILL.md instead of clobbering it", () => {
  const dest = makeDest();
  install(dest);
  // User edits their installed SKILL.md
  writeFileSync(join(dest, "SKILL.md"), "# user custom content\n", "utf8");
  // Re-install
  const r = install(dest);
  assert.ok(r.backups.length >= 1, "expected at least one .bak backup");
  const bakPath = join(dest, "SKILL.md.bak");
  assert.ok(existsSync(bakPath), "SKILL.md.bak exists");
  const bak = readFileSync(bakPath, "utf8");
  assert.equal(bak, "# user custom content\n", "user edit preserved in .bak");
  // And the fresh copy replaced it
  assert.ok(readFileSync(join(dest, "SKILL.md"), "utf8").includes("SliceUI"), "fresh SKILL.md installed");
  rmSync(dirname(dest), { recursive: true, force: true });
});

test("install is idempotent when nothing changed (no backups)", () => {
  const dest = makeDest();
  install(dest);
  const r2 = install(dest);
  assert.equal(r2.backups.length, 0, "no backups on clean re-install");
  rmSync(dirname(dest), { recursive: true, force: true });
});

test("install ships the companion sliceui-handoff skill as a sibling dir", () => {
  const dest = makeDest();
  const r = install(dest);
  // Companion installed at <skills-parent>/sliceui-handoff/, with its own manifest…
  const companion = join(dirname(dest), "sliceui-handoff");
  assert.equal(r.handoffDir, companion, "handoffDir reported");
  assert.ok(existsSync(join(companion, "SKILL.md")), "companion SKILL.md written");
  assert.ok(existsSync(join(companion, ".sliceui-cli-version")), "companion manifest written");
  // …and NOT nested inside the main skill dir (it must activate as its own command).
  assert.ok(!existsSync(join(dest, "handoff")), "no handoff/ subdir inside the main skill");
  rmSync(dirname(dest), { recursive: true, force: true });
});

test("handoff skill source ships with frontmatter and the CLI-less rules section", () => {
  const src = readFileSync(join(HERE, "..", "skill", "handoff", "SKILL.md"), "utf8");
  assert.match(src, /^---\nname: sliceui-handoff/, "frontmatter names the skill");
  assert.ok(src.includes("Aturan untuk Agent Tanpa CLI"), "invariant section present");
  assert.ok(src.includes("sliceui init"), "precondition tells the user to init");
});

test("handoff skill: Design tokens pointer must be verified, not assumed", () => {
  const src = readFileSync(join(HERE, "..", "skill", "handoff", "SKILL.md"), "utf8");
  // The Design tokens section must NOT unconditionally point at the scan artifact — it has to
  // gate the pointer on the artifact actually containing tokens (the empty-artifact bug, 2026-09-19).
  assert.ok(src.includes("Point to it ONLY if it actually contains"), "pointer gated on artifact content");
  assert.ok(src.includes("full list:"), "explicit real-stylesheet pointer example present");
  assert.ok(src.includes("src/assets/main.css"), "example names a stylesheet path, not the artifact");
  assert.ok(src.includes("@theme"), "Tailwind v4 CSS-first source is called out");
  // The general rule must exist so ANY pointer claim is verified against the file it names.
  assert.ok(src.includes("without having READ that file"), "pointer-verification anti-pattern present");
});
