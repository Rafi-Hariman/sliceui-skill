// referee — the two-headed ground-truth validator. Every artifact the agent trusts
// (project-context, conventions, transcript) is a LOSSY prediction about the codebase + XML;
// this module falsifies each claim against the two sources of truth:
//   head "xml"      — did the transcript preserve the design's visual attributes?
//   head "codebase" — does each convention claim trace to a REAL occurrence in the repo?
// Output is a red list (fail/stale) that IS the corruption map — no prose, deterministic.
//
// Priorities when sources disagree (locked by council): XML > transcript > corpus > conventions.md > hope.
//
// PR 3 split:
//   codebaseEvidenceFindings — the repository-scanning head (well/cell-html/corpus/duplicates)
//     + snapshot-only convention checks (mockRowsFloor/app-shell). COLD/DEEP only.
//   liveRefereeFindings      — target-exists (bounded in hot, full glob in deep) + XML fidelity.
//   refereeArtifacts         — deep mode (legacy): codebase + live, full scan.
//   refereeHot               — hot mode: stored verdict codebase findings + live bounded checks.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import fg from "fast-glob";
import { computeFidelity } from "./fidelity.mjs";
import { loadConventionsSnapshot } from "./snapshot.mjs";

const SKIP = ["**/node_modules/**", "**/dist/**", "**/.angular/**", "**/build/**", "**/.sliceui/**"];

/** Resolve the conventions object for a referee run (in-memory ctx wins, else canonical file). */
function conventionsFor(ctx, root) {
  return ctx?.conventions ?? loadConventionsSnapshot(root).conventions ?? {};
}

// ---------- codebase-evidence head (repository scan — COLD/DEEP only) ----------

/**
 * The repository-scanning + snapshot-only codebase checks. Returns the findings that get stored
 * in the verdict, plus the evidence counts. Does NOT include target-exists or XML-fidelity
 * (those are live). No source bodies are retained — only selectors/paths/detail strings.
 */
export function codebaseEvidenceFindings(root, conv, ctx = {}) {
  const findings = [];

  // Scan the WHOLE repo (monorepo: real source lives under projects/, not just src/).
  const htmlFiles = fg.sync(["**/*.html"], { cwd: root, ignore: SKIP, absolute: true });
  const scssFiles = fg.sync(["**/*.scss", "**/*.css"], { cwd: root, ignore: SKIP, absolute: true });
  const html = htmlFiles.map((f) => readFileSyncSafe(f)).join("\n");
  const scss = scssFiles.map((f) => readFileSyncSafe(f)).join("\n");

  // componentAnatomy.wellAvailable — the DANGER is structural authority: if conventions.md
  // teaches "wrap in id=well" as an instruction but the design (XML) has no well, the agent
  // adds a phantom wrapper. The referee cross-checks: does the XML actually contain a well?
  // (user's single-source-of-truth principle — structure = XML, not convention).
  const anatomy = conv.componentAnatomy ?? {};
  if (anatomy.wellAvailable) {
    const wellHtml = /(?:id|class)=["'][^"']*\bwell\b/i.test(html);
    findings.push({
      head: "codebase",
      artifact: "conventions.componentAnatomy.wellAvailable",
      claim: "`.well` is a real styling idiom in this codebase",
      evidencePath: "**/*.html",
      status: wellHtml ? "pass" : "stale",
      detail: wellHtml
        ? "well found in templates — a valid idiom to apply when the design shows a container"
        : "wellAvailable claimed but not found in templates (stale claim)",
    });
  }

  // mockRowsFloor — an OPTIONAL project policy (config.json), not a SliceUI universal. `null`
  // (no policy) is valid and emits nothing; a configured floor must be a positive number. The
  // transcript's "dari N data" total is deliberately NOT used (report §6.5 — 513 literal rows
  // is non-idiomatic), so it is not corruption for a configured floor to differ from a
  // transcript total.
  if (anatomy.mockRowsFloor != null) {
    const sane = Number.isFinite(anatomy.mockRowsFloor) && anatomy.mockRowsFloor > 0;
    findings.push({
      head: "codebase",
      artifact: "conventions.componentAnatomy.mockRowsFloor",
      claim: "mockRowsFloor is a sane positive mock-row policy",
      evidencePath: "config.json",
      status: sane ? "pass" : "fail",
      detail: `policy=${anatomy.mockRowsFloor} (a configured project floor renders exactly this many mock rows)`,
    });
  }

  // cell-html — the label-in-table override. NOTE (verified): `.cell-html .label` exists ONLY
  // in hope-result (1×), NOT in the scholarship project at all. It is hope-author's own idiom,
  // not a project idiom that failed to mine. So this is NOT corruption — it's a difference
  // between the human reference and the codebase. Report as informational (pass) with a note.
  const hasCellHtml = /cell-html/i.test(scss);
  findings.push({
    head: "codebase",
    artifact: "conventions.ngDeepCorpus.cell-html",
    claim: "`.cell-html .label` is a project idiom",
    evidencePath: "**/*.scss",
    status: hasCellHtml ? "pass" : "info",
    detail: hasCellHtml
      ? "cell-html present in project SCSS"
      : "cell-html NOT in project — it is hope-author's own override, not a missing idiom (audit gap 4 reclassified)",
  });

  // ngDeepCorpus selectors — must trace to a real SCSS occurrence.
  const corpus = conv.ngDeepCorpus ?? [];
  const corpusUnverified = [];
  for (const c of corpus) {
    const token = (c.selector || "").split(/[^a-zA-Z0-9_-]+/).filter(Boolean).find((t) => /[-_]/.test(t) && t.length > 1);
    if (token && !scss.includes(token)) {
      corpusUnverified.push(c.selector);
    }
  }
  findings.push({
    head: "codebase",
    artifact: "conventions.ngDeepCorpus",
    claim: `${corpus.length} corpus selectors trace to real SCSS`,
    evidencePath: "src/**/*.scss",
    status: corpusUnverified.length ? "fail" : "pass",
    detail: corpusUnverified.length
      ? `${corpusUnverified.length} unverified: ${corpusUnverified.slice(0, 5).join(", ")}`
      : `${corpus.length} verified`,
  });

  // sampleComponents — app shell is a bad idiom sample (matches collectSelectors' exclusion).
  const samples = ctx?.sampleComponents ?? [];
  const appShellSamples = samples.filter((s) => /app\.component\.ts$/.test(s.path || ""));
  if (appShellSamples.length) {
    findings.push({
      head: "codebase",
      artifact: "project-context.sampleComponents",
      claim: "sample components are feature components, not the app shell",
      evidencePath: appShellSamples.map((s) => s.path).join(", "),
      status: "fail",
      detail: "app.component.ts is the app shell, not a feature idiom",
    });
  }

  // Duplicate selectors across declared components — a silent, dangerous hazard: Angular does NOT
  // error on two components sharing a selector (routing instantiates by class), so a duplicate is a
  // latent bug that only surfaces when both are used in one view (2026-09-10 C2).
  const { duplicates: duplicateSelectors, totalFiles } = findDuplicateSelectors(root);
  if (duplicateSelectors.length) {
    findings.push({
      head: "codebase",
      artifact: "component selectors",
      claim: "every component selector is unique",
      evidencePath: duplicateSelectors.map((d) => d.selector).join(", "),
      status: "fail",
      detail: `duplicate selector(s): ${duplicateSelectors.map((d) => `${d.selector} (${d.files.length}×)`).join(", ")}`,
      duplicates: duplicateSelectors,
    });
  }

  const evidence = {
    filesConsidered: htmlFiles.length + scssFiles.length + totalFiles,
    selectorsChecked: totalFiles,
    conventionClaimsChecked: corpus.length,
    duplicateSelectors: duplicateSelectors.map((d) => d.selector),
  };

  return { findings, evidence };
}

// ---------- live head (no scan, or bounded target) ----------

/**
 * The live checks: target-exists (bounded in hot, repo-wide glob in deep) + XML fidelity.
 * These always run against the CURRENT state — never answered from a stored verdict.
 */
export function liveRefereeFindings(ctx, conv, xml, xmlFilename, transcript = null, target = null, { deep = false } = {}) {
  const findings = [];

  // --- target-exists (STOP gate — a component already has front-end code) ---
  // When the agent names the slice target (`--target <name>`), check whether the component
  // ALREADY exists before any write. Hot mode uses the BOUNDED componentDir lookup only (one
  // file); deep mode adds the repo-wide fallback glob.
  if (target) {
    const root = ctx?.cwd ?? process.cwd();
    const tsPath = deep ? locateTargetTs(root, ctx, target) : locateTargetTsBounded(root, ctx, target);
    if (tsPath) {
      const ts = readFileSyncSafe(tsPath);
      const mode = classifyComponentMode(ts);
      const lines = ts.split("\n").length;
      const sliceuiGenerated = /^\/\/ Generated by SliceUI/m.test(ts);
      if (sliceuiGenerated) {
        findings.push({
          head: "codebase",
          artifact: "component target",
          claim: `"${target}" is a NEW component (does not already exist)`,
          evidencePath: tsPath,
          status: "pass",
          detail: `SliceUI-generated (first-line marker) — safe to regenerate; overwrite is expected (${mode}, ~${lines} lines).`,
          mode,
          sliceuiGenerated: true,
        });
      } else {
        findings.push({
          head: "codebase",
          artifact: "component target",
          claim: `"${target}" is a NEW component (does not already exist)`,
          evidencePath: tsPath,
          status: "fail",
          detail: `ALREADY EXISTS (${mode}, ~${lines} lines). STOP — ask the user: overwrite / merge (keep .ts API) / skip.`,
          mode,
        });
      }
    }
  }

  // --- XML-fidelity (did transcript preserve the design) ---
  if (xml) {
    const f = computeFidelity(xml, xmlFilename || "design.xml");
    findings.push({
      head: "xml",
      artifact: "transcript",
      claim: "visual attributes preserved",
      evidencePath: xmlFilename,
      status: f.score >= 0.9 ? "pass" : "fail",
      detail: `${Math.round(f.score * 100)}% (${f.preserved}/${f.total}); dropped=${f.droppedNodes}`,
    });
    const badAttrs = Object.entries(f.byAttr).filter(([, s]) => s.expected && s.preserved < s.expected);
    for (const [attr, s] of badAttrs) {
      findings.push({
        head: "xml",
        artifact: "transcript",
        claim: `attribute "${attr}" fully preserved`,
        evidencePath: xmlFilename,
        status: "fail",
        detail: `${s.preserved}/${s.expected} preserved`,
      });
    }
  }

  return findings;
}

// ---------- result assembly ----------

/** F12: classify every red finding as slice-blocking vs repo-preexisting. */
function buildResult(findings) {
  const red = findings.filter((x) => x.status === "fail" || x.status === "stale");
  const blockingRed = red.filter((f) => isSliceBlocking(f));
  return {
    findings: findings.map((f) => ({ ...f, blocking: isSliceBlocking(f) })),
    pass: blockingRed.length === 0,
    redCount: red.length,
    blockingRedCount: blockingRed.length,
  };
}

/** Is a red finding the slice's own fault (STOP) vs the repo's pre-existing debt (report only)? */
function isSliceBlocking(f) {
  // A target that already has code is a STOP gate; a transcript that dropped design attributes
  // is a slice-ground-truth defect. Everything else is repo/conventions quality.
  return (f.artifact === "component target" && f.status === "fail")
    || (f.head === "xml" && f.status === "fail");
}

// ---------- entry points ----------

/**
 * DEEP mode (legacy + `--deep` + init's cold-path scan): full codebase evidence + live checks.
 * @returns {{ findings, pass, redCount, blockingRedCount }}
 */
export function refereeArtifacts(root, ctx, xml, xmlFilename, transcript = null, target = null) {
  const conv = conventionsFor(ctx, root);
  const codebase = codebaseEvidenceFindings(root, conv, ctx);
  const live = liveRefereeFindings(ctx, conv, xml, xmlFilename, transcript, target, { deep: true });
  return buildResult([...live, ...codebase.findings]);
}

/**
 * HOT mode: stored verdict codebase findings + live bounded checks. `verdict` is the parsed
 * stored verdict (from assessRefereeVerdict). No repository-wide scan.
 */
export function refereeHot(verdict, ctx, xml, xmlFilename, transcript = null, target = null) {
  const conv = conventionsFor(ctx, ctx?.cwd ?? process.cwd());
  const live = liveRefereeFindings(ctx, conv, xml, xmlFilename, transcript, target, { deep: false });
  return buildResult([...live, ...(verdict?.findings ?? [])]);
}

/** Scan every `.component.ts` for `selector: '…'`; return any selector claimed by >1 file. */
function findDuplicateSelectors(root) {
  const tsFiles = fg.sync(["**/*.component.ts"], { cwd: root, ignore: SKIP, absolute: true });
  const bySelector = new Map();
  for (const f of tsFiles) {
    const src = readFileSyncSafe(f);
    const sel = /selector\s*:\s*['"]([^'"]+)['"]/.exec(src)?.[1];
    if (!sel) continue;
    if (!bySelector.has(sel)) bySelector.set(sel, []);
    bySelector.get(sel).push(f);
  }
  const duplicates = [...bySelector.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([selector, files]) => ({ selector, files }));
  return { duplicates, totalFiles: tsFiles.length };
}

function readFileSyncSafe(p) {
  try { return readFileSync(p, "utf8"); } catch { return ""; }
}

/** Bounded target lookup: only `componentDir/<stem>.component.ts` — a single file, never a glob. */
function locateTargetTsBounded(root, ctx, target) {
  if (!target) return null;
  const stems = new Set([target, classNameToFileStem(target)]);
  const cd = ctx?.componentDir ?? "src/app";
  for (const stem of stems) {
    if (!stem) continue;
    const direct = join(root, cd, `${stem}.component.ts`);
    if (existsSync(direct)) return direct;
  }
  return null;
}

/** Locate `<name>.component.ts` for a target: prefer componentDir, then a repo-wide search.
 *
 *  The target is accepted in EITHER of the two names an agent actually has in hand:
 *    - the basename an Angular component file derives from (`testingcomponent` → `testingcomponent.component.ts`), or
 *    - the PascalCase class name (`TestingcomponentComponent`) — which must be normalized to the
 *      kebab-case file stem before it can match a filename.
 *  The 2026-09-24 field session passed the CLASS name, so the file was never found and the
 *  target-exists STOP gate stayed inert (silently green) — exactly the false-green R1 forbids. */
function locateTargetTs(root, ctx, target) {
  if (!target) return null;
  const stems = new Set([target, classNameToFileStem(target)]);
  const cd = ctx?.componentDir ?? "src/app";
  for (const stem of stems) {
    if (!stem) continue;
    const direct = join(root, cd, `${stem}.component.ts`);
    if (existsSync(direct)) return direct;
    const hits = fg.sync([`**/${stem}.component.ts`], { cwd: root, ignore: SKIP, absolute: true });
    if (hits.length) return hits[0];
  }
  return null;
}

/** `TestingcomponentComponent` → `testingcomponent`. Angular's file-naming convention derives the
 *  component file from the kebab-case class stem: strip a trailing `Component` suffix, then insert
 *  a `-` before each uppercase run (handling leading acronym runs so `HTTPClientComponent` →
 *  `http-client`). A name already kebab-case passes through unchanged. */
export function classNameToFileStem(target) {
  const s = String(target ?? "");
  if (!s || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)) return s; // already a kebab-case stem
  const withoutSuffix = s.replace(/Component$/, "");
  const kebab = withoutSuffix
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
  return kebab || s.toLowerCase();
}

/** Classify an existing component as "mock data" vs "real API" by its .ts contents. */
function classifyComponentMode(ts) {
  // Real API: HTTP client, service injection, or direct HTTP verbs.
  if (/HttpClient|\.(get|post|put|delete|patch)\s*\(|ApiService|Service\s*[;)]|Observable|BehaviorSubject/.test(ts)) {
    return "real API";
  }
  // Mock/hardcoded: mock/dummy/fixture markers, or literal arrays + no HTTP.
  if (/mock|dummy|fixture|hardcod|faker|\bconst\s+\w+\s*=\s*\[/.test(ts)) {
    return "mock data";
  }
  return "static/simple";
}

/** Read the raw XML from .sliceui/inputs/xml/ (first .xml/.figml) when not supplied. */
export function readRawXmlFromSliceui(root) {
  const xdir = join(root, ".sliceui", "inputs", "xml");
  if (!existsSync(xdir)) return { xml: null, name: null };
  const f = readdirSync(xdir).find((x) => /\.(xml|figml)$/i.test(x));
  return f ? { xml: readFileSyncSafe(join(xdir, f)), name: f } : { xml: null, name: null };
}
