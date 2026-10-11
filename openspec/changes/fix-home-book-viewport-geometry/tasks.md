## 1. Geometry design and implementation after separate apply approval

- [ ] 1.1 Write the versioned healthy/short-book schematic in `docs/features/home-hero-book-viewport-mock.md` and link it from the ticket before code.
- [ ] 1.2 Consolidate book width/height, reserve and usable-height geometry into a focused runtime/SSG-compatible leaf model; add tests for 2048×900, 2560×640, control sizes and positive short-height fallback.
- [ ] 1.3 Consume reactive viewport height, including height-only resize, and use height-based vertical paper insets/spacing and bounded readable typography in the existing style groups.
- [ ] 1.4 Make the complete left-page content normally scrollable inside paper when required; preserve controls/order/decoration/photo ratio and tablet/mobile normal flow.
- [ ] 1.5 Update static homepage CSS from the same model and extend `ssg-skeletons.test.ts` to cover wide/short parity.
- [ ] 1.6 Add `e2e/home-hero-book-viewport.spec.ts` with all mandatory elements, clipping-ancestor intersection, normal scroll/reveal and ordinary clicks; establish that the test detects the current defect, with execution reserved for testing.

## 2. Code review

- [ ] 2.1 Run focused geometry, `HomeHero.test.tsx`, `homeHeroMediaLetterbox.test.ts` and SSG Jest suites, scoped ESLint and `npx tsc --noEmit`.
- [ ] 2.2 Complete independent `metravel-code-reviewer` review-and-fix and code-review-gate on runtime/SSG/tests; rerun relevant static checks after fixes.

## 3. Testing after reviewed diff

- [ ] 3.1 After the standard task pipeline makes the reviewed SHA available, verify production build source and execute browser geometry/click regression under the operation gate, preserving real before/after measurements.
- [ ] 3.2 Cover RU/BE/UK/PL/EN × light/dark × off/christmas at 2048×900 and 2560×640; capture clipping 0% after normal reveal, targets ≥44px, screenshots and console.
- [ ] 3.3 Check 1440×900, 1280×900, 1279×900, 390×844 plus height-only resize; no horizontal scroll, chrome overlap or lost content.
- [ ] 3.4 Compare cold SSG bounds/order/actions with loaded application and test keyboard focus/reveal and image fallback.
- [ ] 3.5 Run `yarn verify:slider` and `yarn verify:slider-perf` only under their operation gate in testing; preserve media ratios and performance budgets.
- [ ] 3.6 Run `openspec validate fix-home-book-viewport-geometry --type change --strict`; before archive run `openspec validate --all` and attach actual browser/performance evidence.
