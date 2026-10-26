// verification/runtime — runtime-visible-state verification (doc 04 §6).
//
// The design requires a visible runtime state (pagination footer). Its presence depends on the
// mounted component's state, not on source text — so it must be verified after mount. `domState` is
// measured in the browser: `{ paginationVisible: boolean, paginationText?: string }`.

export function verifyRuntime(check, domState = {}) {
  const visible = domState.paginationVisible === true;
  return {
    status: visible ? "pass" : "fail",
    expected: check.expected ?? { visible: true },
    actual: { visible },
    detail: visible ? "the designed pagination state rendered after mount" : "the designed pagination state is absent after mount — the runtime/mock state does not satisfy the visibility condition",
  };
}
