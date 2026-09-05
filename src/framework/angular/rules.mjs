// Angular codegen rules — version-aware Angular specifics for the slice prompt.
// Moved out of src/lib/prompt-rules/frameworks.mjs (which keeps the other 7 framework rule
// sets as the dispatcher). The web app copy (src/lib/prompts.ts) has no Angular support —
// these rules are NET-NEW to this skill, so there is no upstream copy to keep in sync.
// When updating, the only consumer is frameworks.mjs `getFrameworkRules("angular")`.

export const ANGULAR_RULES = `SPECIFIC RULES (Angular — version-aware, see project_context):
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
- NO signals, NO inject(), NO @if/@for control flow, NO standalone components, UNLESS the project context version says >= 14 (inject/standalone) or >= 17 (control flow).`;
