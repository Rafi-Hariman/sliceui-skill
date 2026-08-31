// referee — the two-headed ground-truth validator. Every artifact the agent trusts
// (project-context, conventions, transcript) is a LOSSY prediction about the codebase + XML;
// this module falsifies each claim against the two sources of truth:
//   head "xml"      — did the transcript preserve the design's visual attributes?
//   head "codebase" — does each convention claim trace to a REAL occurrence in the repo?
// Output is a red list (fail/stale) that IS the corruption map — no prose, deterministic.
//
// Priorities when sources disagree (locked by council): XML > transcript > corpus > conventions.md > hope.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import fg from "fast-glob";
import { computeFidelity } from "./fidelity.mjs";

const SKIP = ["**/node_modules/**", "**/dist/**", "**/.angular/**", "**/build/**", "**/.sliceui/**"];

/**
 * Validate all ground-truth artifacts.
 * @param {string} root — project root (for codebase-evidence scanning)
 * @param {object} ctx — project-context.json (detectProject output)
 * @param {string|null} xml — the raw FIGML XML (for XML-fidelity head)
 * @param {string} xmlFilename
 * @param {object|null} transcript — the parsed transcript (for mockRowsFloor + cell-html)
 * @returns {{ findings: Array<{head,artifact,claim,evidencePath,status,detail}>, pass: boolean }}
 */
export function refereeArtifacts(root, ctx, xml, xmlFilename, transcript = null) {
  const findings = [];

  // --- head 1: XML-fidelity (did transcript preserve the design) ---
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

  // --- head 2: codebase-evidence (do conventions claims trace to real code) ---
  const conv = ctx?.conventions ?? {};
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
  const xmlHasWell = xml ? /\bwell\b/i.test(xml) : null;
  const transcriptHasWell = transcript ? /\bwell\b/i.test(JSON.stringify(transcript)) : null;
  if (anatomy.wellAvailable) {
    const wellHtml = /(?:id|class)=["'][^"']*\bwell\b/i.test(html);
    // wellAvailable means "`.well` is a styling idiom this project uses" — a FACT about the
    // codebase, not an instruction to add a wrapper. As long as the codebase genuinely has it,
    // this passes. The "phantom well" danger (adding a wrapper the XML lacks) is now a
    // SEPARATE concern caught by verify's checkPhantomWrapper against the transcript — not by
    // the convention's mere existence.
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

  // mockRowsFloor — a sane positive MINIMUM (the codebase's own pages). It is a FLOOR, not the
  // slice total: verify computes max(floor, transcript total) per-slice. A 15 floor with a
  // transcript saying 20 is CORRECT (the slice needs 20, verify handles it), not corruption.
  if (anatomy.mockRowsFloor != null) {
    const transcriptTotal = paginationTotal(transcript);
    const sane = Number.isFinite(anatomy.mockRowsFloor) && anatomy.mockRowsFloor > 0;
    findings.push({
      head: "codebase",
      artifact: "conventions.componentAnatomy.mockRowsFloor",
      claim: "mockRowsFloor is a sane positive floor",
      evidencePath: transcript ? "transcript" : "src/**/*.html",
      status: sane ? "pass" : "fail",
      detail: `floor=${anatomy.mockRowsFloor} (transcript total ${transcriptTotal} handled by verify as max(floor, total))`,
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

  const red = findings.filter((x) => x.status === "fail" || x.status === "stale");
  return { findings, pass: red.length === 0, redCount: red.length };
}

function readFileSyncSafe(p) {
  try { return readFileSync(p, "utf8"); } catch { return ""; }
}

/** "Menampilkan 1-10 dari 20 data" → 20; 0 when absent. */
function paginationTotal(transcript) {
  let total = 0;
  const walk = (nodes) => {
    for (const n of nodes ?? []) {
      if (!n || typeof n !== "object") continue;
      const m = /(?:Menampilkan|Showing)\s+\d+\s*-\s*\d+\s+(?:dari|of)\s+(\d+)\s+data/i.exec(n.text ?? "");
      if (m) total = Math.max(total, Number(m[1]));
      if (n.children) walk(n.children);
    }
  };
  walk(transcript?.layout);
  return total;
}

/** Read the raw XML from .sliceui/xml/ (first .xml/.figml) when not supplied. */
export function readRawXmlFromSliceui(root) {
  const xdir = join(root, ".sliceui", "xml");
  if (!existsSync(xdir)) return { xml: null, name: null };
  const f = readdirSync(xdir).find((x) => /\.(xml|figml)$/i.test(x));
  return f ? { xml: readFileSyncSafe(join(xdir, f)), name: f } : { xml: null, name: null };
}
