## 1. Acceptance and ownership prerequisites

- [x] 1.1 Record owner acceptance of the proposed quest-only prefixes, unchanged RU numeric canonicals, RU-only city first stage and backend gateway/activation dependency (design D1–D5); do not interpret planning validation as approval. Accepted by the owner 2026-10-09: D1 language prefixes and D5 backend-owned live gateway, recorded on #2208.
- [x] 1.2 Backend owner confirms real shared serving root, authoritative per-response publication snapshot, private builder revision receipt, anonymous serving projection schema, cache/conditional-request chain and gateway feasibility; agree A/B/C/D interfaces before their parallel implementation and settle any contract change before apply. Confirmed by the approved v1 handoff on #2364, 2026-10-10; interface/fixtures read from backend origin/master. Exposure remains disabled pending B/E release acceptance.
- [x] 1.3 After acceptance, refresh Problem Memory and turn `implementation-cards.md` drafts into linked board cards with separate FE/BE owners; require a later explicit apply request before source work. Created 2026-10-09 after an all-status board search (no duplicates): A #2364, B #2365, C #2362, D #2363, E #2366.

## 2. Frontend route, locale and metadata model

- [x] 2.1 Implement a shared quest canonical/locale/eligible-version model preserving RU numeric paths and all existing aliases; cover Stable language-specific quest URLs scenarios. A #2364 source and regression tests added 2026-10-10; execution remains pending under 5.2.
- [x] 2.2 Reuse shared detail behavior behind a validated web prefixed route adapter; bind initial web boot/resources and exact bundle query to URL locale before mount; preserve native and non-quest preference lifecycle (URL-bound rendered language). A #2364 uses the existing catch-all's web sibling to keep the native graph unchanged; checks/runtime remain pending under 5–6.
- [ ] 2.3 Drive SSG and hydrated metadata/JSON-LD from the shared model; one self-canonical, effective reciprocal self-inclusive alternates and RU x-default; preserve print/parameter policy (Canonical and reciprocal alternate clusters).
- [x] 2.4 Add explicit current/available language anchors through the existing language control, full labels and unavailable-page RU navigation; cover all app-owned keys in RU/BE/UK/PL/EN (Explicit language navigation). A #2364 implementation and all-locale resources added; independent review and check execution are tracked separately.

## 3. Frontend SSG package and publication checks

- [x] 3.1 Build exact-locale complete published candidates, keeping mismatch/absence separate from transport failure; apply existing depth algorithm within same-language detail cohorts and require indexable RU anchor (Translation and quality eligibility). B #2365 source and tests added 2026-10-11 (`scripts/lib/questLocalePackage.js`, `questDetailCohort.js`); release pending under E.
- [x] 3.2 Produce immutable base HTML with bounded head/version-anchor/bootstrap projection slots plus versioned checksum/source-revision manifest after verification; reject partial files, language mismatch or changed source snapshot; checksum stored bytes and validate final projections separately, preserving spoiler/media safeguards (Coherent actual publication and withdrawal). B #2365: interface v1 manifest/3 slots/errors, receipt R1/R2 fence, `scripts/finalize-quest-seo-package.js`; accepted by the backend reader locally.
- [ ] 3.3 Extend static quest verifier to enforce prefixed status/head/body/locale/cluster contracts and candidate sitemap parity without replacing Django's production sitemap or modifying robots. B #2365: package/head/body/locale/cluster/checksum checks done in the former static quest verifier (removed in #2766); sitemap parity of prefixed entries is a runtime check after E/D exposure (6.2).

## 4. Separately owned backend dependencies

- [ ] 4.1 Backend owner implements per-response live effective-cluster/static gateway, anonymous serving projection and internal revisions/private builder receipt without changing #2193 gameplay/write semantics; preserve RU body/status on source drift, ensure missing/changed/withdrawn translations cannot serve old indexable HTML, and distinguish resolver failure from absence.
- [ ] 4.2 Backend owner makes production sitemap and available-version projection consume the same effective resolver and active physical package; preserve other sitemap sections and legacy RU listing policy.
- [ ] 4.3 Backend owner implements constrained production Nginx gateway routing, exact noindex 404 for absent prefixes/landings, safe conditional/cache handling and atomic package activation/rollback; no frontend Nginx edits.
- [x] 4.4 Frontend release handoff stages validated package via normal deploy tooling and checks the backend activation contract, under operation gates; no prefixed exposure until both owners' dependencies pass. E #2366 source integration added 2026-10-11: complete export, private full R1/R2, pinned overlay before sealing, bounded transfer/inventory, exact receipts/CAS and backend-owned rollback. Initial conversion remains separately authorized D maintenance; source/quality gates are recorded in `review.md`, production acceptance remains under 6.

## 5. Code-level validation and independent review

- [ ] 5.1 Add targeted tests for every spec success/failure scenario: aliases, all locale allowlist entries, exact content mismatch, partial/quality failures, timeout, source-revision race, head reciprocity, path traversal, missing file and withdrawal/cache behavior; no skipped tests.
- [ ] 5.2 Run targeted static/unit/guards, lint/typecheck as scope requires and `npm run test:i18n`; verify existing RU catalogue/city/country/scenario/print routes, quest query/offline/progress identity and unrelated locale lifecycle.
- [ ] 5.3 Complete independent `metravel-code-reviewer` review-and-fix and required code-review gate over full FE task diff; backend owner performs its required source/config review. Repeat checks for repaired findings. Runtime QA remains in the following stage.

## 6. Testing after reviewed coordinated release

- [ ] 6.1 Verify actual production frontend SHA, package identity, serving root and gateway/sitemap linkage after the owners' authorized release pipeline, not just local dist output.
- [ ] 6.2 Probe all actually published prefixed canonical URLs without JavaScript for 200/language/body/self-canonical/reciprocal alternates; compare Django sitemap prefixed entries with effective cluster; probe unsupported/missing/thin/withdrawn URLs for real noindex 404 and no shell fallback.
- [ ] 6.3 Capture desktop-web screenshots/console/network for RU and each available BE/UK/PL/EN detail: direct load, refresh, SPA entry/exit, saved/system preference conflict, explicit keyboard links, slow/failing locale load and offline content-language notice.
- [ ] 6.4 Capture equivalent mobile-web touch/layout/locale evidence and verify one quest-view event and retained quest identity/progress/consent; native device gates are inapplicable absent platform-specific changes.
- [ ] 6.5 Under authorized dedicated test-content operations, withdraw/change/re-publish a translation and change its RU source; prove post-commit snapshot serving/sitemap/sibling-head/visible-link safety with warm cache and conditional requests, retained RU status, temporary resolver-failure behavior and consistent in-flight responses; exercise rollback without resurrection.
- [ ] 6.6 Collect matched production before/after TTFB/LCP/CLS and build requests/bytes/duration, keeping existing RU controls; diagnose >10% RU latency/LCP regression and require CLS ≤0.1.

## 7. Handoff and archive

- [ ] 7.1 Record all implementation card Done gates and real production evidence, actual available-language set and remaining content-quality exclusions; no mock-only or SKIPPED pass.
- [x] 7.2 Document quest-only localization exception, feature contract, activation/revocation runbook and #1332 boundary; record optional 28-day search follow-up separately from functional acceptance. E #2366: `docs/RULES.md`, `docs/features/quest-locale-routing.md`, `docs/RELEASE.md` and `docs/ops/quest-locale-release.md`; live withdrawal and optional search follow-up remain separate from source completion.
- [ ] 7.3 Run `openspec validate --all`, sync accepted delta and archive only when implementation is complete and separately authorized; planning #2208 closes only after owner acceptance and linked implementation cards exist.

## 8. Existing-host storage refinement — D #2363 / E #2366

- [x] 8.1 Record owner constraint, fresh host/package measurements, source mechanism and proposed physical-storage architecture D6; distinguish local prototypes from production evidence.
- [x] 8.2 Measure the complete translated export and a three-slot local prototype, including metadata, directory and temporary-file overhead; independently review the private storage plan and unchanged reserve. D6 records APFS and Linux evidence; production admission remains8.5.
- [x] 8.3 Agree and implement the bounded private file-index/storage-plan handshake, streaming verified hardlinks and physical-union inventory while retaining public v1 schemas and logical security limits. Independent complete source review passed;34 focused Jest and31 canonical Make tests passed.
- [x] 8.4 Align D cleanup/accounting and explicit bounded retention with E staging, including reader pins, interrupted-candidate recovery, metadata preservation and separate legacy backup. Locked retention CAS and explicit hash-bound abort refuse unknown/protected data; legacy is never a sharing source.
- [ ] 8.5 Pass focused security/lifecycle/capacity regressions, independent review and normal release gates; verify real production peak allocation and every original D/E Done gate before completion.
- [ ] 8.6 Remove duplicated release I/O under D7, validate capture failure/cancellation/base drift and byte-identical hardlink processing, then measure fresh complete RU/translated preparation and publication within the unchanged300s budget.
- [ ] 8.7 Implement D8 private collect/render split, bind complete R1/all inputs to this build, preserve media coverage/request caps/cancellation; prove offline render, byte parity, failure fences and late guards.
- [ ] 8.8 Implement missing-content transfer-v3 over unchanged storage-v2 accounting/provenance; cover exact stream set, source/CAS races, unsafe entries, zero-body delta, abort/readers and v2 compatibility.
- [ ] 8.9 Close backend direct /static/ aliases of managed roots/private paths through canonical Nginx; review both scopes and compile real Nginx before coordinated release.
- [ ] 8.10 Measure fresh complete D8 prepare/publication≤300s and initial window≤180s at unchanged capacity/reserve; complete original lifecycle/rollback/readers/parity/browser gates. D7 translated309.693s remains a refusal, never an activation candidate.
- [ ] 8.11 D9: replace duplicate normalized/raw capture bodies with private v2 validated references and accepted-only raw provenance, shared pure normalization and inline slug fallback; retain128MiB/full coverage, add numeric size diagnostics and travel-inclusive online/offline parity, then repeat reviewed full preparation and original release gates. First D8 prepare165.449s failed size validation and remains captured-only.
- [ ] 8.12 D10: after D9 prepare213.918sPASS and combined-windowFAIL/recoveredRU, independently review and execute a canonical-Nginx-only window over exact RU/false, including private aliases and unchanged pointer; then measure fresh ordinary online publication and complete the original acceptance. Keep300s/180s/capacity/reserve unchanged; retained sealed candidates do not make old broad aliases safe.
