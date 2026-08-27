// sliceui transcribe — Tier 1 command: Gemini vision + OCR overlay → transcript.json.
// Gemini supplies the layout tree; Swift Vision OCR pins EXACT strings (vision models
// often garble visible text — OCR is the source of truth for copy).
// Composes gemini-client + transcribe-prompt + ocr + schema validation.

import { writeFileSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";
import { callGemini } from "../lib/gemini-client.mjs";
import { TRANSCRIBE_PROMPT } from "../lib/transcribe-prompt.mjs";
import { parseJsonLoose } from "../lib/parse-json.mjs";
import { runOcr } from "../lib/ocr.mjs";
import { validateTranscript, emptyTranscript } from "../lib/transcript-schema.mjs";

/** Transcribe an image with Gemini + OCR overlay; returns { ok, transcript } | { ok:false, reason, message }. */
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
    model: result.model || "gemini-3.6-flash",
    textQuality: "vision",
  });
  transcript.tokens = parsed.tokens ?? { colors: [], fonts: [] };
  transcript.layout = parsed.layout ?? [];
  transcript.images = parsed.images ?? [];
  transcript.icons = parsed.icons ?? [];

  // OCR overlay: pin exact strings onto matching text nodes (OCR > vision for copy fidelity).
  // Geometry match by center-point proximity, tolerant to Gemini's rough boxes.
  const ocr = runOcr(imagePath);
  if (ocr.ok && ocr.boxes.length) {
    const W = transcript.meta.width || 1;
    const H = transcript.meta.height || 1;
    let patched = 0;
    const walk = (nodes) => {
      for (const n of nodes) {
        if ((n.type === "text" || n.type === "button" || n.type === "input") && n.text) {
          const cx = ((n.x ?? 0) + (n.w ?? 0) / 2) / W;
          const cy = ((n.y ?? 0) + (n.h ?? 0) / 2) / H;
          const hit = nearestBox(ocr.boxes, cx, cy);
          if (hit && similarity(hit.text, n.text) > 0.3) {
            n.text = hit.text; // OCR string wins — exact copy beats vision's guess
            patched++;
          }
        }
        if (n.children?.length) walk(n.children);
      }
    };
    walk(transcript.layout);
    if (patched > 0) transcript.meta.textQuality = "vision+ocr";
    transcript.meta.ocrBoxes = ocr.boxes.length;
  }

  const v = validateTranscript(transcript);
  if (!v.ok) {
    return { ok: false, reason: "invalid-schema", message: `Transcript failed schema validation: ${v.errors.join("; ").slice(0, 300)}` };
  }
  return { ok: true, transcript, keySource: result.keySource };
}

// ---------- OCR overlay helpers ----------

/** Find the OCR box whose center is nearest a node's normalized center (within ~5%). */
function nearestBox(boxes, cx, cy) {
  let best = null;
  let bestDist = Infinity;
  for (const b of boxes) {
    const bx = (b.x + b.w / 2) / (b.nx || 1);
    const by = (b.y + b.h / 2) / (b.ny || 1);
    const d = (bx - cx) * (bx - cx) + (by - cy) * (by - cy);
    if (d < bestDist) {
      bestDist = d;
      best = b;
    }
  }
  return bestDist <= 0.05 ? best : null;
}

/** Cheap similarity 0..1 (bigram Jaccard) — is this OCR string close enough to overlay? */
function similarity(a, b) {
  const norm = (s) => String(s).toLowerCase().replace(/\s+/g, " ").trim();
  const A = norm(a);
  const B = norm(b);
  if (!A || !B) return 0;
  if (A === B) return 1;
  const grams = (s) => {
    const out = new Set();
    for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
    return out;
  };
  const ga = grams(A);
  const gb = grams(B);
  let inter = 0;
  for (const g of ga) if (gb.has(g)) inter++;
  return inter / Math.max(ga.size, gb.size);
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
