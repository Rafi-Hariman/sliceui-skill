// transcript.json → transcript.md — the compact text block the code-gen prompt embeds.
// Non-vision models parse this reliably because it is flat, labeled, and positional.

/**
 * @param {object} transcript — validated transcript object
 * @returns {string} markdown
 */
export function renderTranscript(t) {
  const lines = [];
  const meta = t.meta ?? {};
  lines.push(`# UI Transcript`);
  lines.push("");
  lines.push(`- Source: ${meta.source ?? "?"} (tier ${meta.tier ?? "?"})`);
  lines.push(`- Image: ${meta.image ?? "?"}${meta.width ? ` — ${meta.width}x${meta.height}px` : ""}`);
  lines.push(`- Text quality: ${meta.textQuality ?? "unknown"}`);
  lines.push("");

  // --- tokens ---
  lines.push(`## Design tokens`);
  lines.push("");
  const colors = t.tokens?.colors ?? [];
  if (colors.length) {
    lines.push(`Colors:`);
    for (const c of colors) {
      lines.push(`- ${c.role}: ${c.hex}${c.share !== undefined ? ` (${Math.round(c.share * 100)}%)` : ""}`);
    }
  } else {
    lines.push(`Colors: none detected.`);
  }
  const fonts = t.tokens?.fonts ?? [];
  if (fonts.length) {
    lines.push("");
    lines.push(`Fonts:`);
    for (const f of fonts) {
      lines.push(`- ${f.role}: ${f.family ?? "sans-serif"} ${f.weight ?? 400}${f.size ? ` ${f.size}px` : ""}`);
    }
  }
  const spacing = t.tokens?.spacing;
  if (spacing) {
    lines.push("");
    lines.push(`Spacing: base ${spacing.base ?? "?"}px, gap ${spacing.gap ?? "?"}px`);
  }
  lines.push("");

  // --- layout tree ---
  lines.push(`## Layout (top → bottom, left → right)`);
  lines.push("");
  lines.push("```");
  const walk = (nodes, depth) => {
    for (const n of nodes) {
      const pad = "  ".repeat(depth);
      const geom = n.x !== undefined ? ` [${n.x},${n.y} ${n.w}x${n.h}]` : "";
      const bg = n.bg ? ` bg:${n.bg}` : "";
      const axis = n.axis ? ` (${n.axis})` : "";
      const table = n.table ? ` [TABLE]` : "";
      const radius = n.radius ? ` r:${n.radius}` : "";
      const gap = n.gap ? ` gap:${n.gap}` : "";
      const padStr = n.padding ? ` pad:${n.padding.top}/${n.padding.right}/${n.padding.bottom}/${n.padding.left}` : "";
      const align = n.align ? ` align:${n.align}` : "";
      let text = "";
      if (n.type === "text" || n.type === "button") {
        text = n.text ? ` "${n.text}"` : "";
      }
      const style = n.style ? styleSummary(n.style) : "";
      lines.push(`${pad}${n.type}#${n.id}${geom}${bg}${axis}${table}${radius}${gap}${padStr}${align}${text}${style}`);
      if (n.children?.length) walk(n.children, depth + 1);
    }
  };
  walk(t.layout ?? [], 0);
  lines.push("```");
  lines.push("");

  // --- images / icons ---
  const images = t.images ?? [];
  if (images.length) {
    lines.push(`## Images (placeholder)`);
    lines.push("");
    for (const img of images) {
      lines.push(`- ${img.alt ?? "image"} [${img.x ?? "?"},${img.y ?? "?"} ${img.w ?? "?"}x${img.h ?? "?"}] — render as gray placeholder`);
    }
    lines.push("");
  }
  const icons = t.icons ?? [];
  if (icons.length) {
    lines.push(`## Icons`);
    lines.push("");
    for (const ic of icons) {
      lines.push(`- ${ic.description ?? "icon"} [${ic.x ?? "?"},${ic.y ?? "?"} ${ic.w ?? "?"}x${ic.h ?? "?"}]`);
    }
    lines.push("");
  }

  // --- notes ---
  if (meta.textQuality === "unreadable") {
    lines.push(`> ⚠ Text unreadable — substitute plausible copy matching the layout, or ask the user for exact text.`);
    lines.push("");
  }
  if (meta.textQuality === "ocr") {
    lines.push(`> ℹ Text via OCR — verify exact wording with the user if the copy matters.`);
    lines.push("");
  }
  if (meta.textQuality === "vision+ocr") {
    lines.push(`> ✅ Strings are OCR-pinned (exact) — trust the "quoted" text over your own reading of any image.`);
    lines.push("");
  }
  if (meta.source === "figml") {
    lines.push(`> ✅ Source: FIGML (Figma XML) — text, colors, and geometry are EXACT. Trust them verbatim. No placeholders.`);
    lines.push("");
  }

  return lines.join("\n");
}

function styleSummary(style) {
  const parts = [];
  if (style.size) parts.push(`${style.size}px`);
  if (style.weight && style.weight !== 400) parts.push(`w${style.weight}`);
  if (style.color) parts.push(style.color);
  if (style.bg) parts.push(`bg:${style.bg}`);
  if (style.radius) parts.push(`r${style.radius}`);
  if (style.lineHeight) parts.push(`lh${style.lineHeight}`);
  if (style.letterSpacing) parts.push(`ls${style.letterSpacing}`);
  if (style.variant) parts.push(style.variant);
  return parts.length ? ` {${parts.join(" ")}}` : "";
}
