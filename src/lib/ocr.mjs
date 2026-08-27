// Shared Swift Vision OCR — used by BOTH tiers.
// Tier 1 (Gemini) merges the OCR strings as an exact-text overlay on top of the
// vision transcript; tier 2 (static) uses them as the primary text source.
// Returns { ok, quality, boxes } — never throws.

import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const OCR_SWIFT = join(dirname(fileURLToPath(import.meta.url)), "..", "ocr", "ocr.swift");

/**
 * Run OCR on an image (any format sips reads; converted to PNG first when needed).
 * @param {string} imagePath
 * @returns {{ ok: boolean, quality: "ocr"|"unreadable", boxes: Array<{text:string,x:number,y:number,w:number,h:number}>, reason?: string }}
 */
export function runOcr(imagePath) {
  const tmpFiles = [];
  try {
    // 1. Vision reads PNG/JPEG best — convert non-PNG inputs via sips
    let png = imagePath;
    if (!/\.png$/i.test(imagePath)) {
      png = join(tmpdir(), `sliceui-ocr-in-${process.pid}-${Date.now()}.png`);
      execFileSync("sips", ["-s", "format", "png", imagePath, "--out", png], { stdio: "pipe" });
      tmpFiles.push(png);
    }

    // 2. compile + run the Vision OCR helper (single-shot per CLI invocation)
    const bin = join(tmpdir(), `sliceui-ocr-bin-${process.pid}-${Date.now()}`);
    tmpFiles.push(bin);
    execFileSync("swiftc", ["-o", bin, OCR_SWIFT], { stdio: "pipe" });
    const out = execFileSync(bin, [png], { stdio: "pipe", timeout: 30000 }).toString();
    const boxes = JSON.parse(out || "[]");
    if (!Array.isArray(boxes)) throw new Error("ocr output not an array");
    return { ok: true, quality: "ocr", boxes };
  } catch {
    return { ok: false, quality: "unreadable", boxes: [], reason: "sips-or-swift-unavailable" };
  } finally {
    for (const f of tmpFiles) rmSync(f, { force: true });
  }
}
