// sliceui transcribe — Tier 1 command: Gemini vision → transcript.json.
// Composes gemini-client + transcribe-prompt + schema validation.

import { writeFileSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";
import { callGemini } from "../lib/gemini-client.mjs";
import { TRANSCRIBE_PROMPT } from "../lib/transcribe-prompt.mjs";
import { parseJsonLoose } from "../lib/parse-json.mjs";
import { validateTranscript, emptyTranscript } from "../lib/transcript-schema.mjs";

/** Transcribe an image with Gemini; returns { ok, transcript } | { ok:false, reason, message }. */
export async function transcribeWithGemini(imagePath, cwdDir) {
  const result = await callGemini(TRANSCRIBE_PROMPT, imagePath, cwdDir);
  if (!result.ok) return result;

  const parsed = parseJsonLoose(result.text);
  if (!parsed) return { ok: false, reason: "bad-json", message: "Gemini returned non-JSON output." };

  const transcript = emptyTranscript({
    source: "gemini-vision",
    tier: 1,
    image: basename(imagePath),
    width: Number.isFinite(parsed?.meta?.width) ? parsed.meta.width : null,
    height: Number.isFinite(parsed?.meta?.height) ? parsed.meta.height : null,
    model: "gemini-flash-latest",
    textQuality: "vision",
  });
  transcript.tokens = parsed.tokens ?? { colors: [], fonts: [] };
  transcript.layout = parsed.layout ?? [];
  transcript.images = parsed.images ?? [];
  transcript.icons = parsed.icons ?? [];

  const v = validateTranscript(transcript);
  if (!v.ok) {
    return { ok: false, reason: "invalid-schema", message: `Transcript failed schema validation: ${v.errors.join("; ").slice(0, 300)}` };
  }
  return { ok: true, transcript, keySource: result.keySource };
}

// ---------- CLI entry ----------

export async function main(argv) {
  const imagePath = argv[0];
  if (!imagePath) {
    console.error("usage: sliceui transcribe-gemini <image>");
    return 2;
  }
  const abs = imagePath.startsWith("/") ? imagePath : join(process.cwd(), imagePath);
  const result = await transcribeWithGemini(abs, process.cwd());
  if (!result.ok) {
    console.error(JSON.stringify(result, null, 2));
    return 3;
  }
  const outDir = join(process.cwd(), ".sliceui");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "transcript.json");
  writeFileSync(outPath, JSON.stringify(result.transcript, null, 2) + "\n");
  console.log(JSON.stringify({ ok: true, tier: 1, source: "gemini-vision", out: outPath, keySource: result.keySource }, null, 2));
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit((await main(process.argv.slice(2))) ?? 0);
}
