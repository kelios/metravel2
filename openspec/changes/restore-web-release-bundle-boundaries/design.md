## Context

See proposal.md for the production blocker. #2738 owns the unchanged release
budgets; #2846 owns the separately reviewed focus optimization.

The client/server boundary is retained; the measured compiler experiment was
rejected:

1. `QuestPublicLoaderScreen.web.tsx:11` imports JSON-LD functions from
   `questPublicSeo.ts`, which also synchronously imports `questRouteLoader` and
   `routeMetadata`. Those reach server transport/projection validation and the
   static route table. A presentation import therefore brings server owners
   into the client dependency graph even though the screen never calls them.
2. Installed Metro's transform worker (`src/index.js:282-289`) normalizes and
   reserves module-factory pseudo-global names unless
   `unstable_disableNormalizePseudoGlobals` is true. The installed minifier
   passes those reserved names to Terser. The existing web-only transformer
   helper can change web name allocation without changing native defaults, but
   that compatibility proof does not establish compression savings.

The prior ignored #2738 experiment estimates roughly 50 KB gzip from offline
re-minification of an older release, with almost no extra benefit from two or
three compression passes. This is a directional estimate, not current-build
evidence or a guarantee that every route ceiling passes. The actual production
server export of `1b6321866` disproved that estimate: raw 11835.9 → 11809.5 KB,
gzip 3352.1 → 3389.4 KB and Brotli 2635.4 → 2666.7 KB. The same 223 chunks
produced 17 budget breaches instead of 11. Publication stopped before any
server mutation. The pseudo-global experiment and its dedicated fixtures are
reverted; the pure SEO boundary remains.

The reactive-locale compiler also injects a revision subscription into text-free
owners. Actual production home analysis found 27 hook calls across 11 factories:
887 bytes plus at most 44 dependency bytes. Even deleting all subscriptions,
including required ones, changes gzip only 25061 → 24980 bytes. That 81-byte
upper bound cannot close the home gap, while incomplete helper/namespace/render-
prop sensitivity analysis risks stale translations. This candidate is rejected;
the locale compiler remains unchanged.

## Goals / Non-Goals

**Goals:** preserve the module factory ABI and identical public SEO output while
removing unnecessary dependency reachability and measured redundant payloads.
The final source must pass the existing release, eager, request and named-owner
guards on one fresh coordinated export.

**Non-goals:** change compiler compression semantics, native transforms, locale
storage/lifecycle, feature flags, serializer planning, guard arithmetic or ceilings.
Do not move code among chunks solely to evade a named-owner ceiling.

## Decisions

### Keep build-time package resolution finite and visible

The full lint gate exposed opaque computed package loaders in the codec and
the retained budget-report helper. Codec imports use the existing Expo package
export subpaths literally. Report versions still resolve Expo and Metro from
the supplied source root, with the same null fallback, using literal resolvers
and JSON reads instead of a dynamic module loader.

The source graph guard previously rejected even a literal external package
with Node's standard `require.resolve(package, { paths: [root] })` API. Accept
that external terminal edge only for exactly two arguments, a literal non-local
specifier, and one `paths` property containing a literal array without spreads
or omitted elements. Preserve shadowed/mutated-loader checks and reject local,
dynamic, duplicate-property, malformed-options and extra-argument variants.
Do not hide loading behind an alias or change any reachability allowlist.
Regression fixtures cover the requested report root and malformed-package
fallback as well as the guard's positive and negative cases. Report byte
arithmetic, persistence, exit status and schema remain unchanged.

### Keep presentation construction separate from server metadata loading

Extract `questPublicAlternates` and `buildQuestPublicStructuredData` unchanged
into `questPublicStructuredData.ts`. The screen imports that pure owner. The
server metadata owner imports the alternate helper and re-exports both existing
names for compatibility. Preserve type-only projection imports, existing image
normalization and translation calls.

Reject renaming/removing a budget row: it would not remove the unwanted import.
Reject weakening public-projection validation: it remains on the server path.

### Reject the measured web-only name-allocation switch

The installed switch preserved the positional factory ABI, getters and import
side effects in VM tests but increased real release gzip by 37.3 KB and Brotli
by 31.3 KB. Restore the exact existing minifier helper and fixtures, including
`reduce_funcs: false`, reserved names and UTF-8 output. Do not replace this failed
experiment with another offline estimate.

Reject higher compression passes as the primary fix: the prior offline
experiment adds negligible bytes reduction and more compilation work. Reject
removing HEIC conversion: that is a product capability decision outside scope.

### Reject locale-owner exclusion as a bundle remedy

The quantitative upper bound above is too small to justify a compiler change.
Keep the existing owner subscriptions, helper/getter, class, custom hook,
memo/forwardRef/HOC and presentation-callback behavior unchanged. A future
independent compiler task would need conservative unknown-dependency treatment
and an independent inventory for every skipped owner; a false boolean from the
current sensitivity helper does not prove neutrality.

Reject a JSX-only predicate: a component can display translations returned by an
imported factory or getter without containing a translation call or JSX literal.
Reject removing all subscriptions from route facades: any facade with actual
locale-sensitive work must retain its subscription. Do not infer a homepage
lazy-boundary leak from a named byte breach; its eight boundaries remain intact.

Before further implementation, attribute actual generated bytes and confirm the
owned source/test paths with the coordinating root and independent architect.
Static home CSS is only a read-only candidate: moving it to the canonical global
stylesheet must remove real JavaScript parse work and demonstrate a total
transfer benefit; moving bytes merely to evade an owner row is forbidden.
Run one standard
`METRAVEL_WEB_OUTPUT=server EXPO_PUBLIC_WEB_RUNTIME_SSR=true EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR=true DEPLOY=0 ./build-prod.sh prod`
diagnostic after narrow checks and operation-lock coordination. This matches the
failed server export, preserves the build-only marker and avoids publication.
Keep the complete generated artifact for source-byte attribution;
only its actual unchanged guards can show whether the candidate is sufficient.

### Preserve a strict measured acceptance boundary

No existing ceiling, tolerance, deferred list or marker is relaxed. After these
changes, attribute any remaining breach to actual source before proposing a
further boundary change; no sequence of unchanged failing builds is allowed.

## Ownership and Compatibility

### Confirmed source platform boundary

`utils/imageCompressor.ts` returns `{uri,width:0,height:0}` on web before its
native `require('expo-image-manipulator')`, but the package is still a collected
dependency. The baseline transformed graph contains 13216 SDK characters, and
the actual shared JS contains both `manipulateAsync` and
`ImageManipulatorContext`. Add an explicit web implementation of the same
three asynchronous no-op exports. Keep native implementation and options
unchanged; share types through erased type-only imports. Do not replace this
with another runtime Platform guard. Regression checks cover exact results and
the web-resolved graph's inability to reach the native SDK.

The analogous quest video boundary has two shared-barrel consumers and a native
lazy import outside the render-time Platform branch. Move the existing player
behind a module-level platform pair, preserving web/native poster, playback,
error and revision behavior. When the native video payload is excluded, replace
its former permitted byte row with a stricter forbidden-payload control across
all JS; a missing marker alone must not constitute acceptance.

The compression interfaces live in `imageCompressor.types.ts`; both platform
owners import and re-export them type-only. Importing the shared basename from
its `.web` owner would resolve back to itself under the project's web-first
TypeScript suffix order. Native video uses the public `VideoViewProps` in one
typed component assertion because that same suffix order selects Expo's web
view declaration, whose player intersection is narrower than the native SDK
contract. This replaces the former broad unknown/any assertion without changing
player construction, props, events or lifecycle.

### Compact web loader metadata, before hashing

The retained baseline repeats completion IIFEs and async path tables in 223
chunks. Removing exactly the loader metadata recognized by the current guard
gives an upper bound of 69983 gzip bytes, not an achievable savings promise.
Keep upstream granular ownership, module IDs, required-chunk closures and URLs;
encode only the resulting service data.

Use a deterministic versioned `files -> closures -> caller-local maps` registry
and a data-only paths descriptor. The observed two IDs with different caller
closures must roundtrip independently. Do not read a registry while registering
`__d`; decode immediately before async runtime use. Preserve legacy/dev/native
and worker representations. Prefer a web-only adapter delegating to the existing
Expo async-require API over changing native or duplicating loader behavior.

Prepare the plan before `precomputeChunkFilenames`; include descriptor allocation
in stable module serialization. Put the registry and shared completion helper in
the existing runtime preModules, which precedes unsealed shared and entry chunks.
Runtime hashing needs allocation signature and hash-only dependencies on every
registry URL target, using the existing SCC implementation. These edges must not
change requiredChunks or HTML request sets. No emitted JS mutation after hashing.

Keep expanded upstream asset metadata as an independent roundtrip oracle.
Budget and closure guards must decode the emitted versioned data and validate
every reference, then run their existing checks. Named rows exclude only valid
loader data/calls; TOTAL and eager count all registry/decoder/helper bytes.
Malformed, unknown-version, missing or inconsistent registries fail closed.

Validation: actual serializer/VM roundtrip and negative fixtures for per-caller
maps, side effects, preloaded/concurrent/retried imports, resolve and readiness;
hash propagation for changed bodies/allocation/added or removed chunks/cycles;
unchanged native/dev/worker formats; emitted descriptor equality to expanded
asset paths; existing closure and full budget gates on one fresh export.

Owned implementation: `scripts/lib/webChunkMetadata*`, a web async-require
adapter/runtime helper, minimal `@expo/metro-config` patch callbacks,
`metro.config.js`, `guard-chunk-closure.js`, `guard-bundle-budget.js` and their
focused regression tests. Other active sessions own package/test-framework and
governance changes. Installed dependency mutation waits for their explicit
stable handoff; upstream repositories remain read-only.

### Home responsive CSS has one static delivery owner

The only supported application CSS channel is `app/global.css`. Move the
existing responsive-home template into a build-time CommonJS builder and a
marked generated region at the end of that stylesheet. Do not add component
CSS imports. Preserve every selector, declaration order, important flag and
canonical geometry coefficient. Lift only the pure tile/scroll/dock data into
JS plus typed declarations using the existing homeBookGeometry.js pattern;
retain their existing import paths and native API/values.

Remove the now-unneeded HomeResponsiveStyles component/import/JSX so neither
SSR body HTML nor client JavaScript repeats the stylesheet. The root layout
already delivers global CSS before paint with its normal content hash; the new
region adds no request. A generator --check and a parity fixture must reject
stale output when canonical values change. Do not introduce a TS loader or
hand-copy expanded geometry constants.

This shifts about 2-3 KB gzip into the global stylesheet for cold non-home
routes. Report that cost alongside the home HTML+JS+CSS duplicate-removal
benefit; a smaller named JS row alone is not success. Browser acceptance covers
mobile/tablet/desktop/wide-short geometry, theme and dock after review. Existing
DOM/hydration and geometry assertions remain. Native pure-data exports keep
their exact values; source/type/unit parity is the relevant boundary.

Quests catalog has no analogous CSS string in the actual artifact and is not
included in this generator. Its remaining breach requires a separate verified
dead-code/reuse fix, not assigning unrelated bytes to this CSS change.

### Lazy catalog surfaces own their private styles

The catalog already defers Sidebar and MapSection, but `QuestsScreen` eagerly
constructs their entire stylesheet and passes it as props. Therefore those
private definitions still parse/register before the deferred UI is needed.
Move only the verified five Map-private and 38 Sidebar-private keys to style
factories imported by their respective lazy owners. Keep `mapSection`,
`mapLoading`, `sidebarOverlay`, `sidebarMobile` and `desktopSidebarSlot` in core:
the root/content fallback actually reads them.

Pass the existing width/height snapshots and colors rather than introducing a
new window-height subscription. Preserve all style values, theme/dock behavior
and current lazy/preload timing. The child constructs its styles synchronously
before rendering; nothing waits for an extra stylesheet request. Remove only
the independently verified unread `actionBtn` key. Do not create new cast debt
when moving legacy declarations: reuse typed dimensional/style helpers.

Source controls reject an eager import of private factories from the catalog;
parity/geometry checks and existing Map/Sidebar/city-route tests cover values,
callbacks and responsive behavior. Record the actual catalog raw/gzip delta in
the next artifact. This fixes style ownership at existing lazy boundaries,
rather than assigning code to an unrelated shared chunk.

### Use the existing declarative redirect primitive

`trips/plan/index` hand-implements a blank route with `useRouter` and an effect.
Replace it with Expo Router's existing `Redirect href="/trips/my"` primitive,
already used by other routes. Keep blank rendering, replace navigation and
noindex metadata; do not change locale compiler policy to save this tiny row.
The actual href becomes its owner marker, replacing the removed implementation
string `replace('/trips/my')`; byte ceilings stay unchanged. The existing route
test verifies the same destination, and production QA verifies replacement
navigation. No platform-specific OS capability or native integration changes.

### Rejected production web graph optimization

The actual A/B rejected this candidate. Baseline:
11814.5/3346.5/2630.5 KB raw/gzip/Brotli, 223 chunks, eager 756.4 KB Brotli,
11 breaches. Candidate: 11896.2/3300.3/2577.5 KB, 218 chunks, eager 745.3 KB,
19 breaches. Live-binding lowering adds getters and increases several named
raw budgets. The marker for expo-video disappeared because its native-only
closure was genuinely eliminated; that does not satisfy the remaining budget.
The helper/wiring/flags have been removed from application source. Their source
and 22 passing real-runtime/compiler fixtures remain in the ignored candidate
evidence; they are not shipped as unused production helpers.

The following records the evaluated design and its constraints, not a retained
implementation:

The remaining release gap is distributed; no single proven accidental import
accounts for it. `metro.config.js:113` still forces
`experimentalImportSupport:false`, introduced with inline requires in
`e606b605c6` on 10 February. Installed Expo now defaults to ESM support. Its
production tree shaker can remove unused ESM exports and their dependencies,
whereas the existing per-module minifier cannot remove a barrel's whole graph.
The size benefit remains a hypothesis until an actual corrected baseline and
candidate export have been measured.

Use exactly one graph-optimization candidate before reconsidering the design:

- Both production web export commands in `build-prod.sh` receive command-scoped
  `EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH=1` and
  `EXPO_UNSTABLE_TREE_SHAKING=1`.
- `scripts/lib/webGraphOptimization.js` wraps the existing transform-options
  callback. Only production web with `dev:false` and graph optimization enabled
  gets `experimentalImportSupport:true`; preserve inline requires and all other
  options. Native, development and flag-off results remain unchanged.
- Keep the installed serializer rather than introducing a project tree shaker.
  Installed `withExpoSerializers` runs tree shake and reconcile before the final
  granular strategy constructs raw atoms and assigns IDs. Our merge consumes
  the resulting module paths and ownership, so removed modules must not be
  reintroduced. Keep the closure guard and all existing delivery budgets.
- The CLI excludes the ordinary SSR `environment:node` bundles from graph
  optimization. Existing Babel server-export removal and loader references stay
  authoritative; no forced `optimize:true` or native build flags.

Metro's transform-options callback receives platform/dev, not the environment.
The ESM option therefore also applies to the production web server transform;
only graph optimization is excluded there by the CLI. Do not claim identical
server transform bytes. Validate server-render metadata, server-loader exports
and live SSR behavior alongside the optimized client.

Reject narrowing MIME tables, removing HEIC, or replacing lists to force a size
pass: those change independent product contracts. Reject moving code from a
named chunk into shared without reducing its actual delivery graph. The failed
factory-name experiment remains rolled back.

Validate the wrapper's web/native/development matrix and unchanged options,
real installed optimizer behavior and source compiler/loader regressions. Then
retain the fresh baseline and candidate artifacts, their source/config identity,
guard output and attribution. Stop this candidate on broken side effects,
exports, loaders, locale subscriptions, native defaults or chunk closure, or
when the actual export fails to improve the byte budgets. A source/fixture pass
does not count as release success.

Follow-up #2847 separately makes exact deployment reports survive cleanup with
a bounded retention policy and a real comparison consumer. It does not block
or replace this task's unchanged zero-breach requirement.

Task-owned implementation paths:

- `components/quests/runtime/questPublicSeo.ts`
- `components/quests/runtime/questPublicStructuredData.ts` (new)
- `components/quests/runtime/QuestPublicLoaderScreen.web.tsx`
- `scripts/lib/webMinifierConfig.js` (restore the rejected experiment)
- matching `__tests__/components/quests/questPublicStructuredData.test.ts`,
  `__tests__/scripts/bundle-composition.test.ts`,
  `__tests__/scripts/webMinifierConfig.test.ts` and
  `__tests__/utils/seasonalThemeBootScript.test.ts` (restore experiment fixtures)
- this OpenSpec change and the existing ROUTE-BUNDLE-001 registry entry.

No API, URL, auth, analytics, storage, public text or native runtime changes.
Error, empty and slow-network handling keep their existing owners. No data or
schema migration is required.

## Risks / Trade-offs

- [Compiler estimate disagrees with export] → the measured factory-name change
  is rejected; local diagnostics precede any further speculative deployment.
- [Locale sensitivity is missed for negligible gain] → locale-owner exclusion
  rejected from measured upper bound; compiler/runtime/store remain unchanged.
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
| Minifier rollback | Existing UTF-8 configuration and seasonal serialization regressions; exact pre-experiment config restored |
| Rejected graph optimization | 22 real installed optimizer/VM/compiler tests passed, but actual artifact failed; wiring restored and experiment kept only in ignored diagnostics |
| Rejected locale compiler candidate | Actual home upper bound 931 raw / 81 gzip bytes; no compiler or lifecycle source changes |
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
