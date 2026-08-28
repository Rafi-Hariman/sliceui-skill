// Per-framework generation rules.
// The 7 web-framework rule sets are PORTED VERBATIM from the SliceUI web app:
//   sliceui repo, src/lib/prompts.ts (getFrameworkRules) @ commit 42a83f6 (2026-08-27)
// Angular rules are NET-NEW for this skill (the web app has no Angular support).
// When updating rules here, note that src/lib/prompts.ts remains the canonical copy
// for the web app — keep the two in sync manually.

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

  // ---- NET-NEW (not in the web app) ----
  angular: `SPECIFIC RULES (Angular — version-aware, see project_context):
- File split: <name>.component.ts + <name>.component.html + <name>.component.scss (or .css per project styleExt).
- selector: '<prefix>-<name>' kebab-case with the project's selector prefix from project_context.
- Use templateUrl + styleUrls (NOT inline templates unless the project samples use inline).
- Register the component in the owning NgModule's declarations array (edit the module file).
- Template: use *ngIf / *ngFor / (click)="handler()" / [property]="value" — the classic directives, NOT @if/@for control flow.
- DI: inject services via the class constructor: constructor(private service: XService) {}. NOT inject().
- Inputs/Outputs: @Input() / @Output() + EventEmitter.
- Routing links: [routerLink], content projection with <ng-content>.
- Styling: SCSS with :host for host styles; reuse the project's SCSS tokens/variables.
- If uiLibrary is angular-material, prefer its modules/components (MatButtonModule etc.) and its theming tokens.
- NO signals, NO inject(), NO @if/@for control flow, NO standalone components, UNLESS the project context version says >= 14 (inject/standalone) or >= 17 (control flow).`,
};

/** Look up framework rules by id; "" when unknown. */
export function getFrameworkRules(frameworkId) {
  return FRAMEWORK_RULES[frameworkId] ?? "";
}
