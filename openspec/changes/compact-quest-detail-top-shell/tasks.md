## 1. Design and implementation

- [x] 1.1 Record evidence, chosen shared policy, rejected alternatives, native boundary and rollback before code.
- [x] 1.2 Apply shared detail-route and presentation policy to header rendering, first-frame reservation and wizard placement.
- [x] 1.3 Preserve desktop brand/language/navigation and sidebar identity/actions while omitting the duplicate wide breadcrumb row.
- [x] 1.4 Add source regressions for localized route scope, header geometry and tablet/landscape draft/sheet/scroll continuity.

## 2. Code review and validation

- [ ] 2.1 Run coordinated targeted static/unit checks and existing i18n checks; record actual results without treating SKIPPED as PASS.
- [ ] 2.2 Independent review-and-fix of the complete task diff, followed by code-review gate.

## 3. Testing after review

- [ ] 3.1 On the exact deployed SHA measure pinned top chrome <=20% at all seven spec viewports; screenshots, light/dark and console evidence.
- [ ] 3.2 Verify RU/BE/UK/PL/EN routes and fallback notice, loading/error/offline, intro/step, desktop sidebar and all row/menu actions.
- [ ] 3.3 Verify route sheet/current point, answer draft/focus and reading anchor during portrait/landscape resize.
- [ ] 3.4 Run final OpenSpec validation before archive; update completion only from actual evidence.
