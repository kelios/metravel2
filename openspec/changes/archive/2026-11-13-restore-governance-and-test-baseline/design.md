## Context

See proposal.md for motivation. Raw-source governance found nine static feature imports across eight consumers, two direct import continuations, one incomplete named-export mock and four obsolete fetch-call arity assertions. All ten failures reproduce on parent `3774232`; the fetch-policy mismatch originated in this workline's earlier #3362 commit. Existing production code already forwards four fetch arguments and implements MeasuredFlow.

Task type and expected result: level-L recurring AI build-contract repair plus bounded native/test-fixture repair; all five failed suites green with preserved behavior.
Task-owned paths: eight AI offenders, `api/aiAssist/policy.ts`, new `constants/aiFormPolicy.ts`, near-route feature runtime, AI governance/selection and focused tests; the shared policy's `services/ai-assist/Dockerfile` packaging and existing image-layout import regression; two quest callers; anchors, Near and articles test files; this OpenSpec change.
Platform impact: shared; web build composition and native import normalization. Localization impact: none.
Risk/operation gates: no runtime/build, commit/push, board or publication by the implementation worker; root owns combined review and release. Foreign compiler paths and untracked skill stay untouched.
Validation: normal wrapped five-suite run, focused enabled/disabled AI and quest plain/thenable controls, scoped ESLint, whole typecheck and guards; root owns final combined full lint and canonical source-attributed bundle/production acceptance.

## Goals / Non-Goals

**Goals:** Restore existing build and import contracts without changing public exports, API values, rendered states, cancellation, retry timing or test business assertions. Guarantee the AI governance suite is selected for app-source edits.

**Non-Goals:** New AI features, production flags, server behavior, UI strings, allowlist additions, budget changes, compiler adjustments, or broad test rewrites.

## Decisions

1. Extract only existing pure author/tag/map constants and their types to `constants/aiFormPolicy.ts`; keep compatibility re-exports in `api/aiAssist/policy.ts`. The re-export uses an explicit `.ts` extension for the service's native Node ESM loader, and the Dockerfile copies this exact neutral leaf into the image. The existing image-layout test loads the service module without starting HTTP or a model, covering the real extension and packaging boundary beyond Jest's resolver. No existing neutral policy module provides these values. Consumers retain synchronous normalizers and identical exports. Rejected asynchronous policy loading because it would change synchronous API/normalizer contracts; rejected duplicated literals and a scanner exception because they allow drift or conceal the dependency.
2. Load author-draft executable API inside the existing async action under the literal assistant flag. Keep abort ownership and stale-result checks around both module loading and API completion. Move the unchanged near-route hook/card implementation behind a stable module-scope literal-gated lazy component; its facade retains pure helper exports. The existing outer slot Suspense and app error boundary remain responsible for pending/rejected chunks; no inner Suspense is added. Rejected conditional hook loading and import-string hiding.
3. Expand flag recognition to the existing static-similar flag and select the guard through the current app contract test selector. Keep all forbidden-static-import rules and known exceptions unchanged. Add positive and negative source/selection controls.
4. Normalize only the two quest import expressions through an existing Promise continuation; retain target, cache, retry and handlers. The extra microtask captures synchronous loader throws as well as plain modules, thenables and rejected promises. Add plain-module and thenable behavior controls at the caller boundary.
5. Complete the anchor module mock with the matching measured-flow export while preserving real RNW anchors/refs and all four cases. Add the explicit empty retry-policy argument to exactly four fetch-call expectations; production transport stays unchanged.

## Risks / Trade-offs

- Lazy module resolution adds an asynchronous step before the existing request → verify enabled success/error, cancellation before resolution and late-response suppression; no request after abort.
- Compatibility re-exports could lose names or introduce cycles → compare unchanged exported values/types and enforce that the neutral contract has no imports/re-exports.
- A deferred near-route runtime must retain hook identity → lazy component defined outside render; existing add/filter/loading tests execute the real query flow under the enabled flag.
- Build-source exclusion is not proved by Jest → root keeps #3301 before/after raw/Brotli attribution and unchanged budget gates on the final combined canonical candidate.

## Migration Plan

No data migration. Implement and validate source, freeze explicit path hashes, then hand the full union to independent review and root publication. Reuse the 26,500 passing full-Jest assertions only while their dependencies/contracts remain compatible; rerun all affected suites. Rollback reverts only these explicit paths, restoring original pure-policy location and lazy consumers; map/compiler changes are retained.
