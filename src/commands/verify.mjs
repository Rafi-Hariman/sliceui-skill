// sliceui verify — deterministic fidelity + conventions gate for a generated component.
// Reads the component files (html/scss/ts) and their ground truth (conventions.json +
// transcript + raw XML) and prints a structured verdict. Exit 0 = all checks pass.

import { existsSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { verifyComponent } from "../framework/angular/verify.mjs";
import { loadPilar } from "../lib/pilar-loader.mjs";
import { tracedReadFileSync, allowRoot } from "../lib/fs-trace.mjs";
import { loadConventionsSnapshot } from "../lib/snapshot.mjs";
import { normalizeComponentName } from "../lib/component-name.mjs";

export async function main(argv) {
  const opts = parseArgs(argv);
  const dir = opts.dir ? resolve(opts.dir) : process.cwd();
  const name = opts.name; // optional component basename (e.g. "history-agreement")

  // Ground truth lives in the nearest project root's `.sliceui/` (walk up from the component
  // dir), NOT process.cwd() — verifying a subdirectory of a monorepo must still find it.
  const root = nearestProjectRoot(dir);
  // The allowlist for the repository-access guard: everything under .sliceui/ (ground truth) and
  // the component's own directory (the generated target) is in scope. Any other read — the old
  // owning-module root traversal, a source-file scan — counts as a "repo read" for --profile.
  allowRoot(join(root, ".sliceui"));
  allowRoot(dir);
  const component = readComponent(dir, name);
  const { scss, html, ts } = component;
  // An explicit --conventions path wins over root-walk (escape hatch when auto-detect is wrong).
  // Otherwise load the canonical conventions snapshot (conventions.json) with legacy fallback to
  // project-context.json for pre-PR-2 snapshots that carry loadedClassRegistry there (PR 2).
  const snapshot = opts.conventions ? null : loadConventionsSnapshot(root);
  let conventions = opts.conventions
    ? readJsonSafe(resolve(opts.conventions))
    : (snapshot?.conventions ?? null);
  // Ground truth pairing: explicit --xml/--transcript flags win; else pair by component name;
  // else LOUD warn (never silently fall back to the wrong design's file — Report #1 §6.2).
  // Flags override an unpaired state — explicit evidence always wins.
  const pairing = pairGroundTruth(root, name, opts);
  const transcript = opts.transcript ? readJsonSafe(resolve(opts.transcript)) : pairing.transcript;
  const rawXml = opts.xml ? readFileSyncSafe(resolve(opts.xml)) : pairing.rawXml;
  // When an explicit name failed to pair AND no flags supplied the evidence, transcript/XML are
  // null — checks that depend on them skip as "unverified" instead of running against nothing.
  const unpaired = pairing.unpaired && !opts.transcript && !opts.xml;
  // PR 5 — malformed canonical snapshot is a ground-truth state, not a silent skip: the loader
  // reports it via diagnostics, and it must make the run unverifiable (non-green), never green.
  const snapshotDiagnostics = snapshot?.diagnostics ?? [];
  const malformedSnapshot = snapshotDiagnostics.some((d) => /malformed|conflicts/i.test(d));

  if (component.error) {
    console.error(component.error);
    console.error("SliceUI verify only validates Angular-style components: *.component.{scss,html,ts}.");
    return 2;
  }

  if (!html && !scss && !ts) {
    console.error(`no component files found in ${dir}`);
    console.error("SliceUI verify only validates Angular-style components: *.component.{scss,html,ts}.");
    console.error("React/Vue/Svelte/Next/Tailwind output is experimental today and is NOT verify-gated.");
    return 2;
  }

  // pilar is present only when the private catalogs are installed (internal/UII build); a public
  // npm install has them stripped → loadPilar() returns null and the pilar checks skip gracefully.
  const pilar = await loadPilar();
  // PR 5 — framework version from the canonical snapshot drives the Angular-version compatibility
  // check (bounded static diagnostics, never a full compiler). Read-only; a missing project-context
  // degrades the framework check to skip, not a crash.
  const projectContext = readJsonSafe(join(root, ".sliceui", "project-context.json"));
  const framework = projectContext?.framework ?? null;
  // The declaring module is at or above the COMPONENT's own directory (`dir`), so scope the walk
  // there rather than traversing the whole repo from `root`. See readOwningModules.
  const modules = readOwningModules(root, dir);
  const result = verifyComponent({ scss, html, ts, conventions, transcript, rawXml, pilar, modules, framework });

  // Pairing warnings go FIRST — the agent reads the head of the output, and an unpaired run's
  // per-check verdicts are misleading until the reader knows the ground truth is missing (F1).
  for (const w of pairing.warnings) console.log(w);
  // PR 5 corrective patch (EXT-001): a malformed canonical snapshot is UNVERIFIABLE too — its
  // headline must say so (exit 3), not read like an ordinary verification run.
  if (unpaired) {
    console.log("SliceUI verify — UNVERIFIED (design pairing failed; XML/transcript-dependent checks skipped)\n");
  } else if (malformedSnapshot) {
    console.log("SliceUI verify — UNVERIFIED (required ground truth is malformed/invalid; see snapshot diagnostics below)\n");
  } else {
    console.log("SliceUI verify — generated component fidelity + conventions\n");
  }
  for (const c of result.checks) {
    const icon = c.status === "pass" ? "✓" : c.status === "warn" ? "▲" : c.status === "fail" ? "✗" : "·";
    console.log(`  ${icon} ${c.name.padEnd(16)} ${c.status.padEnd(4)} ${c.detail}`);
    if (c.missing?.length) {
      for (const m of c.missing.slice(0, 8)) console.log(`       - ${m}`);
      if (c.missing.length > 8) console.log(`       … and ${c.missing.length - 8} more`);
    }
    if (c.problems?.length) for (const p of c.problems) console.log(`       - ${p}`);
    if (c.invented?.length) console.log(`       invented: ${c.invented.join(", ")}`);
  }
  const warned = result.warnCount ? ` · ${result.warnCount} warn` : "";
  console.log(`\n${result.failCount} fail${warned} · ${result.skipCount} skip · ${result.checks.length} checks`);
  if (!result.hasGroundTruth) {
    console.log("⚠ NO GROUND TRUTH — no .sliceui/conventions.json, transcript, or XML found (run `sliceui init` and `sliceui transcribe` first). NOT verifiable.");
  } else if (!conventions) {
    console.log("⚠ no .sliceui/conventions.json — run `sliceui init` first (convention checks may skip).");
  }
  // PR 5 — surface snapshot loader diagnostics (malformed canonical / legacy conflict) so a
  // corrupt-but-present snapshot is visible, never silently treated as a valid empty snapshot.
  for (const d of snapshotDiagnostics) console.log(`⚠ ${d}`);

  // Exit-code contract (PR 5 §8):
  //   0 = verified pass · 1 = verified fail · 2 = invalid input/target · 3 = unverifiable
  // A malformed canonical snapshot is UNVERIFIABLE (3), not a pass — same as an unpaired design.
  if (unpaired || malformedSnapshot) return 3;
  return result.pass ? 0 : 1;
}

/** Parse `verify [dir] [name] [--xml F] [--transcript F] [--conventions F]`. Flags anywhere. */
export function parseArgs(argv) {
  const out = { dir: null, name: null, xml: null, transcript: null, conventions: null };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--xml" && argv[i + 1]) { out.xml = argv[++i]; }
    else if (a.startsWith("--xml=")) { out.xml = a.slice("--xml=".length); }
    else if (a === "--transcript" && argv[i + 1]) { out.transcript = argv[++i]; }
    else if (a.startsWith("--transcript=")) { out.transcript = a.slice("--transcript=".length); }
    else if (a === "--conventions" && argv[i + 1]) { out.conventions = argv[++i]; }
    else if (a.startsWith("--conventions=")) { out.conventions = a.slice("--conventions=".length); }
    else if (!a.startsWith("--")) { positional.push(a); }
  }
  out.dir = positional[0] ?? null;
  out.name = positional[1] ?? null;
  return out;
}

/** Resolve transcript + rawXml by name; emit a loud warning (not a silent wrong-design fallback)
 *  when a component name is given but matches no ground-truth file and no --flag was passed.
 *  Layout: one artifact folder per design — `.sliceui/artifacts/<name>/transcript.json` and
 *  `.sliceui/inputs/xml/<name>.{xml,figml}`. Pairing is "a name → a folder", no cross-folder
 *  readdir guesswork. When pairing FAILS for an explicit name, we return null + `unpaired:true`
 *  (checks that need transcript/XML then skip) — NEVER a silent fallback to another design's
 *  artifact (that is what produced 3 false-fails in the 2026-09-11 session). */
export function pairGroundTruth(root, name, opts = {}) {
  const warnings = [];
  let transcript = null;
  let rawXml = null;
  let unpaired = false;

  const adir = join(root, ".sliceui", "artifacts");
  const xdir = join(root, ".sliceui", "inputs", "xml");
  const designNames = existsSync(adir) ? readdirSync(adir).filter((d) => existsSync(join(adir, d, "transcript.json"))) : [];
  const xCandidates = existsSync(xdir) ? readdirSync(xdir).filter((f) => /\.(xml|figml)$/i.test(f)) : [];
  const xmlStems = xCandidates.map((f) => f.replace(/\.(xml|figml)$/i, ""));

  if (name) {
    // 1. Explicit config map (authoritative, survives word-order differences).
    const pairings = readPairings(root);
    const mapped = pairings[name];
    const designTarget = mapped ?? name;

    // 2. Exact match, else token-overlap (word-order-independent).
    let tName = designNames.includes(designTarget) ? designTarget : null;
    let xFile = xCandidates.find((f) => f.replace(/\.(xml|figml)$/i, "") === designTarget) ?? null;
    if (!tName) tName = tokenOverlapMatch(designTarget, designNames);
    if (!xFile) {
      const xOverlap = tokenOverlapMatch(designTarget, xmlStems);
      if (xOverlap) xFile = xCandidates.find((f) => f.replace(/\.(xml|figml)$/i, "") === xOverlap) ?? null;
    }

    if (tName) transcript = readJsonSafe(join(adir, tName, "transcript.json"));
    if (xFile) rawXml = readFileSyncSafe(join(xdir, xFile));

    if ((!tName && !opts.transcript) || (!xFile && !opts.xml)) {
      unpaired = true;
      warnings.push(
        `⚠ PAIRING FAILED for component "${name}" — no exact/token-overlap/pairings match. ` +
        `XML/transcript-dependent checks are UNVERIFIED (not run against a wrong design). ` +
        `Pass --xml <file> --transcript <file> or add a "pairings" map in .sliceui/config.json.`,
      );
    }
  } else {
    // No name at all → first candidate is the only sensible default (single-design project).
    if (designNames.length) transcript = readJsonSafe(join(adir, designNames[0], "transcript.json"));
    if (xCandidates.length) rawXml = readFileSyncSafe(join(xdir, xCandidates[0]));
  }

  return { transcript, rawXml, warnings, unpaired };
}

/** Read `.sliceui/config.json` `pairings: { "<component-name>": "<design-stem>" }`. */
function readPairings(root) {
  const cfg = readJsonSafe(join(root, ".sliceui", "config.json"));
  return (cfg && typeof cfg.pairings === "object" && cfg.pairings) || {};
}

/** Token-overlap match: same multiword token SET (order-insensitive) → the matching stem, else null.
 *  `modal-detail-scholarship-deduction` ≈ `scholarship-deduction-modal-detail` (identical tokens). */
function tokenOverlapMatch(target, candidates) {
  const tok = (s) => [...new Set(String(s).toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1))].sort();
  const t = tok(target);
  if (t.length < 2) return null; // single-token name → token-overlap is too weak a signal
  for (const c of candidates) {
    const ct = tok(c);
    if (ct.length && ct.length === t.length && ct.every((x) => t.includes(x))) return c;
  }
  return null;
}

/** Read a component's html/scss/ts from a directory (or explicit basename). PR 5: the name is
 *  normalized (PascalCase class → kebab stem) before matching, so `TestingcomponentComponent`
 *  and `testingcomponent` address the same `testingcomponent.component.ts`. Traversal and
 *  ambiguity are rejected (an explicit bad name → { error } rather than a silent wrong pick). */
function readComponent(dir, name) {
  const files = existsSync(dir) ? readdirSync(dir) : [];
  let norm = null;
  if (name) {
    norm = normalizeComponentName(name);
    if (!norm.ok) {
      return { scss: "", html: "", ts: "", error: `invalid component name: ${norm.reason}` };
    }
  }
  const stem = norm?.stem ?? null;
  const pick = (ext) => {
    const match = files.find((f) => f.endsWith(`.component.${ext}`) && (!stem || f.startsWith(`${stem}.`)));
    return match ? readFileSyncSafe(join(dir, match)) : "";
  };
  return { scss: pick("scss"), html: pick("html"), ts: pick("ts") };
}

/** Workspace-aware project root for ground truth. Priority (highest first):
 *  1. nearest ancestor holding `.sliceui/` — the ground truth lives here, and in a monorepo the
 *     library subdir's `package.json` would otherwise mask the workspace root (2026-09-10 A1).
 *  2. workspace root — the first ancestor holding `angular.json` / `nx.json` / `workspace.json`.
 *  3. nearest `package.json` (fallback for non-workspace repos).
 *  4. process.cwd().
 *  We deliberately do NOT stop at a library `package.json` under a `projects` subdir — that is
 *  the leaf, and its `.sliceui/` (if any) is never the project ground truth. */
export function nearestProjectRoot(startDir) {
  let d = resolve(startDir);
  let pkgFallback = null;
  for (;;) {
    if (existsSync(join(d, ".sliceui"))) return d;
    if (existsSync(join(d, "angular.json")) || existsSync(join(d, "nx.json")) || existsSync(join(d, "workspace.json"))) {
      return d;
    }
    if (pkgFallback === null && existsSync(join(d, "package.json"))) pkgFallback = d;
    const up = dirname(d);
    if (up === d) return pkgFallback ?? process.cwd();
    d = up;
  }
}

function readFileSyncSafe(p) {
  try { return tracedReadFileSync(p, "utf8"); } catch { return ""; }
}

/** Concatenate the owning NgModule sources under the project root, so checkDeclaredInModule can
 *  confirm the component class is registered. Best-effort: returns "" when none are found. */
/** Candidate module sources for checkDeclaredInModule — SCOPED, never a root traversal.
 *
 *  Until 2026-09-24 this walked the whole source tree on every verify, purely to find the module
 *  that declares the generated component. That is the one genuinely unbounded read in the hot
 *  path (the rest of verify already reads only `.sliceui/` + the target files).
 *
 *  The owning module always sits AT or ABOVE the component's directory (Angular declares a
 *  component in a module located in its own directory or an ancestor's — never a sibling subtree),
 *  so the search space is derivable rather than discovered: walk up from the component dir to the
 *  project root, reading `*.module.ts` directly in each directory on the chain. A component in
 *  `src/app/foo/bar/` is declared by `bar.module.ts`, `foo.module.ts`, or `app.module.ts`.
 *
 *  When the component dir is absent or unreadable, this returns "" and `checkDeclaredInModule`
 *  reports skip — it must NOT fall back to a full traversal (the pre-fix behavior). A skip is
 *  honest; a silent root walk is the cost this function exists to remove. */
export function readOwningModules(root, componentDir) {
  if (!componentDir) return "";
  const start = resolve(root, componentDir);
  if (!existsSync(start)) return "";
  const out = [];
  const readModuleFilesIn = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) continue; // no descent — modules are at or above the component, never below
      if (/\.module\.ts$/.test(e.name)) out.push(readFileSyncSafe(join(dir, e.name)));
    }
  };
  let d = start;
  for (;;) {
    readModuleFilesIn(d);
    if (d === root) break;
    const up = dirname(d);
    if (up === d || !up.startsWith(root)) break;
    d = up;
  }
  return out.join("\n");
}
function readJsonSafe(p) {
  try { return JSON.parse(tracedReadFileSync(p, "utf8")); } catch { return null; }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)) ?? 0);
}
