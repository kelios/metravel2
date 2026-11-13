## Context

See proposal.md for the reported payload baseline. The fresh 2026-11-12 diagnostic export of clean `b8becc9ad` contains 762 indexed source-map module sections, no root-layout/provider module in entry, and a 2,564 B generated quest URL facade (982 B compressed independently). `i18n/bootLocale.web.ts:12` and `i18n/instance.web.ts -> utils/ssr/requestLocale.js:4` import that full CommonJS facade for parsers/locale constants. Source map/table: `.codex-temp/task3374/before/entry-composition.{json,md}`; independent graph: `before/graph/metro-analyze-73847-3997.json`; initial home/travel-article consumers: `before/consumer-ownership.json`. Independently, the guard rounds KiB to 0.1 and applies 5% default tolerance to named chunks. Its `fileSizes` retains full delivered bytes, while legacy named metrics remove loader metadata.

## Measured startup composition

Clean base `b8becc9ad27c28c5a8646003487ca630bca5b905`, cold production SSR diagnostic export on 2026-11-12. Indexed source map: **762 module sections / 763 inventory rows including the runtime footer**. Complete generated raw attribution is additive and totals **1091235 B**, including map/debug annotations; independently compressed module Brotli values below are **non-additive** because a delivered chunk shares its compression dictionary. Actual map-enabled entry is 233600 B Brotli. Removing only map/debug annotations gives a diagnostic 233279 B, **not an actual normal-export measurement**. Final normal export controls the byte ratchets.

| Module | Generated raw B | Standalone Brotli B | Home first render | Article first render | Decision |
|---|---:|---:|---|---|---|
| React DOM renderer (`/node_modules/react-dom/cjs/react-dom-client.production.js`) | 206760 | 54683 | Required renderer | Required renderer | Keep |
| RNW VirtualizedList (`/node_modules/react-native-web/dist/vendor/react-native/VirtualizedList/index.js`) | 25961 | 6604 | Sync framework dependency | Sync framework dependency | Keep framework contract; no upstream rewrite |
| Expo navigation reducer (`/node_modules/expo-router/build/global-state/useNavigationTreeReducer.js`) | 8563 | 2912 | Required navigation lifecycle | Required navigation lifecycle | Keep |
| Expo head runtime (`/node_modules/expo-router/vendor/react-helmet-async/lib/index.js`) | 12186 | 4133 | Sync framework dependency | Sync framework dependency | Keep |
| Generated route context (`/app?ctx=e7d453d5b579992fd745ea5ff887e28dfd34d236`) | 7128 | 992 | Required route discovery | Required route discovery | Keep |
| Entry/polyfills (`/entry.js`) | 4913 | 1465 | Required bootstrap | Required bootstrap | Keep protected entry |
| Web translation runtime (`/i18n/translate.web.ts`) | 3696 | 1455 | Required locale boot | Required locale boot | Keep; catalogs remain deferred |
| Locale registry (`/i18n/config.ts`) | 1996 | 731 | Required allowlist/defaults | Required allowlist/defaults | Keep |
| Locale preference storage (`/i18n/localeStorage.ts`) | 1686 | 641 | Required preference boot | Required preference boot | Keep lifecycle |
| Pre-hydration locale boot (`/i18n/bootLocale.web.ts`) | 1264 | 480 | Required saved-locale gate | Required saved-locale gate | Change parser import only |
| Web locale state (`/i18n/instance.web.ts`) | 605 | 329 | Required locale state | Required locale state | Keep |
| SSR/browser locale bridge (`/utils/ssr/requestLocale.js`) | 1013 | 466 | Required browser-safe bridge | Required browser-safe bridge | Change parser/allowlist import only |
| Quest URL/serving facade (`/utils/questLocaleRouting.js`) | 2564 | 982 | Parser yes; serving projection no | Parser yes; serving projection no | Extract parser leaf; shell helpers separate; serving stays route-owned |

“Sync framework dependency” records bootstrap reachability, not component coverage or a claim that every framework export renders above the fold. Root layout/providers are **absent from entry** (already async roots), so deferring them cannot solve this entry target and was rejected. The full per-module decisions remain in [the source-map inventory](../../../.codex-temp/task3374/before/entry-composition.json) and its [readable table](../../../.codex-temp/task3374/before/entry-composition.md); maps/raw bundles remain ignored. Initial route consumer evidence is [consumer-ownership.json](../../../.codex-temp/task3374/before/consumer-ownership.json).

Evidence SHA-256 (full inventory/map/identity are integrity-linked, not recreated from the summary):

- Inventory `10bd4c566f95f30bd82730c6dfb00f6a8f860d77f5c529cd6709e5300d32238f`; source map `c88d3c5af37b2f081e84dbb5bab8a67573a415fed470ab51e9e17631d64297a9`.
- [Build identity](../../../.codex-temp/task3374/before/identity.json) `01d65f1ac5eefc48de6fd3d3220bf35719053c98769ddcfaa1ce67abf11e3078`; production-env fingerprint `08732685d906834b35d69e24ce777263c5a1d09d4cf71e7b21ee65d6e9bcae4f` (no values recorded here).
- Toolchain: Node v22.13.1, Expo 58.0.21, Metro 0.87.1, @expo/metro-config 58.0.20.
- Input `metro.config.js`: `3e488108f43e5c35b4f549cabaa825a1f6e630ac7070917724a8f402446fe154`.
- Input `babel.config.js`: `6ca5ffd5a9aa27eff6223b382c18059bd6fabdcc490979aa29a0fec97827a920`.
- Input `package.json`: `584475447295106bef73e1827e15bb2cf26905c45f2e73214774e01ca877673b`.
- Input `yarn.lock`: `bdbacebef8a2eaa2cbad74b63889e5171b0579c56a30da7673b8278dcc4679b5`.
- Input `scripts/lib/granularChunkMerge.js`: `a38b1bfa6004342ace6346dd1d6a3fdf001aa3856b63dee529f2e92a001a902a`.
- Input `scripts/lib/scopedModuleIdFactory.js`: `50f4fce927f270fe82d658bebe04339dc9f3ce0f82d41e008baa09498b30b80d`.
- Input `node_modules/@expo/metro-config/build/serializer/chunking/Chunk.js`: `886a634e48365770e9e9368d1143963b4957399f00695cb3cb25c63926eadd84`.

## Goals / Non-Goals

Use the same production environment, serializer and lockfile for a source-map diagnostic export and a final normal export. Select startup boundaries from that evidence; do not optimize providers outside entry merely because they appear large. Preserve the proposal's non-goals and all existing public behavior.

## Decisions

1. **Exact byte gates reuse full measurements.** Add optional `chunks.<owner>.maxBrotliBytes` and `eager.maxBrotliBytesByRoute`. Validate non-negative safe integers; explicit malformed values fail closed. Sum `fileSizes` over a named owner's files for full delivery, including loader metadata. Reuse existing HTML route normalization and script sets. Exact comparisons use integers and report `unit: bytes` with a full-delivery basis; legacy KiB fields and all unrelated limits retain their policy. Rejected: inverse percentage/rounded KiB pins, which permit growth despite no chosen headroom. Keep exact fields on `--update` rather than resetting/removing the ratchet.
2. **Freeze byte pins after normal export.** Entry and home exact fields equal observed normal bytes, with no padding. Lower legacy KB ceilings too without affecting other routes. The regression fixture sets a ceiling exactly one byte below the compressed payload; it must fail even with generous legacy tolerance, including a metadata-bearing entry.
3. **Source-map and production measurements differ.** `--source-maps external` adds map/debug annotations in the installed Expo serializer. Record diagnostic and normalized values separately; normalized bytes are not a normal-export claim without identity proof. Final actual normal export is authoritative. `ANALYZE_BUNDLE=1` only reads the graph and writes JSON.
4. **Confirmed startup boundary.** Extract `QUEST_LOCALES` and the exact detail/hub/URL parser bodies into `utils/questLocalePath.js`, with typed declarations. Put the hub path builder and inline parser-script generator in `utils/questLocaleShell.js`: initial shell consumers need them, while entry does not. The existing `questLocaleRouting.js` retains detail URL building, projection validation and alternates, and re-exports leaf/shell functions by identity. Its public declarations re-export the existing route types and retain serving types. Migrate proven startup parser-only imports in `i18n/{bootLocale.web.ts,LocaleProvider.web.tsx}`, `utils/ssr/requestLocale.js`, `components/layout/{bottomDockItemDefs.ts,LanguageOptionList.web.tsx,customHeaderModel.ts,topLevelSections.ts,documentView.tsx}`, and `hooks/useQuestVersionNavigation.web.ts`. The shared breadcrumb parser uses the same leaf so later header loading does not import serving behavior. `i18n/localeBootShell.ts` and `utils/questLocaleHubs.ts` use the shell helper. Preserve parser grammar verbatim; no route-screen or content changes. Existing quest-serving consumers retain the facade. `scripts/prepare-web-ssr.js` copies both new helpers, exercised by an isolated packaged Node bootstrap without repository fallback. Rejected: only splitting the entry import, which would retain unused serving code through the initial shell's imports; moving all path/script generators into entry, which adds unused boot payload.

## Paths and Contracts

Confirmed tooling paths: `scripts/guard-bundle-budget.js`, `scripts/lib/bundleBudgetReport.js` (new full-chunk measurement basis enum only), `__tests__/scripts/{bundle-budget-release-contract.test.ts,bundle-budget-exact-bytes.test.ts,startup-locale-runtime.test.ts}`, `config/bundle-budget.json`; startup paths are enumerated in decision 4. No backend/data/API change. No new UI, SEO URL, metadata, accessibility, analytics or security behavior; existing parser validation and locale lifecycle are preserved. No new dependency.

## Validation Matrix

- Before app edits: current source map with module/raw/standalone-Brotli table (standalone compressed rows are non-additive), graph and production-input fingerprints.
- Tooling: narrow guard fixture tests for equality, +1 B, full metadata, missing targets/invalid values, legacy compatibility and update preservation; existing scripts suite under the shared quality gate.
- Startup split: existing parser grammar/facade tests, affected i18n boot tests and packaged SSR helper bootstrap with no repository module fallback. No native runtime gate because no platform behavior changes.
- Normal production export: full entry/home bytes, exact guard `--fail`, locale chunk comparison. No runtime/API probes during code review.
- After independent review/publication by the delivery owner: mobile web then desktop home/article screenshots and console; persisted non-RU boot and existing slow/failure recovery probe on the affected boundary. Runtime backend preflight belongs to that owner.

## Risks / Trade-offs

- Exact zero-spare byte ceilings intentionally reject routine one-byte growth; deterministic normal export/input fingerprints and the user's requested ratchet justify this trade-off.
- A parser refactor could drift grammar or standalone packaging -> preserve bodies/export identity and exercise published helper paths.
- Moving entry code into another eager file could leave home unchanged -> evaluate the complete home HTML script set and proven shell consumers.
- Diagnostic annotations can distort sizes -> final actual normal export controls the pins.
- Active #3387 release owns the operation window -> no build/runtime/full-quality overlap; parent coordinates bounded windows.

## Migration Plan

Tooling changes remain optional for legacy configurations. App-source edits begin only after the active #3387 release owner releases the clean source snapshot. Review the full task diff before publication. Rollback reverts only task-owned paths; no data migration is needed. Parent owns commit/push/deploy and live acceptance.

## Superseded local-root diagnostic evidence

**Not a release reference:** F3 proved the local-root command omitted the production HUBS default and used a different absolute module layout. Its byte pins below are superseded, despite correct map/normal distinction. One diagnostic source-map-off SSR export completed at 2026-11-12T22:27:21.355Z on the reviewed shared startup/Places source freeze. The exact production environment fingerprint, Node version and all recorded bundler/minifier/serializer inputs match the diagnostic build ([identity comparison](../../../.codex-temp/task3374/after/identity-comparison.json)). No new export followed the config-only pins; the config is absent from both the before and after client graphs and does not participate in serializer inputs.

| Full delivered metric | Fixed 2026-11-12 baseline B Brotli | Actual normal B Brotli | Reduction B | Exact ceiling B |
|---|---:|---:|---:|---:|
| Entry | 233211 | 232696 | 515 | 232696 |
| Home HTML script set | 481252 | 480758 | 494 | 480758 |

In that HUBS-off diagnostic, home retains 13 requests; the travel article has 18 requests / 566272 B Brotli. Neither diagnostic initial script set contains the serving-projection validator. Its graph places the parser leaf in the 762-module initial synchronous closure; shell helper and full serving facade are outside it ([graph proof](../../../.codex-temp/task3374/after/startup-graph-proof.json)). This is source attribution, not canonical ownership proof: canonical HUBS is on. The diagnostic entry has no map/debug annotations. Its superseded legacy KiB pins were 1013/268.3/216.4 and home469.5. All unrelated ceilings remain unchanged.

BE/UK/PL/EN normal catalog bytes are SHA-256 identical to the diagnostic catalogs after removing only the trailing source-map/debug annotation pair **and the single joining newline inserted with that pair**. All earlier bytes, module IDs and loader metadata are preserved; content-hashed names are identical. This is a strict code-identity comparison, not mapped-byte headroom. Actual Brotli B: BE 130798, UK 130555, PL 126576, EN 116248. [Locale identity](../../../.codex-temp/task3374/after/locale-identity.json), SHA-256 `9f6f1dd2d60c77822d34ffa5388eadaaead37ee6c62e850ca55aafb31ebf49a6`.

RU is the default inline/per-module fallback: **there is no separate deferred RU catalog and no fifth catalog chunk was measured**. All 55 tracked RU/default registry/resource/compiler source identities match clean base b8becc9ad exactly ([RU source identity](../../../.codex-temp/task3374/after/ru-source-identity.json), SHA-256 `ed9b4e719ead993326a0b3a60542b869105205547ac30415c649cc74641a3e1d`). Existing i18n behavior checks pass (34 suites / 557 assertions).

[Actual measurements](../../../.codex-temp/task3374/after/actual-measurements.json), SHA-256 `99c47ee22d5b9c50d0eed160c2c5a1439beb38c6166e2c6f758292e40c19af8d`; [final guard report](../../../.codex-temp/task3374/after/budget-final.json), SHA-256 `2ab85dc4f05c6948d9e1990adbf68e1cf6d4019dd52a77416c89b5add15572df`: pass, no breaches. [Measured pins](../../../.codex-temp/task3374/after/pins.json) record old/new values. These are local production-build/code-level results; published revision identity, home/article console/screenshots and locale runtime acceptance remain the delivery owner's testing gate.

## Canonical reference correction (F3 reactivation)

The reference is the existing command, not a new export driver:

```bash
METRAVEL_WEB_OUTPUT=server EXPO_PUBLIC_WEB_RUNTIME_SSR=true EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR=true \
  DEPLOY=0 DEPLOY_QUIET=1 RETAIN_BUNDLE_EVIDENCE=1 scripts/deploy-prod.sh <sha>
```

The wrapper derives MT from the shared git directory, takes the shared build lock and always uses `dirname(MT)/worktrees/deploy-prod`; SHA, timestamp and mode never enter that path. Both modes symlink the same canonical node_modules. The existing build-only default remains a static preview unless the documented SSR inputs are supplied. Build-prod retains sole ownership of AI/HUBS defaults and the exporter environment. A pure shipped-function probe compared all 86 effective inputs and Expo arguments under DEPLOY=0/1: [parity receipt](../../../.codex-temp/task3374/reactivation/build-env-parity-proof.json). The source-backed module-order probe changes 3469/3999 IDs on deploy-style app-only relocation, versus zero on uniform relocation; [report](../../../.codex-temp/task3374/repro-moduleids.md). ANALYZE is dump-only.

**Chosen correction:** capture private context using the same command-local environment array as Expo after defaults/cache setup; retain bounded public client evidence before cleanup, automatically for failed builds and explicitly for successful measurements. Only scripts/deploy-prod.sh, build-prod.sh, the new scripts/lib/productionBundleEvidence.js, focused script tests, this OpenSpec, workflow docs and budget reference/pins change. No browser/app/Metro/serializer code changes. The archive contains only whitelisted JS/HTML/CSS and the public source marker, plus sanitized private receipts/report; no .env, server code, arbitrary files or symlinks. Missing/mismatched sources, report or public files make evidence ineligible. Archive errors never replace the original build/deploy exit status.

**Rejected:** factory/serializer priming to make numeric IDs portable. Absolute async-root order, relative owner hashes and loader metadata also depend on layout; fixing IDs alone is insufficient and expands into unrelated Metro architecture. Rollback reverts measurement tooling/provenance changes; failed guards continue to block publication.

Published F1 (3e70d7d6, excluding the startup split) is the canonical before reference: full entry 233377 B, normalized 233343 B, equal to canonical292's measurements. F3 full entry 232864 B and normalized 232870 B yield a like-basis observed full reduction of 513 B across these revisions. The frozen 233211 B threshold is independently recovered as a FULL historical #3316 route-file measurement; F3's margin to that requested target is 347 B. This is not a controlled same-source causal improvement. Home's fixed full aggregate threshold 481252 B exceeds F3's 480545 B by 707 B. Exact reference pins are full entry 232864/home 480545 with no padding. Normalized legacy raw/gzip/Brotli ceilings are 1011.4/268.2/216.6 KiB; home 469.3 KiB. [Canonical comparison](../../../.codex-temp/task3374/reactivation/canonical-reference-comparison.json).

All four deferred catalog filenames and full raw/gzip/Brotli measurements are identical in published F1, canonical292 and F3 (BE130802/UK130507/PL126659/EN116260 B Brotli), preserving IDs/metadata; original raw canonical JS was cleaned, so no recovered SHA equality is claimed. RU has no separate deferred chunk and retains its independently verified default source identities.

The calibration bootstrap is deliberately historical: saved F3 canonical report SHA-256 `36184f3adedce8e6eba3f1645f3718984342e6febe8baed11b851d1f44a9103f`, environment parity proof `933d214ca4a1d61d3ee500414aaf402770b4756e6030eb47c405381cdfc7704f`, layout proof `007d02f7c74b1ec7d8e9d4e9b1eca1316fae4fe1ca4d684d6700accd88916238`, browser input fingerprint `bd5e469b44b5f7472d4b09d6c63795e120093b3e3becc657eae648ad62000b55`. Home bytes are recorded at canonical build log line 589 (SHA-256 `7cd6ebf0ecbf8e3b7c24896a9a0e6da7962dc75fc0c46300d8eebb4bb1506dbd`), rather than an absent per-route JSON field. `measurementReference.raw_artifacts_retained=false` prevents this report being described as a complete retained package. No browser input path is changed by this correction.

Flag-specific source trace: `questLocaleHubs.ts` reads HUBS only in `areQuestLocaleHubsPublished`; its path builder comes from the shell, and shell imports only the parser leaf. The hook's serving-projection import is type-only. This supports the boundary but does not replace canonical delivered-code evidence. The next retained package records parser/shell/serving-export marker presence in actual home/travel/article HTML script sets, including every generated loader byte.

Validation: real stubbed wrapper tests for same path/shared deps across SHAs and modes, exact context/export env equality (including minifier/localAPI/E2E/devtools/analytics inputs), no publish in build-only mode, retention before cleanup on success/failure, redaction/allowlist/symlink rejection and invalid incomplete receipts. Source/browser-input fingerprints must match F3. The next ordinary canonical publisher, after review/push and an explicit operation window, provides real retained provenance and the final guard result; no extra diagnostic export is required or authorized.

Code checks on docs-only base `ec668d79d2aa0d20269882df590aa46c6941f0bd`: five unchanged suites / 137 tests passed in the first combined run; the wrapper suite's two fixture assumptions were corrected (exact-byte breach instead of rounded tiny KiB; explicit .log selection), then all 17 wrapper tests passed. This is composite evidence for 154 unique tests, not a fresh six-suite green run. Scoped ESLint, shell syntax, owned diffcheck and strict OpenSpec validation passed. Both launchers remain mode 100755. [First run](../../../.codex-temp/task3374/reactivation/final-quality.log), [bounded rerun/static checks](../../../.codex-temp/task3374/reactivation/final-quality-rerun.log). No new export, production traffic or Git mutation was used for this correction; publication/retained canonical ownership/runtime acceptance remain pending.
