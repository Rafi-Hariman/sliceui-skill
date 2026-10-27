// sliceui uninstall — remove a SliceUI setup in one command.
// Project scope (default): remove .sliceui/, remove .env.local ONLY if it is
//   sliceui-owned (our header + only the Gemini key), and drop the .sliceui/ gitignore line.
// --skill / --global: remove the installed skill dirs (~/.claude/skills/sliceui AND the
//   companion ~/.claude/skills/sliceui-handoff).
// Never removes a .env.local that isn't ours (safety: don't nuke a user's other keys).

import { existsSync, readFileSync, rmSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { parseEnvContent } from "../lib/env.mjs";

const DEFAULT_SKILL_DIR = join(homedir(), ".claude", "skills", "sliceui");
const HANDOFF_SKILL_DIR = join(homedir(), ".claude", "skills", "sliceui-handoff");

/** True if the .env.local was created by sliceui (our header + only the Gemini key). */
function isSliceuiOwnedEnv(content) {
  const hasHeader = content.includes("# SliceUI");
  const env = parseEnvContent(content);
  const keys = Object.keys(env).filter((k) => !k.startsWith("#"));
  const onlyGemini = keys.every((k) => k === "GEMINI_API_KEY" || k === "VITE_GEMINI_API_KEY");
  return hasHeader && onlyGemini;
}

export function uninstallProject(rootDir) {
  const root = resolve(rootDir);
  const removed = [];
  const kept = [];

  // 1. .sliceui/ — always ours, always remove.
  const sliceuiDir = join(root, ".sliceui");
  if (existsSync(sliceuiDir)) {
    rmSync(sliceuiDir, { recursive: true, force: true });
    removed.push(".sliceui/");
  }

  // 2. .env.local — only if sliceui-owned.
  const envPath = join(root, ".env.local");
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, "utf8");
    if (isSliceuiOwnedEnv(content)) {
      rmSync(envPath, { force: true });
      removed.push(".env.local");
    } else {
      kept.push(".env.local (contains non-sliceui keys — left untouched)");
    }
  }

  // 3. .gitignore — drop the .sliceui/ line we added (leave .env.local line).
  const giPath = join(root, ".gitignore");
  if (existsSync(giPath)) {
    const content = readFileSync(giPath, "utf8");
    // Preserve the file's own line endings (CRLF vs LF) and trailing newline on rewrite.
    const eol = content.includes("\r\n") ? "\r\n" : "\n";
    const lines = content.split(/\r?\n/);
    const filtered = lines.filter((l) => l.trim() !== ".sliceui/");
    if (filtered.length !== lines.length) {
      writeFileSync(giPath, filtered.join(eol));
      removed.push(".gitignore → removed .sliceui/ line");
    }
  }

  return { ok: true, removed, kept };
}

export function uninstallSkill() {
  const removed = [];
  if (existsSync(DEFAULT_SKILL_DIR)) {
    rmSync(DEFAULT_SKILL_DIR, { recursive: true, force: true });
    removed.push(DEFAULT_SKILL_DIR);
  }
  if (existsSync(HANDOFF_SKILL_DIR)) {
    rmSync(HANDOFF_SKILL_DIR, { recursive: true, force: true });
    removed.push(HANDOFF_SKILL_DIR);
  }
  return { ok: true, removed };
}

export function main(argv) {
  const isSkill = argv.includes("--skill") || argv.includes("--global");

  if (isSkill) {
    const r = uninstallSkill();
    console.log(JSON.stringify({ ok: true, scope: "global", removed: r.removed }, null, 2));
    console.log(`\nRemoved skill. To remove the CLI itself: npm uninstall -g sliceui-skill\n`);
    return 0;
  }

  const r = uninstallProject(process.cwd());
  console.log(JSON.stringify({ ok: true, scope: "project", ...r }, null, 2));
  if (r.kept.length) {
    console.log("\nNote: " + r.kept.join("; "));
  }
  console.log(`\nRe-init anytime with: sliceui init [--key-from <file>]\n`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)) ?? 0);
}
