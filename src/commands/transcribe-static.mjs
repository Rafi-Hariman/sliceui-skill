// sliceui transcribe — Tier 2 (static fallback): image → transcript without any API key.
// Pipeline: sips → BMP → pure-JS decode → band/column extraction → Swift Vision OCR (optional).
// Degrades gracefully: missing sips/swiftc → textQuality "unreadable"; still emits structure + colors.

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { decodeBmp } from "../lib/bmp-decode.mjs";
import { extractColorsAndBands, bandColumns } from "../lib/static-extract.mjs";
import { runOcr } from "../lib/ocr.mjs";
import { validateTranscript, emptyTranscript } from "../lib/transcript-schema.mjs";

const ANALYSIS_MAX_EDGE = 512; // downscale for extraction speed; geometry scaled back up

/** Transcribe statically. Returns { ok, transcript } | { ok:false, reason, message }. */
export function transcribeStatic(imagePath) {
  const tmpFiles = [];
  try {
    // 1. decode to BMP via sips (any input sips reads: png/jpg/webp/tiff...)
    const bmpPath = join(tmpdir(), `sliceui-static-${process.pid}-${Date.now()}.bmp`);
    execFileSync("sips", ["-s", "format", "bmp", "-Z", String(ANALYSIS_MAX_EDGE), imagePath, "--out", bmpPath], { stdio: "pipe" });
    tmpFiles.push(bmpPath);
    const img = decodeBmp(readFileSync(bmpPath));

    // 2. colors + bands
    const { colors, bands } = extractColorsAndBands(img);
    const bgHex = colors.find((c) => c.role === "background")?.hex ?? null;

    // 3. OCR via the shared helper (Vision reads png; converts internally when needed)
    const ocr = runOcr(imagePath);

    // 4. build layout: bands → typed nodes with column children + OCR text
    const origEdge = originalEdge(imagePath);
    const scale = origEdge / Math.max(img.width, img.height);
    // OCR boxes live in original pixel space — pass original dims for relative matching
    const origW = Math.round(img.width * scale);
    const origH = Math.round(img.height * scale);
    const layout = buildLayout(bands, img, bgHex, ocr.boxes, scale, origW, origH);

    const transcript = emptyTranscript({
      source: "static",
      tier: 2,
      image: basename(imagePath),
      width: Math.round(img.width * scale),
      height: Math.round(img.height * scale),
      textQuality: ocr.quality,
    });
    transcript.tokens = {
      colors,
      fonts: [],
      spacing: { base: 8, gap: inferGap(bands) },
    };
    transcript.layout = layout;

    const v = validateTranscript(transcript);
    if (!v.ok) {
      return { ok: false, reason: "invalid-schema", message: `Static transcript failed validation: ${v.errors.join("; ")}` };
    }
    return { ok: true, transcript };
  } catch (err) {
    return { ok: false, reason: "static-failed", message: String(err?.message ?? err) };
  } finally {
    for (const f of tmpFiles) rmSync(f, { force: true });
  }
}

// ---------- layout building ----------

function buildLayout(bands, img, bgHex, ocrBoxes, scale, origW, origH) {
  const layout = [];
  bands.sort((a, b) => a.y - b.y);
  for (const [bi, band] of bands.entries()) {
    const cols = bandColumns(img, band, bgHex);
    const y = Math.round(band.y * scale);
    const h = Math.round(band.h * scale);
    const type = guessType(bi, bands.length, band, img.height);
    const children = cols.map((c, ci) => {
      const box = ocrBoxes.find(
        (b) => boxWithinRegion(b, c.x, band.y, c.w, band.h, img.width, img.height, origW, origH),
      );
      return {
        id: `b${bi}c${ci}`,
        type: box ? "text" : "group",
        x: Math.round(c.x * scale),
        y,
        w: Math.round(c.w * scale),
        h,
        ...(box ? { text: box.text } : {}),
      };
    });
    layout.push({
      id: `band${bi}`,
      type,
      x: 0,
      y,
      w: Math.round(img.width * scale),
      h,
      ...(children.length > 1 ? { children } : {}),
    });
  }
  return layout;
}

function guessType(bi, total, band, imgHeight) {
  const relY = band.y / imgHeight;
  const relH = band.h / imgHeight;
  if (bi === 0 && relY < 0.15 && relH < 0.2) return "nav";
  if (bi === total - 1 && relY > 0.85) return "footer";
  if (relH > 0.25) return "hero";
  if (relH > 0.1) return "section";
  return "group";
}

function boxWithinRegion(box, rx, ry, rw, rh, imgW, imgH, origW, origH) {
  // OCR boxes are in ORIGINAL pixel space (origW x origH); regions are in ANALYSIS space (imgW x imgH).
  // Compare relatively: normalize both to 0..1, with tolerance for OCR ascenders/descenders.
  const bx = box.x / origW;
  const by = box.y / origH;
  const rl = rx / imgW, rr = (rx + rw) / imgW, rt = ry / imgH, rb = (ry + rh) / imgH;
  const tol = 0.01;
  return bx >= rl - tol && bx <= rr + tol && by >= rt - tol && by <= rb + tol;
}

function inferGap(bands) {
  if (bands.length < 2) return 16;
  const gaps = [];
  const sorted = [...bands].sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(sorted[i].y - (sorted[i - 1].y + sorted[i - 1].h));
  }
  gaps.sort((a, b) => a - b);
  return Math.round(gaps[Math.floor(gaps.length / 2)]);
}

function originalEdge(imagePath) {
  try {
    const out = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", imagePath]).toString();
    const w = /pixelWidth: (\d+)/.exec(out)?.[1];
    const h = /pixelHeight: (\d+)/.exec(out)?.[1];
    return Math.max(Number(w), Number(h));
  } catch {
    return ANALYSIS_MAX_EDGE;
  }
}

// ---------- CLI entry ----------

export function main(argv) {
  const imagePath = argv[0];
  if (!imagePath) {
    console.error("usage: sliceui transcribe-static <image>");
    return 2;
  }
  const abs = imagePath.startsWith("/") ? imagePath : join(process.cwd(), imagePath);
  const result = transcribeStatic(abs);
  if (!result.ok) {
    console.error(JSON.stringify(result, null, 2));
    return 3;
  }
  const outDir = join(process.cwd(), ".sliceui");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "transcript.json");
  writeFileSync(outPath, JSON.stringify(result.transcript, null, 2) + "\n");
  console.log(JSON.stringify({ ok: true, tier: 2, source: "static", out: outPath }, null, 2));
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)) ?? 0);
}
