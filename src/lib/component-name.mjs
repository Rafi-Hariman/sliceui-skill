// component-name — deterministic target-name normalization for verify (and future commands).
//
// PR 5 closes the PascalCase↔kebab-case gap: `verify <dir> TestingcomponentComponent` previously
// matched NO file (readComponent did `f.startsWith(name)` against `testingcomponent.component.ts`),
// returning "no component files found" — a false "invalid target" for a name the agent actually
// passed. Angular derives its file stem from the kebab-case class name, so a class name must
// normalize before it can match a filename.
//
// Pure and deterministic; no fs. Rejects path traversal and refuses to guess on ambiguity.

/** Accepted forms that all name the same target when unambiguous:
 *    billing-history            (kebab stem)
 *    BillingHistoryComponent    (Angular class)
 *    billing-history.component  (component basename)
 *    billing-history.component.ts (full filename)
 */
export function normalizeComponentName(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return { ok: false, reason: "empty name" };

  // 1. Reject path traversal and separators — a target is a bare name, never a path.
  if (/[\\/]/.test(raw) || raw === "." || raw === ".." || raw.includes("..")) {
    return { ok: false, reason: `path separators or traversal in name "${raw}"` };
  }

  // 2. Strip known suffixes deterministically: `.component.ts`, `.component`, `.ts`.
  let stem = raw.replace(/\.component\.(ts|html|scss|css)$/i, "")
                .replace(/\.component$/i, "")
                .replace(/\.ts$/i, "");

  // 3. Already kebab-case → pass through unchanged (the canonical stem).
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(stem)) {
    return { ok: true, stem, normalized: false };
  }

  // 4. Angular class name: PascalCase → kebab-case. Strip a trailing `Component` suffix first,
  //    then insert `-` before uppercase runs (leading acronym collapse: HTTPClient → http-client).
  const withoutSuffix = stem.replace(/Component$/, "");
  // A class name must look like a class: leading uppercase, no spaces, no already-kebab hyphens.
  if (!/^[A-Z][A-Za-z0-9]*$/.test(withoutSuffix)) {
    return { ok: false, reason: `"${raw}" is neither a kebab-case stem nor an Angular class name` };
  }
  const kebab = withoutSuffix
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
  return { ok: true, stem: kebab, normalized: true };
}

/** Resolve the exact file stem for a component directory, returning an ambiguity instead of a
 *  first-pick when multiple files share the normalized prefix. Pure (no fs) — the caller supplies
 *  the directory's file list. */
export function resolveComponentStem(files, inputName) {
  const norm = normalizeComponentName(inputName);
  if (!norm.ok) return norm;
  const stem = norm.stem;
  const matches = (files ?? []).filter((f) => f.startsWith(`${stem}.component.`) || f === `${stem}.component.ts`);
  // A filename like `foo.component.ts` vs `foo-bar.component.ts` must not collide: only accept an
  // EXACT stem prefix — `f.startsWith(stem + ".component.")` already guarantees the boundary.
  if (matches.length > 1) {
    return { ok: false, ambiguous: true, reason: `multiple component files match "${stem}": ${matches.join(", ")}`, matches };
  }
  return { ok: true, stem, matches, normalized: norm.normalized };
}
