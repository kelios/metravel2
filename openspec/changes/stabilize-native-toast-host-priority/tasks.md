## 1. Planning and negative control

- [x] 1.1 Record source-only analyst/designer invariants, platform/localization scope and approved dependency-lifecycle design; validate strict planning.
- [x] 1.2 Add real-library regression tests reproducing lower-host keyboard/inset rerender and internal expiry priority drift on the unpatched dependency; retain negative-control evidence.

## 2. Implementation and code checks

- [x] 2.1 Add the versioned patch with a stable lifetime imperative API delegating to current show/hide methods; verify clean-copy application and local installation after notifying the shared-dependency owner.
- [x] 2.2 Pass focused tests for active presentation priority, nested unmount fallback, current options/callbacks, replacement, expiry, action and public hide; run native governance and scoped static checks.
- [ ] 2.3 Complete independent full-diff review-and-fix and required code-review gate before runtime handoff.

## 3. Testing after review

- [ ] 3.1 Recheck physical iPhone fullscreen description editor keyboard plus Photos-denied feedback and invalid anchor, with the parent retained and unchanged duration.
- [ ] 3.2 Recheck adjacent map Copy, retained gallery/review feedback, child-to-parent-to-root close/reopen; preserve previous source/device evidence without promoting it to the patched source.
- [ ] 3.3 Record exact patched-source physical acceptance and remaining release-layer boundaries; run openspec validate --all before archive.
