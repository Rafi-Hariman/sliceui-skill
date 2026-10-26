// sliceui init — one-shot project setup.
// Creates everything the skill needs inside the target project:
//   .sliceui/            (config, artifacts, project context)
//   .sliceui/inputs/     (drop screenshots/xml here)
//   .sliceui/config.json (per-project settings)
//   .env.local           (Gemini key — from --key-from FILE, or a commented template)
//   .gitignore entries   (.sliceui/, .env.local)
// Then runs detect → .sliceui/project-context.json.
// Idempotent: safe to re-run; never overwrites an existing .env.local or config.

import { mkdirSync, writeFileSync, readFileSync, existsSync, appendFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { detectProject, writeContextSectionFiles } from "./detect.mjs";
import { parseEnvContent } from "../lib/env.mjs";
import { renderConventionsMd, mergeGoldenReferences, mergeProjectPolicy } from "../framework/angular/conventions.mjs";
import { renderConventionsMd as renderVueConventionsMd } from "../framework/vue-sfc/conventions.mjs";
import { withMinedDeclarations } from "../project/scss-mine.mjs";
import { refereeArtifacts, codebaseEvidenceFindings } from "../lib/referee.mjs";
import { buildRefereeVerdict, REFEREE_VERDICT_FILE } from "../lib/referee-verdict.mjs";
import { loadPilar } from "../lib/pilar-loader.mjs";
import { splitProjectContext } from "../lib/snapshot.mjs";
import { renderHandoffMd } from "../lib/handoff.mjs";

const GITIGNORE_LINES = [".sliceui/", ".env.local"];

const ENV_TEMPLATE = `# SliceUI — image→code transcription key
# Get a FREE key at https://aistudio.google.com (Gemini API)
# Paste it below, then save this file. Without a key, sliceui uses the static tier.
GEMINI_API_KEY=
`;

export async function initProject(rootDir, { keyFrom = null, frameworkId = null, profile = null } = {}) {
  const root = resolve(rootDir);
  const created = [];
  const warnings = [];

  // pilar is present only when the private catalogs are installed (internal/UII build). In the
  // public npm tarball the pilar files are stripped → loadPilar() returns null, and the UII-only
  // docs/drift-guard below degrade to a no-op (never crash, never leak org source).
  const pilar = await loadPilar();

  // --- 1. .sliceui/ + inputs/{images,xml}/ ---
  const sliceuiDir = join(root, ".sliceui");
  const imagesDir = join(sliceuiDir, "inputs", "images");
  const xmlDir = join(sliceuiDir, "inputs", "xml");
  if (!existsSync(sliceuiDir)) created.push(".sliceui/");
  if (!existsSync(imagesDir)) created.push(".sliceui/inputs/images/");
  if (!existsSync(xmlDir)) created.push(".sliceui/inputs/xml/");
  mkdirSync(imagesDir, { recursive: true });
  mkdirSync(xmlDir, { recursive: true });

  // --- 2. per-project config ---
  const configPath = join(sliceuiDir, "config.json");
  if (!existsSync(configPath)) {
    writeFileSync(configPath, JSON.stringify({
      version: 1,
      forceTranscribe: true,
      defaultTier: "auto",
      references: [],
      notes: "forceTranscribe=true: always transcribe images to text (model-agnostic). references = paths to hand-sliced 'golden' components the agent reads FIRST as writing patterns. mockRowsFloor = optional positive number (project policy): when set, a paginated table renders exactly that many mock rows; omit for no fixed floor.",
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
  // --framework / --profile force detection; null = auto-detect.
  const ctx = await detectProject(root, { frameworkId, profile });
  // PR 2: split — project-context.json keeps only the WHAT facts; the duplicate
  // loadedClassRegistry + conventions blobs move to conventions.json (single owner).
  const { projectContext, conventions: baseConventions } = splitProjectContext(ctx);
  const ctxPath = join(sliceuiDir, "project-context.json");
  writeFileSync(ctxPath, JSON.stringify(projectContext, null, 2) + "\n");
  created.push(".sliceui/project-context.json");
  // Agent-readable context sections (.sliceui/context/*.md) — project-context.json can exceed
  // the agent's Read cap (479 KB in the 2026-09-10 run); these are additive slices of the same
  // facts, written alongside the full machine contract.
  for (const p of writeContextSectionFiles(sliceuiDir, ctx)) {
    created.push(toRelCreated(root, p));
  }

  // conventions.json — deterministic facts (machine-readable, the verify gate's ground truth),
  // canonical owner of loadedClassRegistry + classVocabulary + ngDeepCorpus + anatomy + naming.
  // Golden references (config.json `references`) are the user's hand-curated canonical pattern:
  // their classes are merged into the vocabulary so verify never flags a mirrored golden idiom
  // (mt-4 / col-12 / p-0) as invented.
  let conventions = { ...baseConventions };
  // profile gates the org-private grammar: conventions consumers (verify/conventions-mining)
  // must know whether pilar/@uiigateway idiom is in play.
  if (ctx.profile) conventions.profile = ctx.profile;
  conventions = mergeProjectPolicy(root, mergeGoldenReferences(root, conventions));
  conventions = await withMinedDeclarations(root, conventions, ctx.framework?.id);
  const convPath = join(sliceuiDir, "conventions.json");
  writeFileSync(convPath, JSON.stringify({ ...conventions, generatedAt: new Date().toISOString(), inputHash: ctx.inputHash }, null, 2) + "\n");
  created.push(".sliceui/conventions.json");

  // conventions.md — agent-facing narrative profile (deterministic template). Per-framework
  // renderer: Vue gets its own (SFC anatomy + :deep() corpus), everything else uses the
  // Angular renderer's generic fallback until its miner is built.
  const convMdPath = join(sliceuiDir, "conventions.md");
  const fwLabel = ctx.framework?.label ?? "";
  const convMd = ctx.framework?.id === "vue-sfc"
    ? renderVueConventionsMd(conventions, fwLabel)
    : renderConventionsMd(conventions, fwLabel, ctx.framework?.id);
  writeFileSync(convMdPath, convMd);
  created.push(".sliceui/conventions.md");

  // handoff.md — canonical project-facing contract for the coding agent (remediation Phase 1).
  // Compact; references real source paths; never inlines the class vocabulary or ::ng-deep
  // corpus (those stay in conventions.md). Written for every framework (non-Angular degrades
  // honestly — deep convention mining is Angular-first).
  const handoffMd = renderHandoffMd(projectContext, new Date().toISOString());
  writeFileSync(join(sliceuiDir, "handoff.md"), handoffMd);
  created.push(".sliceui/handoff.md");

  // uii-profile.md — the org's action→authKey→icon grammar. Written ONLY for UII projects
  // (fingerprinted by detect); a generic project never receives the org grammar on disk.
  // pilar-reference.md — the FULL pilar API reference (components + typing), also UII-only.
  // pilar-showcase.md — the FULL pilar showcase (every doc-* working example), also UII-only.
  if (ctx.profile === "uii" && pilar) {
    const uiiProfilePath = join(sliceuiDir, "uii-profile.md");
    writeFileSync(uiiProfilePath, pilar.renderUiiProfileMd());
    created.push(".sliceui/uii-profile.md");

    const pilarRefPath = join(sliceuiDir, "pilar-reference.md");
    writeFileSync(pilarRefPath, pilar.renderPilarReferenceMd());
    created.push(".sliceui/pilar-reference.md");

    const pilarShowcasePath = join(sliceuiDir, "pilar-showcase.md");
    writeFileSync(pilarShowcasePath, pilar.renderPilarShowcaseMd());
    created.push(".sliceui/pilar-showcase.md");
  }

  // Referee (codebase head): validate the conventions just extracted against real occurrences
  // in the source tree. Report-only — a fresh scaffold must still succeed — but surface the
  // corruption map so stale/incorrect convention claims are visible at setup time, not during a slice.
  const referee = refereeArtifacts(root, ctx, null, null, null);
  const redCount = referee.findings.filter((f) => f.status === "fail" || f.status === "stale").length;
  const refereeWarnings = redCount > 0
    ? [`referee: ${redCount} ground-truth claim(s) fail/stale — run \`sliceui referee\` for the corruption map.`]
    : [];

  // PR 3: persist the codebase-evidence verdict (the repository-scanning head) so the hot-path
  // `referee --target` reads it instead of re-scanning. Bound it to the just-written snapshot.
  try {
    const codebase = codebaseEvidenceFindings(root, baseConventions, projectContext);
    const verdict = buildRefereeVerdict({ ctx: projectContext, codebaseFindings: codebase.findings, evidence: codebase.evidence });
    writeFileSync(join(sliceuiDir, REFEREE_VERDICT_FILE), JSON.stringify(verdict, null, 2) + "\n");
    created.push(".sliceui/referee-verdict.json");
  } catch (err) {
    warnings.push(`referee verdict not written: ${err?.message ?? err}`);
  }

  // Drift guard (UII only): the pilar catalogs are a snapshot at PILAR_VERSION. When the
  // project's installed pilar differs, surface the regeneration command — a stale snapshot
  // generates against the wrong API and nothing else fails until runtime.
  const skewWarnings = [];
  if (ctx.profile === "uii" && pilar) {
    const st = pilar.pilarVersionStatus(root, ctx.deps ?? {});
    if (st.skew && st.message) skewWarnings.push(st.message);
  }

  return {
    ok: true,
    root,
    created,
    gitignoreAdded: giAdded,
    keyStatus,
    framework: ctx.framework,
    profile: ctx.profile ?? "generic",
    detected: ctx.detected,
    componentDir: ctx.componentDir,
    warnings: [...warnings, ...ctx.detectionWarnings, ...refereeWarnings, ...skewWarnings],
  };
}

/** Absolute path under root → the `.sliceui/...` shape the `created[]` list uses. */
function toRelCreated(root, abs) {
  return abs.startsWith(root) ? "." + abs.slice(root.length) : abs;
}

/** Read GEMINI_API_KEY / VITE_GEMINI_API_KEY from another env file. Returns the value or null. */
function extractKeyFrom(path) {
  try {
    const env = parseEnvContent(readFileSync(resolve(path), "utf8"));
    return env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || null;
  } catch {
    return null;
  }
}

// ---------- CLI entry ----------

/** Framework ids the CLI accepts for `--framework`. */
const VALID_FRAMEWORK_IDS = [
  "angular", "react-tsx", "nextjs", "vue-sfc", "svelte", "tailwind", "bootstrap5", "native-html",
];
const VALID_PROFILES = ["uii", "generic", "auto"];

/** Parse argv into { keyFrom, frameworkId, profile, yes } — last flag wins. */
function parseArgs(argv) {
  const out = { keyFrom: null, frameworkId: null, profile: null, yes: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--key-from" && argv[i + 1]) { out.keyFrom = argv[++i]; }
    else if (a === "--framework" && argv[i + 1]) { out.frameworkId = argv[++i]; }
    else if (a === "--profile" && argv[i + 1]) { out.profile = argv[++i]; }
    else if (a === "--yes") { out.yes = true; }
    else if (a.startsWith("--framework=")) { out.frameworkId = a.slice("--framework=".length); }
    else if (a.startsWith("--profile=")) { out.profile = a.slice("--profile=".length); }
  }
  return out;
}

/** Read one line from stdin (interactive confirmation). Returns null when stdin is not a TTY. */
function readLine(question) {
  if (!process.stdin.isTTY) return null;
  return new Promise((resolveLine) => {
    process.stdout.write(question);
    process.stdin.once("data", (buf) => resolveLine(buf.toString().trim()));
  });
}

/** Confirm the detected framework interactively (only when TTY + no --framework/--yes). */
async function confirmOrPick(argv, args) {
  // 1) explicit --framework → no prompt.
  if (args.frameworkId) return { frameworkId: args.frameworkId, profile: args.profile };

  // 2) --yes / non-TTY (agent) → no prompt, auto.
  if (args.yes || !process.stdin.isTTY) return { frameworkId: null, profile: args.profile };

  // 3) interactive: detect first to know what we'd confirm.
  const { detectProject } = await import("./detect.mjs");
  const pre = await detectProject(process.cwd(), { profile: args.profile === "auto" ? null : args.profile });
  const label = pre.framework?.label ?? "unknown";
  const id = pre.framework?.id;
  const forced = pre.framework?.forced;

  // Multi-framework ambiguity is surfaced as a warning by detect; here we offer a pick only when
  // detection itself could not settle (no known dep). Otherwise confirm the single detection.
  if (forced || !id || id === "tailwind" && pre.detectionWarnings?.some((w) => w.includes("No known framework"))) {
    const list = VALID_FRAMEWORK_IDS.map((f, i) => `${i + 1}. ${f}`).join("\n");
    const answer = await readLine(`\nNo framework detected — pick one:\n${list}\n> `);
    const n = Number.parseInt(answer ?? "", 10);
    const picked = VALID_FRAMEWORK_IDS[n - 1];
    if (picked) return { frameworkId: picked, profile: args.profile };
    process.stderr.write(`\nInvalid choice "${answer}" — aborting init. Use --framework <id> or --yes.\n`);
    process.exit(1);
  }

  const answer = await readLine(`Init SliceUI for ${label}? [Y/n] `);
  if (answer && /^n/i.test(answer)) {
    process.stderr.write("Aborted by user.\n");
    process.exit(0);
  }
  return { frameworkId: id, profile: args.profile };
}

export async function main(argv) {
  const args = parseArgs(argv);
  if (args.frameworkId && !VALID_FRAMEWORK_IDS.includes(args.frameworkId)) {
    process.stderr.write(`Unknown --framework "${args.frameworkId}". Valid: ${VALID_FRAMEWORK_IDS.join(", ")}\n`);
    return 2;
  }
  if (args.profile && !VALID_PROFILES.includes(args.profile)) {
    process.stderr.write(`Unknown --profile "${args.profile}". Valid: ${VALID_PROFILES.join(", ")}\n`);
    return 2;
  }

  // --profile auto = null (fingerprint decides). Resolve interactive confirm/pick.
  const { frameworkId, profile } = await confirmOrPick(argv, args);
  const profileArg = profile === "auto" ? null : profile;

  const result = await initProject(process.cwd(), { keyFrom: args.keyFrom, frameworkId, profile: profileArg });

  const safe = { ...result, framework: result.framework, profile: result.profile };
  console.log(JSON.stringify(safe, null, 2));
  if (result.keyStatus === "template" || result.keyStatus === "hint-appended") {
    console.log("\nNext: paste your Gemini key into .env.local (free at https://aistudio.google.com).");
  }
  console.log("\nDrop your inputs, then ask your agent:");
  console.log('  Figma XML   → .sliceui/inputs/xml/<name>.xml   ("slice this into my app: .sliceui/inputs/xml/<name>.xml")');
  console.log('  Screenshot  → .sliceui/inputs/images/<name>.png ("slice this into my app: .sliceui/inputs/images/<name>.png")');
  console.log("ℹ XML is instant + exact (no key). Screenshots use Gemini (your key); `--static` for 100% local.");
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).then((code) => process.exit(code ?? 0));
}
