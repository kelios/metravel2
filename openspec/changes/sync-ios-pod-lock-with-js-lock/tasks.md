## 1. Source repair
- [x] 1.1 Snapshot tracked native/package/yarn state and generate CocoaPods lock from frozen dependencies.
- [x] 1.2 Inspect full generated diff; preserve native settings and unrelated files.
- [x] 1.3 Repeat deployment install with no tracked drift; compare manifest; run release guard and strict spec validation.
## 2. Review and acceptance
- [ ] 2.1 Independent code review/gate, commit/push explicit task scope and testing.
- [ ] 2.2 Unsigned simulator build, native stamp and provenance check.
- [ ] 2.3 Record acceptance and resume original #3452 runtime; archive after required evidence passes.
