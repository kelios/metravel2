## Context

See proposal.md for the production blocker. #2738 owns the unchanged release
budgets; #2846 owns the separately reviewed focus optimization.

Two independently verified source mechanisms are suitable for this iteration:

1. `QuestPublicLoaderScreen.web.tsx:11` imports JSON-LD functions from
   `questPublicSeo.ts`, which also synchronously imports `questRouteLoader` and
   `routeMetadata`. Those reach server transport/projection validation and the
   static route table. A presentation import therefore brings server owners
   into the client dependency graph even though the screen never calls them.
2. Installed Metro's transform worker (`src/index.js:282-289`) normalizes and
   reserves module-factory pseudo-global names unless
   `unstable_disableNormalizePseudoGlobals` is true. The installed minifier
   passes those reserved names to Terser. The existing web-only transformer
   helper is the proper owner for web name allocation; native defaults remain.

The prior ignored #2738 experiment estimates roughly 50 KB gzip from offline
re-minification of an older release, with almost no extra benefit from two or
three compression passes. This is a directional estimate, not current-build
evidence or a guarantee that every route ceiling passes.

## Goals / Non-Goals

**Goals:** preserve the module factory ABI and identical public SEO output while
removing unnecessary dependency reachability and name-allocation constraints.
The final source must pass the existing release, eager, request and named-owner
guards on one fresh coordinated export.

**Non-goals:** change compiler compression semantics, native transforms, locale
subscriptions, feature flags, serializer planning, guard arithmetic or ceilings.
Do not move code among chunks solely to evade a named-owner ceiling.

## Decisions

### Keep presentation construction separate from server metadata loading

Extract `questPublicAlternates` and `buildQuestPublicStructuredData` unchanged
into `questPublicStructuredData.ts`. The screen imports that pure owner. The
server metadata owner imports the alternate helper and re-exports both existing
names for compatibility. Preserve type-only projection imports, existing image
normalization and translation calls.

Reject renaming/removing a budget row: it would not remove the unwanted import.
Reject weakening public-projection validation: it remains on the server path.

### Use the installed web-only name-allocation switch

Set `unstable_disableNormalizePseudoGlobals: true` only in
`applyWebBuildMinifier` after its existing `EXPO_WEB_BUILD_MINIFY === 'true'`
gate. Do not change the minifier's compression or mangling configuration. A VM
fixture must run both installed native-default and web factories and compare
require/import side effects, parameter positions, exports identity and getters.

Reject higher compression passes as the primary fix: the prior offline
experiment adds negligible bytes reduction and more compilation work. Reject
removing HEIC conversion: that is a product capability decision outside scope.

### Preserve a strict measured acceptance boundary

No existing ceiling, tolerance, deferred list or marker is relaxed. After these
changes, attribute any remaining breach to actual source before proposing a
further boundary change; no sequence of unchanged failing builds is allowed.

## Ownership and Compatibility

Task-owned implementation paths:

- `components/quests/runtime/questPublicSeo.ts`
- `components/quests/runtime/questPublicStructuredData.ts` (new)
- `components/quests/runtime/QuestPublicLoaderScreen.web.tsx`
- `scripts/lib/webMinifierConfig.js`
- matching `__tests__/components/quests/questPublicStructuredData.test.ts`,
  `__tests__/scripts/bundle-composition.test.ts`,
  `__tests__/scripts/webMinifierConfig.test.ts` and
  `__tests__/utils/seasonalThemeBootScript.test.ts`
- this OpenSpec change and the existing ROUTE-BUNDLE-001 registry entry.

No API, URL, auth, analytics, storage, public text or native runtime changes.
Error, empty and slow-network handling keep their existing owners. No data or
schema migration is required.

## Risks / Trade-offs

- [Factory name allocation changes generated code] → execute the real installed
  transform/minifier and compare the factory ABI; preserve native defaults.
- [Metadata extraction changes structured data] → parity fixtures for detail,
  city/country lists, alternate locales and missing alternate data; server
  metadata tests keep the original exported API.
- [Server code remains reachable by another client import] → real local-import
  graph assertions from the screen, including a negative control that restores
  the former import; inspect resulting built chunks.
- [Expected savings do not meet all ceilings] → record the actual guard output
  and attribute remaining source; do not claim or publish a green release.

## Validation Matrix

| Boundary | Evidence |
| --- | --- |
| Compiler ABI, web-only gate | Focused minifier config tests using installed Metro/Terser and VM factories; normal native configuration unchanged |
| Client/server dependency boundary | Source graph test with former-path negative control; pure construction import must not initialize mocked server owners |
| SEO values and locales | Existing quest metadata/projection fixtures plus exact JSON-LD/alternates tests; RU/BE/UK/PL/EN values unchanged |
| Release artifact | One coordinated production server export; bundle guard has zero breaches, eager guard passes, unchanged ceilings |
| Testing after review/publication | Live production SHA and assets; mobile then desktop quest detail/city/country render, metadata and console checks; existing error/not-found behavior |
| Native/device | Source/config exclusion proof; no simulator/device run for an unchanged native contract |

No visible layout change is intended. Compatible earlier UI evidence can be
reused, but the changed published assets and SEO owners require a narrow live
probe. Field CWV is tracked independently from the release guard.

## Migration Plan

Implement and validate source checks, complete independent review and the final
code-review gate, then publish through the existing frontend pipeline. The root
session coordinates build/deploy locks. Roll back only this task's source
changes through a reviewed commit and the standard deployment rollback path;
never change the numeric limits or server paths to recover a release.
