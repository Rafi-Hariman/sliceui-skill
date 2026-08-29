// sliceui update — self-update the CLI + refresh the installed skill.
// Checks the npm registry for the latest version; if newer, installs it globally
// and re-installs the skill (SKILL.md + version manifest). Idempotent: safe to run
// even when already up-to-date.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { install } from "./install.mjs";

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PKG = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8"));
const PKG_NAME = PKG.name;

function latestVersion() {
  try {
    return execFileSync("npm", ["view", PKG_NAME, "version"], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

export function update() {
  const latest = latestVersion();
  if (!latest) {
    return { ok: false, reason: "offline", message: "Cannot reach the npm registry." };
  }
  const current = PKG.version;
  if (latest === current) {
    return { ok: true, updated: false, current, latest, message: "Already up to date." };
  }

  try {
    execFileSync("npm", ["install", "-g", `${PKG_NAME}@${latest}`], { stdio: "inherit" });
  } catch (err) {
    return { ok: false, reason: "install-failed", message: String(err?.message ?? err).slice(0, 300) };
  }

  // Re-install the skill so SKILL.md + manifest match the new CLI.
  const installed = install(join(process.env.HOME ?? "~", ".claude", "skills", "sliceui"));
  return {
    ok: true,
    updated: true,
    current,
    latest,
    skillInstalled: installed.ok,
  };
}

export function main() {
  const r = update();
  console.log(JSON.stringify(r, null, 2));
  if (r.ok && r.updated) {
    console.log(`\nUpdated ${PKG_NAME} ${r.current} → ${r.latest}.`);
  } else if (r.ok && !r.updated) {
    console.log(`\n${PKG_NAME} is already at ${r.current}.`);
  }
  return r.ok ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main() ?? 0);
}
