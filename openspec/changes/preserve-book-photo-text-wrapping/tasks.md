## 1. Confirm display and source contracts

- [x] 1.1 Freeze current browser export source route, article672 display shapes and source checksum; identify direct worker fragment consumers and their excluded occurrence-ledger boundary.
- [x] 1.2 Add failing typed association and renderer tests for preceding paragraph/orphan float in p and figure shapes, both sides, headings/end and claimed interleaving; assert text/link/media conservation and source immutability.

Evidence: regression coverage is added and the current implementation passes it. The attempted pre-fix baseline runner was SKIPPED by a foreign quality gate; this is not an observed old-code failure or a validation PASS.

## 2. Implement safe PDF display flow

- [x] 2.1 Implement linear typed render-only association without calling web-only transform or modifying parser/editor/save pipeline; preserve image order, explicit side, caption, alt and paragraph HTML.
- [x] 2.2 Integrate the associations into BlockRenderer and focused containing/keep-with-next print behavior; preserve next-heading clearing, forward wrapping and splittable long paragraphs.
- [x] 2.3 Add exact paragraph-empty/short/boundary/gallery/list/table/full-width/idempotence cases, fallback-image preservation and justified content golden deltas only.

## 3. Code review and conservation regressions

- [ ] 3.1 Run coordinated helper/BlockRenderer/printPageBreaks/heading/image fallback/generator/worker conservation tests plus scoped lint/typecheck, preserving all original ledgers and unrelated fixtures.
- [ ] 3.2 Complete independent review-auditor review-and-fix and separate code-review-gate over the full task-owned source/test/doc diff; repeat necessary code-level checks after findings.

Evidence: all 27 urgent suites passed in the full Jest run, including typed flow, BlockRenderer, generator and worker conservation coverage. The final four-suite golden/final-page run passed 183 tests with no skips; owned ESLint/diff checks, typecheck, image/i18n/prompt guards and the three urgent strict OpenSpec validations passed. The full repository run remains non-green for six older map suites and one older quest-route assertion after the sandbox-fixture rerun; `openspec validate --all` retains one unrelated change failure. Independent review-and-fix is complete; item 3.2 stays open for the separate gate. CSS/source checks do not prove physical pagination or an ordinary server/segmented export route; those remain testing requirements.

Follow-up: revision983f77b8 was reviewed, pushed and deployed; real guest and QA104 ordinary HTML exports both printed21 physical pages. Rakov wraps on page10; Priluki text on page8 and photo on page9 fail physical co-placement. Source acceptance is reopened for the advisory containing-group refinement in decision2 and its meaningful long-text conservation tests. The previous receipts remain history; fresh review, checks, push, deployment and physical pagination are required before completion.

## 4. Real export and physical pagination acceptance

- [ ] 4.1 Use authorized task pipeline for owned-path commit/push and production deploy; record actual served revision and ordinary single-article browser export path before claiming acceptance.
- [ ] 4.2 Export production article672 normally on desktop and mobile web; capture preview and real printed PDF for Rakov/Priluki examples with text/photo vertical overlap, no text covering photo and next-heading separation.
- [ ] 4.3 Measure a pair placed near physical page bottom and a paragraph exceeding one page; verify actual wrapping text stays with photo, complete text continues in order and no clipping/cropping/duplication or image-only association split occurs.
- [ ] 4.4 Verify left/right and p/figure across minimal/dark/illustrated, RU/BE/UK/PL/EN surrounding labels, existing forward/claimed/media-group cases and slow/error image fallback.
- [ ] 4.5 Record exact source/text/link/image occurrence conservation and truthful segmented-worker coverage; do not mark a worker route fixed from browser-only evidence. If the affected ordinary action uses the excluded worker route, record the blocker and require separately approved bounded design instead of mock completion.
- [ ] 4.6 Update scoped docs and board evidence through its owning session, retain PDF/screenshots/console and exact SHA, and run final OpenSpec strict validation before completion/archive.
