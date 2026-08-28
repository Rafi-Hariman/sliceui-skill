// sliceui install — copy the skill (SKILL.md + references) into an agent's skill dir.
// Default ~/.claude/skills/sliceui. --dir overrides for other agent CLIs (Cursor, GLM Code, …).
// Idempotent + anti-clobber: existing files that differ from source are backed up to .bak
// (never silently overwrite a user's edits). Writes a version manifest so `doctor` can
// detect skill↔CLI drift.

import { mkdirSync, cpSync, existsSync, readFileSync, writeFileSync, readdirSync, statSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SKILL_SRC = join(PACKAGE_ROOT, "skill");
const PKG = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8"));
const VERSION_MANIFEST = ".sliceui-cli-version";

const DEFAULT_DIR = join(homedir(), ".claude", "skills", "sliceui");

const PRIVACY_LINE =
  "ℹ privacy: tier-1 transcription sends the screenshot to Gemini (your key). Use `sliceui transcribe --static` for 100% local. No telemetry.";

/** True when a dest file differs from its source (never clobber edits). */
function differs(srcDir, destDir, relPath) {
  try {
    const a = readFileSync(join(srcDir, relPath));
    const b = readFileSync(join(destDir, relPath));
    if (a.equals(b)) return false;
    return true;
  } catch {
    return true; // dest file missing or unreadable → treat as differing (will copy)
  }
}

export function install(destDir) {
  if (!existsSync(SKILL_SRC)) {
    return { ok: false, reason: "missing-skill", message: `Skill source not found at ${SKILL_SRC}` };
  }
  mkdirSync(destDir, { recursive: true });

  // Walk source tree; copy each file, backing up differing destinations.
  const backups = [];
  const copied = [];
  const walk = (dir, rel) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const srcFull = join(dir, entry.name);
      const relPath = join(rel, entry.name);
      const destFull = join(destDir, relPath);
      if (entry.isDirectory()) {
        mkdirSync(destFull, { recursive: true });
        walk(srcFull, relPath);
      } else {
        const existed = existsSync(destFull);
        const diff = existed && differs(SKILL_SRC, destDir, relPath);
        if (diff && existed) {
          const bak = `${destFull}.bak`;
          renameSync(destFull, bak);
          backups.push(`${relPath}.bak`);
        }
        cpSync(srcFull, destFull);
        copied.push(relPath);
      }
    }
  };
  walk(SKILL_SRC, "");

  // Version manifest so doctor can detect drift.
  writeFileSync(join(destDir, VERSION_MANIFEST), PKG.version + "\n");

  return { ok: true, destDir, copied, backups };
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
  console.log(JSON.stringify({
    ok: true,
    installed: result.destDir,
    files: result.copied.length,
    backedUp: result.backups,
  }, null, 2));
  console.log(PRIVACY_LINE);
  console.log(`\nSliceUI skill installed (CLI v${PKG.version}). Now in any project, ask your agent:\n  "slice this screenshot into my app: <image-path>"\n`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)) ?? 0);
}
