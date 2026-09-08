## 1. Confirm scope and regressions

- [x] 1.1 Reuse task #1874 and document its source-confirmed sanitizer family and platform boundaries.
- [x] 1.2 Add failing round-trip cases for missing supported text formats and supplemental-field list normalization (editor RED: 7 failures / 38 passes; supplemental API RED: 2 failures / 8 cases).
- [x] 1.3 Record removal as the minimal implementation decision under the user's subsequent fix-all-and-production-deploy request.

## 2. Preserve supported formatting

- [x] 2.1 Add bounded block/inline format vocabulary and restrictive editor class allowlists.
- [x] 2.2 Apply scoped web reader CSS in both existing HTML reader surfaces.
- [x] 2.3 Add equivalent native alignment/font/size/indent styles using existing platform font conventions and the native span model for parent-aware sizes.
- [x] 2.4 Reuse the safe body write pipeline for all four rich-text fields on PUT/PATCH without losing limits, FAQ structure or save/moderation semantics.
- [x] 2.5 Preserve the existing mobile rich-content guard when reopening paragraphs/spans with supported Quill classes.
- [x] 2.6 Remove unsupported color/background controls and add real-toolbar/reintroduction regressions; full validation is tracked below.

## 3. Permanent controls and code review

- [x] 3.1 Derive every format/option case from the toolbar configuration and prove an unknown control/option fails validation.
- [x] 3.2 Pass supported-format, unsafe-input, ordered/bullet-list and FAQ regression tests (final full Jest: 1322 suites / 12992 tests, no failures, skips or emitted diagnostics).
- [x] 3.3 Record the recurring family and permanent control in docs/PROBLEM_MEMORY.md.
- [x] 3.4 Pass full lint with max-warnings=0, TypeScript and e2e TypeScript, relevant guards, prompt audit (116 artifacts), strict OpenSpec validation and check:fast (11 suites / 280 tests).
- [ ] 3.5 Complete independent full-diff review-and-fix, then the mandatory review gate and explicit-path commit/push before testing.

## 4. Testing and acceptance

- [ ] 4.1 Refresh and verify the local backend and reuse the existing local frontend without duplicate operations.
- [ ] 4.2 In the real wizard save a disposable formatted article; verify raw and canonical HTML plus supplemental fields through real API responses.
- [ ] 4.3 Verify actual reader alignment, size, font, lists and FAQ on desktop 1280/mobile 390 with screenshots, computed styles and console/network evidence.
- [ ] 4.4 Verify changed native reader styles on local Android debug/device and iOS simulator after the testing transition.
- [ ] 4.5 Remove disposable test data, record the acceptance verdict and confirm the board state.
- [ ] 4.6 Complete tasks, synchronize/archive this change and run openspec validate --all; leave unrelated changes untouched.
- [ ] 4.7 Complete the subsequently requested full lint/Jest/e2e repair cycle, then authorized canonical production deployment and post-deploy checks after all operation gates pass.
