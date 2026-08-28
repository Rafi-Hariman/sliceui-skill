import { test } from "node:test";
import assert from "node:assert/strict";
import { validateTranscript, emptyTranscript, TRANSCRIPT_VERSION } from "../src/lib/transcript-schema.mjs";

test("emptyTranscript produces a valid transcript", () => {
  const t = emptyTranscript({ image: "hero.png" });
  const v = validateTranscript(t);
  assert.equal(v.ok, true, v.errors.join("; "));
  assert.equal(t.version, TRANSCRIPT_VERSION);
  assert.equal(t.meta.source, "static");
});

test("a valid tier-1 transcript passes", () => {
  const t = emptyTranscript({ source: "gemini-vision", tier: 1, image: "hero.png", textQuality: "vision" });
  t.tokens = {
    colors: [{ role: "background", hex: "#0f172a", share: 0.61 }],
    fonts: [{ role: "heading", family: "sans-serif", weight: 700, size: 48 }],
    spacing: { base: 8, gap: 16 },
  };
  t.layout = [
    { id: "nav", type: "nav", x: 0, y: 0, w: 1440, h: 64, bg: "#0f172a", children: [
      { id: "logo", type: "text", text: "Acme" },
    ] },
  ];
  const v = validateTranscript(t);
  assert.equal(v.ok, true, v.errors.join("; "));
});

test("rejects a missing layout array", () => {
  const t = emptyTranscript({ image: "x.png" });
  t.layout = undefined;
  const v = validateTranscript(t);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => e.includes("layout")));
});

test("rejects a bad color hex", () => {
  const t = emptyTranscript({ image: "x.png" });
  t.tokens.colors = [{ role: "text", hex: "not-a-color", share: 0.5 }];
  const v = validateTranscript(t);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => e.includes("hex")));
});

test("rejects an unknown layout type", () => {
  const t = emptyTranscript({ image: "x.png" });
  t.layout = [{ id: "a", type: "waffle" }];
  const v = validateTranscript(t);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => e.includes("waffle")));
});

test("allows duplicate node ids (Figma reuses instance ids legitimately)", () => {
  const t = emptyTranscript({ image: "x.png" });
  t.layout = [
    { id: "a", type: "text" },
    { id: "a", type: "text" },
  ];
  const v = validateTranscript(t);
  assert.equal(v.ok, true, "duplicate ids are allowed");
});
