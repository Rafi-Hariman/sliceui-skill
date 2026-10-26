// business-boundary — reject invented business behavior (doc 03 §9).
//
// Without an explicit user/project contract, generation must NOT invent an API endpoint, service,
// route target, modal target, query parameter, business workflow, or permission semantics beyond
// what rendering needs. The safe handler is `onAction(): void { /* TODO: wire action */ }`.
//
// This checker scans generated source for the markers of those inventions and returns findings;
// the implementation plan also carries a `forbiddenInventions` list the agent must honor.

export const FORBIDDEN_INVENTIONS = Object.freeze([
  { id: "navigation", label: "route/navigation", detect: /routerLink\b|router\.navigate|RouterModule|ActivatedRoute|Routes\s*=|\[routerLink\]/i },
  { id: "api", label: "API/HTTP service", detect: /HttpClient|http\.(get|post|put|delete)\(|fetch\(|axios|\.subscribe\(\s*[^)]*\.(get|post)\(/i },
  { id: "modal", label: "modal/dialog target", detect: /NgbModal|MatDialog|openModal|modalRef|ModalService|dialog\.open|modal\.open/i },
  { id: "query-param", label: "query parameter", detect: /queryParam|queryParams|searchParams|\.queryParams\b/i },
  { id: "workflow", label: "business workflow", detect: /approve\(|submit\(|process\(|workflow|stateMachine|transition\(/i },
  { id: "permission", label: "permission/guard", detect: /canActivate|AuthGuard|hasPermission|PermissionService|@Roles|roleGuard/i },
]);

/** The safe default action handler (no invented behavior). */
export function defaultActionHandler() {
  return `  onAction(): void {
    // TODO: wire action
  }`;
}

/**
 * Scan generated source for invented business behavior.
 * @param {{ html?: string, ts?: string, scss?: string }} source
 * @returns {{ violated: boolean, findings: Array<{ id: string, label: string, match: string }> }}
 */
export function checkInventedBusiness({ html = "", ts = "", scss = "" } = {}) {
  const findings = [];
  const htmlSrc = String(html ?? "");
  const tsSrc = String(ts ?? "");
  for (const rule of FORBIDDEN_INVENTIONS) {
    if (rule.detect.test(htmlSrc)) {
      findings.push({ id: rule.id, label: rule.label, match: rule.detect.exec(htmlSrc)[0] });
      continue;
    }
    if (rule.detect.test(tsSrc)) {
      findings.push({ id: rule.id, label: rule.label, match: rule.detect.exec(tsSrc)[0] });
    }
  }
  return { violated: findings.length > 0, findings };
}
