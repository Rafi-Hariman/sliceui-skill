// walk-nodes — shared depth-first walker over a transcript layout tree.
// Was duplicated verbatim in framework/angular/verify.mjs and lib/resolve.mjs (and a THIRD,
// structurally different walker in figml-parse.mjs is a FIGML-specific parser, NOT this — it
// stays local). Single home for the shared "visit every layout node (recursing children)".

/** Visit every node in a layout tree depth-first, applying `fn`. Skips non-objects. */
export function walkNodes(nodes, fn) {
  for (const n of nodes ?? []) {
    if (!n || typeof n !== "object") continue;
    fn(n);
    if (n.children) walkNodes(n.children, fn);
  }
}
