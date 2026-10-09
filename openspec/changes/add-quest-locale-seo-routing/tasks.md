## 1. Acceptance and ownership prerequisites

- [x] 1.1 Record owner acceptance of the proposed quest-only prefixes, unchanged RU numeric canonicals, RU-only city first stage and backend gateway/activation dependency (design D1–D5); do not interpret planning validation as approval. Accepted by the owner 2026-10-09: D1 language prefixes and D5 backend-owned live gateway, recorded on #2208.
- [ ] 1.2 Backend owner confirms real shared serving root, authoritative per-response publication snapshot, private builder revision receipt, anonymous serving projection schema, cache/conditional-request chain and gateway feasibility; agree A/B/C/D interfaces before their parallel implementation and settle any contract change before apply.
- [x] 1.3 After acceptance, refresh Problem Memory and turn `implementation-cards.md` drafts into linked board cards with separate FE/BE owners; require a later explicit apply request before source work. Created 2026-10-09 after an all-status board search (no duplicates): A #2364, B #2365, C #2362, D #2363, E #2366.

## 2. Frontend route, locale and metadata model

- [ ] 2.1 Implement a shared quest canonical/locale/eligible-version model preserving RU numeric paths and all existing aliases; cover Stable language-specific quest URLs scenarios.
- [ ] 2.2 Reuse shared detail behavior behind a validated web prefixed route adapter; bind initial web boot/resources and exact bundle query to URL locale before mount; preserve native and non-quest preference lifecycle (URL-bound rendered language).
- [ ] 2.3 Drive SSG and hydrated metadata/JSON-LD from the shared model; one self-canonical, effective reciprocal self-inclusive alternates and RU x-default; preserve print/parameter policy (Canonical and reciprocal alternate clusters).
- [ ] 2.4 Add explicit current/available language anchors through the existing language control, full labels and unavailable-page RU navigation; cover all app-owned keys in RU/BE/UK/PL/EN (Explicit language navigation).

## 3. Frontend SSG package and publication checks

- [ ] 3.1 Build exact-locale complete published candidates, keeping mismatch/absence separate from transport failure; apply existing depth algorithm within same-language detail cohorts and require indexable RU anchor (Translation and quality eligibility).
- [ ] 3.2 Produce immutable base HTML with bounded head/version-anchor/bootstrap projection slots plus versioned checksum/source-revision manifest after verification; reject partial files, language mismatch or changed source snapshot; checksum stored bytes and validate final projections separately, preserving spoiler/media safeguards (Coherent actual publication and withdrawal).
- [ ] 3.3 Extend static quest verifier to enforce prefixed status/head/body/locale/cluster contracts and candidate sitemap parity without replacing Django's production sitemap or modifying robots.

## 4. Separately owned backend dependencies

- [ ] 4.1 Backend owner implements per-response live effective-cluster/static gateway, anonymous serving projection and internal revisions/private builder receipt without changing #2193 gameplay/write semantics; preserve RU body/status on source drift, ensure missing/changed/withdrawn translations cannot serve old indexable HTML, and distinguish resolver failure from absence.
- [ ] 4.2 Backend owner makes production sitemap and available-version projection consume the same effective resolver and active physical package; preserve other sitemap sections and legacy RU listing policy.
- [ ] 4.3 Backend owner implements constrained production Nginx gateway routing, exact noindex 404 for absent prefixes/landings, safe conditional/cache handling and atomic package activation/rollback; no frontend Nginx edits.
- [ ] 4.4 Frontend release handoff stages validated package via normal deploy tooling and checks the backend activation contract, under operation gates; no prefixed exposure until both owners' dependencies pass.

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
- [ ] 7.2 Document quest-only localization exception, feature contract, activation/revocation runbook and #1332 boundary; record optional 28-day search follow-up separately from functional acceptance.
- [ ] 7.3 Run `openspec validate --all`, sync accepted delta and archive only when implementation is complete and separately authorized; planning #2208 closes only after owner acceptance and linked implementation cards exist.
