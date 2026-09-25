// Vue 3 SFC codegen rules — version-aware Vue specifics for the slice prompt.
// Home of the Vue rule set. The generic dispatcher (src/lib/prompt-rules/frameworks.mjs)
// imports it the same way it imports ANGULAR_RULES from framework/angular/rules.mjs.
// The web-app copy (src/lib/prompts.ts) has only a one-line Vue rule set; these rules are
// NET-NEW to this skill — no upstream copy to keep in sync.

export const VUE_RULES = `SPECIFIC RULES (Vue 3 — Single-File Components, Composition API):
- SFC split: <template> + <script setup lang="ts"> + <style scoped> (lang per project styleExt: scss/less/css).
- Props/emits: defineProps<{...}>() / defineEmits<{...}>() with TypeScript types — NO Options API (data/methods) unless the project samples use it.
- Reactive state: ref()/reactive(); derived: computed(). Import from 'vue'.
- Events & binding: @click="handler", v-model for two-way binding, v-if/v-for with a required :key on v-for.
- Styling: <style scoped> with the project's style lang. To restyle a child/library component's internal DOM, use :deep(selector) — copy the reusable :deep blocks from conventions.md verbatim, never invent them.
- If a UI library is present (Element Plus / Vuetify / Naive UI / Ant Design Vue), use ITS components + theming tokens instead of raw HTML.
- If the project uses Tailwind, compose its utility classes (from @theme tokens) — do NOT invent new CSS classes.`;
