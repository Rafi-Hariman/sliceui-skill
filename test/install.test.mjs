import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { install } from "../src/commands/install.mjs";

function makeDest() {
  return mkdtempSync(join(tmpdir(), "sliceui-install-"));
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
  rmSync(dest, { recursive: true, force: true });
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
  rmSync(dest, { recursive: true, force: true });
});

test("install is idempotent when nothing changed (no backups)", () => {
  const dest = makeDest();
  install(dest);
  const r2 = install(dest);
  assert.equal(r2.backups.length, 0, "no backups on clean re-install");
  rmSync(dest, { recursive: true, force: true });
});
