// sliceui verify — deterministic fidelity + conventions gate for a generated component.
// Reads the component files (html/scss/ts) and their ground truth (conventions.json +
// transcript + raw XML) and prints a structured verdict. Exit 0 = all checks pass.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { verifyComponent } from "../framework/angular/verify.mjs";
import { loadPilar } from "../lib/pilar-loader.mjs";

export async function main(argv) {
  const opts = parseArgs(argv);
  const dir = opts.dir ? resolve(opts.dir) : process.cwd();
  const name = opts.name; // optional component basename (e.g. "history-agreement")

  // Ground truth lives in the nearest project root's `.sliceui/` (walk up from the component
  // dir), NOT process.cwd() — verifying a subdirectory of a monorepo must still find it.
  const root = nearestProjectRoot(dir);
  const { scss, html, ts } = readComponent(dir, name);
  let conventions = readJsonSafe(join(root, ".sliceui", "conventions.json")) ?? null;
  // loadedClassRegistry lives top-level in project-context.json (detect), not in conventions.json.
  // When conventions doesn't carry it (a `sliceui detect` run without init, or older init), pull it
  // from project-context so checkLoadedClass is live — not silently skipped.
  if (conventions && !conventions.loadedClassRegistry) {
    const pctx = readJsonSafe(join(root, ".sliceui", "project-context.json"));
    if (pctx?.loadedClassRegistry) {
      conventions = { ...conventions, loadedClassRegistry: pctx.loadedClassRegistry };
    }
  }
  // Ground truth pairing: explicit --xml/--transcript flags win; else pair by component name;
  // else LOUD warn (never silently fall back to the wrong design's file — Report #1 §6.2).
  const pairing = pairGroundTruth(root, name, opts);
  const transcript = opts.transcript ? readJsonSafe(resolve(opts.transcript)) : pairing.transcript;
  const rawXml = opts.xml ? readFileSyncSafe(resolve(opts.xml)) : pairing.rawXml;

  if (!html && !scss && !ts) {
    console.error(`no component files found in ${dir}`);
    console.error("SliceUI verify only validates Angular-style components: *.component.{scss,html,ts}.");
    console.error("React/Vue/Svelte/Next/Tailwind output is experimental today and is NOT verify-gated.");
    return 2;
  }

  // pilar is present only when the private catalogs are installed (internal/UII build); a public
  // npm install has them stripped → loadPilar() returns null and the pilar checks skip gracefully.
  const pilar = await loadPilar();
  const result = verifyComponent({ scss, html, ts, conventions, transcript, rawXml, pilar });

  console.log("SliceUI verify — generated component fidelity + conventions\n");
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
  for (const w of pairing.warnings) console.log(w);

  return result.pass ? 0 : 1;
}

/** Parse `verify [dir] [name] [--xml F] [--transcript F]`. Flags may appear anywhere. */
function parseArgs(argv) {
  const out = { dir: null, name: null, xml: null, transcript: null };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--xml" && argv[i + 1]) { out.xml = argv[++i]; }
    else if (a.startsWith("--xml=")) { out.xml = a.slice("--xml=".length); }
    else if (a === "--transcript" && argv[i + 1]) { out.transcript = argv[++i]; }
    else if (a.startsWith("--transcript=")) { out.transcript = a.slice("--transcript=".length); }
    else if (!a.startsWith("--")) { positional.push(a); }
  }
  out.dir = positional[0] ?? null;
  out.name = positional[1] ?? null;
  return out;
}

/** Resolve transcript + rawXml by name; emit a loud warning (not a silent wrong-design fallback)
 *  when a component name is given but matches no ground-truth file and no --flag was passed. */
function pairGroundTruth(root, name, opts) {
  const warnings = [];
  let transcript = null;
  let rawXml = null;

  const tdir = join(root, ".sliceui", "transcript");
  const xdir = join(root, ".sliceui", "xml");
  const tCandidates = existsSync(tdir) ? readdirSync(tdir).filter((f) => f.endsWith(".transcript.json") && !f.endsWith(".meta.json")) : [];
  const xCandidates = existsSync(xdir) ? readdirSync(xdir).filter((f) => /\.(xml|figml)$/i.test(f)) : [];

  const tMatch = name ? tCandidates.find((f) => f.startsWith(`${name}.`)) : null;
  const xMatch = name ? xCandidates.find((f) => f.startsWith(`${name}.`)) : null;

  if (tMatch) transcript = readJsonSafe(join(tdir, tMatch));
  if (xMatch) rawXml = readFileSyncSafe(join(xdir, xMatch));

  // Warn when name is given but no ground-truth file matches AND no explicit flag was supplied.
  if (name && !opts.transcript && !tMatch && tCandidates.length) {
    warnings.push(`⚠ no transcript matches component "${name}" (have: ${tCandidates.join(", ")}) — pass --transcript <file> or rename to pair.`);
  }
  if (name && !opts.xml && !xMatch && xCandidates.length) {
    warnings.push(`⚠ no XML matches component "${name}" (have: ${xCandidates.join(", ")}) — pass --xml <file> or rename to pair.`);
  }

  // No name at all → first candidate is the only sensible default (single-design project).
  if (!transcript && tCandidates.length) transcript = readJsonSafe(join(tdir, tCandidates[0]));
  if (!rawXml && xCandidates.length) rawXml = readFileSyncSafe(join(xdir, xCandidates[0]));

  return { transcript, rawXml, warnings };
}

/** Read a component's html/scss/ts from a directory (or explicit basename). */
function readComponent(dir, name) {
  const files = existsSync(dir) ? readdirSync(dir) : [];
  const pick = (ext) => {
    const match = files.find((f) => f.endsWith(`.component.${ext}`) && (!name || f.startsWith(name)));
    return match ? readFileSyncSafe(join(dir, match)) : "";
  };
  return { scss: pick("scss"), html: pick("html"), ts: pick("ts") };
}

/** Nearest ancestor (or self) holding a package.json — the project root whose `.sliceui/`
 *  holds this component's ground truth. Falls back to cwd when nothing is found above. */
function nearestProjectRoot(startDir) {
  let d = resolve(startDir);
  for (;;) {
    if (existsSync(join(d, "package.json"))) return d;
    const up = dirname(d);
    if (up === d) return process.cwd();
    d = up;
  }
}

function readFileSyncSafe(p) {
  try { return readFileSync(p, "utf8"); } catch { return ""; }
}
function readJsonSafe(p) {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)) ?? 0);
}
