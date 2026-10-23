## Context

See proposal.md — Why. Numeric editor first-client rendering includes Tabs/header and hides the root footer. The delivered generic NotFound document includes StandaloneScreen/NotFoundContent and the footer. Replacing only the editor spinner cannot hydrate that document correctly. Pinned Expo Router 57.0.28 supports root Stack screenLayout, but SSR08 proved that retaining only Stack is insufficient: discarding its SceneView removes nested Tabs getState registration. `core/useOnGetState.js` replaces route.state with the missing child's undefined result; `useLinking.js` then serializes the truncated route as `/?id=42`, losing returnTo/hash. The same change breaks Home and hidden-screen state. Preserve the full navigation registration while selecting one canonical rendered view.

## Goals / Non-Goals

**Goals:** match the actual delivered document at bootstrap and preserve normal navigation afterwards. Reuse all existing NotFound text, SEO, accessibility and chrome. Cover actual server markup and first client tree, including Suspense boundaries.

**Non-Goals:** authorization decisions, synthetic URLs, dependency/entry changes, backend dispatcher changes, new design or localization.

## Decisions

1. Extract the current StandaloneScreen + NotFoundContent assembly to `components/screens/NotFoundScreen.tsx`; both catch-all and root boundary reuse it. Do not import an app route into root, clone markup or eagerly import the editor/quest implementation.
2. A focused document-view helper snapshots the delivered `static-not-found` marker once, scoped to the initial numeric `/travel/<id>` digit-string shape used by the server dispatcher. Do not parse the string as a safe/positive JavaScript number: unknown0, leading-zero and long numeric URLs still receive a denial document. It stores no credentials, private fields, API response or session flag. A marker is a presentation hint, never permission. Ordinary editor200/new routes are unchanged.
3. Root Stack screenLayout always preserves its original SceneView in one stable provider/children position, including hidden routes. For the focused NotFound descriptor, render the canonical NotFound alongside it and enable a route-registration-only context. The actual Tabs navigator uses its supported `layout` prop to return an empty fragment: useNavigationBuilder/getState/action registration run before that layout, while BottomTabView, header and editor UI never render. The web catch-all returns no duplicate UI inside registration-only mode. A descriptor uses its own route/params before SceneView, since global route info can lag during a new SPA transition. Supported locale quests bypass this mode. Never replace navigation state, fake pathname or manipulate history.
4. Derive root footer/dock/layout and wizard-prefetch policy from the same document view. Keep actual pathname for navigation, analytics, focus and deep links. Denied documents register Tabs navigation without mounting Tabs/header/editor UI or prefetching wizard dictionaries. Native uses ordinary route behavior.
5. Consume the initial override permanently on first committed departure from the initial pathname; a later SPA revisit does not reapply stale denial. Auth readiness/timers must not switch a delivered404 into editor200.

The bootstrap selector is separate from generic document kind: only its own currently focused `travel/[id]` leaf with the same digit string may receive it. Read that leaf through public `navigation.getState()` for the root descriptor key; screen props deliberately strip nested state. Generic NotFound uses descriptor classification alone. Otherwise Back can focus an existing Tabs descriptor while global route info still says NotFound, briefly removing BottomTabView and remounting Home. For the same ordering reason, trust a resolved Home pathname `/` when route segments are present; only unresolved `/` with empty segments may use the initial window fallback. Linking mirrors navigation into window after the reactive route update.
6. A cold denial document must register the Tabs layout module before entry. Existing generic404 ships only root layout, whereas the authoritative editor export lists both root and Tabs layout chunks; an unresolved Tabs layout otherwise delays registration until after linking effects. Extend the existing expoStaticShell boot owner to select layout scripts from the authoritative editor HTML, validate and include their dependency closure, and ship classic defer scripts before entry in canonical NotFound documents. Never scan retained chunk generations by basename. Preserve localized quest boot/catalog logic and keep heavy editor implementation chunks lazy.
7. Memoize existing NotFoundContent Stack.Screen options by the translated title. Outside SceneView's StaticContainer, fresh options objects caused a proven setOptions render loop in SSR07. Preserve all labels, SEO and accessibility.

Alternative local LazyUpsert NotFound leaves mismatching ancestor/chrome. Dropping SceneView preserves pixels but truncates routing state (SSR08), so it is rejected. Globally changing hidden descriptors remounts prior Home state and is rejected. Prehydration history replacement, state getter repair and bare early-root404 violate routing ownership. Custom ExpoRoot linking overrides are unsupported by this pinned store; no vendor/entry rewrite is needed.

## Risks / Trade-offs

- Different server/client navigator wrappers or Suspense markers → real SSR-to-hydrate integration with root Stack boundary and actual footer/dock descendants, plus exact production export verification.
- Delayed cold layout registration → explicit pending-layout negative control, authoritative pre-entry script/dependency/order guard, then registered cold/warm SSR-to-hydrate URL/query/hash/history and navigation controls.
- Read-once marker accidentally reacts to SPA content → snapshot/lifecycle tests, consume-on-departure and owner/new/locale controls.
- Root eager import growth → import only the existing small shared NotFound screen; never a route or full quest/editor graph.
- Denial accidentally conceals authorization regressions → production cookie sessions check document and API independently for A/B/guest/admin and the same owned fixture.

## Migration Plan

Task-owned paths: `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/[...missing].tsx`, `app/[...missing].web.tsx`, shared NotFound/document-view modules including `NotFoundContent.tsx`, `scripts/lib/expoStaticShell.js` and canonical generate-seo caller/boot guards, focused SSR/unit tests, explicit production probe and shared browser assertions, OpenSpec and Problem Memory. Existing `RootWebFooter`/`WebMobileDockShell` need changes only if semantic policy requires them. Backend/nginx/entry/+html remain read-only/unmodified.

After source checks: independent review-auditor then code-review-gate, explicit commit/push main, testing, canonical production rollout and exact SHA verification. Verify cold/warm direct/reload at1440×900/390×844: B/guest private404, A/admin editor200, unknown404, nonmanager public301, new-route and SPA controls; console errors0, privacy/history/writes unchanged, screenshots and fixture cleanup. All locales reuse existing copy, native runtime unaffected. Roll back only task-owned frontend commit by canonical rollout; server access policy remains intact.
