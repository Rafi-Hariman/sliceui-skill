// sliceui verify — deterministic fidelity + conventions gate for a generated component.
// Reads the component files (html/scss/ts) and their ground truth (conventions.json +
// transcript + raw XML) and prints a structured verdict. Exit 0 = all checks pass.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { verifyComponent } from "../framework/angular/verify.mjs";
import { loadPilar } from "../lib/pilar-loader.mjs";

export async function main(argv) {
  const dir = argv[0] ? resolve(argv[0]) : process.cwd();
  const name = argv[1] ?? null; // optional component basename (e.g. "history-agreement")

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
  const transcript = readTranscript(root, name);
  const rawXml = readRawXml(root, name);

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

  return result.pass ? 0 : 1;
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

/** Read the transcript paired to this component: prefer the one whose meta.image / filename
 *  names the component (stamp-and-pair), else the first `.transcript.json`. */
function readTranscript(cwdDir, name = null) {
  const tdir = join(cwdDir, ".sliceui", "transcript");
  if (!existsSync(tdir)) return null;
  const candidates = readdirSync(tdir).filter((f) => f.endsWith(".transcript.json") && !f.endsWith(".meta.json"));
  if (!candidates.length) return null;
  if (name) {
    const stem = candidates.find((f) => f.startsWith(`${name}.`));
    if (stem) return readJsonSafe(join(tdir, stem));
  }
  return readJsonSafe(join(tdir, candidates[0]));
}

/** Read the raw XML/figml paired to this component (prefer a filename that names it). */
function readRawXml(cwdDir, name = null) {
  const xdir = join(cwdDir, ".sliceui", "xml");
  if (!existsSync(xdir)) return null;
  const candidates = readdirSync(xdir).filter((f) => /\.(xml|figml)$/i.test(f));
  if (!candidates.length) return null;
  if (name) {
    const stem = candidates.find((f) => f.startsWith(`${name}.`));
    if (stem) return readFileSyncSafe(join(xdir, stem));
  }
  return readFileSyncSafe(join(xdir, candidates[0]));
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
