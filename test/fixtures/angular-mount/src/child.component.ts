import { Component } from "@angular/core";

// Minimal child component: the target of the ::ng-deep piercing assertion. The parent
// (under-test) styles `.child-internal` via `:host ::ng-deep`; emulated view encapsulation
// only lets that land here if piercing works across the child boundary.
@Component({
  selector: "app-child",
  template: `<span class="child-internal">child</span>`,
})
export class ChildComponent {}
