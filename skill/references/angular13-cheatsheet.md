# Angular 13 Cheatsheet (module-based)

Angular 13 is **before** the big syntax changes. Generated code must match it exactly.

| Concept | Angular ≤13 (use this) | Angular 14+ | Angular 17+ |
|---|---|---|---|
| Component | `@Component` + **NgModule** registration | standalone (optional) | standalone common |
| Dependency injection | `constructor(private svc: FooService) {}` | `inject()` | `inject()` |
| Control flow | `*ngIf` / `*ngFor` | `*ngIf` / `*ngFor` | `@if` / `@for` |
| Refs | `@ViewChild('x')` | `@ViewChild` | signal queries |
| State | plain class props | signals (optional) | signals |

## Component skeleton (Angular 13)

```ts
// hero.component.ts
import { Component, Input, Output, EventEmitter } from "@angular/core";

@Component({
  selector: "app-hero",
  templateUrl: "./hero.component.html",
  styleUrls: ["./hero.component.scss"],
})
export class HeroComponent {
  @Input() title = "";
  @Output() cta = new EventEmitter<void>();
}
```

```html
<!-- hero.component.html -->
<section class="hero">
  <h1>{{ title }}</h1>
  <button *ngIf="showCta" (click)="cta.emit()">Get started</button>
</section>
```

```scss
// hero.component.scss
:host {
  display: block;
}
.hero {
  background: var(--color-bg, #0f172a);
}
```

## Registration (app.module.ts)

```ts
import { NgModule } from "@angular/core";
import { HeroComponent } from "./features/hero/hero.component";

@NgModule({
  declarations: [HeroComponent],   // ← register new components here
  imports: [/* CommonModule, MatButtonModule, … */],
  exports: [HeroComponent],
})
export class AppModule {}
```

## Rules to follow

1. `selector` = `<project-prefix>-<kebab-name>` (read prefix from `.sliceui/project-context.json`).
2. `templateUrl` + `styleUrls` — match the sample components' pattern (inline vs external).
3. `*ngIf`/`*ngFor`, never `@if`/`@for`. Events via `(click)`, links via `[routerLink]`.
4. DI in the `constructor`, never `inject()`.
5. Styling: SCSS, `:host` for host styles, reuse `$tokens` (SCSS vars) or `--css-vars`.
6. If `uiLibrary === "angular-material"`, import Material modules (`MatButtonModule`, `MatCardModule`, …) in the owning NgModule.
