import { test } from "node:test";
import assert from "node:assert/strict";
import { renderTranscript } from "../src/lib/render-transcript.mjs";

function transcript() {
  return {
    version: 3,
    meta: { source: "figml", tier: 0, image: "x.xml", width: 100, height: 100, textQuality: "exact" },
    tokens: { colors: [], fonts: [], spacing: { base: 12, gap: 10 } },
    layout: [
      {
        id: "card",
        type: "group",
        x: 0,
        y: 0,
        w: 400,
        h: 200,
        radius: 8,
        padding: { top: 16, right: 20, bottom: 16, left: 20 },
        gap: 10,
        children: [
          { id: "t", type: "text", x: 0, y: 0, w: 100, h: 24, text: "Judul", style: { size: 14, weight: 500, color: "#000000", lineHeight: 20 } },
        ],
      },
    ],
    images: [],
    icons: [],
  };
}

test("renders radius/padding/gap from node fields (the double-drop fix)", () => {
  const md = renderTranscript(transcript());
  assert.ok(md.includes("r:8"), "radius printed from node.radius");
  assert.ok(md.includes("gap:10"), "gap printed");
  assert.ok(md.includes("pad:16/20/16/20"), "padding printed as t/r/b/l");
});

test("renders lineHeight in the style summary", () => {
  const md = renderTranscript(transcript());
  assert.ok(md.includes("lh20"), "lineHeight in style summary");
});

test("renders the spacing tokens block for the figml path", () => {
  const md = renderTranscript(transcript());
  assert.ok(md.includes("Spacing: base 12px, gap 10px"), "spacing tokens block present");
});
