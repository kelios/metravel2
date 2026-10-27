## 1. Measurement

- [x] 1.1 Add settled-query tracking with real result counts, cancellation, deduplication, input minimization, and web-only dispatch.
- [x] 1.2 Integrate tracking with the catalogue's raw query, applied term, full matching count, readiness, and focus.
- [x] 1.3 Document the event payload and Yandex report entry in the quest feature contract.

## 2. Code-level validation and review

- [x] 2.1 Run focused hook tests for stable/continued typing, stale results, zero results, readiness, focus, clear/repeat, query limits, and native suppression; run the existing analytics provider regression tests and scoped lint.
- [ ] 2.2 Complete independent code review and repair of the full task diff, then the required review gate.
- [x] 2.3 Validate this OpenSpec change strictly.
- [ ] 2.4 Run final `openspec validate --all` before archive.

## 3. Testing after review

- [x] 3.1 Verify the standalone `quest_search` JavaScript goal exists in Yandex Metrica counter 62803912 and its parameters report can be opened.
- [ ] 3.2 On the published reviewed version, verify one real query and a zero-result query emit matching search intent/payload; verify cleared and unfocused states do not emit stale events. Reuse shared logic evidence across viewports because rendering is unchanged.
