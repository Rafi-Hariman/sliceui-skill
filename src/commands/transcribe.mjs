// sliceui transcribe — orchestrator: Gemini (tier 1) → static (tier 2) fallback.
// Always transcribes (design decision: never assume the agent's model can see images).
// Writes .sliceui/transcript.json + transcript.md + transcript-meta.json.

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { transcribeWithGemini } from "./transcribe-gemini.mjs";
import { transcribeStatic } from "./transcribe-static.mjs";
import { renderTranscript } from "../lib/render-transcript.mjs";

export async function transcribe(imagePath, cwdDir, { forceStatic = false } = {}) {
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
    return { ok: true, transcript: r2.transcript, tier: 2, source: "static", notes };
  }
  notes.push(`tier2: ${r2.reason} — ${r2.message}`);

  return { ok: false, reason: "all-tiers-failed", notes };
}

export async function main(argv) {
  const forceStatic = argv.includes("--static");
  const args = argv.filter((a) => a !== "--static");
  const imagePath = args[0];
  if (!imagePath) {
    console.error("usage: sliceui transcribe <image> [--static]");
    return 2;
  }
  const abs = imagePath.startsWith("/") ? imagePath : join(process.cwd(), imagePath);
  const result = await transcribe(abs, process.cwd(), { forceStatic });

  if (!result.ok) {
    console.error(JSON.stringify(result, null, 2));
    return 3;
  }

  const outDir = join(process.cwd(), ".sliceui");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "transcript.json"), JSON.stringify(result.transcript, null, 2) + "\n");
  writeFileSync(join(outDir, "transcript.md"), renderTranscript(result.transcript));
  writeFileSync(join(outDir, "transcript-meta.json"), JSON.stringify({
    tier: result.tier,
    source: result.source,
    image: abs,
    notes: result.notes,
  }, null, 2) + "\n");

  console.log(JSON.stringify({
    ok: true,
    tier: result.tier,
    source: result.source,
    out: join(outDir, "transcript.md"),
    notes: result.notes.length ? result.notes : undefined,
  }, null, 2));
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit((await main(process.argv.slice(2))) ?? 0);
}
