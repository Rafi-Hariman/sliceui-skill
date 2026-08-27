// sliceui install — copy the skill (SKILL.md + references) into an agent's skill dir.
// Default ~/.claude/skills/sliceui. --dir overrides for other agent CLIs (Cursor, GLM Code, …).
// Idempotent: re-running refreshes the snapshot after an update.

import { mkdirSync, cpSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SKILL_SRC = join(PACKAGE_ROOT, "skill");

const DEFAULT_DIR = join(homedir(), ".claude", "skills", "sliceui");

export function install(destDir) {
  if (!existsSync(SKILL_SRC)) {
    return { ok: false, reason: "missing-skill", message: `Skill source not found at ${SKILL_SRC}` };
  }
  mkdirSync(destDir, { recursive: true });
  cpSync(SKILL_SRC, destDir, { recursive: true });
  return { ok: true, destDir };
}

export function main(argv) {
  let destDir = DEFAULT_DIR;
  const dirIdx = argv.indexOf("--dir");
  if (dirIdx !== -1 && argv[dirIdx + 1]) {
    destDir = argv[dirIdx + 1];
  }
  const result = install(destDir);
  if (!result.ok) {
    console.error(JSON.stringify(result, null, 2));
    return 1;
  }
  console.log(JSON.stringify({ ok: true, installed: result.destDir }, null, 2));
  console.log(`\nSliceUI skill installed. Now in any project, ask your agent:\n  "slice this screenshot into my app: <image-path>"\n`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)) ?? 0);
}
