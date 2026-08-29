// Transcript schema — the shared contract between transcription tiers and the code-gen prompt.
// Tier 1 (gemini-vision) and Tier 2 (static) both emit this shape; the renderer turns it into
// the compact markdown block embedded in the generation prompt.

export const TRANSCRIPT_VERSION = 3;

export const LAYOUT_TYPES = [
  "nav", "hero", "section", "card", "footer", "text", "group",
  "button", "input", "image", "icon", "divider", "container",
];

/**
 * Validate a transcript object.
 * @param {any} t
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateTranscript(t) {
  const errors = [];
  if (!t || typeof t !== "object") return { ok: false, errors: ["transcript is not an object"] };

  if (t.version !== TRANSCRIPT_VERSION) errors.push(`version must be ${TRANSCRIPT_VERSION} (got ${JSON.stringify(t.version)})`);

  // --- meta ---
  const meta = t.meta;
  if (!meta || typeof meta !== "object") {
    errors.push("meta is missing or not an object");
  } else {
    if (!["gemini-vision", "static", "figml"].includes(meta.source)) {
      errors.push(`meta.source must be "gemini-vision", "static", or "figml" (got ${JSON.stringify(meta.source)})`);
    }
    if (![0, 1, 2].includes(meta.tier)) {
      errors.push(`meta.tier must be 0, 1, or 2 (got ${JSON.stringify(meta.tier)})`);
    }
    if (typeof meta.image !== "string" || !meta.image) errors.push("meta.image must be a non-empty string");
    if (meta.textQuality && !["vision", "ocr", "unreadable", "exact"].includes(meta.textQuality)) {
      errors.push(`meta.textQuality must be vision|ocr|unreadable|exact (got ${JSON.stringify(meta.textQuality)})`);
    }
  }

  // --- tokens ---
  const tokens = t.tokens;
  if (!tokens || typeof tokens !== "object") {
    errors.push("tokens is missing or not an object");
  } else {
    if (!Array.isArray(tokens.colors)) errors.push("tokens.colors must be an array");
    else for (const [i, c] of tokens.colors.entries()) {
      if (!c || typeof c !== "object") { errors.push(`tokens.colors[${i}] is not an object`); continue; }
      if (typeof c.hex !== "string" || !/^#[0-9a-fA-F]{6}$/.test(c.hex)) {
        errors.push(`tokens.colors[${i}].hex must be #rrggbb (got ${JSON.stringify(c.hex)})`);
      }
      if (typeof c.role !== "string") errors.push(`tokens.colors[${i}].role must be a string`);
    }
    if (tokens.fonts !== undefined && !Array.isArray(tokens.fonts)) errors.push("tokens.fonts must be an array when present");
  }

  // --- layout ---
  if (!Array.isArray(t.layout)) {
    errors.push("layout must be an array");
  } else {
    const walk = (nodes, path) => {
      for (const [i, n] of nodes.entries()) {
        const where = `${path}[${i}]`;
        if (!n || typeof n !== "object") { errors.push(`layout node ${where} is not an object`); continue; }
        if (typeof n.id !== "string" || !n.id) errors.push(`layout node ${where}.id must be a non-empty string`);
        if (!LAYOUT_TYPES.includes(n.type)) {
          errors.push(`layout node ${where}.type "${n.type}" is not one of ${LAYOUT_TYPES.join("|")}`);
        }
        for (const k of ["x", "y", "w", "h"]) {
          if (n[k] !== undefined && !Number.isFinite(n[k])) errors.push(`layout node ${where}.${k} must be a number`);
        }
        // v3: exact fill color of the node's container/box (#rrggbb), when the design sets one.
        if (n.bg !== undefined && (typeof n.bg !== "string" || !/^#[0-9a-f]{6}$/.test(n.bg))) {
          errors.push(`layout node ${where}.bg must be #rrggbb (got ${JSON.stringify(n.bg)})`);
        }
        // v3: node is hidden/not visible in the design (e.g. Figma visible="false").
        if (n.hidden !== undefined && typeof n.hidden !== "boolean") {
          errors.push(`layout node ${where}.hidden must be a boolean (got ${JSON.stringify(n.hidden)})`);
        }
        if (n.children !== undefined) {
          if (!Array.isArray(n.children)) errors.push(`layout node ${where}.children must be an array`);
          else walk(n.children, `${where}.children`);
        }
      }
    };
    walk(t.layout, "layout");
  }

  // --- images / icons (optional but shape-checked) ---
  if (t.images !== undefined && !Array.isArray(t.images)) errors.push("images must be an array when present");
  if (t.icons !== undefined && !Array.isArray(t.icons)) errors.push("icons must be an array when present");

  return { ok: errors.length === 0, errors };
}

/** A minimal valid transcript — the seed both tiers start from. */
export function emptyTranscript(meta) {
  return {
    version: TRANSCRIPT_VERSION,
    meta: { tier: 2, source: "static", textQuality: "unreadable", ...meta },
    tokens: { colors: [], fonts: [] },
    layout: [],
    images: [],
    icons: [],
  };
}
