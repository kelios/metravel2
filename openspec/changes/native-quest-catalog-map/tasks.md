## 1. Contract and implementation

- [x] 1.1 Confirm map data ownership, shared native renderer and validation selection.
- [x] 1.2 Set the native points-only contract and preserve marker navigation.
- [x] 1.3 Reuse truthful loading/error/empty states and remove duplicate native Back.
- [x] 1.4 Add route regressions and document the changed native contract.
- [x] 1.5 Make the native fit floor target-aware and prove full global bounds/tiles/resize with real Leaflet while preserving the radius floor.
- [x] 1.6 Add and source-validate the tracked Maestro quest-catalog-map scenario.

## 2. Code validation and review

- [x] 2.1 Run focused route/native-map tests, governance, lint and typecheck.
- [ ] 2.2 Complete independent review-and-fix and code-review gate for #3424.
- [ ] 2.3 Commit explicit task paths, push main and record SHA/status testing.

## 3. Testing and delivery

- [ ] 3.1 Verify reviewed Android candidate: quest markers, distant coordinates, tap, states, single Back and main-map control.
- [ ] 3.2 Reuse the shared native contract evidence for iOS with the recorded invalidation condition.
- [ ] 3.3 Verify retained web framing after normal frontend rollout and record acceptance.
- [ ] 3.4 Validate/sync/archive the change after the Done gate passes.
