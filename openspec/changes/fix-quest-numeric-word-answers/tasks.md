## 1. Reproduction and implementation

- [ ] 1.1 Prove the live Sofia pattern rejects the correct cardinal answer and accepts an invalid numeric prefix before the fix.
- [x] 1.2 Implement shared strict literal/cardinal parsing and integrate numeric checker branches without changing free text or saved progress.
- [x] 1.3 Add all-current-locale positive cases, incorrect quantity/ordinal/prefix negatives and production-pattern regressions.

## 2. Code validation and review

- [x] 2.1 Pass targeted checker/evaluation/morphology/rejected-corpus tests, task lint/typecheck and update the feature contract.
- [ ] 2.2 Complete independent code review and code-review gate for the complete task diff.
- [x] 2.3 Validate OpenSpec and prompt/document structure checks.

30.10.2026: combined task-scoped Jest passed 16 suites / 342 tests, including
numeric/checker/evaluation/morphology/rejected-corpus, country SEO fixture and
ready-book/A4 regressions. Scoped ESLint, quest-answer-eval, locale guard,
OpenSpec strict and prompt audit passed. Full typecheck still reports the two
pre-existing errors in QuestFullMap and TravelDescriptionHtml.web; no errors in
task-owned production files. Independent review-and-fix passed; the separate
code-review gate and production acceptance remain below.

## 3. Testing and delivery

- [ ] 3.1 Commit explicit task-owned paths and push main under the repository's authorized fix pipeline.
- [ ] 3.2 Deploy the reviewed task revision through frontend-deployer and verify published source identity.
- [ ] 3.3 Verify a representative published answer flow and confirm that progress 595 remains untouched; save a redacted playthrough review and report limitations.
