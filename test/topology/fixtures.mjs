// Synthetic FIGML fixtures for the design-intent (Prompt A) tests.
//
// These exercise topology families the real field export (mahasiswa-tarif) does not cover — GRID,
// OVERLAY, mixed FIXED/FILL/HUG, sibling ratios 1:1:1 / 1:1, hidden actions — with NEUTRAL labels.
// No private project text, ids, dimensions, or selectors are hardcoded anywhere in the compiler;
// these are just geometry generators the tests feed through the same `ingestDesign` pipeline.

/** Wrap child XML in a root frame. */
export function doc(root, childrenXml) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<?figml version="1.0"?>
<frame id="${root.id}" name="${root.name ?? "Root"}" x="0" y="0" width="${root.w ?? 1200}" height="${root.h ?? 800}" layoutMode="${root.mode ?? "VERTICAL"}" type="FRAME">
  <children>
${childrenXml}
  </children>
</frame>`;
}

/** A <Frame> container. */
export function frame(id, { name, x = 0, y = 0, w = 0, h = 0, mode, sizingH, sizingV, grow, alignPrimary, alignCounter, positioning, spacing, children = "" } = {}) {
  return `    <Frame id="${id}" name="${name ?? id}" x="${x}" y="${y}" width="${w}" height="${h}"${mode ? ` layoutMode="${mode}"` : ""}${sizingH ? ` layoutSizingHorizontal="${sizingH}"` : ""}${sizingV ? ` layoutSizingVertical="${sizingV}"` : ""}${grow != null ? ` layoutGrow="${grow}"` : ""}${alignPrimary ? ` primaryAxisAlignItems="${alignPrimary}"` : ""}${alignCounter ? ` counterAxisAlignItems="${alignCounter}"` : ""}${positioning ? ` layoutPositioning="${positioning}"` : ""}${spacing != null ? ` itemSpacing="${spacing}"` : ""} type="FRAME">${children ? `\n      <children>\n${children}\n      </children>\n    </Frame>` : `</Frame>`}`;
}

/** A <Text> leaf. */
export function text(id, { name, x = 0, y = 0, w = 0, h = 0, chars = "", color = "#111111" } = {}) {
  return `      <Text id="${id}" name="${name ?? id}" x="${x}" y="${y}" width="${w}" height="${h}" characters="${chars}" type="TEXT"><fills><fill blendMode="NORMAL" color="${color}" /></fills></Text>`;
}

/** An <Instance> leaf (button/field/icon) with an optional absolutely-positioned override. */
export function instance(id, { name, x = 0, y = 0, w = 0, h = 0, positioning, mode, grow, sizingH, alignPrimary, children = "" } = {}) {
  return `    <Instance id="${id}" name="${name ?? id}" x="${x}" y="${y}" width="${w}" height="${h}"${positioning ? ` layoutPositioning="${positioning}"` : ""}${mode ? ` layoutMode="${mode}"` : ""}${grow != null ? ` layoutGrow="${grow}"` : ""}${sizingH ? ` layoutSizingHorizontal="${sizingH}"` : ""}${alignPrimary ? ` primaryAxisAlignItems="${alignPrimary}"` : ""} type="INSTANCE">${children ? `\n      <children>\n${children}\n      </children>\n    </Instance>` : `</Instance>`}`;
}

// ---------- specific fixtures ----------

/** A 2×3 GRID of cards (two rows, three columns), not a vertical stack. */
export function gridFixture() {
  const cards = [];
  let id = 0;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      cards.push(frame(`card${id}`, { x: c * 320, y: r * 220, w: 300, h: 200, children: text(`card${id}t`, { x: 0, y: 0, w: 300, h: 20, chars: `Card ${id}` }) }));
      id++;
    }
  }
  return doc({ id: "gridroot", w: 1000, h: 500 }, cards.join("\n"));
}

/** An OVERLAY: a badge absolutely positioned at the top-right of a card. */
export function overlayFixture() {
  const badge = instance("badge", { name: "Notification_dot", x: 260, y: 0, w: 40, h: 40, positioning: "ABSOLUTE" });
  return doc({ id: "ovroot", w: 400, h: 300 },
    frame("card", { x: 0, y: 0, w: 300, h: 200, children: `${text("cardtitle", { x: 0, y: 0, w: 300, h: 20, chars: "Title" })}\n${badge}` }));
}

/** A REPEATED list: three same-height items stacked vertically. */
export function repeatedFixture() {
  const items = [];
  for (let i = 0; i < 3; i++) {
    items.push(frame(`item${i}`, { x: 0, y: i * 60, w: 400, h: 50, children: text(`item${i}t`, { x: 0, y: 0, w: 200, h: 20, chars: `Item ${i}` }) }));
  }
  return doc({ id: "reproot", w: 400, h: 200 }, frame("list", { x: 0, y: 0, w: 400, h: 150, children: items.join("\n") }));
}

/** A LINEAR row of four equal FILL fields + an END-aligned action. */
export function linearFilterFixture() {
  const fields = [];
  for (let i = 0; i < 3; i++) {
    fields.push(instance(`field${i}`, { name: "Field", x: i * 210, y: 0, w: 200, h: 60, mode: "VERTICAL", grow: 1, sizingH: "FILL" }));
  }
  const action = instance("action", { name: "Button", x: 630, y: 0, w: 200, h: 60, sizingH: "FILL" });
  return doc({ id: "linroot", w: 840, h: 80 }, frame("filters", { x: 0, y: 0, w: 830, h: 60, mode: "HORIZONTAL", spacing: 10, children: `${fields.join("\n")}\n${action}` }));
}

/** A row with an END-aligned action (the action is pinned to the right edge). */
export function endAlignedActionFixture() {
  return doc({ id: "endroot", w: 600, h: 80 },
    frame("toolbar", { x: 0, y: 0, w: 600, h: 60, mode: "HORIZONTAL", alignPrimary: "SPACE_BETWEEN", children: `${instance("left", { name: "Info", x: 0, y: 0, w: 100, h: 40 })}\n${instance("add", { name: "Button_Add", x: 500, y: 0, w: 100, h: 40 })}` }));
}

/** Mixed FIXED + FILL + HUG siblings in one horizontal row. */
export function mixedSizingFixture() {
  return doc({ id: "mixroot", w: 600, h: 80 },
    frame("row", { x: 0, y: 0, w: 600, h: 60, mode: "HORIZONTAL", spacing: 10, children:
      `${instance("fixed", { name: "Icon", x: 0, y: 0, w: 40, h: 40, sizingH: "FIXED" })}\n${instance("fill", { name: "Search", x: 50, y: 0, w: 460, h: 40, sizingH: "FILL", grow: 1 })}\n${instance("hug", { name: "Badge", x: 520, y: 0, w: 60, h: 40, sizingH: "HUG" })}` }));
}

/** A row with a hidden action icon (visible="false") that must be excluded from the surface. */
export function hiddenActionFixture() {
  return doc({ id: "hidroot", w: 400, h: 80 },
    frame("row", { x: 0, y: 0, w: 400, h: 60, mode: "HORIZONTAL", children:
      `${instance("vis", { name: "Button_Edit", x: 0, y: 0, w: 40, h: 40 })}\n${instance("hid", { name: "Button_Delete", x: 50, y: 0, w: 40, h: 40, children: text("hidover", { x: 0, y: 0, w: 40, h: 40 }) })}` }).replace("name=\"Button_Delete\"", "name=\"Button_Delete\" visible=\"false\""));
}

/** A two-column sibling pair (1:1) and a three-column pair (1:1:1), for ratio assertions. */
export function ratioFixture() {
  const row1 = frame("r1", { x: 0, y: 0, w: 600, h: 40, mode: "HORIZONTAL", children: `${instance("a", { name: "Field", x: 0, y: 0, w: 300, h: 40, sizingH: "FILL" })}\n${instance("b", { name: "Field", x: 300, y: 0, w: 300, h: 40, sizingH: "FILL" })}` });
  const row2 = frame("r2", { x: 0, y: 50, w: 600, h: 40, mode: "HORIZONTAL", children: `${instance("c", { name: "Field", x: 0, y: 0, w: 200, h: 40, sizingH: "FILL" })}\n${instance("d", { name: "Field", x: 200, y: 0, w: 200, h: 40, sizingH: "FILL" })}\n${instance("e", { name: "Field", x: 400, y: 0, w: 200, h: 40, sizingH: "FILL" })}` });
  return doc({ id: "ratroot", w: 600, h: 100 }, `${row1}\n${row2}`);
}
