// parseJsonLoose — tolerant JSON extraction from LLM output.
// Handles: clean JSON, accidental markdown fences, and prose-wrapped JSON.

export function parseJsonLoose(text) {
  try {
    return JSON.parse(text);
  } catch {
    /* fall through */
  }
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      /* fall through */
    }
  }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(text.slice(first, last + 1));
    } catch {
      /* fall through */
    }
  }
  return null;
}
