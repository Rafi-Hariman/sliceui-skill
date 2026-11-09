// sliceui transcribe — orchestrator. Auto-detects input type:
//   .xml/.figml → FIGML parse (deterministic, exact, no key, instant)
//   image       → Gemini (tier 1) → static (tier 2) fallback
// Writes .sliceui/artifacts/<name>/transcript.{md,json,meta.json}.

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { transcribeWithGemini } from "./transcribe-gemini.mjs";
import { transcribeStatic } from "./transcribe-static.mjs";
import { parseFigml } from "../lib/figml-parse.mjs";
import { parseFigmlContract, normalizeFromTranscript } from "../lib/figml-contract.mjs";
import { renderTranscript } from "../lib/render-transcript.mjs";
import { computeFidelity } from "../lib/fidelity.mjs";
import { buildSliceIR } from "../design/slice-ir.mjs";
import { renderHierarchicalTranscript } from "../lib/render-hierarchical-transcript.mjs";

const XML_EXTS = new Set([".xml", ".figml"]);

function isXml(path) {
  return XML_EXTS.has(extname(path).toLowerCase());
}

/** Build the Phase-1 contract for a FIGML input. Best-effort: a contract failure must never
 *  block a slice, so it degrades to `null` and the transcript alone still carries the design. */
function buildContract(xml, imagePath, transcript) {
  try {
    const c = parseFigmlContract(xml, basename(imagePath));
    if (!c.ok) return { error: c.reason, message: c.message };
    return { ...c.doc, normalized: normalizeFromTranscript(transcript, c.doc) };
  } catch (err) {
    return { error: "contract-error", message: String(err?.message ?? err) };
  }
}

export async function transcribe(imagePath, cwdDir, { forceStatic = false } = {}) {
  // --- FIGML path (deterministic, primary) ---
  if (isXml(imagePath)) {
    let xml;
    try {
      xml = readFileSync(imagePath, "utf8");
    } catch {
      return { ok: false, reason: "read-error", message: `Cannot read ${imagePath}` };
    }
    const r = parseFigml(xml, imagePath);
    if (!r.ok) return r;
    // Fidelity: on the deterministic FIGML path, report how many visual attributes survived into
    // the transcript — the corruption signal `sliceui fidelity` exposes, surfaced on every slice.
    const fidelity = computeFidelity(xml, basename(imagePath));
    // Phase-1 contract (additive, never blocks): full-fidelity doc + diagnostics + minimal
    // normalized projection. Persisted as contract.json alongside transcript.* by
    // persistTranscript(). Existing transcript output is unchanged.
    const contract = buildContract(xml, imagePath, r.transcript);
    return { ok: true, transcript: r.transcript, tier: 0, source: "figml", fidelity, contract, notes: [] };
  }

  const notes = [];

  // --- Tier 1: Gemini vision ---
  if (!forceStatic) {
    const r1 = await transcribeWithGemini(imagePath, cwdDir);
    if (r1.ok) {
      return { ok: true, transcript: r1.transcript, tier: 1, source: "gemini-vision", notes };
    }
    notes.push(`tier1: ${r1.reason} — ${r1.message}`);
  } else {
    notes.push("tier1: skipped (--static)");
  }

  // --- Tier 2: static extraction ---
  const r2 = transcribeStatic(imagePath);
  if (r2.ok) {
    const degraded = r2.transcript.meta?.textQuality === "unreadable";
    return { ok: true, transcript: r2.transcript, tier: 2, source: "static", degraded, notes };
  }
  notes.push(`tier2: ${r2.reason} — ${r2.message}`);

  return { ok: false, reason: "all-tiers-failed", notes };
}

/** Persist a successful transcription into `.sliceui/artifacts/<stem>/` (json + md + meta).
 *  Shared by `transcribe` and `inspect` so the two never drift on the on-disk contract. Returns
 *  the output paths for callers that need them (e.g. `transcribe` prints the md path). */
export function persistTranscript(result, abs, cwdDir) {
  const stem = basename(abs).replace(/\.(xml|figml|png|jpe?g|webp)$/i, "");
  const outDir = join(cwdDir, ".sliceui", "artifacts", stem);
  mkdirSync(outDir, { recursive: true });
  const jsonPath = join(outDir, "transcript.json");
  const mdPath = join(outDir, "transcript.md");
  const metaPath = join(outDir, "transcript.meta.json");
  writeFileSync(jsonPath, JSON.stringify(result.transcript, null, 2) + "\n");
  writeFileSync(mdPath, renderTranscript(result.transcript));
  if (result.contract) {
    // Additive Phase-1 artifact (full-fidelity contract + diagnostics + normalized projection).
    // Never replaces transcript.json/md/meta — those stay byte-stable.
    writeFileSync(join(outDir, "contract.json"), JSON.stringify(result.contract, null, 2) + "\n");
  }
  writeFileSync(metaPath, JSON.stringify({
    tier: result.tier,
    source: result.source,
    image: abs,
    degraded: Boolean(result.degraded),
    notes: result.notes ?? [],
  }, null, 2) + "\n");
  return { outDir, jsonPath, mdPath, metaPath };
}

/** Parse the opt-in `--transcript-version <1|2>` flag. Returns { ok, version } or { ok:false }.
 *  Legacy (1) is the default; 2 is hierarchical transcript-v2. Invalid values fail loudly. */
function parseTranscriptVersion(argv) {
  const idx = argv.indexOf("--transcript-version");
  if (idx === -1) return { ok: true, version: 1 };
  const val = argv[idx + 1];
  if (val === undefined) return { ok: false, message: "usage: --transcript-version requires a value (1 or 2)" };
  if (val === "1") return { ok: true, version: 1 };
  if (val === "2") return { ok: true, version: 2 };
  return { ok: false, message: `Invalid transcript version "${val}" — supported: 1 (legacy), 2 (hierarchical)` };
}

/** Build SliceIR + transcript-v2 from a FIGML result. Best-effort; never touches legacy output. */
function writeTranscriptV2(result, outDir) {
  if (!result.contract || result.contract.error) {
    return { ok: false, message: "contract unavailable — cannot build SliceIR (the FIGML failed to parse into a contract)" };
  }
  try {
    const built = buildSliceIR(result.contract);
    if (!built.ok) return { ok: false, message: `${built.reason}: ${built.message}` };
    writeFileSync(join(outDir, "sliceir.json"), JSON.stringify(built.ir, null, 2) + "\n");
    const rendered = renderHierarchicalTranscript(built.ir, outDir);
    return { ok: true, ir: built.ir, dir: rendered.dir };
  } catch (err) {
    return { ok: false, message: String(err?.message ?? err) };
  }
}

export async function main(argv) {
  const forceStatic = argv.includes("--static");
  const tv = parseTranscriptVersion(argv);
  if (!tv.ok) {
    console.error(tv.message);
    return 2;
  }
  const args = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--transcript-version") { i++; continue; } // skip flag + its value
    if (argv[i] === "--static") continue;
    args.push(argv[i]);
  }
  const imagePath = args[0];
  if (!imagePath) {
    console.error("usage: sliceui transcribe <image> [--static] [--transcript-version 2]");
    return 2;
  }
  const abs = imagePath.startsWith("/") ? imagePath : join(process.cwd(), imagePath);
  const result = await transcribe(abs, process.cwd(), { forceStatic });

  // Guard: conventions are the codegen ground truth. Warn (don't refuse — standalone
  // screenshot transcription is still useful) if init hasn't produced them yet.
  const conventionsWarnings = checkConventions(process.cwd());

  if (!result.ok) {
    console.error(JSON.stringify(result, null, 2));
    return 3;
  }

  const { mdPath, outDir } = persistTranscript(result, abs, process.cwd());

  // Phase 2 opt-in: SliceIR + hierarchical transcript-v2 (never the default).
  let v2 = null;
  if (tv.version === 2) {
    v2 = writeTranscriptV2(result, outDir);
    if (!v2.ok) {
      console.error(`transcript-v2: ${v2.message}`);
      return 4;
    }
  }

  if (result.degraded) {
    process.stderr.write(
      "⚠ DEGRADED MODE — layout/color only, text unreadable (no OCR, likely non-macOS or no swiftc).\n" +
      "  Generated code will use placeholder copy. Add a Gemini key (`sliceui init --key-from <file>`) for full transcription.\n",
    );
  }
  if (conventionsWarnings.length) {
    process.stderr.write(conventionsWarnings.map((w) => "⚠ " + w).join("\n") + "\n");
  }

  // Fidelity: surfaced on every FIGML transcribe so the agent sees a dropped-attribute warning
  // without a separate `sliceui fidelity` command.
  const fidelity = result.fidelity;
  if (fidelity) {
    const pct = Math.round(fidelity.score * 100);
    console.log(`Fidelity: ${pct}% (${fidelity.preserved}/${fidelity.total} visual attributes preserved)`);
    if (fidelity.score < 0.9) {
      process.stderr.write(
        `⚠ FIDELITY ${pct}% — the transcript dropped visual attributes the design had. Inspect the layout before generating.\n`,
      );
    }
  }

  console.log(JSON.stringify({
    ok: true,
    tier: result.tier,
    source: result.source,
    degraded: Boolean(result.degraded),
    fidelity: fidelity ? { score: fidelity.score, preserved: fidelity.preserved, total: fidelity.total } : undefined,
    out: mdPath,
    transcriptVersion: v2 ? 2 : undefined,
    sliceir: v2 ? { schema: v2.ir.schemaVersion, dir: v2.dir } : undefined,
    notes: result.notes.length ? result.notes : undefined,
  }, null, 2));
  return 0;
}

/** Warn when conventions (from `sliceui init`) are missing or stale. Codegen depends on them. */
function checkConventions(cwdDir) {
  const warnings = [];
  const convJson = join(cwdDir, ".sliceui", "conventions.json");
  const ctxJson = join(cwdDir, ".sliceui", "project-context.json");
  if (!existsSync(convJson)) {
    warnings.push("No .sliceui/conventions.json — run `sliceui init` so generated code adapts to this codebase.");
    return warnings;
  }
  // Staleness: conventions.json records the inputHash it was generated from; the current
  // project-context.json should carry the same hash. A mismatch means the codebase changed.
  try {
    const conv = JSON.parse(readFileSync(convJson, "utf8"));
    if (existsSync(ctxJson)) {
      const ctx = JSON.parse(readFileSync(ctxJson, "utf8"));
      if (conv.inputHash && ctx.inputHash && conv.inputHash !== ctx.inputHash) {
        warnings.push("Conventions are stale (inputHash mismatch) — re-run `sliceui init` to refresh.");
      }
    }
  } catch {
    warnings.push("Unreadable .sliceui/conventions.json — re-run `sliceui init`.");
  }
  return warnings;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit((await main(process.argv.slice(2))) ?? 0);
}
