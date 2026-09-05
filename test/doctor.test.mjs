import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { runDoctor } from "../src/commands/doctor.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = JSON.parse(readFileSync(join(HERE, "..", "package.json"), "utf8"));

function makeProject(extra = {}) {
  const dir = mkdtempSync(join(tmpdir(), "sliceui-doctor-"));
  if (extra.envKey) {
    writeFileSync(join(dir, ".env.local"), `GEMINI_API_KEY=${extra.envKey}\n`);
  }
  return dir;
}

/** Isolated skill dir: point doctor at a temp dir via SLICEUI_SKILL_DIR. */
function withSkillDir(fn, { withManifest = false } = {}) {
  const skillDir = mkdtempSync(join(tmpdir(), "sliceui-skilldir-"));
  if (withManifest) {
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "# sliceui\n");
    writeFileSync(join(skillDir, ".sliceui-cli-version"), PKG.version + "\n");
  }
  const prev = process.env.SLICEUI_SKILL_DIR;
  process.env.SLICEUI_SKILL_DIR = skillDir;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.SLICEUI_SKILL_DIR;
    else process.env.SLICEUI_SKILL_DIR = prev;
    rmSync(skillDir, { recursive: true, force: true });
  }
}

test("doctor reports missing key as a soft warning (falls back to static), not hard fail", async () => {
  // A missing Gemini key must NOT make doctor exit non-zero / say "fix before generating":
  // XML/FIGML input transcribes without a key and the screenshot path degrades to static tier.
  const dir = makeProject({});
  await withSkillDir(async () => {
    const r = await runDoctor(dir);
    const keyCheck = r.checks.find((c) => c.label.includes("Gemini API key"));
    assert.ok(keyCheck, "key check present");
    assert.equal(keyCheck.ok, false, "key check reports not-found");
    assert.equal(keyCheck.warn, true, "missing key is a warning, not a hard failure");
    // The only hard fail left is the missing skill manifest (this temp env has none).
    const hardFails = r.hardFails.filter((c) => !c.label.includes("Skill"));
    assert.equal(hardFails.length, 0, "missing key alone must not be a hard failure");
    // Without the missing-skill hard fail, doctor would be ok — prove key is not in hardFails.
    assert.ok(!r.hardFails.some((c) => c.label.includes("Gemini API key")), "key check must NOT be a hard failure");
    assert.ok(!r.hardFails.some((c) => c.label.includes("Gemini live call")), "skipped live call must NOT be a hard failure");
  });
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

test("doctor reports skill version as unmatched when no manifest is installed", async () => {
  const dir = makeProject({});
  await withSkillDir(async () => {
    const r = await runDoctor(dir);
    const versionCheck = r.checks.find((c) => c.label.includes("Skill↔CLI version"));
    assert.ok(versionCheck, "version check present");
    assert.equal(versionCheck.ok, false);
  });
  rmSync(dir, { recursive: true, force: true });
});

test("doctor reports skill version as matched when manifest equals CLI version", async () => {
  const dir = makeProject({});
  await withSkillDir(async () => {
    const r = await runDoctor(dir);
    const versionCheck = r.checks.find((c) => c.label.includes("Skill↔CLI version"));
    assert.equal(versionCheck.ok, true, versionCheck.detail);
  }, { withManifest: true });
  rmSync(dir, { recursive: true, force: true });
});
