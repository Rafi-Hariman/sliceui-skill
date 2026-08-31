import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveTranscript } from "../src/lib/resolve.mjs";

const CONVENTIONS = {
  ngDeepCorpus: [
    { selector: "label-custom-waiting .fa-exclamation-circle", block: "::ng-deep .label-custom-waiting .fa-exclamation-circle { color: #bd3737 !important; }" },
    { selector: "label-custom-rejected .fa-times-circle", block: "::ng-deep .label-custom-rejected .fa-times-circle { color: #f44444; }" },
    { selector: "label-custom-belum-diverif .fa-exclamation-circle", block: "::ng-deep .label-custom-belum-diverif .fa-exclamation-circle { color: #bd3737; }" },
  ],
  classVocabulary: [
    { name: "label-custom-waiting", family: "label-custom" },
    { name: "label-custom-rejected", family: "label-custom" },
  ],
};

test("resolve: badge #fef2f2 + icon #f44444 → fa-exclamation-circle (NOT triangle)", () => {
  const transcript = {
    layout: [
      { id: "badge1", type: "group", bg: "#fef2f2", children: [
        { id: "icon1", type: "icon", bg: "#f44444" },
      ]},
    ],
  };
  const r = resolveTranscript(transcript, CONVENTIONS);
  assert.equal(r.statusTable.length, 1);
  const status = r.statusTable[0];
  const icons = status.resolved.filter((x) => x.kind === "icon").map((x) => x.value);
  assert.ok(icons.includes("fa-exclamation-circle"), "red #f44444 → fa-exclamation-circle, not triangle");
  assert.ok(!icons.includes("fa-exclamation-triangle"), "must NOT invent triangle");
});

test("resolve: label co-occurrence surfaces candidates, never guesses by bg alone", () => {
  const transcript = {
    layout: [
      { id: "badge1", type: "group", bg: "#fef2f2", children: [
        { id: "icon1", type: "icon", bg: "#f44444" },
      ]},
    ],
  };
  const r = resolveTranscript(transcript, CONVENTIONS);
  const status = r.statusTable[0];
  // The icon pairs with several labels → ambiguity surfaced, not silently guessed.
  assert.ok(status.candidates || status.resolved.some((x) => x.value.startsWith("label-custom-")),
    "label is resolved via co-occurrence, and ambiguity is surfaced");
});

test("resolve: OOV badge (no label-custom-* pairs icon) → native-plain fallback, not silent drop", () => {
  const transcript = {
    layout: [
      { id: "badge1", type: "group", bg: "#fef2f2", children: [
        { id: "icon1", type: "icon", bg: "#4fbbbb" }, // green check — not in the small corpus
      ]},
    ],
  };
  const r = resolveTranscript(transcript, CONVENTIONS);
  const status = r.statusTable[0];
  assert.ok(status.fallback, "OOV → fallback present (never silent drop)");
  assert.equal(status.fallback.kind, "native-plain");
});

test("resolve: bare icon resolves its color to the fa-* set", () => {
  const transcript = {
    layout: [
      { id: "caret", type: "icon", bg: "#03337b" },
    ],
  };
  const r = resolveTranscript(transcript, CONVENTIONS);
  const leaf = r.leaves.find((l) => l.id === "caret");
  assert.ok(leaf.resolved.some((x) => x.value.startsWith("fa-")), "blue icon → a fa-* glyph");
});

test("resolve: non-styled structural nodes are skipped", () => {
  const transcript = {
    layout: [
      { id: "text", type: "text", text: "Ubah tagihan" },
      { id: "frame", type: "group", children: [] },
    ],
  };
  const r = resolveTranscript(transcript, CONVENTIONS);
  assert.equal(r.leaves.length, 0, "text + empty group are not styled leaves");
});
