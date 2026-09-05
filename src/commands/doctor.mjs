// sliceui doctor — diagnose the install before anything goes wrong.
// Turns every day-one silent-failure mode (PATH, platform, sips/swiftc, Gemini key,
// skill destination, model reachability) into a printed, actionable report.
// Exit 0 = everything the CLI needs is present; 1 = something is broken.
// NEVER prints the API key value — only its source.

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { resolveGeminiKey } from "../lib/env.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = JSON.parse(readFileSync(join(HERE, "..", "..", "package.json"), "utf8"));
// Skill dir is resolved per-call (not at module load, so tests can isolate): env → default.
function skillDirFor() {
  return process.env.SLICEUI_SKILL_DIR || join(homedir(), ".claude", "skills", "sliceui");
}

function checkNode() {
  const major = Number(process.versions.node.split(".")[0]);
  const need = PKG.engines?.node ?? ">=18";
  const ok = major >= 20;
  return { ok, label: `Node ${process.versions.node}`, detail: `engines: ${need} — ${ok ? "ok" : "Node 18 is EOL; use >=20"}` };
}

function checkPlatform() {
  const p = process.platform;
  const mac = p === "darwin";
  return {
    ok: true, // not a hard failure — just informational
    label: `Platform ${p}${mac ? "" : " (non-macOS)"}`,
    detail: mac
      ? "ok — sips/swiftc expected"
      : "⚠ static tier (sips+swiftc) unavailable on non-macOS; Gemini key required for full transcription",
    warn: !mac,
  };
}

function whichBin(name) {
  try {
    execFileSync(name, ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    try {
      execFileSync(name, ["-v"], { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }
}

function checkSips() {
  const ok = whichBin("sips");
  return { ok, label: "sips", detail: ok ? "found — static tier decode available" : "missing — static tier decode unavailable (macOS)" };
}

function checkSwiftc() {
  const ok = whichBin("swiftc");
  return { ok, label: "swiftc", detail: ok ? "found — OCR available" : "missing — OCR unavailable (macOS Swift)" };
}

function checkKey(cwd) {
  const { key, source } = resolveGeminiKey(cwd);
  // A missing key is NOT a hard failure: XML/FIGML input is parsed without any key, and the
  // screenshot path degrades to the static tier. Treat it as a warning (informational), not a
  // blocking "fix before generating" — doctor must not gate XML-only workflows on an optional key.
  const missing = !key;
  return {
    ok: !missing,
    warn: missing,
    label: `Gemini API key: ${key ? "found" : "NOT found"}`,
    detail: key
      ? `from ${source}`
      : "no key — XML/FIGML still transcribe exactly; screenshots fall back to the static tier. Add via `sliceui init --key-from <file>` or ~/.sliceui/.env.local",
  };
}

function checkSkillDir() {
  const skillDir = skillDirFor();
  const skill = join(skillDir, "SKILL.md");
  const ok = existsSync(skill);
  return {
    ok,
    label: `Skill installed: ${ok ? "yes" : "no"}`,
    detail: ok ? skill : `not found at ${skillDir} — run \`sliceui install\``,
  };
}

function checkSkillVersion() {
  const manifestPath = join(skillDirFor(), ".sliceui-cli-version");
  let installed;
  try {
    installed = readFileSync(manifestPath, "utf8").trim();
  } catch {
    return { ok: false, label: "Skill↔CLI version: unknown", detail: `no ${manifestPath} — re-run \`sliceui install\`` };
  }
  const ok = installed === PKG.version;
  return {
    ok,
    label: `Skill↔CLI version: ${ok ? "matched" : "mismatch"}`,
    detail: ok ? `skill built for CLI v${installed}` : `skill wants CLI v${installed}, running v${PKG.version} — run \`sliceui install\``,
  };
}

async function checkGeminiLive() {
  const { key } = resolveGeminiKey(process.cwd());
  if (!key) {
    return { ok: false, warn: true, label: "Gemini live call: skipped", detail: "no key — XML/FIGML + static tiers unaffected" };
  }
  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Reply OK" }] }], generationConfig: { maxOutputTokens: 8 } }),
        signal: controller.signal,
      },
    );
    clearTimeout(timer);
    const ok = res.status === 200;
    return {
      ok,
      label: `Gemini live call (${model}): ${ok ? "ok" : `HTTP ${res.status}`}`,
      detail: ok ? "model reachable" : "model unreachable or key invalid — transcription will fall back to static tier",
    };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, label: "Gemini live call: error", detail: String(err?.message ?? err).slice(0, 120) };
  }
}

export async function runDoctor(cwd) {
  const checks = [
    checkNode(),
    checkPlatform(),
    checkSips(),
    checkSwiftc(),
    checkKey(cwd),
    checkSkillDir(),
    checkSkillVersion(),
    await checkGeminiLive(),
  ];
  const hardFails = checks.filter((c) => !c.ok && !c.warn);
  const warns = checks.filter((c) => c.warn);
  return { checks, hardFails, warns, ok: hardFails.length === 0 };
}

export async function main(argv) {
  const cwd = process.cwd();
  const r = await runDoctor(cwd);

  const lines = [];
  for (const c of r.checks) {
    const prefix = c.ok ? (c.warn ? "⚠ " : "✅ ") : (c.warn ? "⚠ " : "❌ ");
    lines.push(`${prefix} ${c.label}`);
    lines.push(`   ${c.detail}`);
  }
  lines.push("");
  if (r.warns.length) lines.push(`⚠ ${r.warns.length} warning(s) — ${r.warns.map((w) => w.label).join("; ")}`);
  if (r.ok) {
    lines.push("✅ doctor: OK — SliceUI is ready to use.");
  } else {
    lines.push(`❌ doctor: ${r.hardFails.length} problem(s) found — fix above before generating.`);
  }
  console.log(lines.join("\n"));
  return r.ok ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit((await main(process.argv.slice(2))) ?? 0);
}
