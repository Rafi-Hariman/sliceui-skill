// snapshot — the `.sliceui` snapshot split + load helpers (PR 2: Snapshot Deduplication).
//
// PR 2 removes the two duplicate blobs the audit proved:
//   loadedClassRegistry  was byte-identical in project-context.json AND conventions.json
//   conventions           was byte-identical in project-context.json.conventions AND conventions.json
//
// Single-owner contract after PR 2:
//   project-context.json  = WHAT the project is (framework, paths, capabilities, tokens, samples)
//   conventions.json      = HOW this team writes (loadedClassRegistry, classVocabulary,
//                           ngDeepCorpus, anatomy, naming) — canonical owner
//
// This module centralizes the SPLIT (writer side) and the LOAD (reader side, with legacy
// fallback + conflict detection) so no command re-implements the old-vs-new format difference.

import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Duplicate fields removed from project-context.json (they live canonically in conventions.json). */
const SPLIT_FIELDS = ["loadedClassRegistry", "conventions"];

/**
 * Split a `detectProject()` ctx into the two artifacts.
 * @param {object} ctx — detectProject output (may carry the duplicate fields)
 * @returns {{ projectContext: object, conventions: object }}
 *   projectContext = ctx minus the duplicate fields; conventions = { ...conventions, loadedClassRegistry }
 */
export function splitProjectContext(ctx) {
  if (!ctx || typeof ctx !== "object") return { projectContext: ctx ?? {}, conventions: {} };
  const projectContext = { ...ctx };
  const conventions = {
    ...(ctx.conventions ?? {}),
    ...(ctx.loadedClassRegistry ? { loadedClassRegistry: ctx.loadedClassRegistry } : {}),
  };
  for (const f of SPLIT_FIELDS) delete projectContext[f];
  return { projectContext, conventions };
}

/** Read a JSON file, distinguishing absent from present-but-malformed (never throws). */
function readJsonWithPresence(p) {
  let raw;
  try { raw = readFileSync(p, "utf8"); } catch { return { present: false, data: null, malformed: false }; }
  try { return { present: true, data: JSON.parse(raw), malformed: false }; }
  catch { return { present: true, data: null, malformed: true }; }
}

/**
 * Load the canonical conventions snapshot, with legacy fallback and conflict detection.
 *
 * Canonical = `.sliceui/conventions.json`. Legacy = `.sliceui/project-context.json` carrying the
 * old duplicate fields (`conventions`, `loadedClassRegistry`) when the canonical file is missing
 * or incomplete. Policy: canonical wins; a conflict is flagged, never silently resolved; a
 * repository scan is NEVER performed as a fallback.
 *
 * Missing is EXPLICIT, never a truthy empty object: when neither the canonical file nor the
 * legacy location carries any convention data, `source` is `"none"` and `conventions` is `null`.
 * A present-but-empty canonical file (`{}`) is NOT missing — it is a valid canonical snapshot.
 *
 * @param {string} root — project root (holds `.sliceui/`)
 * @returns {{ conventions: object|null, source: "canonical"|"legacy"|"none", conflict: boolean, diagnostics: string[] }}
 */
export function loadConventionsSnapshot(root) {
  const convRes = readJsonWithPresence(join(root, ".sliceui", "conventions.json"));
  const ctxRes = readJsonWithPresence(join(root, ".sliceui", "project-context.json"));
  const diagnostics = [];
  let conflict = false;

  const conv = convRes.data && typeof convRes.data === "object" ? convRes.data : null;
  const ctx = ctxRes.data && typeof ctxRes.data === "object" ? ctxRes.data : null;

  if (convRes.malformed) {
    diagnostics.push("SUI-SNAPSHOT: conventions.json is malformed JSON — treating it as absent (not as an empty snapshot).");
  }

  let conventions = conv;
  let source = conventions ? "canonical" : "legacy";

  const legacyConventions = ctx?.conventions && typeof ctx.conventions === "object" ? ctx.conventions : null;
  const legacyLcr = ctx?.loadedClassRegistry;

  if (!conventions) {
    // conventions.json missing/invalid → legacy project-context.json.conventions + loadedClassRegistry.
    if (legacyConventions || legacyLcr) {
      conventions = { ...(legacyConventions ?? {}) };
      if (legacyLcr) conventions = { ...conventions, loadedClassRegistry: legacyLcr };
      source = "legacy";
    } else {
      // Truly missing: no canonical, no legacy. Return null so the verify gate fires.
      source = "none";
      conventions = null;
      diagnostics.push("SUI-SNAPSHOT-001: No conventions ground truth is available (missing .sliceui/conventions.json and legacy project-context.json conventions).");
      return { conventions, source, conflict, diagnostics };
    }
  }

  const canonLcr = conventions?.loadedClassRegistry;

  // loadedClassRegistry: canonical first, legacy fallback.
  if (!canonLcr && legacyLcr) {
    conventions = { ...conventions, loadedClassRegistry: legacyLcr };
    if (source === "canonical") {
      diagnostics.push("SUI-SNAPSHOT: loadedClassRegistry missing from conventions.json; using project-context.json (legacy). Re-run `sliceui init`.");
    }
  }

  // Conflict: canonical and legacy disagree → canonical wins + diagnostic.
  if (canonLcr && legacyLcr && JSON.stringify(canonLcr) !== JSON.stringify(legacyLcr)) {
    conflict = true;
    diagnostics.push("SUI-SNAPSHOT: conventions.json.loadedClassRegistry conflicts with project-context.json.loadedClassRegistry; using conventions.json (canonical). Re-run `sliceui init`.");
  }

  return { conventions, source, conflict, diagnostics };
}
