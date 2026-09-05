// Per-framework generation rules — the shared dispatcher.
// The 7 web-framework rule sets are PORTED VERBATIM from the SliceUI web app:
//   sliceui repo, src/lib/prompts.ts (getFrameworkRules) @ commit 42a83f6 (2026-08-27)
// The Angular rules (NET-NEW to this skill) live in src/framework/angular/rules.mjs — their
// home is the framework folder, not this generic dispatcher.
// When updating the ported rules, src/lib/prompts.ts remains the canonical copy — keep in sync.

import { ANGULAR_RULES } from "../../framework/angular/rules.mjs";

export const FRAMEWORK_RULES = {
  tailwind: `SPECIFIC RULES:
- Plain HTML fragment. Tailwind utility classes only.
- No <style> block. For custom hex not in Tailwind, use inline style only for that value.`,

  "react-tsx": `SPECIFIC RULES:
- React functional component with TypeScript.
- Name it based on dominant type (HeroSection, NavBar, CardGrid, etc).
- Use className not class. Tailwind for styling. Export as default.`,

  "vue-sfc": `SPECIFIC RULES:
- Vue 3 SFC with <template>, <script setup lang='ts'>, <style scoped>.
- Composition API. Tailwind classes in template.`,

  bootstrap5: `SPECIFIC RULES:
- Plain HTML. Bootstrap 5 class names only.
- Use container/row/col-* grid. Bootstrap utility classes (d-flex, gap-*, etc).`,

  "native-html": `SPECIFIC RULES:
- Semantic HTML5 with <style> block at top.
- CSS custom properties for colors (--color-primary, --color-bg, etc).
- CSS Grid or Flexbox for layout. Zero framework dependencies.`,

  nextjs: `SPECIFIC RULES:
- Next.js App Router component. Add 'use client' only if has onClick/useState.
- Prefer Server Component. Use next/image for images. Tailwind. Export default.`,

  svelte: `SPECIFIC RULES:
- Svelte 5 component with runes ($state, $derived).
- <script lang='ts'>. Tailwind classes.`,

  angular: ANGULAR_RULES, // home: src/framework/angular/rules.mjs
};

/** Look up framework rules by id; "" when unknown. */
export function getFrameworkRules(frameworkId) {
  return FRAMEWORK_RULES[frameworkId] ?? "";
}
