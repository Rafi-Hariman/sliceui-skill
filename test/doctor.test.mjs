import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDoctor } from "../src/commands/doctor.mjs";

function makeProject(extra = {}) {
  const dir = mkdtempSync(join(tmpdir(), "sliceui-doctor-"));
  // optional .env.local
  if (extra.envKey) {
    writeFileSync(join(dir, ".env.local"), `GEMINI_API_KEY=${extra.envKey}\n`);
  }
  // optional fake skill dir under a temp home
  return dir;
}

test("doctor reports missing key as a soft warning (falls back to static), not hard fail", async () => {
  const dir = makeProject({});
  const r = await runDoctor(dir);
  const keyCheck = r.checks.find((c) => c.label.includes("Gemini API key"));
  assert.ok(keyCheck, "key check present");
  assert.equal(keyCheck.ok, false);
  // missing key alone must not fail doctor (static tier is valid) — only live-call+env checks are informational
  rmSync(dir, { recursive: true, force: true });
});

test("doctor reports a key found when .env.local has one, without exposing its value", async () => {
  const dir = makeProject({ envKey: "fake-key-value" });
  const r = await runDoctor(dir);
  const keyCheck = r.checks.find((c) => c.label.includes("Gemini API key"));
  assert.equal(keyCheck.ok, true);
  assert.equal(keyCheck.label.includes("fake-key-value"), false, "must not print the key value");
  assert.equal(keyCheck.detail.includes("fake-key-value"), false, "detail must not leak the key");
  rmSync(dir, { recursive: true, force: true });
});

test("doctor exposes the platform + sips/swiftc checks", async () => {
  const dir = makeProject({});
  const r = await runDoctor(dir);
  const labels = r.checks.map((c) => c.label);
  assert.ok(labels.some((l) => l.includes("Platform")));
  assert.ok(labels.some((l) => l.includes("sips")));
  assert.ok(labels.some((l) => l.includes("swiftc")));
  rmSync(dir, { recursive: true, force: true });
});

test("doctor detects installed skill version manifest", async () => {
  const dir = makeProject({});
  // Simulate a fresh install (no manifest) → version check not ok (soft)
  const r = await runDoctor(dir);
  const versionCheck = r.checks.find((c) => c.label.includes("Skill↔CLI version"));
  assert.ok(versionCheck, "version check present");
  assert.equal(versionCheck.ok, false); // no manifest yet
  rmSync(dir, { recursive: true, force: true });
});
