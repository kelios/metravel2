## 1. Shared shell and consumers

- [x] 1.1 Extend BottomSheet with backward-compatible keyboardAware, maxHeight-only panelStyle and modalContent; preserve swipe/touch/inset defaults (spec: Form actions and Modal lifecycle).
- [x] 1.2 Migrate report, quest share and five achievement sheets; preserve labels, states, APIs, scroll, nested presentation and modal toast ownership (spec: all requirements).
- [x] 1.3 Replace centered theme-paywall wrapper with sibling backdrop/card, preserving centred placement and actions (spec: Theme paywall scenario).

## 2. Regression controls and code review

- [x] 2.1 Add AST wrapper/noop guard under lint with passing/failing fixtures; adapt modal-feedback guard for BottomSheet aliases/modalContent while preserving transient report policy.
- [x] 2.2 Run targeted sheet/shell/guard Jest tests, lint and typecheck; preserve existing locales without new strings.
- [x] 2.3 Complete independent review-and-fix of the full task diff and code-review-gate before testing.

## 3. Testing and completion

- [ ] 3.1 After reviewed task-SHA publication/deploy according to #2434 workflow, collect production web 390/1440 Tab/Shift+Tab, Escape, backdrop, focus, nested lifecycle and feedback evidence.
- [ ] 3.2 On local iPhone 17 Pro iOS 26.5 simulator, collect Accessibility Inspector evidence of at least six report reasons, comment, submit/close, keyboard access and each migrated sheet; verify nested achievement close/reopen.
- [ ] 3.3 Collect Android TalkBack report navigation per Task Contract and record the device/runtime layer. iPad layout checks are optional risk checks.
- [ ] 3.4 Record each candidate's migration or centered exception and actual evidence in #2434; validate this change strictly and run openspec validate --all before archive.
