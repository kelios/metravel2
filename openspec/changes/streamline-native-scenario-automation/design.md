## Context

See proposal.md for the incident and scope. Existing assets are Maestro YAML flows, the standalone physical XCTest driver, the App Review scene catalog and shared quality-lock utilities. No new mobile testing dependency is required.

## Goals / Non-Goals

Goals: assertion-bearing repeatable scenarios, bounded first-failure reports, explicit target/build identity, reusable helper products, shared target ownership and mechanical recording readiness. Do not replace physical evidence with simulator/web tests, or implement application fixes from session 2137.

## Decisions

1. Reuse Maestro for Android/iOS simulator and XCTest for physical iOS. Reject a single cross-platform runner that pretends Maestro covers physical iOS.
2. Validate scenario schema and metadata before device access. Add exact identity/visibility/absence/value/count assertions and bounded scrolling to the existing Swift driver; diagnostics remain distinct from rehearsal. Reject coordinate-only replay as acceptance.
3. Keep run.sh as the compatible entry point; delegate process/deadline/report/cache management to Node standard library. Cache build-for-testing only with source/toolchain/target identity and product hashes, then use test-without-building. Provisioning updates are explicit.
4. Use a shared per-device lock between native runners, under the existing common lock root. Preserve global quality gate semantics; busy/skipped is never pass. Unique ignored directories prevent destructive evidence overwrite.
5. Add a recording plan check against completed physical rehearsal reports: exact candidate, backend/locale/account role/device model, scenario SHA, current runner source, freshness and successful exit. It is preparation evidence, not a signed binary attestation or proof of final recording privacy.
6. Consolidate procedure in docs/TESTING.md. Skills and agent prompts point to it; generated mirrors use existing sync tools. Native regression authoring belongs to test-author, physical acceptance to ios-tester, capture to recorder.

## Risks / Trade-offs

- Strict assertions may expose unstable/ambiguous accessibility IDs → report failure and fix source identity; do not choose the first match.
- Candidate identity is verified operational metadata, not cryptographic attestation → retain actual install/TestFlight provenance in the scene batch.
- Existing handwritten local helpers can bypass new locks → do not acquire an occupied physical target; migrate at a deliberate session boundary.
- Scene catalog has substantially more requirements than existing native tests → report missing coverage rather than inventing success.
- No runtime timing baseline while another session owns the device → validate orchestration with fake child processes and explicitly retain native testing tasks.

## Migration Plan

Introduce additive commands and JSON object scenarios, preserve diagnostic-array invocation, remove implicit provisioning/device choice, sync generated prompts, validate source tests, independently review. Runtime testing starts only after review in testing and target handoff. Roll back task-owned tooling/prompts together; cached products are expendable, original evidence is retained.

## Validation matrix

- Native runner/schema/deadline/cache/readiness: focused Node/Jest tests using fake processes and files, no device access.
- Swift: parser/source validation now; compile and one success plus deliberate missing-state failure later on an available authorized test target.
- Android/iOS simulator: manifest static validation now; execute selected guest suite later, with explicit target and same metadata.
- Prompts/skills: audit:prompts, skill-creator validation, generated mirror checks and independent code review.
- App UI/localization/SEO/accessibility/analytics/bundle: unchanged; no new UI/device gate from shared docs.
- Final recording: fresh exact-candidate rehearsal plus actual video/privacy/manifest verification remain separate.
