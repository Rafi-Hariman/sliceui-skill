// sliceui transcribe — orchestrator. Auto-detects input type:
//   .xml/.figml → FIGML parse (deterministic, exact, no key, instant)
//   image       → Gemini (tier 1) → static (tier 2) fallback
// Writes .sliceui/transcript/<name>.transcript.{md,json,meta.json}.

import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { transcribeWithGemini } from "./transcribe-gemini.mjs";
import { transcribeStatic } from "./transcribe-static.mjs";
import { parseFigml } from "../lib/figml-parse.mjs";
import { renderTranscript } from "../lib/render-transcript.mjs";

const XML_EXTS = new Set([".xml", ".figml"]);

function isXml(path) {
  return XML_EXTS.has(extname(path).toLowerCase());
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
    return { ok: true, transcript: r.transcript, tier: 0, source: "figml", notes: [] };
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

  const outDir = join(process.cwd(), ".sliceui", "transcript");
  mkdirSync(outDir, { recursive: true });
  const stem = basename(abs).replace(/\.(xml|figml|png|jpe?g|webp)$/i, "");
  const mdPath = join(outDir, `${stem}.transcript.md`);
  const jsonPath = join(outDir, `${stem}.transcript.json`);
  const metaPath = join(outDir, `${stem}.transcript.meta.json`);
  writeFileSync(jsonPath, JSON.stringify(result.transcript, null, 2) + "\n");
  writeFileSync(mdPath, renderTranscript(result.transcript));
  writeFileSync(metaPath, JSON.stringify({
    tier: result.tier,
    source: result.source,
    image: abs,
    degraded: Boolean(result.degraded),
    notes: result.notes,
  }, null, 2) + "\n");

  if (result.degraded) {
    process.stderr.write(
      "⚠ DEGRADED MODE — layout/color only, text unreadable (no OCR, likely non-macOS or no swiftc).\n" +
      "  Generated code will use placeholder copy. Add a Gemini key (`sliceui init --key-from <file>`) for full transcription.\n",
    );
  }

  console.log(JSON.stringify({
    ok: true,
    tier: result.tier,
    source: result.source,
    degraded: Boolean(result.degraded),
    out: mdPath,
    notes: result.notes.length ? result.notes : undefined,
  }, null, 2));
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit((await main(process.argv.slice(2))) ?? 0);
}
