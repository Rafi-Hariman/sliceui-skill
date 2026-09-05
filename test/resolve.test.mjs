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

test("resolve: caret icon resolves by NAME (fa-caret-down), not color-first fa-search", () => {
  const transcript = {
    layout: [
      { id: "caret1", type: "icon", bg: "#03337b", description: "Icon_Font_Awesome_Free_Solid_C_caret-down" },
    ],
  };
  const r = resolveTranscript(transcript, CONVENTIONS);
  const icon = r.leaves.find((l) => l.kind === "icon");
  const vals = icon?.resolved?.map((x) => x.value) ?? [];
  assert.ok(vals.includes("fa-caret-down"), `caret name must resolve fa-caret-down, got ${JSON.stringify(vals)}`);
  assert.ok(!vals.includes("fa-search"), "caret must not be color-collapsed into fa-search");
});

test("resolve: eye icon nested under a Vector leaf inherits the FA name from its wrapper (not fa-search)", () => {
  // Real FIGML web-export shape: the FA glyph name sits on the INSTANCE wrapper (color-less);
  // the painted, colored leaf is its inner `Vector` child. The leaf must inherit the wrapper name.
  const transcript = {
    layout: [
      { id: "wrap", type: "icon", description: "Icon_Font_Awesome_Free_Solid_E_eye", children: [
        { id: "vec", type: "icon", description: "Vector", bg: "#03337b" },
      ]},
    ],
  };
  const r = resolveTranscript(transcript, CONVENTIONS);
  const icon = r.leaves.find((l) => l.id === "vec");
  assert.ok(icon, "the Vector leaf is the resolvable styled leaf");
  const vals = icon.resolved.map((x) => x.value);
  assert.ok(vals.includes("fa-eye"), `eye wrapper name must resolve fa-eye, got ${JSON.stringify(vals)}`);
  assert.ok(!vals.includes("fa-search"), "eye must NOT collapse to color-default fa-search");
});

test("resolve: pencil-alt icon nested under a Vector leaf inherits the FA name from its wrapper", () => {
  const transcript = {
    layout: [
      { id: "wrap", type: "icon", description: "Icon_Font_Awesome_Free_Solid_P_pencil-alt", children: [
        { id: "vec", type: "icon", description: "Vector", bg: "#03337b" },
      ]},
    ],
  };
  const r = resolveTranscript(transcript, CONVENTIONS);
  const icon = r.leaves.find((l) => l.id === "vec");
  const vals = icon?.resolved?.map((x) => x.value) ?? [];
  assert.ok(vals.includes("fa-pencil"), `pencil wrapper name must resolve fa-pencil, got ${JSON.stringify(vals)}`);
  assert.ok(!vals.includes("fa-search"), "pencil must NOT collapse to color-default fa-search");
});

test("resolve: ambiguous-color bare icon with NO name surfaces the family + a fallback, not a confident fa-search", () => {
  // #03337b is search/pencil/eye alike; a bare leaf (generic "Vector") carries no glyph signal,
  // so the resolver must NOT emit a confident single answer — it surfaces the family + a note
  // and leaves the pick to the action context (H1: honesty over false confidence).
  const transcript = {
    layout: [
      { id: "bare", type: "icon", description: "Vector", bg: "#03337b" },
    ],
  };
  const r = resolveTranscript(transcript, CONVENTIONS);
  const icon = r.leaves.find((l) => l.id === "bare");
  const vals = icon?.resolved?.map((x) => x.value) ?? [];
  assert.deepEqual(vals.sort(), ["fa-eye", "fa-pencil", "fa-search"], "ambiguous color surfaces the whole fa family");
  assert.ok(icon.fallback, "ambiguity must be flagged, not silent");
  assert.match(icon.fallback.note, /ambiguous/i);
});

test("resolve: unambiguous-color bare icon (single family) still resolves to that glyph", () => {
  const transcript = {
    layout: [
      { id: "check", type: "icon", description: "Vector", bg: "#4fbbbb" }, // single: fa-check-circle
    ],
  };
  const r = resolveTranscript(transcript, CONVENTIONS);
  const icon = r.leaves.find((l) => l.id === "check");
  const vals = icon?.resolved?.map((x) => x.value) ?? [];
  assert.ok(vals.includes("fa-check-circle"), `single-family color resolves its glyph, got ${JSON.stringify(vals)}`);
  assert.equal(icon.fallback, null, "no ambiguity → no fallback");
});

test("resolve: badge with status text 'Dibatalkan' → label-custom-cancel (text beats color co-occurrence)", () => {
  const vocab = [
    ...CONVENTIONS.classVocabulary,
    { name: "label-custom-cancel", family: "label-custom" },
    { name: "label-custom-warning", family: "label-custom" },
  ];
  const transcript = {
    layout: [
      { id: "badgeB", type: "group", bg: "#f6cacb", children: [
        { id: "iconB", type: "icon", bg: "#f44444" },
        { id: "txtB", type: "text", text: "Dibatalkan" },
      ]},
    ],
  };
  const r = resolveTranscript(transcript, { ...CONVENTIONS, classVocabulary: vocab });
  const status = r.statusTable[0];
  const classes = status.resolved.filter((x) => x.kind === "class").map((x) => x.value);
  assert.ok(classes.includes("label-custom-cancel"), `'Dibatalkan' text must pick cancel, got ${JSON.stringify(classes)}`);
});

test("resolve: button variant secondary → btn-secondary when in vocabulary", () => {
  const vocab = [
    ...CONVENTIONS.classVocabulary,
    { name: "btn-secondary", family: "btn", hint: "button" },
    { name: "btn-primary", family: "btn", hint: "button" },
  ];
  const transcript = {
    layout: [
      { id: "btn1", type: "button", text: "Ubah massal tgl akhir bayar", variant: "secondary" },
    ],
  };
  const r = resolveTranscript(transcript, { ...CONVENTIONS, classVocabulary: vocab });
  const btn = r.leaves.find((l) => l.kind === "button");
  const classes = btn?.resolved?.map((x) => x.value) ?? [];
  assert.ok(classes.includes("btn-secondary"), `variant secondary → btn-secondary, got ${JSON.stringify(classes)}`);
});

test("resolve: button variant with no matching btn-* falls back native-plain (not invented)", () => {
  const transcript = {
    layout: [{ id: "btn2", type: "button", text: "Kirim", variant: "ghost" }],
  };
  const r = resolveTranscript(transcript, CONVENTIONS); // no btn-ghost in vocab
  const btn = r.leaves.find((l) => l.kind === "button");
  assert.ok(btn.fallback?.kind === "native-plain", "unknown variant → native-plain fallback");
});
