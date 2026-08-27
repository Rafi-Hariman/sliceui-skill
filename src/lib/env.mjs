// Minimal .env parser — no dotenv dependency.
// Supports KEY=VALUE lines, blank lines, and # comments. No quoting edge cases beyond simple quotes.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";

/**
 * Parse an env file's content into a flat object.
 * @param {string} content
 * @returns {Record<string, string>}
 */
export function parseEnvContent(content) {
  const out = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // strip simple surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

/**
 * Load env vars from a list of candidate file paths. Keys from earlier files win.
 * Missing files are skipped silently.
 * @param {string[]} paths
 * @returns {Record<string, string>}
 */
export function loadEnvFiles(paths) {
  const merged = {};
  for (const p of paths) {
    try {
      const content = readFileSync(p, "utf8");
      for (const [k, v] of Object.entries(parseEnvContent(content))) {
        if (!(k in merged)) merged[k] = v;
      }
    } catch {
      // missing/unreadable file — skip
    }
  }
  return merged;
}

/**
 * Resolve the Gemini API key with precedence:
 * process.env.GEMINI_API_KEY → process.env.VITE_GEMINI_API_KEY →
 * <cwd>/.env.local → ~/.sliceui/.env.local (GEMINI_API_KEY or VITE_GEMINI_API_KEY).
 * @param {string} cwd
 * @returns {{ key: string | null, source: string | null }}
 */
export function resolveGeminiKey(cwd) {
  if (process.env.GEMINI_API_KEY) {
    return { key: process.env.GEMINI_API_KEY, source: "process.env.GEMINI_API_KEY" };
  }
  if (process.env.VITE_GEMINI_API_KEY) {
    return { key: process.env.VITE_GEMINI_API_KEY, source: "process.env.VITE_GEMINI_API_KEY" };
  }
  const fileEnvs = loadEnvFiles([
    `${cwd}/.env.local`,
    `${homedir()}/.sliceui/.env.local`,
  ]);
  if (fileEnvs.GEMINI_API_KEY) {
    return { key: fileEnvs.GEMINI_API_KEY, source: ".env.local:GEMINI_API_KEY" };
  }
  if (fileEnvs.VITE_GEMINI_API_KEY) {
    return { key: fileEnvs.VITE_GEMINI_API_KEY, source: ".env.local:VITE_GEMINI_API_KEY" };
  }
  return { key: null, source: null };
}
