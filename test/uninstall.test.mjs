import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { uninstallProject } from "../src/commands/uninstall.mjs";

function makeProject({ withSliceui = true, envContent = null, gitignore = null } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "sliceui-uninstall-"));
  if (withSliceui) {
    mkdirSync(join(dir, ".sliceui", "images"), { recursive: true });
    writeFileSync(join(dir, ".sliceui", "project-context.json"), "{}");
  }
  if (envContent !== null) {
    writeFileSync(join(dir, ".env.local"), envContent);
  }
  if (gitignore !== null) {
    writeFileSync(join(dir, ".gitignore"), gitignore);
  }
  return dir;
}

const OWNED_ENV = "# SliceUI — Gemini API key (free: https://aistudio.google.com)\nGEMINI_API_KEY=abc123\n";
const FOREIGN_ENV = "# my app\nDATABASE_URL=postgres://x\nGEMINI_API_KEY=abc\n";

test("removes .sliceui/ and sliceui-owned .env.local", () => {
  const dir = makeProject({ envContent: OWNED_ENV });
  const r = uninstallProject(dir);
  assert.equal(existsSync(join(dir, ".sliceui")), false, ".sliceui removed");
  assert.equal(existsSync(join(dir, ".env.local")), false, "owned .env.local removed");
  assert.ok(r.removed.includes(".env.local"));
});

test("keeps a .env.local that has non-sliceui keys", () => {
  const dir = makeProject({ envContent: FOREIGN_ENV });
  const r = uninstallProject(dir);
  assert.equal(existsSync(join(dir, ".env.local")), true, "foreign .env.local kept");
  assert.ok(r.kept.length > 0, "reported as kept");
});

test("drops the .sliceui/ line from .gitignore, keeps .env.local line", () => {
  const dir = makeProject({ gitignore: "node_modules/\n.sliceui/\n.env.local\n" });
  uninstallProject(dir);
  const gi = readFileSync(join(dir, ".gitignore"), "utf8");
  assert.ok(!gi.includes(".sliceui/"), ".sliceui/ line removed");
  assert.ok(gi.includes(".env.local"), ".env.local line kept");
});

test("no-op when nothing is installed", () => {
  const dir = makeProject({ withSliceui: false });
  const r = uninstallProject(dir);
  assert.equal(r.ok, true);
  assert.equal(r.removed.length, 0);
});
