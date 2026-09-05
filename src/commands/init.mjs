// sliceui init — one-shot project setup.
// Creates everything the skill needs inside the target project:
//   .sliceui/            (config, transcripts, project context)
//   .sliceui/images/     (drop screenshots here)
//   .sliceui/config.json (per-project settings)
//   .env.local           (Gemini key — from --key-from FILE, or a commented template)
//   .gitignore entries   (.sliceui/, .env.local)
// Then runs detect → .sliceui/project-context.json.
// Idempotent: safe to re-run; never overwrites an existing .env.local or config.

import { mkdirSync, writeFileSync, readFileSync, existsSync, appendFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { detectProject } from "./detect.mjs";
import { parseEnvContent } from "../lib/env.mjs";
import { renderConventionsMd, mergeGoldenClasses, goldenCompanionFiles } from "../lib/conventions.mjs";
import { renderUiiProfileMd } from "../lib/profiles/uii.mjs";
import { refereeArtifacts } from "../lib/referee.mjs";

const GITIGNORE_LINES = [".sliceui/", ".env.local"];

const ENV_TEMPLATE = `# SliceUI — image→code transcription key
# Get a FREE key at https://aistudio.google.com (Gemini API)
# Paste it below, then save this file. Without a key, sliceui uses the static tier.
GEMINI_API_KEY=
`;

export function initProject(rootDir, { keyFrom = null } = {}) {
  const root = resolve(rootDir);
  const created = [];
  const warnings = [];

  // --- 1. .sliceui/ + images/ + xml/ + transcript/ ---
  const sliceuiDir = join(root, ".sliceui");
  const imagesDir = join(sliceuiDir, "images");
  const xmlDir = join(sliceuiDir, "xml");
  const transcriptDir = join(sliceuiDir, "transcript");
  if (!existsSync(sliceuiDir)) created.push(".sliceui/");
  if (!existsSync(imagesDir)) created.push(".sliceui/images/");
  if (!existsSync(xmlDir)) created.push(".sliceui/xml/");
  if (!existsSync(transcriptDir)) created.push(".sliceui/transcript/");
  mkdirSync(imagesDir, { recursive: true });
  mkdirSync(xmlDir, { recursive: true });
  mkdirSync(transcriptDir, { recursive: true });

  // --- 2. per-project config ---
  const configPath = join(sliceuiDir, "config.json");
  if (!existsSync(configPath)) {
    writeFileSync(configPath, JSON.stringify({
      version: 1,
      forceTranscribe: true,
      defaultTier: "auto",
      references: [],
      notes: "forceTranscribe=true: always transcribe images to text (model-agnostic). references = paths to hand-sliced 'golden' components the agent reads FIRST as writing patterns.",
    }, null, 2) + "\n");
    created.push(".sliceui/config.json");
  }

  // --- 3. .env.local + key ---
  let keyStatus;
  const envPath = join(root, ".env.local");
  const key = keyFrom ? extractKeyFrom(keyFrom) : null;
  if (keyFrom && !key) {
    warnings.push(`No GEMINI_API_KEY found in ${keyFrom} — writing template instead.`);
  }
  if (!existsSync(envPath)) {
    if (key) {
      writeFileSync(envPath, `# SliceUI — Gemini API key (free: https://aistudio.google.com)\nGEMINI_API_KEY=${key}\n`);
      keyStatus = "written-from-source";
      created.push(".env.local");
    } else {
      writeFileSync(envPath, ENV_TEMPLATE);
      keyStatus = "template";
      created.push(".env.local");
      warnings.push(".env.local created with an empty GEMINI_API_KEY — paste your key, or transcription falls back to the static tier.");
    }
  } else {
    const existing = parseEnvContent(readFileSync(envPath, "utf8"));
    if (existing.GEMINI_API_KEY || existing.VITE_GEMINI_API_KEY) {
      keyStatus = "already-set";
    } else if (key) {
      appendFileSync(envPath, `GEMINI_API_KEY=${key}\n`);
      keyStatus = "appended-from-source";
    } else {
      appendFileSync(envPath, `\n# SliceUI — paste your FREE Gemini key (https://aistudio.google.com)\n# GEMINI_API_KEY=\n`);
      keyStatus = "hint-appended";
      warnings.push(".env.local exists but has no GEMINI_API_KEY — add one for tier-1 transcription.");
    }
  }

  // --- 4. .gitignore ---
  const giPath = join(root, ".gitignore");
  let giAdded = [];
  if (existsSync(giPath)) {
    const gi = readFileSync(giPath, "utf8");
    for (const line of GITIGNORE_LINES) {
      if (!gi.split(/\r?\n/).some((l) => l.trim() === line)) {
        appendFileSync(giPath, (gi.endsWith("\n") ? "" : "\n") + line + "\n");
        giAdded.push(line);
      }
    }
  } else {
    writeFileSync(giPath, GITIGNORE_LINES.join("\n") + "\n");
    giAdded = [...GITIGNORE_LINES];
    created.push(".gitignore");
  }

  // --- 5. detect + conventions (persist all 3 artifacts, so the agent can read them right after init) ---
  const ctx = detectProject(root);
  const ctxPath = join(sliceuiDir, "project-context.json");
  writeFileSync(ctxPath, JSON.stringify(ctx, null, 2) + "\n");
  created.push(".sliceui/project-context.json");

  // conventions.json — deterministic facts (machine-readable, the verify gate's ground truth)
  // Golden references (config.json `references`) are the user's hand-curated canonical pattern:
  // their classes are merged into the vocabulary so verify never flags a mirrored golden idiom
  // (mt-4 / col-12 / p-0) as invented.
  const conventions = { ...(ctx.conventions ?? {}) };
  // profile gates the org-private grammar: conventions consumers (verify/conventions-mining)
  // must know whether pilar/@uiigateway idiom is in play.
  if (ctx.profile) conventions.profile = ctx.profile;
  // The loaded-class registry is detect's ground truth for "which utility/grid classes actually
  // resolve in a LOADED stylesheet". It lives top-level in project-context.json (detect) but the
  // verify gate reads conventions.json — carry it here so checkLoadedClass is live in production
  // (it was built but never wired: conventions.json never carried it → always skip).
  if (ctx.loadedClassRegistry) conventions.loadedClassRegistry = ctx.loadedClassRegistry;
  const refs = readJsonSafe(join(root, ".sliceui", "config.json"))?.references ?? [];
  if (Array.isArray(refs) && refs.length) {
    const { html } = goldenCompanionFiles(root, refs);
    if (html.length) {
      conventions.classVocabulary = mergeGoldenClasses(conventions.classVocabulary ?? [], html);
    }
  }
  const convPath = join(sliceuiDir, "conventions.json");
  writeFileSync(convPath, JSON.stringify({ ...conventions, generatedAt: new Date().toISOString(), inputHash: ctx.inputHash }, null, 2) + "\n");
  created.push(".sliceui/conventions.json");

  // conventions.md — agent-facing narrative profile (deterministic template)
  const convMdPath = join(sliceuiDir, "conventions.md");
  const fwLabel = ctx.framework?.label ?? "";
  writeFileSync(convMdPath, renderConventionsMd(conventions, fwLabel));
  created.push(".sliceui/conventions.md");

  // uii-profile.md — the org's action→authKey→icon grammar. Written ONLY for UII projects
  // (fingerprinted by detect); a generic project never receives the org grammar on disk.
  if (ctx.profile === "uii") {
    const uiiProfilePath = join(sliceuiDir, "uii-profile.md");
    writeFileSync(uiiProfilePath, renderUiiProfileMd());
    created.push(".sliceui/uii-profile.md");
  }

  // Referee (codebase head): validate the conventions just extracted against real occurrences
  // in the source tree. Report-only — a fresh scaffold must still succeed — but surface the
  // corruption map so stale/incorrect convention claims are visible at setup time, not during a slice.
  const referee = refereeArtifacts(root, ctx, null, null, null);
  const redCount = referee.findings.filter((f) => f.status === "fail" || f.status === "stale").length;
  const refereeWarnings = redCount > 0
    ? [`referee: ${redCount} ground-truth claim(s) fail/stale — run \`sliceui referee\` for the corruption map.`]
    : [];

  return {
    ok: true,
    root,
    created,
    gitignoreAdded: giAdded,
    keyStatus,
    framework: ctx.framework,
    detected: ctx.detected,
    componentDir: ctx.componentDir,
    warnings: [...warnings, ...ctx.detectionWarnings, ...refereeWarnings],
  };
}

/** Read GEMINI_API_KEY / VITE_GEMINI_API_KEY from another env file. Returns the value or null. */
function readJsonSafe(p) {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}

function extractKeyFrom(path) {
  try {
    const env = parseEnvContent(readFileSync(resolve(path), "utf8"));
    return env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || null;
  } catch {
    return null;
  }
}

// ---------- CLI entry ----------

export function main(argv) {
  const keyIdx = argv.indexOf("--key-from");
  const keyFrom = keyIdx !== -1 && argv[keyIdx + 1] ? argv[keyIdx + 1] : null;
  const result = initProject(process.cwd(), { keyFrom });

  const safe = { ...result };
  console.log(JSON.stringify(safe, null, 2));
  if (result.keyStatus === "template" || result.keyStatus === "hint-appended") {
    console.log("\nNext: paste your Gemini key into .env.local (free at https://aistudio.google.com).");
  }
  console.log("\nDrop your inputs, then ask your agent:");
  console.log('  Figma XML   → .sliceui/xml/<name>.xml   ("slice this into my app: .sliceui/xml/<name>.xml")');
  console.log('  Screenshot  → .sliceui/images/<name>.png ("slice this into my app: .sliceui/images/<name>.png")');
  console.log("ℹ XML is instant + exact (no key). Screenshots use Gemini (your key); `--static` for 100% local.");
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)) ?? 0);
}
