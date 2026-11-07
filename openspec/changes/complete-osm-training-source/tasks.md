## 1. Source preparation

- [x] 1.1 Confirm the missing clean cache, bounded Overpass failures, free source sizes and available disk; preserve diagnostics.
- [x] 1.2 Define the explicit PBF coverage/grounding contract and isolated optional tooling.
- [x] 1.3 Implement verified streaming downloads, complete country scans, disk-backed geometry resolution and atomic cache publication.

## 2. Grounding and validation

- [x] 2.1 Remove unsupported description closers and include country provenance in prompts.
- [x] 2.2 Add country/tag/geometry/checksum regression controls and run a native tiny-file parser fixture.
- [x] 2.3 Complete both real country extracts, build the capped mix, verify country negatives, description counts and every filter JSON.
- [ ] 2.4 Reuse prior model evaluation only with exact input/validator compatibility and record actual counts/hashes.

## 3. Handoff

- [ ] 3.1 Complete independent review-and-fix, then code gate and explicit-path commit/push through the root coordinator.
- [ ] 3.2 Validate planning, append measured source/coverage evidence to #2479, and accept only when all in-scope gates pass.
