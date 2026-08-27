// Gemini REST client for tier-1 transcription.
// Mirrors the sliceui web app's api/convert.ts pattern (raw fetch, base64 inline_data).
// Key never hardcoded — always via resolveGeminiKey().

import { readFileSync, statSync, rmSync } from "node:fs";
import { join, extname } from "node:path";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { resolveGeminiKey } from "./env.mjs";

const GEMINI_MODEL = "gemini-flash-latest";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const MAX_EDGE_PX = 1536;
const MAX_BYTES = 1500000;
const TIMEOUT_MS = 90000;
const RETRIES = 3;
const BACKOFF_MS = [2000, 4000, 8000];

/** POST prompt+image to Gemini, return raw candidate text (or {ok:false,...}). */
export async function callGemini(prompt, imagePath, cwdDir) {
  const { key, source } = resolveGeminiKey(cwdDir);
  if (!key) {
    return { ok: false, reason: "no-key", message: "No GEMINI_API_KEY found (checked process.env, ./.env.local, ~/.sliceui/.env.local)." };
  }

  const prepared = prepareImage(imagePath);
  if (!prepared.data) {
    return { ok: false, reason: "read-error", message: `Cannot read image: ${imagePath}` };
  }

  const body = {
    contents: [{
      role: "user",
      parts: [
        { text: prompt },
        { inline_data: { mime_type: prepared.mimeType, data: prepared.data } },
      ],
    }],
    generationConfig: { maxOutputTokens: 8192, temperature: 0.2, responseMimeType: "application/json" },
  };

  let lastErr = null;
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.status === 429 || res.status >= 500) {
        lastErr = `HTTP ${res.status}`;
        if (attempt < RETRIES - 1) await sleep(BACKOFF_MS[attempt]);
        continue;
      }
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        return { ok: false, reason: "http-error", message: `Gemini HTTP ${res.status}: ${errText.slice(0, 300)}` };
      }
      const json = await res.json();
      const parts = json?.candidates?.[0]?.content?.parts ?? [];
      const text = parts.map((p) => p.text).filter(Boolean).join("");
      if (!text) return { ok: false, reason: "empty", message: "Gemini returned no candidate text." };
      return { ok: true, text, keySource: source };
    } catch (err) {
      clearTimeout(timer);
      if (err?.name === "AbortError") {
        return { ok: false, reason: "timeout", message: `Gemini request timed out after ${TIMEOUT_MS / 1000}s.` };
      }
      lastErr = String(err?.message ?? err);
      if (attempt < RETRIES - 1) await sleep(BACKOFF_MS[attempt]);
    }
  }
  return { ok: false, reason: "rate-limited", message: `Gemini failed after ${RETRIES} attempts: ${lastErr}` };
}

// ---------- image prep ----------

function prepareImage(imagePath) {
  const mimeType = mimeOf(extname(imagePath).toLowerCase());
  let bytes;
  try {
    bytes = readFileSync(imagePath);
  } catch {
    return { data: null };
  }
  const sizeOk = statSync(imagePath).size <= MAX_BYTES;
  const extOk = ["image/png", "image/jpeg", "image/webp"].includes(mimeType);
  if (sizeOk && extOk) {
    return { data: bytes.toString("base64"), mimeType };
  }
  // Resize via macOS sips to long edge 1536, jpeg q80.
  try {
    const tmp = join(tmpdir(), `sliceui-${process.pid}-${Date.now()}.jpg`);
    execFileSync("sips", ["-Z", String(MAX_EDGE_PX), "-s", "format", "jpeg", "-s", "formatOptions", "80", imagePath, "--out", tmp], { stdio: "pipe" });
    const resized = readFileSync(tmp);
    rmSync(tmp, { force: true });
    return { data: resized.toString("base64"), mimeType: "image/jpeg" };
  } catch {
    // no sips (Linux/CI) or resize failed — send raw if the type is acceptable
    if (extOk) return { data: bytes.toString("base64"), mimeType };
    return { data: null };
  }
}

function mimeOf(ext) {
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "";
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
