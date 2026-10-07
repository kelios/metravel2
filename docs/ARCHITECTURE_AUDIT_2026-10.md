# Architecture & Technical Debt Audit — October 2026

Scope: the Expo SDK 57 / React Native 0.86 / react-native-web 0.21 app in this
repository (web, Android, iOS). Backend is out of scope except where the client
contract leaks into the frontend.

Date: 2026-10-07. Baseline commit: `0b38a4a`.

How to read this document: issues are catalogued by area with a stable ID
(`NAV-1`, `SEC-2`, …) and the eight required fields. Sections A–I at the end
rank, group and plan them. Everything quoted with `path:line` was read in the
code during this audit. Items marked **(hypothesis)** were not confirmed at
runtime (no device or production run was part of this audit).

## 0. Method and evidence

- Static checks run in this audit: `tsc --noEmit` → 0 errors (56 s);
  `eslint . --max-warnings=0` → 0 problems; `madge --circular` over
  2 255 files → 19 cycles (section CQ-5). Dependencies installed with
  `yarn install --frozen-lockfile`.
- Size: ~418 k LOC of product source. `components/` alone is 1 191 files /
  241 k LOC; `utils/` 291 files / 41 k LOC; `hooks/` 172 files / 30 k LOC.
  33 source files exceed the project's own 800-LOC guard; 73 exceed 700.
- Eight parallel read-only audits (navigation/lifecycle/push/permissions,
  state, API/security, performance, hooks/forms/errors, code quality,
  testing, build/dependencies), each cross-checked on the highest-impact
  items by re-reading the cited code.
- Metrics gathered directly: ~3 300 `any` casts/annotations in non-test
  source (`guard-type-debt` tracks only `as` casts, see TS-1); 31
  `@ts-ignore`; 235 `console.*` calls in product code (stripped in
  production except `console.error`); 1 911 `Platform.OS` checks; 141
  platform-suffixed files; 57 files touch `AsyncStorage`; 1 649 Jest test
  files; 140 Playwright specs.

## 1. Overall architecture (what exists today)

```
entry.js → app/_layout(.web).tsx           providers, QueryClient, splash, theme
         → app/(tabs)/_layout.tsx          ONE Tabs navigator, tab bar hidden
           ├ app/(tabs)/**                 ~60 routes (details, lists, auth, legal…)
           └ app/*.tsx                      a few root routes (privacy, blocked-users…)
components/   feature UI + components/screens/*   (38 screen compositions)
screens/      screens/tabs/* (33 files)           (map, places, quests, userpoints)
hooks/        feature hooks, autosave, map controllers
api/          fetch layer (api/client.ts) + per-domain modules + React Query keys
stores/       14 Zustand stores (auth, route, map panels, travel status, …)
context/      Auth (thin wrapper over Zustand), Favorites, MapFilters
services/     offline catalog, push, notifications, pdf-export, book export
utils/        291 files — formatting, geo, html sanitising, validation, caches…
i18n/         5 locales (RU/BE/UK/PL/EN), inline babel plugin on web
```

Server state: TanStack Query v5 with an AsyncStorage persister (whitelisted
keys, 7-day max age). Client state: Zustand. Auth: HttpOnly cookie on web,
SecureStore tokens on native, single token writer (`utils/authTokenStore.ts`).
Maps: Leaflet on web, Leaflet-in-WebView on native. Rich text: Quill on web,
`react-native-render-html` on native. Build: Metro for all platforms, static
web export, local Gradle for Android, Xcode/EAS for iOS. Governance: 30+
guard scripts in `scripts/` wired into `npm run lint` and pre-push preflight.

What is genuinely good and should be preserved:

- Auth core: one token writer with a queue, 401 confirmed by a probe before
  logout, epoch counters against login/logout races, identity-change cache
  purge with a credentials barrier (`api/identityQueryCache.ts`).
- Query layer hygiene: central `api/queryKeys.ts` with identity-scope tests,
  AST-based retry-policy guard, narrow persisted-cache whitelist.
- `api/` has zero `any`; responses go through `safeJsonParse<unknown>` and
  normalisers. `components/ui` imports nothing from features or `api/`.
- Autosave vs. manual save: monotonic revisions, no preemption, back-off while
  the server may still be working, last-request queue.
- Web performance budgets: eager-bundle guard, bundle-size budget, Lighthouse
  mobile budget, deferred-loading registry; FlashList catalog tuned from
  measurements.
- Deep-link parser is fail-closed (control chars, dot segments, credentials,
  ports rejected); post-login redirect validation is strict.
- Expo-managed native libraries are exactly on SDK 57's expected versions;
  patches carry issue numbers and `patch-package --error-on-fail`.

## 2. Issue catalogue

Field legend — **Sev**: critical/high/medium/low · **Where** · **Why** ·
**Risk** · **Fix** · **Effort**: S (<1 day) / M (1–3 days) / L (>3 days) ·
**RR** (refactoring risk): low/medium/high · **Deps**.

### 2.1 Navigation (NAV)

**NAV-1 — Android back handlers run on screens that are not visible.**
Sev: high. Where: `hooks/useAndroidBackHandler.ts:41-84` (no focus gate,
re-subscribes on every `pathname` change at :76); tabs keep screens mounted
(`app/(tabs)/_layout.tsx:251-252`); callers `components/screens/calendar/CalendarScreen.tsx:348`,
`components/screens/messages/MessagesScreen.tsx:244`, `app/(tabs)/articles.tsx:73`,
`components/layout/BottomDock.tsx:194`. Why: `BackHandler` picks the newest
subscription, so the handler that wins depends on render order, not on the
visible screen. Risk: Calendar's handler sends the user to `/profile` from an
unrelated screen; Messages closes an invisible thread. Fix: subscribe inside
`useFocusEffect` and keep `pathname` in a ref. Effort: S. RR: low. Deps: none.
→ **Fixed in Phase 1 (this change set).**

**NAV-2 — Every route lives in one Tabs navigator with the tab bar hidden.**
Sev: high. Where: `app/(tabs)/_layout.tsx:236-302`; detail routes
`travels/[param]`, `article/[id]`, `quests/[city]/[questId]`, `trips/*`,
`user/[id]` are tab screens. Why: expo-router turns PUSH into NAVIGATE for
non-stack navigators, so there is no native stack, no iOS swipe-back, screens
are never unmounted, and A→B navigation between two travels reuses one screen.
Risk: memory growth, the per-screen back workarounds (#548, #573, #1725,
#1727, `resolveBack`) keep multiplying. Fix: move detail families into a
nested `Stack` and keep only real sections in Tabs; stage one route family at
a time behind e2e coverage. Effort: L. RR: high. Deps: NAV-1, NAV-6, DL-2.

**NAV-3 — Typed routes are enabled but bypassed.** Sev: medium. Where:
`app.json` `typedRoutes: true`; ~74 `as any`, 15 `as never`, 13 `as Href`
around `router.push/replace` (e.g. `app/contact.tsx:219`,
`app/(tabs)/export.tsx:103-139`); `utils/routes.ts` exists. Why: casts hide
broken hrefs. Risk: dead links after a route rename. Fix: generate route types
before `tsc` in CI, then remove casts under a type-debt budget. Effort: M. RR:
low. Deps: TS-2.

**NAV-4 — Type-checking only sees the `.web` variant.** Sev: medium. Where:
`tsconfig.json` `moduleSuffixes: [".web", ".native", ""]`. Why: a drifting
`.native` signature (e.g. `components/MapPage/Map.ios.tsx:182` uses its own
`TravelProps`, not `Map/types.ts` `MapProps`) is never type-checked against
consumers. Fix: add `tsconfig.native.json` (`[".native", ""]`) and run both in
CI; or share one `Props` type with `satisfies`. Effort: S. RR: low. Deps: root
file allow-list in `scripts/guard-root-scratch-artifacts.js` (owner approval
needed for `scripts/`).

**NAV-5 — Duplicated route variants.** Sev: medium. Where:
`app/(tabs)/login.native.tsx`, `registration.native.tsx`,
`set-password.native.tsx` are byte-identical to their base files;
`userpoints.native.tsx` differs only in comments; `app/(tabs)/article/[id].tsx`
is unreachable (both `.web` and `.native` exist) and has drifted (renders
`ArticleRatingSection`); `export.tsx:103-139` and `export.native.tsx:57-93`
duplicate the empty state. Fix: delete the identical copies, make the article
base a shared component. Effort: S. RR: low. → **Identical copies removed in
Phase 1.**

**NAV-6 — Four "return to" params and three validators.** Sev: medium. Where:
`redirect`, `returnTo`, `from=<path>`, `from=profile`;
`utils/authNavigation.ts:22-60` (strict), `utils/navigationReturnPath.ts:14-21`
(no decoding), `utils/articleNavigation.ts:7-20` (decodes once, allows `\`).
Fix: one `safeInternalHref()` built on the auth validator; one param name.
Effort: M. RR: low. Deps: none.

**NAV-7 — Back-navigation guard gap.** Sev: low. Where:
`scripts/guard-no-inline-back-navigation.js` matches only `canGoBack()`; bare
`router.back()` at `app/(tabs)/user/[id].tsx:239` is a no-op from a deep link.
Fix: use `goBackOrReplace`, extend the guard. Effort: S.

**NAV-8 — Stale startup decisions.** Sev: low. `travels/[param]` eager at
native cold start (`_layout.tsx:224-227`, no rationale); root
`GestureHandlerRootView` removed "verify pending 2026-06-11"
(`app/_layout.tsx:25-29`) and the dock's More sheet disabled because of it
(`BottomDock.tsx:56-60`), though nested roots work elsewhere. Re-verify.

### 2.2 Deep links (DL)

**DL-1 — Android App Links claim the whole domain, the app accepts a few
paths.** Sev: high. Where: `app.json` intent filter `pathPrefix "/"` with
`autoVerify`; `public/.well-known/assetlinks.json` `handle_all_urls`;
allow-list `utils/incomingAppLinks.ts:107-176`. Why: `/accountconfirmation?hash=`,
`/subscribe/confirm?token=`, `/set-password`, `/articles`, `/quests/<city>`,
`/search` open the installed app and are dropped (home on cold start). iOS
limits paths via the server AASA, so platforms disagree. Fix: generate the
intent-filter paths, AASA components and the allow-list from one route
manifest; or restrict the intent filter. Effort: M. RR: medium (device QA).
Deps: `app.json` change needs owner approval per `AGENTS.md`.

**DL-2 — Three-plus route tables.** Sev: medium. `utils/incomingAppLinks.ts`
(OS links), `utils/siteLinks.ts:69-117` (in-app, tested against `app/`),
AASA, intent filter. Merge into the DL-1 manifest. Effort: M.

**DL-3 — Quest return reminder opens nothing when tapped.** Sev: medium.
Where: `services/notifications.ts:490` builds `url: /quests/<city>`;
`isSupportedRoute` (`utils/incomingAppLinks.ts:136-148`) accepts 3-segment
paths only for `travels|article|user|trips`. No test. Fix: allow `/quests`
and `/quests/<slug>`, add tests. Effort: S. → **Fixed in Phase 1.**

**DL-4 — Links may be handled twice on Android once stack routes exist.**
Sev: low. `hooks/useIncomingAppLinks.native.ts:63-75` plus expo-router's own
`Linking` listener; de-dupes only its own pushes. Deps: NAV-2.

### 2.3 App lifecycle (LC)

**LC-1 — No foreground refetch on native.** Sev: medium. Where:
`utils/reactQueryConfig.ts:57` `refetchOnWindowFocus:false`; React Query's
`focusManager` is never wired to `AppState`; `queryConfigs.critical`
(`:133`) is a no-op on native. Risk: an app resumed after hours shows stale
lists. Fix: `AppState` → `focusManager.setFocused`, enable focus refetch for
native only. Effort: S. RR: low.

**LC-2 — Two `QueryClient`s.** Sev: medium. Where: mounted client
`app/_layout.tsx:242-257` (via `api/activeQueryClient.ts`); module singleton
`api/queryClient.ts:7-9` used by `api/geoQueries.ts:237` whose comment
(:230-233) wrongly claims a shared cache. Risk: duplicate geocoding requests,
singleton never purged on identity change, inherits defaults the mounted
client overrides (mutation retry). Fix: `getActiveQueryClient()` in
`fetchReverseGeocode`, delete the singleton and the root `queryClient.ts` /
`queryKeys.ts` shims (13 importers). Effort: S. RR: low.

**LC-3 — Timers/listeners left running.** Sev: low.
`components/ui/SyncIndicator.tsx:50` nested `setTimeout` never cleared;
`hooks/map/useMapUserLocation.ts:132` `Promise.race` timeout not cleared;
`utils/networkErrorHandler.ts:201-206` `online` listener leaks if the network
never returns; 8+ independent `AppState` listeners. → **SyncIndicator fixed
in Phase 1.** Product check: `BiometricGate.native.tsx` locks only on cold
start, not on resume.

### 2.4 Push notifications (PUSH)

**PUSH-1 — Quest notifications use the LOW-importance channel.** Sev: medium.
Where: `services/notifications.ts:66` (`recommendations`, importance 2) used
at `:396`, `:436`, `:491` for geofence arrival and quest reminders. Risk: no
sound, no heads-up on Android. Fix: dedicated `quests` channel at DEFAULT.
Effort: S. Localisation: all five locales. → **Fixed in Phase 1.**

**PUSH-2 — Local reminders survive logout.** Sev: medium.
`questReminderId(questId)` (`:337-339`) is not owner-scoped;
`cancelAllScheduledNotificationsAsync` is never called. Risk: previous user's
quest titles appear for the next account on a shared device. Fix: cancel
scheduled reminders in `authStore.logout` / identity change. Effort: S.

**PUSH-3 — Duplication and drift.** Sev: low. `services/notifications.web.ts`
duplicates types and `NOTIFICATION_CHANNELS`; response de-dupe window is 1 s
(`hooks/usePushNotifications.native.ts:41`); deprecated `shouldShowAlert`
(`:209`); `services/pushRegistration.native.ts:101` prefers a pending token
over a fresh one.

### 2.5 Permissions (PERM)

**PERM-1 — iOS photo-library permission gate blocks a picker that needs no
permission.** Sev: medium. Where: `components/travel/PhotoUploadWithPreview.tsx:90-96`,
`hooks/useAvatarUpload.ts:86-92`, `components/quests/QuestReviewPhotoPicker.tsx:192-197`,
`components/article/ArticleEditor.ios.tsx:245`,
`components/travel/ImageGalleryComponent.ios.tsx:243`. Verified against the
installed module: `expo-image-picker/ios/ImagePickerModule.swift:65`
(`launchImageLibraryAsync`) has no permission guard while `launchCameraAsync`
(`:57`) does; the picker is `PHPickerViewController`. Risk: users who once
denied photo access are locked out of uploads; everyone sees an unneeded
prompt. Fix: drop the gate, keep the camera check. Effort: S. RR: low (iOS
device QA recommended).

**PERM-2 — Permission requests are scattered.** Sev: medium. ~8 location
request sites (`hooks/map/useMapCoordinates.ts:568`, `useMapUserLocation.ts:118`,
`usePointsRecommendations.ts:65,186`, `screens/tabs/QuestsScreen.tsx:279`, …)
and ~7 image-picker sites with inconsistent denied-state handling; some call
`Linking.openSettings` directly despite `openSystemSettings`
(`utils/externalLinks.ts:204`). Fix: one `services/permissions.ts` with
request → rationale → open-settings. Effort: M.

**PERM-3 — Location prompt without user intent.** Sev: medium.
`hooks/usePointsRecommendations.ts:46-75` requests location on mount (web:
high-accuracy geolocation on page load). Ask on user action. Effort: S.

**PERM-4 — Dead geofencing would request background location.** Sev: medium
(latent). `services/questGeofencing.native.ts:176-178` returns early
(`expo-task-manager` not installed) but `:141-161` would request background
location, which `app.json` forbids. Remove or gate behind a deliberate config
change. Effort: S.

**PERM-5 — `expo-media-library` installed, configured, never imported.**
Sev: low. Remove the dependency and plugin entry (iOS release guard checks
the plugin list — update together). Effort: S. Deps: owner approval for
`app.json`.

### 2.6 Keyboard and safe area (KB)

**KB-1 — Two contradicting Android keyboard rules.** Sev: high. Where:
`components/travel/upsert/wizardKeyboard.ts:5-15` ("adjustResize resizes, KAV
is a no-op") vs `hooks/useSoftKeyboardInset.ts:72-77` ("root does not resize
under edge-to-edge"). 20 files rely on `KeyboardAvoidingView` (`LoginForm.tsx:48`,
`RegistrationForm.tsx:348`, wizard steps, `QuestWizard.tsx:818`); 5 use the
inset hook; `calendarScreen.parts.tsx:354` and `QuestInaccuracyReportModal.tsx:134`
use `behavior="height"` on Android (double compensation under rule 1). Risk:
inputs hidden behind the keyboard or jumping content; which rule holds needs an
Android 15 device check. Fix: one keyboard primitive (e.g.
`react-native-keyboard-controller`) plus a guard banning raw KAV. Effort: M.
RR: medium.

**KB-2 — Small issues.** Sev: low. `useSoftKeyboardInset` listens to
`keyboardDidShow` (late on iOS); `calendarScreen.styles.ts:274` hard-codes a
36 px bottom pad instead of `insets.bottom`.

### 2.7 Offline (OFF)

**OFF-1 — "Online" means different things.** Sev: medium.
`utils/queryOnlineManager.ts:15-17` requires `isInternetReachable !== false`;
`hooks/useNetworkStatus.ts:58-61` exposes only `isConnected`; 6 consumers
check only that (`SyncIndicator`, `NetworkStatus`, `MapScreen:223`,
`useMapTravels:236`, `useQuestsApi:275`, `useQuestProgressQueueRuntime:21`).
Risk: captive-portal Wi-Fi: queries pause, UI says online, quest queue flushes
and fails. Fix: one `isOnline` from React Query's `onlineManager` via
`useSyncExternalStore`. Effort: S–M.

**OFF-2 — Saved copies only used when the device reports offline.** Sev:
medium. `hooks/useTravelDetails.ts:353-361`; likely `api/articles.ts:304,347`
(hypothesis). Fix: fall back to the saved package on network errors too.
Effort: S.

**OFF-3 — Leftovers.** Sev: low. `hooks/useOfflineCatalog.ts:24-31` `refresh`
has no error handling (unhandled rejection, `isLoading` stuck) and no stale
guard on user switch → **fixed in Phase 1**; `offlineOperations` memory-only;
`useOfflineTravelCache`, `getOfflineTravelCached*` unused; `SyncIndicator`
shows "syncing" for a fixed 3 s.

### 2.8 State management (ST)

**ST-1 — Device-only favorites live only in the React Query cache and get
wiped.** Sev: high. Where: `hooks/useFavoritesData.ts:61-82,161-174`
(article favorites, Android-guest favorites); identity reset
`stores/authStore.ts:687-722` → `api/identityQueryCache.ts:26-33`; persister
`utils/queryPersist.ts:30-33` (7 days, buster `v1`); default `gcTime` 10 min
(`utils/reactQueryConfig.ts:27`). Why: logout/401 drops `favorites(userId)`,
the persister then saves a snapshot without them; `favorites(null)` has no
subscribers after login and is garbage-collected; nothing merges guest
favorites into the account although the toast promises a sync
(`hooks/useFavoriteToggle.ts:113-116`); `getGuestFavoritesStorageKey`
(`utils/guestTrialState.ts:16`) is dead. Risk: silent data loss. Fix: move
device-only favorites to a persisted Zustand store keyed by owner (pattern:
`stores/hiddenContentStore.ts`), merge on login or reword the toast. Effort:
M. RR: medium. Deps: product decision;
`__tests__/stores/authStore.identityCacheReset.test.ts` asserts the drop.

**ST-2 — Map filters context memo misses `isBusy`.** Sev: medium-high.
Where: `context/MapFiltersContext.tsx:121-160` hand-written dependency list
omits `isBusy` (declared `:41`, produced
`hooks/map/useMapFiltersPanelProps.ts:258`). Why: `FiltersPanel.tsx:76` /
`FiltersPanelBody.tsx:126` read a stale value and show "nothing found" while
loading. Fix: derive dependencies from an exhaustive key list checked at
compile time. Effort: S. → **Fixed in Phase 1.**

**ST-3 — `useAuth()` subscribes every caller to the whole store.** Sev:
medium. `context/AuthContext.tsx:117-119` `useAuthStore(useShallow(s => s))`,
72 call sites incl. per-comment `CommentItem.tsx:28` and `BottomDock.tsx:163`;
`checkAuthentication` makes 2–4 writes during boot. Fix: `useAuth(selector)`
or split `useAuthIdentity()` / `useAuthActions()`, codemod call sites.
Effort: M. RR: low.

**ST-4 — Every favorite heart re-renders on any favorites/history change.**
Sev: medium. `context/FavoritesContext.tsx:189-206` returns the whole list +
history + a fresh `isFavorite` closure; `FavoriteButton.tsx:56` subscribes
per card; `React.memo` (`:278`) is defeated. Fix: `useIsFavorite(id, type)`
via `useQuery({ select })`. Effort: S–M. Deps: ST-3.

**ST-5 — Server profile data copied into the auth store.** Sev: medium.
`stores/authStore.ts:375-381,398-420` (username/avatar/isPremium),
`hooks/useUserProfile.ts:81-84` effect-sync, `profileRefreshToken` hand-made
cache buster (`useAvatarUri.ts:131`); `isPremium` stale until re-login
(`PdfEntitlementSource.ts:24`); `isSuperuser` restored from client storage
(`authStore.ts:303,378`) and gates 19 components (UI only — server
enforcement assumed). Fix: keep `userId/isAuthenticated/authReady` in the
store, read display fields and entitlements from the profile query. Effort:
M–L. RR: medium. Deps: ST-3.

**ST-6 — Hand-rolled optimistic updates with full-snapshot rollback.** Sev:
medium. `hooks/useFavoritesData.ts:187-195`, `stores/travelStatusStore.ts:439,455`;
no `cancelQueries`; `refreshFavoritesFromServer` (`:85-93`) can join an
in-flight fetch that predates the mutation (hypothesis). Fix: `useMutation`
with `onMutate` snapshot, per-item rollback, `onSettled` invalidate. Effort:
M. Deps: ST-1.

**ST-7 — Retry policies contradict the project's own rule (#2184).** Sev:
medium. `utils/reactQueryConfig.ts:30-51` retries 500 twice and never
retries connection failures; `utils/queryRetryPolicy.ts` says the opposite;
`scripts/guard-query-retry-policy.js` checks only per-query overrides;
mutations default to `retry: 1` (`:65-71`) and only the mounted client
overrides it (`app/_layout.tsx:245-247`); uploads retry on 504
(`api/clientTypes.ts:13`) although `api/clientErrors.ts:66-79` documents 504
as "server still working" (duplicate images, no idempotency key except
`api/questReviewPhoto.ts:119`). Fix: default `retry` → `readRetryTwice`,
mutations → `false` (**done in Phase 1**), decide on 504 for uploads with the
backend (idempotency key). Effort: S. RR: low–medium (behaviour change;
`__tests__/utils/reactQueryConfig.test.ts:88-94` encodes the old policy).

**ST-8 — Filter dictionaries cached three ways.** Sev: medium.
`api/miscOptimized.ts:13-14,91-118` (module TTL cache + in-flight dedupe),
`hooks/useFilterOptions.ts` (React Query, 30 min), `hooks/useTravelFilters.ts:251-296`
and `hooks/map/useMapFilters.ts:78-130` (manual fetch into `useState`).
Fix: one React Query query per dictionary; imperative callers use
`queryClient.fetchQuery`; delete the module cache. Effort: M. RR: medium.

**ST-9 — Persisted Zustand stores not hydration-gated on static web
(hypothesis).** Sev: medium. `stores/listViewStore.ts` reads `localStorage`
synchronously; `ListTravelBase.tsx:91` reads `density` on first render;
`app.json` `output: "static"`. Risk: React #418 mismatch + CLS for users with
`compact` density. Fix: `useHydrationReady()` gate or `skipHydration` +
`rehydrate()`. Effort: S.

**ST-10 — Smaller state issues.** Sev: low. Dead `context/FiltersProvider.tsx`
(tests only); unreachable provider deferral (`app/_layout.tsx:405-406`
hard-codes `false`, so `AppProviders.tsx:48-130` and
`AppProvidersDeferredRuntime.tsx` never run); provider order differs between
web (`AppProviders.tsx:136-167`, Auth/Favorites outside
`PersistQueryClientProvider`) and native (`AppProviders.native.tsx:23-29`);
`mapPanelStore.ts:80-85` deprecated nonces written never read;
`transportMode` stored twice (`useMapFilters.ts:96-98` vs
`routeStore.ts:268-271`); `routeStore` and `searchHistoryStore` not keyed by
owner nor cleared on logout; query-key guard bypassed by string props
(`HomeNewRoutesSection.tsx:15` → `HomeInspirationSection.tsx:156`,
`api/blockSensitiveQueries.ts:52-58`); mock catalogs imported statically
(`api/gamification.ts:14-18`, `api/publicTrips.ts:20-24`,
`api/plannedTripsRequests.ts:23`, ~24 KB) while `achievementsRequests.ts:54-57`
already uses a dynamic import.

### 2.9 API layer and networking (API)

**API-1 — ~40 % of API modules bypass `apiClient`.** Sev: medium. 15 modules
call `fetchWithTimeout`/`fetch` directly (`api/auth.ts` 13×, `api/map.ts` 8×,
`api/misc.ts` 6×, `api/travelListQueries.ts` 6×, `messages`, `places`,
`articles`, `subscriptionLinks`, `travelUserQueries`, `appleAuth`);
`api/external/serverRouting.ts:35` uses plain `fetch` with no timeout; clones
`api/messages.ts:29-68` (`messagingFetch`) and `api/publicFetchWithSession.ts`;
13 hand-built `Authorization: Token` headers; the `resolveApiBaseUrl` block is
copied in `misc.ts:26-44`, `places.ts:15-26`, `mapOffline.ts:25-28`,
`travelQueryShared.ts:7-23`, `articles.ts:15-30`, `map.ts:262-278`;
`LONG_TIMEOUT` redefined in 6 files; error shapes vary (`ApiError`,
`Error("HTTP 500…")`, `OFFLINE_MAP_POINTS_HTTP_500`, silent `[]`;
`auth.ts:220` regex-parses the status back out of a message). Risk: each
bypass misses the 401 probe, rate limiter, CSRF and consistent errors. Fix:
import base URL/timeouts from `api/apiConfig.ts`; add `apiClient.requestRaw()`
for ETag/304 callers; standardise on `ApiError`. Effort: M–L. RR: medium.

**API-2 — Failed writes are re-sent anonymously after a 401.** Sev: medium.
`api/client.ts:472-488` (any method), `download()` `:640-650`. Risk: on
endpoints that accept anonymous calls (telemetry, quest results) user data is
saved as anonymous; doubled write traffic. Fix: limit the anonymous retry to
GET/HEAD. Effort: S. RR: low (the fallback path has tests:
`__tests__/api/client.test.ts:492-714`).

**API-3 — Logged-in web responses stored in guest-only module caches that
survive logout.** Sev: medium. `api/travelDetailsQueries.ts:489-494,572-578`
compute `isAuthenticated` from the native token store, which is always empty
on web (cookie auth, `utils/authPlatform.ts:22`), so personal payloads go into
`travelCache`/`travelSlugCache` (`:25-27`), which also have no size limit or
TTL and are only cleared per key by `utils/travelQueryInvalidation.ts`. Fix:
decide "authenticated" from `useAuthStore` (treat `!authReady` as
authenticated), clear the maps on identity change, cap the size. Effort: S.
→ **Fixed in Phase 1.**

**API-4 — Abort signals mostly not forwarded.** Sev: low. ~54 `queryFn`s
ignore the React Query signal; `apiClient.post/put/patch/delete` accept no
options (`api/client.ts:692-727`). Effort: M.

**API-5 — Dead or misleading client code.** Sev: low. `uploadFile`
(`api/client.ts:733-798`) has no app callers (only `scripts/upload-quest-media.js`
and a test); the private `checkNetworkStatus()` always returns `true`
(`:319-321`), so its two `isOnline` branches are dead; refresh flow
(`:136-225`) disabled by `backendHasRefreshEndpoint=false` and has a herd
problem; `api/misc.ts:448-454` doc says "raw Response" but returns the body.
Effort: S.

**API-6 — Validation/parsing edge cases.** Sev: low. `utils/security.ts:29-43`
strips `on\w+=` from user text (corrupts input; escape on output instead);
`api/clientResponse.ts:111-139` turns a non-JSON 2xx into `null` that looks
like success; `api/auth.ts:388-407` retries registration after a connection
failure (account may already exist). Effort: S.

**API-7 — Duplicated upload logic.** Sev: low. `/upload` FormData built in
5 places (`hooks/usePhotoUpload.ts:132-140,281-289`,
`hooks/useMarkerImageUpload.ts:267-270`, `api/questReviewPhoto.ts:108-119`,
`components/article/articleEditorMediaHelpers.ts:170-173`);
`hooks/useAvatarUpload.ts:75-118,171-210` duplicate picker + compression.
Fix: one `api/uploadMedia()` (also the right place for an idempotency key).
Effort: M.

### 2.10 Security (SEC)

**SEC-1 — Client guard on backend-sanitised HTML is bypassable (defence in
depth).** Sev: medium. `utils/serverSafeHtml.ts:12-41`; when `safe_html` is
present `components/travel/stableContent/htmlTransform.ts:837` and
`components/article/SafeHtml.tsx:58` skip `sanitize-html` and render via
`dangerouslySetInnerHTML` (`StableContent.web.tsx:111`, `SafeHtml.tsx:194`).
Gaps: iframe `srcdoc` unchecked; attributes separated by `/` instead of
whitespace; entity-encoded schemes. Combined with the nginx CSP that allows
`'unsafe-inline' 'unsafe-eval'` and `cdn.jsdelivr.net` (`nginx/nginx.conf:332`,
backend-owned) a backend sanitiser slip becomes stored XSS and `csrftoken` is
readable from `document.cookie`. Fix: run `sanitizeRichText` on `safe_html`
too (one parse), strip `srcdoc`, decode entities; longer term nonce/hash CSP
(`app/+html.tsx` has 25 inline scripts) — `area=back` task. Effort: S–M / L.

**SEC-2 — Cross-user data on a shared device.** Sev: medium. Travel drafts
`metravel_travel_draft_new|_<id>` (`hooks/useDraftRecovery.ts:210,271-275`) and
wizard step keys (`useUpsertTravelController.ts:124`) are not user-scoped;
logout removes only 4 keys (`stores/authStore.ts:657`); expired drafts are
swept only when the same editor reopens (`useDraftRecovery.ts:335-338`);
plus PUSH-2, ST-10 (route/search stores), API-3. Fix: `userId` in draft keys
with legacy-key migration, clear drafts/reminders on logout, sweep >24 h at
boot. Effort: S–M. RR: low. Deps: `__tests__/hooks/useDraftRecovery.test.ts`
builds keys by hand.

**SEC-3 — Third-party API keys in the client.** Sev: low. `EXPO_PUBLIC_ORS_API_KEY`
(`MapRouteEngine.tsx:78`, `TripRoutePreviewEngine.tsx:35`),
`EXPO_PUBLIC_OWM_API_KEY` (`weatherTempLabelsOverlay.ts:193`,
`nativeWeatherTempLabelsScript.ts:6`). A backend routing proxy exists
(`/routing/route/`). Fix: drop the ORS fallback, proxy weather. Effort: M.

**SEC-4 — Secrets guard only scans config files.** Sev: low.
`scripts/guard-env-secrets.js:8`; `process.env.PROD_API_URL` read in 9 client
places (never inlined → always undefined → hard-coded fallback); no
`.env.example` for `EXPO_PUBLIC_*`. Effort: S (scripts — owner approval).

**SEC-5 — Fake "encryption" in web secure storage.** Sev: low.
`utils/secureStorage.ts:16,60-73` XORs with a constant (only the biometric
flag on web). Rename or delete the web path. Effort: S.

**SEC-6 — Three HTML sanitiser allow-lists disagree.** Sev: low.
`utils/sanitizeRichText.ts:7-14` (vimeo, `www.google.com` any path),
`articleEditorSanitize.ts:65-72`, `serverSafeHtml.ts`; author `allow` attribute
passed through (`sanitizeRichText.ts:468-470`); `http:` iframes allowed; no
`sandbox`; DOMPurify is a rarely used fallback (`utils/travelDetailsSecure.ts:243`)
that returns input unchanged on native (no DOM). Fix: one allow-list module,
https only, fixed `allow`, drop DOMPurify. Effort: S–M.

**SEC-7 — Map WebViews.** Sev: low. No `onShouldStartLoadWithRequest`;
`Map.ios.tsx:788` gives the page the `https://metravel.by/` origin;
`NativeRoutePickerMap.native.tsx:252` `originWhitelist={['*']}`. Bridge
messages are strictly parsed (`nativeBridge.ts:90-140`). Fix: block
in-WebView navigation except tiles. Effort: S.

**SEC-8 — `getSafeExternalUrl` treats `/\host` as relative.** Sev: low.
`utils/safeExternalUrl.ts`. Effort: S.

### 2.11 Performance (PERF)

**PERF-1 — Native map tiles go through the JS thread as base64.** Sev: high.
`components/MapPage/Map.ios.tsx:414-479` (`handleTileRequest` →
`injectJavaScript`), `utils/mapTileCache.ts:128` (`readAsStringAsync
'base64'`), `nativeTileBridgeScript.ts:137,156`; `MAX_TILE_FETCH = 3`. Each
tile is a postMessage, disk read, 27–55 KB string, escape, inject — ~1 MB+ per
pan on a cold cache. Fix: let the WebView load tiles itself (HTTP online,
`file://` offline with `allowingReadAccessToURL` / `allowFileAccess`), bridge
only to notify caching. Effort: L. RR: medium (#1561/#1665 offline cache).

**PERF-2 — Native fullscreen gallery loads unresized originals and keeps
~21 pages mounted.** Sev: high. `components/travel/ZoomableGalleryImage.tsx:183-194`
passes size only via `style`, so `ImageCardMedia` (`:415-423`, `:94-95`)
cannot build a resized source and loads the original (backend serves originals
`no-store`); `blurRadius={18}` decodes twice; every page `priority="high"`
(`FullscreenGallery.tsx:151`); `FlatList` without window props (`:207-224`,
default `windowSize` 21). Affects travel details, article lightbox
(`StableContent.native.tsx:115`), quest reviews. Risk: OOM on Android, data
use. Fix: numeric `width`/`height`, `windowSize={3}`,
`initialNumToRender={1}`, `maxToRenderPerBatch={1}`; high priority only for
the active page. Effort: S. → **Fixed in Phase 1 (sizing + window props).**

**PERF-3 — Pinch/pan zoom runs on the JS thread.** Sev: high.
`ZoomableGalleryImage.tsx:3-8` legacy `PinchGestureHandler`/`PanGestureHandler`,
`:94-109` `Animated.event(..., { useNativeDriver: false })`. Fix:
`Gesture.Pinch()/Pan()` + Reanimated shared values (pattern: `UnifiedSlider`).
Effort: M. RR: medium.

**PERF-4 — `/places` renders every loaded card without virtualisation.**
Sev: medium. `screens/tabs/PlacesScreen.tsx:276-285` maps all pages inside a
`ScrollView` (`:787-796`); each `PlaceCard` builds its own saved-point index
(`hooks/map/useSavedPointToggle.ts`, up to ~1 000 points) and calls
`useWindowDimensions` (`PlacesScreen.parts.tsx:56`); inline `badges` array
(`:266-269`) defeats `PlaceListCard` memo. Fix: FlashList grid like
`RightColumn`; build the index once per points array. Effort: M. RR: medium
(#1334 parity).

**PERF-5 — Native startup loads all five locale catalogs.** Sev: medium.
`i18n/index.ts` → `instance.ts:10` → `resources.ts:1-5` (~4.7 MB source);
web already lazy (`instance.web.ts`). Fix: inline-require active locale + RU
fallback. Effort: M. RR: medium (missing-key fallbacks).

**PERF-6 — Native WebView map rebuilds all markers and re-serialises the
payload.** Sev: medium. `nativeMapHtml.ts:432-441` (clear + re-add, no
diff); `Map.ios.tsx:611-617` serialises the whole payload per change for
dedupe; payload includes the center; clusters re-queried per viewport
(`:265-268`). Fix: send center separately, diff by `placeKey`, cheap hash.
Effort: M.

**PERF-7 — Map list keys include the index; inline handlers defeat memo.**
Sev: medium. `hooks/map/useMapTravels.ts:134-139` (`${identity}#${index}`) →
`TravelListPanel.tsx:325`; `useTravelItemRenderer.tsx:60,99,132`. Fix:
occurrence-counter dedupe, id-based callbacks. Effort: S.

**PERF-8 — Bottom sheet publishes height to JS every frame.** Sev: medium.
`components/MapPage/MapBottomSheet.tsx:81-89` `runOnJS(publishHeight)` per
frame (store write); `runOnJS` deprecated in Reanimated 4. Fix: publish on
settle. Effort: S.

**PERF-9 — Smaller render issues.** Sev: low. JS-driver animations
(`WizardSkeleton.tsx:19-20`, `RouletteScreen.tsx:190-196`, `FavoriteButton.tsx:69-70`,
`SubscribeButton.tsx:63-64`, `MapLoadingBar.tsx:29-40` width loop,
`RecommendationsTabs.tsx:364-367`); per-item style creation
(`TravelListItem.tsx:182` 44 styles/card, `PlaceListCard.tsx:71`,
`CommentItem.tsx:32`) because `getThemedColors` returns a new object
(`constants/designSystem.ts:453`); `ThreadList.tsx:250` new `extraData` per
render and the 30 s poll replaces the array even when unchanged
(`hooks/useMessages.ts:95-99,116`); dead FlashList 2 props via `as any`
(`estimatedItemSize` in ~10 places, `columnWrapperStyle`
`PointListChrome.tsx:422`); `ImageCardMedia.tsx:1020-1026` fresh `imageProps`
to memoised `OptimizedImage`; `MarkersListComponent.tsx:565` index keys;
`app/_layout.tsx` `ThemedContent` (`:369-511`) not memoised (hypothesis).

### 2.12 Hooks, forms, errors, loading (HK)

**HK-1 — No crash reporting at all.** Sev: high.
`services/performanceMonitoring.ts:16` never imported; no `@sentry/*`;
`utils/logger.ts:143` `setMonitoringService` never called so `logError` is a
production no-op; `useTravelFormPersistence.ts:845` checks a `window.Sentry`
that never exists; duplicate `unhandledrejection` handlers (`entry.js:314`,
`components/layout/WebAppRuntimeEffects.tsx:25`) only silence font errors; no
`QueryCache`/`MutationCache` `onError` (`utils/reactQueryConfig.ts:83`).
~260 empty `catch` blocks in app logic are invisible. Fix: `@sentry/react-native`
(+ `@sentry/react` web), init in `app/_layout.tsx`, wire
`setMonitoringService`, add cache `onError`. Effort: M. RR: low. Deps: new
dependency + `app.json` plugin (owner approval).

**HK-2 — Three travel validators disagree.** Sev: high.
`utils/formValidation.ts:277` (raw HTML length), `utils/travelWizardValidation.ts:212`
(strips HTML), `utils/validation.ts:145` `travelSchema` unused,
`ContentUpsertSection.tsx:125-150` hard-codes 50/150 a third time. Risk:
moderation checklist and wizard step give different answers for the same text.
Fix: one rules module with HTML-aware length. Effort: M. RR: medium.

**HK-3 — Error-boundary architecture is fragmented.** Sev: medium.
`app/error.tsx` is a dead route expecting props Expo Router never passes; no
route/layout exports `ErrorBoundary`; root `components/ui/ErrorBoundary.tsx:115`
shows raw `error.message` in production; Leaflet cleanup copied from
`MapPage/MapErrorBoundary.tsx:50-110` into the generic boundary (`:78-94`);
`TravelFormErrorBoundary.tsx:51`, `MapErrorBoundary.tsx:44` bypass `logError`.
Fix: route-level `ErrorBoundary` export in `(tabs)/_layout`, one fallback,
log through `logError`. Effort: M. Deps: HK-1.

**HK-4 — Dead or broken form/validation code.** Sev: medium.
`useTravelFormData.ts:82-85` never enables validation → `useOptimizedValidation`
(252 LOC) disabled; `useOptimizedFormState.ts:65-67` no-op validators but a
timer per keystroke (`:87-97`); `useOptimizedValidation.ts:66-68,77` promise
never resolves when superseded; unused yup schemas (`utils/validation.ts:65,113,145,206`);
`utils/validation/index.ts` barrel unreachable (`validation.ts` wins);
`aiValidation.validateEmail/validatePassword` unused; ArticleEditor autosave
engine (`ArticleEditor.web.effects.ts:427-500`, `ArticleEditor.ios.tsx:160-182`)
has no consumer. Fix: delete, keep `useYupForm` + one rules module. Effort:
S–M.

**HK-5 — Feedback form implemented twice and drifted.** Sev: medium.
`app/contact.tsx:87` vs `app/(tabs)/about.tsx:83`; `about` lacks the
`sendingRef` guard and `mountedRef`, Enter path allows double send. Fix:
`useFeedbackForm` on `useYupForm`. Effort: S.

**HK-6 — Trip create vs edit validate differently.** Sev: medium.
`components/trips/planning/TripCreateForm.tsx:68-140` inline yup schema and
hand-rolled form state; `app/(tabs)/trips/plan/[id].tsx:343-373` imperative
re-implementation (accepts `2026-02-31`). Fix: `utils/tripValidation.ts` +
`useYupForm` in both. Effort: M.

**HK-7 — Fetch-in-effect outside React Query.** Sev: medium.
`app/(tabs)/article/[id].tsx:73-120` (+ `.web.tsx:67`, `.native.tsx:85`: three
copies, no AbortController, raw `error.message` shown);
`components/travel/hooks/usePointListCategoryDictionaryModel.ts:16-51`
(conditional `useQuery` in try/catch, second fetch while pending);
`components/screens/messages/useThreadResolution.ts:69-96` (N+1 profile fetch
bypassing `useUserProfileCached`); `QuestWizard.tsx:626` refetches a bundle
already cached. Fix: `useQuery`/`useQueries`/`fetchQuery`. Effort: M.

**HK-8 — Raw exception messages shown to users at 18 sites.** Sev: medium.
`RegistrationForm.tsx:160`, `contact.tsx`, `about.tsx`, `SetPasswordForm`,
`MapPage/useRouting.ts`; three overlapping helpers (`utils/userFriendlyErrors.ts`,
`utils/networkErrorHandler.ts:110`, `utils/errorHelpers.ts`). Fix: one
`toUserMessage(error)`. Effort: M.

**HK-9 — Derived state via effects.** Sev: medium. `ProfileScreen.tsx:292-298`,
`CommentForm.tsx:54-64`, `UnifiedTravelCard.tsx:237-241`,
`questWizardStepCard.tsx:288-298`, `PlacePopupCard/index.tsx:394`,
`QuestWizard.tsx:616-618`, `plan/[id].tsx:271-275`, `gallery/ImageGallery.tsx:285`
(+ `:343` two-way sync). Compute in render or reset with `key`. Effort: S each.

**HK-10 — Duplicated hooks/helpers.** Sev: low–medium. True duplicate:
`hooks/useVisitedCountries.ts:60` vs
`components/screens/profile/useProfileCountriesData.ts:46` (same query + same
fallback effect) → **shared core extracted in Phase 1**; three `deepEqual`
implementations; 52 files call `useWindowDimensions` directly beside
`useResponsive` (123 users); `useNetworkStatus` (11 consumers, one NetInfo
subscription each) beside `utils/nativeQueryOnlineListener.native.ts:162`;
`useNetworkStatus.ts:55` `NetInfo.fetch()` without `.catch` → **fixed in
Phase 1**; email regex copied 7×, min-8 password rule 6×, YouTube URL rule 3×;
`useYupForm.ts:127` swallows `onSubmit` errors silently → **now logged in
Phase 1**.

**HK-11 — Loading-state inconsistency.** Sev: low. 115 `ActivityIndicator`
vs 71 skeleton usages with ~15 one-off skeletons beside `ui/SkeletonLoader`;
`achievements/SectionState.tsx:28` treats "not fetching" as empty (the exact
bug `useAuthedQuerySettled` exists to prevent); `roulette/useRoulette.ts:266`
shows background refetch as loading; 52 of 93 `<Suspense>` use `fallback={null}`.

**HK-12 — i18n leftovers.** Sev: low. RU/BE/UK/PL catalogs contain English
values (`travel_02.ts:153,164`, `travel_03.ts:240-241`, `seo_01.ts:8-9`); the
slider CSS selects by `aria-label="Previous slide"` (`sliderParts/globalStyles.ts:16-27`),
so translating the label breaks styling; no check for untranslated values.

### 2.13 Code quality, duplication, dead code (CQ)

**CQ-1 — Layer boundaries are not enforced.** Sev: medium. 185 component
files import `@/api/*` at runtime, 27 render components import raw fetchers
(`components/home/Home.tsx:14`, `components/quests/QuestWizard.tsx:47`,
`components/screens/settings/SettingsScreen.tsx:13`); `utils/` imports
`api/` (13 files), `stores/authStore` (`utils/questProgressQueue.ts:31`,
`utils/qaDebug.ts:6`), `components/*` (`utils/confirmAction.ts:4`,
`utils/criticalCSSBuilder.ts:7-12`, `utils/questAdapters.ts:5` type-only);
`services/pdf-export/**` imports `components/export/*` (10 files, for the
`BookSettings` type that already lives in `BookSettingsModal.types.ts:15`);
`screens/` and `components/screens/` are two names for one layer with 15
inverted imports (`QuestLandingLayout.tsx:18-20` → `screens/tabs/QuestCard`,
`MapScreenDesktop.tsx:17-23` → `screens/tabs/mapDeferred`,
`TripReportForm.tsx:10` → `PlacesScreen.helpers`, `useMapScreenController.ts:9`
→ `screens/tabs/map.styles`). No `no-restricted-imports`, no `import/no-cycle`.
Fix: ESLint `no-restricted-imports` with a baseline; move domain modules out
of `utils/`; one screens convention. Effort: M. RR: low.

**CQ-2 — Duplicated logic.** Sev: high (geo) / medium (rest). 17 Haversine
implementations (`utils/geo.ts:3`, `utils/distanceCalculator.ts:19`,
`utils/coordinateConverter.ts:82`, `utils/coordinates/index.ts:176`,
`utils/routingHelpers.ts:79`, `utils/routeFileParser.ts:4`,
`utils/questForLocation.ts:59`, `utils/travelForLocation.ts:15`,
`hooks/map/useSearchThisArea.ts:17`, `hooks/map/useMapCoordinates.ts:110`,
`MapLogicComponent.tsx:63`, `FiltersPanelRouteSection.tsx:40`,
`pointsListLogic.ts:110`, `QuestPointNavigator.native.tsx:27`,
`RouteElevationProfile.utils.ts:53`, 2 in pdf-export) with km/m and
6371/6371e3 mix-ups; stale native default center
(`constants/mapConfig.ts:21-29` vs `Map.ios.tsx:151-152,222`,
`Map/nativeMapHtml.ts:36-37,133`); `ImageGalleryComponent.ios.tsx` (762 LOC)
forks the web gallery (re-declares `safeEncodeUrl`, `ensureAbsoluteUrl`,
`GalleryItem`, props) without the web dedupe/reorder helpers;
`QuestFullMap.tsx` vs `.native.tsx` copy export/share helpers (`:295-346` vs
`:291-328`); 7 ad-hoc `Point` types beside `map-core/types.ts:244`;
`formatDate` ×6, `formatDistance` ×4, `formatDuration` ×4 beside
`i18n/format.ts`; local plural helpers beside `utils/pluralize.ts`;
`UnifiedSlider.tsx` is native-only yet carries 11 `isWeb` branches and 227
LOC of web-only slider parts. Fix: `utils/geo/distance.ts` + lint ban on the
literal `6371`; `useQuestMapExport`; shared `useGalleryModel`; adapters.
Effort: S–M each. RR: low–medium.

**CQ-3 — Dead code: 43 unreachable files (6 758 LOC), 137 unused exports.**
Sev: medium. Largest: `services/pdf-export/.../legacyGalleryLayouts.ts` 688,
`components/MapPage/Map/useRouteBuilding.ts` 479, `utils/webVitalsMonitoring.ts`
466, `components/travel/RecentViews.tsx` 338, `components/forms/SearchAutocomplete.tsx`
286, `styles/criticalCSS.ts` 275, `hooks/useTravelDetailsUtils.ts` 268,
`hooks/useKeyboardNavigation.ts` 234, `components/profile/ProfileQuickActions.tsx`
218, `components/forms/SelectComponent.tsx` 214, `components/map-core/MapMarkerLayer.tsx`
213, `components/navigation/OpenInMapsSheet.tsx` 207,
`components/forms/NumberInputComponent.tsx` 202 (3 `@ts-ignore`),
`components/listTravel/ExportBar.tsx` 192, `types/book.ts` 183,
`components/MapPage/MapLegend.tsx` 174, `utils/travelFaq.ts` 171,
`components/map-core/useMapLifecycle.ts` 152, `services/performanceMonitoring.ts`
148, `utils/instagramOAuth.ts` 133, `components/seo/InstantSEO.tsx` 99,
`context/FiltersProvider.tsx` 49, `utils/guestTrialState.ts` 50,
`types/travel.ts` 31 (conflicting `Travel`), `constants/theme.ts` 15
(conflicting palette); 20 non-route base files shadowed by `.web` + `.native`
variants (`MapPage/Map.tsx`, `ImageGalleryComponent.tsx`, `GoogleSignInButton.tsx`);
`metro.config.optimized.js` (233 LOC, requires non-existent `expo-asset-tools`);
dead metro-stubs (`Map.ios.js`, `MaterialCommunityIcons.js`, `html2canvas.js`,
`react-native-webview.js`, `react-native-maps.js` + resolver branch
`metro.config.js:141-146`); `scratch-lh/` 2.6 MB tracked Lighthouse dumps;
stale `tsconfig.json` excludes (`components/ui/examples`, `ModernTravelCard.tsx`);
`specs/` beside `openspec/` (two spec systems). Unused exports include
`api/misc.ts:859 sendAIMessage`, `api/quests.ts fetchQuestById/createProgress`,
`hooks/useStepTransition.ts` (6), `utils/coordinates/index.ts` (4),
`utils/aiValidation.ts` (4). Fix: delete in batches (test-only files take their
tests along), add knip/ts-prune with a baseline. Effort: S–M. RR: low.
→ **First batch removed in Phase 1** (see §4).

**CQ-4 — 33 files above the 800-LOC guard, guard is warn-only and
baseline-less.** Sev: medium. `scripts/guard-file-complexity.js:10` `MAX_LOC=800`
scans api/app/components/hooks/stores/context/screens/services (not `utils`,
`constants`, `ui`); `guard-file-complexity-changed.js:84-91` blocks only new
crossings, legacy files grow freely. Categories and seams: style factories
(`screens/tabs/QuestsScreen.styles.ts` 1 321 — one `getStyles()` with 130
keys and 49 `isMobileW` ternaries; `PlacePopupCard/styles.ts` 890;
`quests/printable/styles.ts` 887; `map.styles.ts` 826; `PlacesScreen.styles.ts`
821); god components (`PlacePopupCard/index.tsx` 1 392 one component;
`ui/ImageCardMedia.tsx` 1 158 → split `.web`/`.native`; `Map.web.tsx` 1 029 (9
effects, 12 refs); `Map.ios.tsx` 886; `MapMobileLayout.tsx` 901;
`MapMobileTopOverlay.tsx` 805; `QuestWizard.tsx` 925 + `questWizardStepCard.tsx`
909 + `questWizardShell.tsx` 814; `ArticleEditor.web.tsx` 827 (12 state, 18
effects, 30 refs); `ProfileScreen.tsx` 845 (43 memos); `ContentUpsertSection.tsx`
898; `TripCreateForm.tsx` 897; `gallery/ImageGallery.tsx` 831;
`TravelListItem.tsx` 882; `UnifiedTravelCard.tsx` 857; `PlaceListCard.tsx` 805);
fat routes violating the project's own "thin routes" rule
(`app/(tabs)/trips/plan/[id].tsx` 1 045 with 11 `useState`;
`quests/[city]/[questId].tsx` 926); god hooks (`useTravelFormPersistence.ts`
1 119 — pure marker-merge helpers at 184–360 belong in `utils`;
`useMapCoordinates.ts` 848; `useBreadcrumbModel.ts` 801 — route table → data);
API grab-bags (`api/quests.ts` 1 086, `api/map.ts` 1 026, `api/client.ts` 931,
`api/misc.ts` 884). Fix: per-file LOC baseline with ratchet, add `utils` and
`constants` to scope; split along the seams above with `refactor-surgeon`.
Effort: L (incremental). RR: medium.

**CQ-5 — Import cycles.** Sev: low–medium. madge: 19 cycles; runtime-static
cycles: 0 on web, 1 on native (`QuestFullMap.native.tsx:37` →
`questWizardHelpers.ts:15` → `questWizardMedia.tsx:4` →
`QuestFullMapLazy.native.tsx:1` → back; web breaks it only via `lazy()`);
type-only SCCs: `api/gamification` ↔ `gamificationMock` ↔ `achievementsTypes`;
`api/publicTrips` ↔ `publicTripsMock`; `utils/actionConsent` ↔ `api/consent`
(utils↔api); `api/quests` ↔ `utils/questProgressMerge` ↔ `api/questBundleCache`
↔ `services/offline/questOfflineAdapter`; `components/export/*` ↔
`types/pdf-presets`; `RightColumn` ↔ `RightColumnListStatus`; a 9-file quests
SCC (`utils/questAdapters` → `components/quests/QuestWizard` …). Fix: move
`openQuestMap`/`getQuestClipboard` out of `questWizardHelpers`; move domain
types to `types/`; add `import/no-cycle` with a baseline. Effort: S–M.

### 2.14 TypeScript (TS)

**TS-1 — ~3 500 `any`, the guard sees a third.** Sev: high. 2 294 `as any`,
980 `: any`, 139 `<any>`, 84 `any[]` in non-test source; `scripts/guard-type-debt.js:115`
counts only `AsExpression`; `no-explicit-any` is a warning and only for
`api/hooks/stores/**/*.ts` (`eslint.config.js:221-231`). Hotspots:
`QuestsScreen.styles.ts` 49, `utils/travelFormNormalization.ts` 42,
`MapWebCanvas.tsx` 37, `UnifiedTravelCard.tsx` 36, `WebMapComponent.tsx` 36,
`TravelTmlRound.tsx` 35, `PointList.styles.ts` 32, `MapLogicComponent.tsx` 32,
`PopularTravelList.tsx` 30. Patterns: ~944 style casts for RNW CSS props; 145
`(e: any)`; 111 Leaflet `L: any`; 81 `(window as any)`; 73 `router.push(x as any)`;
DTO alias probing (`TravelTmlRound.tsx:36-38`). `api/` has 0. Fix: extend the
guard to `AnyKeyword`; `declare module 'react-native'` augmentation for
`aria-*`, `dataSet`, `fetchPriority`, `inert`, web CSS; typed routes through
`utils/routes.ts`. Effort: L (incremental). RR: low.

**TS-2 — Type-debt baseline is not ratcheted.** Sev: medium. Baseline allows
1 359/1 164/45 (style/logic casts/ts-ignore); current 1 192/1 082/30 (debt is
shrinking), but 87 files have slack and the scope skips `types/`, `constants/`,
`ui/`. Fix: auto-tighten on pass. Effort: S (scripts — owner approval).

**TS-3 — snake_case DTOs leak into UI types.** Sev: medium.
`types/types.ts:102-180` `Travel` mixes `travel_image_thumb_url`, `number_days`,
`cityName`, `countUnicIpView`; duplicate pairs `comment_count`/`comments_count`
(`:131-132`), `thread_id`/`comment_thread_id` (`:133-134`); 35 UI files read
snake_case fields; 175 files import `@/types/types`; `types/types.ts:192`
imports from `api/mapPlaces`. Fix: adopt the quest pattern (`ApiQuest*` →
`utils/questAdapters` → camelCase domain types). Effort: L. RR: medium.

**TS-4 — 31 `@ts-ignore` (20 files), ~90 % web DOM props.** Sev: low.
`Button.tsx:386-425` ×5, `OptimizedImage` ×2, `useSliderCore` ×2,
`TravelPreviewModal` ×2, `questWizardMedia` ×2, `ThemeToggle` ×2,
`ImageCardMedia:965`, `ImageCardMediaWebHelpers:481`, `TravelDetailsSkeletonOverlay:31`.
TS-1's augmentation removes most. Non-null assertions: 9 (good).
`noUncheckedIndexedAccess` is off.

### 2.15 Design system (DS)

**DS-1 — Two token sources with the same names and different values.** Sev:
high. `constants/layout.ts:12-20` `METRICS.spacing` (`xs:4, s:8, xxl:40,
xxxl:48`) vs `constants/designSystem.ts:325-334` `DESIGN_TOKENS.spacing`
(`xxs:4, xs:8, xxl:48, xxxl:64`); radius `xl:16` vs `xl:28`; breakpoints
`xxl:1536` vs `largeDesktop:1920` although the comment says "aligned";
`METRICS` in 47 files, `DESIGN_TOKENS` in 261; dead `constants/theme.ts`
third palette. Fix: `designSystem.ts` single source, `METRICS` derived.
Effort: M. RR: medium (visual diff where `xs` changes).

**DS-2 — Hard-coded colours are not guarded.** Sev: medium.
`guard-themed-colors` flags only `DESIGN_TOKENS.colors.*` reads in non-web
files (baseline 129); 724 hex/rgba literals in 162 UI files
(`mapMarkerStyles.ts` 51, `sliderMediaStyles.ts` 31, `QuestsScreen.styles.ts`
26, 45 raw `#fff`/`#000`). Fix: literal-colour rule with baseline, allow-list
map/PDF/print palettes. Effort: M.

**DS-3 — `react-native-paper` is now a thin dependency with a 663-LOC web
shim.** Sev: medium. 26 files use `@/ui/paper` for 11 symbols;
`ui/paper.web.tsx` duplicates `components/ui` Button/IconButton/Typography/
ConfirmDialog, so web and native render different code. Fix: migrate the 26
files to `components/ui`, drop Paper and the shim. Effort: M. RR: low–medium
(native visual QA).

**DS-4 — `ui/` (2 files) vs `components/ui/` (63) vs `styles/`.** Sev: low.
Merge into `components/ui`; `utils/webProps.ts` (69 importers) is under-used
compared with the ~944 style casts.

### 2.16 Dependencies, build, native config, upgrade readiness (DEP)

**DEP-1 — Web chunk serializer fork.** Sev: critical (upgrade blocker).
`patches/@expo+metro-config+57.0.3.patch` (475 lines, rewrites
`serializeChunks.js`: per-route shared chunks, `__METRAVEL_SHARED_CHUNKS__`)
+ `patches/expo+57.0.4.patch` (runtime half in `asyncRequireModule`). Fixes a
real production bug ("Requiring unknown module", `docs/PROBLEM_MEMORY.md:901-917`).
Risk: must be re-ported on every SDK bump against compiled output. Fix:
upstream the fix or isolate it as a custom serializer passed via
`metro.config.js` so it survives upgrades. Effort: L.

**DEP-2 — React Native and Hermes built from source on Android + RN patch.**
Sev: critical (build/upgrade). `plugins/withAndroidReleaseSafety.js:21-31,139-148`
`includeBuild('../node_modules/react-native')`; `patches/react-native+0.86.0.patch`
(Android API 35 status/nav-bar APIs, iOS `HERMES_CLI_PATH`). Risk: very slow
builds needing NDK/cmake, re-port on every RN bump. Fix: accept the Play
warning or upstream the Kotlin change; keep only the podspec change. Effort:
M. RR: medium. Deps: `plugins/` is owner-gated.

**DEP-3 — Hybrid iOS workflow: `ios/` committed as bare project with doctor
checks off.** Sev: high. `scripts/ios-prebuild.sh:5` never runs prebuild;
`package.json` `doctor.appConfigFieldsNotSyncedCheck` disabled; manual edits:
Google reversed-client-ID scheme (`ios/metravel/Info.plist:40-43`, no
config plugin), `ios/Podfile:21-22` modular headers, `Expo.plist`
`EXUpdatesRuntimeVersion` without expo-updates; drift: `FacebookAutoInitEnabled`
false in Info.plist vs `isAutoInitEnabled: true` in `app.config.js:59` (what
Android gets); `FacebookClientToken` committed in Info.plist while treated as
a secret in `app.config.js`. Fix: move iOS to CNG with config plugins, or
formally document iOS as bare. Effort: L. RR: medium.

**DEP-4 — `StyleSheet.absoluteFillObject` shim.** Sev: high.
`scripts/fix-react-native-compat.js:49-65` re-adds an API removed in RN 0.85;
68 usages depend on it. Fix: codemod to `StyleSheet.absoluteFill`, delete the
shim. Effort: S–M. RR: low.

**DEP-5 — Unused / redundant / misplaced dependencies.** Sev: medium.
Zero imports: `react-native-image-picker` (still compiled into iOS,
`ios/Podfile.lock:1837`), `metro-react-native-babel-transformer` (deprecated;
`__tests__/config/android-dependencies.test.ts:191` asserts it),
`yaml`/`tar`/`semver`/`picomatch` (security pins duplicated from
`resolutions`; `picomatch >=2.3.2` unbounded), `lightningcss 1.32.0` pin
(installs a second copy; Metro loads 1.31.1), `expo-auth-session`,
`expo-media-library` (plugin configured). Misplaced: `jszip` (e2e only).
Unused dev: `@babel/preset-env`, `@babel/preset-typescript`,
`@babel/helper-compilation-targets`, `babel-plugin-transform-import-meta`,
`source-map-explorer`, `chalk`, `@types/react-test-renderer`,
`@jest/test-sequencer@30` (jest uses nested 29.7). Phantom: `graceful-fs`,
`fontfaceobserver`, `expo-asset`, `@eslint/js`, `globals`. Overlaps:
`react-native-paper` (DS-3), `dompurify` vs `sanitize-html` (SEC-6),
`react-native-render-html` + iframe plugin (unmaintained, React 19 patch),
`react-native-responsive-screen` (single `wp(1.5)` in `ArticleListItem.tsx:209`).
Fix: remove in one dependency PR with `pod install`; declare phantoms. Effort:
S–M. RR: low (iOS pod lock update needed).

**DEP-6 — postinstall hacks.** Sev: medium. `scripts/fix-lightningcss.js:13-15`
exits on non-macOS and thereby skips its unrelated react-native-svg web patch
(never applied on Linux/CI; probably obsolete for svg 15.15.4 — hypothesis);
`fix-expo-metro-terminal-reporter.js`, `fix-brace-expansion.js` regex-edit
`node_modules`; yarn `resolutions` and npm `overrides` diverge (~15 entries,
`overrides` lacks `braces`). Fix: delete the svg part, keep one package
manager, drop `overrides`. Effort: S.

**DEP-7 — Metro/web build leftovers.** Sev: low–medium.
`metro.config.optimized.js` dead and broken → **removed in Phase 1**;
`metro.config.js` dead Node<20 polyfill (:7-17), `react-native-maps` resolver
branch for an uninstalled package (:141-146); four web build entry points
(`build-prod.sh` → `build-web-safe.js`, `build-web-prod.js`, `build-dev.sh`
raw export with `NODE_ENV=dev` and swallowed exit code, unreferenced
`build.sh`); `expo.install.exclude` for react/react-dom/react-native is
unnecessary (versions match SDK 57 exactly) and hides drift at the next
upgrade; `i18n/babel-inline-plugin.js` loads the TypeScript compiler API at
build time with a per-process cache and no Metro cache key (stale dev strings
— hypothesis; blocks TS 7's Go port).

**DEP-8 — New Architecture / compatibility.** Sev: medium. Verified:
`react-native-fbsdk-next 13.4.3` has no `codegenConfig` (legacy
`RCT_EXPORT_MODULE`, runs via interop); `masked-view 0.3.2` legacy view
manager; `reanimated 4.5.0` + `worklets 0.10.0` `compatibility.json` lists RN
0.83–0.86 only (lockstep with RN 0.87); `flash-list 2.x` is NA-only;
`react-native-render-html 6.3.4` unmaintained and React-19-only via patch.
`google-signin`, `webview`, `datetimepicker`, `netinfo`, `async-storage`,
`image-picker` have `codegenConfig`. Hermes on; `newArchEnabled:true`
redundant on 0.86.

**DEP-9 — Tooling.** Sev: medium. ESLint enforces only `rules-of-hooks` and
`exhaustive-deps` (react plugin registered with no rules); CI never runs
`tsc` or the full Jest suite (TEST-3); TS-ESLint 8.62.1 peer range `<6.1.0`;
`@testing-library/jest-native` and `react-test-renderer` (62 test files)
deprecated under React 19; Node 22 pinned consistently (EOL April 2027;
`metro.config.js:2` mentions Node 24); `entry.js:10-30` monkey-patches
`Object.defineProperty` on web.

### 2.17 Testing (TEST)

**TEST-1 — False-green test runs.** Sev: critical. `scripts/jest-quality-gate-setup.js:18`
exits 0 when the quality-gate lock is busy (any jest/playwright/preflight
process in the workspace), wired through `jest.config.js` `globalSetup`, so a
second plain `jest` prints "SKIPPED" and passes; `package.json` `test:ci`
pipes Jest into `tee` without `pipefail`, so failures exit 0
(`docs/DEVELOPMENT.md:149` points people there). Fix: exit non-zero (75) or
wait with timeout; keep the lock only in `run-with-quality-gate-lock.js`;
`set -o pipefail` or `--outputFile`. Effort: S. Deps: `scripts/` is
owner-gated.

**TEST-2 — The Jest environment mixes iOS module resolution with a jsdom
DOM.** Sev: high. `jest.config.js` `testEnvironment: 'jsdom'` while jest-expo
resolves `defaultPlatform: 'ios'`; `.ios`/`.native` files load with DOM
globals, `.web.tsx` never loads unless a test re-mocks `react-native` as
`react-native-web`; 116 files flip `Platform.OS='web'` (which does not change
resolution); 29 files render RN into react-dom via `@testing-library/react`
with the resulting warnings silenced (`__tests__/setup.ts:346-362`). Fix:
Jest projects — `jest-expo/ios` for `*.test.tsx`, `jest-expo/web` for
`*.web.test.tsx`. Effort: M/L. RR: medium.

**TEST-3 — CI never runs the full Jest suite, `tsc`, or e2e against a
backend.** Sev: high. `.github/workflows/ci-smoke.yml:240` runs
`test:smoke:critical:ci` (10 files, `scripts/smoke-critical-tests.js:3-14`)
plus hard-coded per-area lists; ~1 630 test files run only locally (pre-push,
skippable with `SKIP_PREFLIGHT=1`); the `e2e-selective` job (`:254-293`)
starts no backend (default target `127.0.0.1:8000`; `docs/TESTING.md:157`
admits a dead backend "does not fail loudly"); live-contract specs
(`auth-logout`, `travel-crud`, `travel-persistence`, `draft-recovery`,
`travel-full-flow`) are never scheduled. Fix: sharded full `jest --ci` (or
`--changedSince` + nightly), `yarn typecheck` in CI, fail-fast backend probe
in `global-setup.ts`, scheduled live-contract job. Effort: M. Deps:
`.github/workflows/` owner-gated.

**TEST-4 — Global setup hides problems.** Sev: medium. `__tests__/setup.ts`
(1 215 lines): act() warnings silenced (`:291-296`); every unmocked `fetch`
returns `ok:false, status:0` (`:375-383`) so a missing mock becomes a silent
"network error"; `__DEV__ = false` (line 2); app modules mocked globally
(`useTheme` `:223`, `FavoritesContext` `:596`, `travelStatusStore` `:633`,
`expo-router` `:549`, `Pressable` → `View` `:1022`); 165 files re-mock
`expo-router` locally while `helpers/expoRouterMock.ts` has 4 users;
`clearAllMocks` instead of `resetAllMocks` (`:1202-1204`); developer LAN IP as
API URL (`jest.expo-globals.js:63-64`). Fix: throw on unmocked fetch, make act
warnings fatal with an allow-list, `resetAllMocks`, opt-in app mocks,
`.invalid` host. Effort: M.

**TEST-5 — Over-mocking and implementation-detail assertions.** Sev: medium.
`TravelDetailsSectionAnchors.web.test.tsx:49-138` (41 mocks for 3 tests);
`TravelDetailsContainer.mobile.duplicates.test.tsx` (24 mocks, one
assertion); `integration/like-unlike-flow.test.tsx:9-10` mocks `useComments`
and `AuthContext` then asserts mock calls; four `useMapScreenController.*.test.ts`
repeat 13 mocks; the autosave seam is mocked on every side so no Jest test
runs real persistence + autosave together; 3 128 `toHaveBeenCalled*`, 235
`.mock.calls[i][j]`; tests that cannot fail (`PlatformComponents.test.tsx:42-120`).
Fix: real hooks with a test `QueryClient` and a fake `@/api/client` (or MSW);
shared mock factories. Effort: M.

**TEST-6 — Flakiness patterns.** Sev: medium. Jest: wall-clock timing checks
(`CompactSideBarTravel.web.test.tsx:536,548`, `tripPlanLinkedText.test.tsx:134`),
21 real-timer sleeps, 46 `waitFor` ≥3 s (`login.test.tsx:104,393` 10 s), real
dates (`MiniCalendar.test.tsx:69-190`), 239 files mutate `Platform.OS` (~50
without restore). E2E: 139 `waitForTimeout` across 59 files, 117
`force:true`, 47 `networkidle`; retry settings disagree
(`playwright.config.ts:104` vs `scripts/e2e-run.js:207,246`);
`guard-e2e-wait-for-timeout.js` misses `new Promise(r => setTimeout(r, N))`
(17×). Effort: S/M.

**TEST-7 — Coverage gaps on critical flows.** Sev: medium. No direct test of
`logoutApi` (`api/auth.ts:252-283`); `hooks/useQuestProgressQueueRuntime.ts`
(foreground/reconnect/login triggers) untested; `packageStore.native/web.ts`,
`offlineAssets.native/web.ts` untested; no e2e for offline or push; Maestro
(5 flows) manual against production; premium gating is a stub
(`usePdfPremium.ts:22-24`). Native variants: 36 `*.native.test`, 3 `*.ios.test`,
0 Android; untested native modules `questGeofencing.native.ts` (250),
`nativeQueryOnlineListener.native.ts` (199), `HomeQuickActions.native.tsx`,
`TravelDetailsBackButton.native.tsx`, `ThemedPaperProvider.native.tsx`.

**TEST-8 — Governance tests inflate the suite.** Sev: low. ~144 script/meta
tests plus ~80 that pattern-match product source; 40 read `docs/*.md`. Move
to a separate Jest project reported apart from product coverage. Effort: S.

## 3. Rankings and plans

### A. Top 20 technical-debt items by impact

| # | ID(s) | Item | Sev | Effort |
|---|---|---|---|---|
| 1 | TEST-1, TEST-3 | False-green test runs; CI never runs full Jest, `tsc`, or e2e with a backend | critical | S + M |
| 2 | HK-1 | No crash reporting; `logError` is a production no-op; ~260 silent catches | high | M |
| 3 | SEC-1, SEC-6 | Bypassable client HTML guard behind an `unsafe-inline` CSP; three allow-lists | medium (impact high) | S–M (+L backend) |
| 4 | DEP-1 | Web chunk-serializer fork patched into compiled Expo/Metro output | critical (upgrade) | L |
| 5 | DEP-2 | RN + Hermes built from source on Android to carry an RN patch | critical (build) | M |
| 6 | NAV-2 | One hidden-tab-bar Tabs navigator for every route (no stack) | high | L |
| 7 | DL-1, DL-2, DL-3 | Android App Links claim the domain, allow-list drops auth links; 3 route tables | high | M |
| 8 | PERF-1 | Native map tiles cross the JS bridge as base64 | high | L |
| 9 | PERF-2, PERF-3 | Fullscreen gallery: originals, 21 pages mounted, JS-thread zoom | high | S + M |
| 10 | ST-1 | Device-only favorites wiped on logout / 7 days; guest merge never happens | high | M |
| 11 | SEC-2, API-3, PUSH-2, ST-10 | Cross-user leftovers on shared devices (drafts, caches, reminders, stores) | medium | S–M |
| 12 | NAV-1 | Android back handlers not focus-aware | high | S |
| 13 | KB-1 | Contradicting Android keyboard strategies across 25 files | high | M |
| 14 | ST-7, API-2 | Retry/fallback policies contradict #2184; anonymous re-send of writes; 504 upload retry | medium | S |
| 15 | CQ-3, NAV-5, DEP-7 | ~6.8 k LOC dead code, 137 unused exports, duplicate route variants, dead configs | medium | S–M |
| 16 | CQ-2, HK-2, HK-5, HK-6, ST-8 | Duplicated logic: 17 Haversines, 3 travel validators, 3 dictionary caches, 2 feedback forms, create/edit trip validation | high/medium | S–M each |
| 17 | TS-1, TS-3, NAV-3, NAV-4 | ~3.5 k `any` (guard sees a third), snake_case DTO leak, typed routes bypassed, `.native` never type-checked | high | L incremental |
| 18 | DS-1, DS-2, DS-3 | Conflicting token sources, 724 colour literals, Paper + 663-LOC web shim | high/medium | M |
| 19 | API-1 | 40 % of API modules bypass the client; 6 base-URL copies; inconsistent errors | medium | M–L |
| 20 | CQ-1, CQ-4 | Unenforced layer boundaries; 33 files over the 800-LOC guard with no ratchet | medium | M / L |

Runner-ups: ST-3/ST-4 (`useAuth` whole-store subscription, per-card favorites
re-render), TEST-2 (jsdom + iOS resolution), DEP-3 (bare iOS project),
PERF-4 (`/places` unvirtualised), PERF-5 (all locales eager on native),
LC-1 (no foreground refetch), OFF-1 (two definitions of online).

### B. Quick wins (< 1 working day each, safe)

Done in Phase 1 of this change set (see §4): ST-2, ST-7 (mutation default),
DL-3, PUSH-1, NAV-1, LC-3 (SyncIndicator), OFF-3 (`useOfflineCatalog`),
HK-10 (`useNetworkStatus` catch, `useYupForm` logging, visited-countries
dedupe), API-3, PERF-2 (sizing + window props), NAV-5 (identical `.native`
copies), DEP-7 (`metro.config.optimized.js`), small dead code.

Remaining quick wins:

- LC-1: wire `AppState` → `focusManager`, enable focus refetch on native.
- LC-2: `getActiveQueryClient()` in `fetchReverseGeocode`; delete
  `api/queryClient.ts` and the root shims (13 imports).
- PERM-1: drop the iOS photo-library gate in 5 files (verified against the
  installed Swift module; needs one iOS device QA pass).
- PERM-3: request location on user action in `usePointsRecommendations`.
- PERM-4: delete `questGeofencing.native.ts` and its call sites.
- PUSH-2: cancel scheduled quest reminders on logout.
- OFF-2: fall back to the saved package on network errors.
- API-2: anonymous 401 retry only for GET/HEAD.
- API-5/API-6: delete `uploadFile` (after moving the script onto the
  client) and the always-true `checkNetworkStatus` branches; fix
  `clientResponse` non-JSON 2xx; stop retrying registration.
- CQ-2 (geo): one `haversineKm()` and replace 17 copies; fix the native
  default center (D2).
- CQ-3: next dead-code batch (test-only files + their tests), stale
  `tsconfig` excludes, `scratch-lh/`.
- CQ-5: move `openQuestMap`/`getQuestClipboard` out of `questWizardHelpers`.
- HK-5: `useFeedbackForm` shared by `contact.tsx` and `about.tsx`.
- HK-9: eight derived-state effects → computed values.
- PERF-7, PERF-8, PERF-9 (per item): stable keys, publish-on-settle,
  native-driver animations, cached themed styles.
- DS-1 step 1: make `METRICS` derive from `DESIGN_TOKENS` where values agree;
  delete `constants/theme.ts`.
- DEP-4: codemod `absoluteFillObject` → `absoluteFill` (68 sites), delete the
  shim.
- DEP-5: remove zero-import dependencies (one PR with `pod install`).
- TEST-1 / TEST-6 / TS-2 / SEC-4: scripts-level fixes — each is < 1 day but
  touches owner-gated `scripts/` and `.github/`.

### C. Architectural problems (need structural change)

1. **Navigation model** (NAV-2 + NAV-6 + DL-1/DL-2): a Stack for detail
   families, one internal-href validator, one route manifest feeding the
   intent filter, AASA and link allow-list.
2. **Observability** (HK-1 + HK-3 + HK-8): Sentry (or equivalent), cache
   `onError`, route-level error boundaries, one `toUserMessage`.
3. **Server-state ownership** (ST-1, ST-5, ST-6, ST-8, LC-2): React Query as
   the only server cache; device-only data in owner-keyed persisted stores;
   profile fields read from the profile query; `useMutation` for optimistic
   flows; one `QueryClient`.
4. **API client as the single chokepoint** (API-1, API-4, API-7): shared
   base URL/timeouts, `requestRaw`, signal forwarding, `uploadMedia`.
5. **Layer boundaries and folder convention** (CQ-1, CQ-4, DS-4): enforce
   `app → screens/features → components → hooks → api/services → utils`
   with `no-restricted-imports`; one screens folder; `utils` becomes a leaf.
6. **Domain types** (TS-3): DTO → adapter → camelCase domain types for
   Travel/Place/User, as quests already do.
7. **Native map engine** (PERF-1, PERF-6, SEC-7): WebView loads its own
   tiles, marker diffing, navigation locked down.
8. **Keyboard strategy** (KB-1): one primitive, one rule, a guard.
9. **Test environment** (TEST-2, TEST-4, TEST-5): Jest projects per platform,
   stricter setup, real-hook integration tests.
10. **Build/upgrade path** (DEP-1, DEP-2, DEP-3): upstream or isolate the
    serializer, stop building RN from source, decide CNG vs bare for iOS.

### D. Refactoring roadmap

**Phase 1 — low-risk cleanup (1–2 weeks, behaviour-preserving or
bug-fixing).** The quick wins in §B, in this order: observability
(Sentry) → test-run integrity (TEST-1, `tsc` in CI) → cross-user leftovers
(SEC-2, PUSH-2, API-2) → dead code + duplicate variants + dependency removal
→ Haversine/validators/feedback-form dedupe → LC-1/LC-2 → PERM-1/PERM-3/PERM-4
→ PERF-7/8/9. Exit criteria: `yarn lint`, `yarn typecheck`, full Jest and
smoke e2e green; type-debt and file-complexity baselines tightened to current
values.

**Phase 2 — architecture improvements (4–8 weeks, incremental).**
API chokepoint (API-1, API-4, API-7) → server-state ownership (ST-1, ST-3,
ST-4, ST-5, ST-6, ST-8) → keyboard primitive (KB-1) → permissions service
(PERM-2) → one online definition (OFF-1) → error boundaries + user messages
(HK-3, HK-8) → forms (HK-2, HK-4, HK-6 → one rules module + `useYupForm`) →
design tokens (DS-1, DS-2) → Paper removal (DS-3) → Jest projects (TEST-2,
TEST-4) → boundary lint with baseline (CQ-1, CQ-5) → `absoluteFillObject`
codemod and dependency hygiene (DEP-4, DEP-5, DEP-6, DEP-7).

**Phase 3 — larger redesigns (quarter-scale, each behind e2e/device QA).**
Navigation stack + route manifest (NAV-2, DL-1, DL-2, NAV-3) → native map
tile loading and marker diffing (PERF-1, PERF-6) → gallery gestures on the UI
thread (PERF-3) → `/places` virtualisation (PERF-4) → DTO adapters (TS-3) →
god-file splits (CQ-4) → `react-native-render-html` replacement → upstream the
serializer fork and stop building RN from source (DEP-1, DEP-2) → iOS CNG
(DEP-3) → lazy locale loading on native (PERF-5).

### E. Proposed target architecture

Incremental: no big-bang move. New code follows the target; existing folders
migrate feature by feature behind the boundary lint.

```
app/                         Expo Router routes only (thin: read params, render a screen)
  _layout.tsx                providers, QueryClient, splash, error boundary export
  (tabs)/                    real sections (home, map, quests, places, profile)
  (stack)/…                  detail families: travels/[param], article/[id], quests/[city]/[id], trips/*
features/<name>/             one folder per product area (travel, quests, map, trips, auth, profile, messages, offline)
  screens/                   screen compositions (today's screens/tabs + components/screens)
  components/                feature-only UI
  hooks/                     feature hooks (queries, controllers, forms)
  api.ts | api/              feature endpoints built on the shared client; query keys registered centrally
  model/                     DTO → domain adapters and domain types (camelCase)
  __tests__/                 feature tests next to the code
components/ui/               design-system primitives only (no feature or api imports)  ← merge ui/, styles/
constants/designSystem.ts    the single token source (METRICS derived, theme.ts removed)
api/                         client.ts (request pipeline, requestRaw, uploadMedia), queryKeys.ts, queryClient access, errors
stores/                      cross-feature client state only (auth identity, offline catalog); owner-keyed when per-user
services/                    platform services: notifications, push, permissions, offline storage, pdf-export, monitoring
utils/                       pure leaf helpers only (geo, format, html sanitise, url) — no api/stores/components imports
i18n/                        unchanged; locale catalogs lazy on native
types/                       shared domain types; no imports from api/ or components/
scripts/, plugins/, patches/ unchanged ownership
```

Responsibilities and rules:

- **Routes** never fetch or validate; they render a feature screen.
- **Screens** compose feature components and hooks; one screens convention
  (today's `screens/tabs/*` and `components/screens/*` merge).
- **Hooks** own server state (React Query) and controllers; no fetch-in-effect.
- **Feature `api`** modules use `apiClient` only; base URL, timeouts and
  `ApiError` come from `api/`.
- **Stores** hold identity and device-only data, keyed by owner, cleared on
  identity change through one subscriber.
- **Services** wrap native modules (permissions, notifications, storage) so
  components never call `expo-*` directly for permission flows.
- **`components/ui` and `utils`** are leaves, enforced by
  `no-restricted-imports` with a shrinking baseline.
- **Platform variants** share a `Props` type (`satisfies`) and are
  type-checked with both suffix orders.

### F. Performance review

Lists: the travel catalog (`RightColumn`) and quests list are tuned; the
gaps are `/places` (`ScrollView` + `.map`, per-card saved-point index,
PERF-4), the fullscreen gallery (`windowSize` 21, index keys, PERF-2), map
list keys with index + inline handlers (PERF-7), favorites web branch and
`PopularTravelList` inside a `ScrollView` (PERF-9), dead FlashList v2 props
passed via `as any`.

Images: `expo-image` is correctly funnelled through `ImageCardMedia` with a
guard; the gallery bypassed resizing by passing size via `style` (PERF-2,
fixed). Guard gap: `ImageCardMedia` without numeric width on native.

Animations: Reanimated is used well in the hero slider and travel details;
remaining JS-driver animations are listed in PERF-9; the gallery zoom
(PERF-3) and the bottom sheet height publish (PERF-8) are the two UI-thread
problems.

Navigation: one Tabs navigator keeps every visited screen mounted (NAV-2);
`ThemedContent` in `app/_layout.tsx` re-renders on each navigation
(hypothesis).

JS thread: native map tiles as base64 strings (PERF-1), full marker rebuild
and payload re-serialisation (PERF-6), all five locale catalogs at startup
(PERF-5), per-item style factories because `getThemedColors` is not cached.

Re-renders: `useAuth()` whole-store subscription in 72 call sites (ST-3),
per-card favorites subscription (ST-4), `extraData` churn in messages.

Expensive computations: HTML parsing is memoised; `sanitize-html` is skipped
for server-sanitised HTML (SEC-1 trade-off); module caches are mostly capped
except `travelCache`/`travelSlugCache` (API-3, now capped).

Budgets exist only for web (eager bundle 1 200 KB, Brotli 800 KiB per page,
Lighthouse mobile score ≥60, LCP ≤4 s, TBT ≤600 ms, CLS ≤0.1). Nothing
measures native startup or memory; PERF-1/2/5 live there.

### G. Mobile-specific reliability review

- **Resume/background**: no focus refetch on native (LC-1); push token
  retries on resume are correct; `BiometricGate` does not re-lock on resume
  (product decision to confirm); `nativeQueryOnlineListener` re-checks NetInfo
  on resume with back-off (good).
- **Offline/online**: two definitions of online (OFF-1); saved copies ignored
  on network errors while "online" (OFF-2); `offlineOperations` memory-only;
  the quest progress queue flushes on start/resume/reconnect/login (good).
- **Permissions**: scattered requests and inconsistent denied handling
  (PERM-2); unnecessary iOS photo-library prompt (PERM-1); location prompt on
  mount (PERM-3); latent background-location request in dead geofencing
  (PERM-4); Android uses the system photo picker with `READ_MEDIA_*` blocked
  (good).
- **Deep links**: Android claims the whole domain but drops auth
  confirmation, subscribe confirm, set-password, articles, `/quests/<city>`
  (DL-1); reminder tap did nothing (DL-3, fixed); parser is fail-closed
  (good).
- **Push**: quest notifications on a LOW channel (PUSH-1, fixed); reminders
  survive logout (PUSH-2); registration flow handles rotation, logout races
  and provisional iOS permission (good).
- **Token expiration**: web cookie + CSRF; native tokens via SecureStore; 401
  confirmed by probe; refresh endpoint flag off; anonymous re-send of writes
  after 401 (API-2); `isSuperuser` restored from storage (ST-5).
- **Crash-prone areas**: fullscreen gallery memory (PERF-2), WebView map
  on low-end Android (PERF-1/6), keyboard handling (KB-1), unobserved
  exceptions because there is no crash reporter (HK-1), `useOfflineCatalog`
  unhandled rejection (fixed), `accountconfirmation` one-shot guard under
  StrictMode (dev only, hypothesis).

### H. Upgrade readiness (blockers for the next Expo SDK / RN)

1. DEP-1 — serializer fork (`@expo/metro-config`, `expo` patches, ~566 lines
   against compiled output).
2. DEP-2 — RN/Hermes from source on Android + `react-native+0.86.0.patch`.
3. DEP-3 — bare `ios/` with doctor checks disabled; manual Info.plist/Podfile
   edits.
4. DEP-4 — `absoluteFillObject` shim (68 usages).
5. DEP-8 — `react-native-render-html` (unmaintained, React 19 via patch);
   `react-native-fbsdk-next` legacy modules via interop; reanimated/worklets
   capped at RN 0.86; `expo-image` patch + `buildFromSource`.
6. DEP-7 — `expo.install.exclude` and duplicated pins (`resolutions` vs
   `overrides`) hide drift; i18n babel plugin depends on the TypeScript
   compiler API (TS 7 blocker).
7. DEP-9 — TS-ESLint `<6.1`, deprecated `react-test-renderer` /
   `jest-native` (RNTL 14 migration), Node 22 EOL April 2027.
8. TEST-2 — the Jest platform/DOM mix will surface on any preset bump.

### I. Security review

- **Token storage**: good — SecureStore on native, HttpOnly cookie on web,
  single writer, legacy web tokens purged. Weak spots: `isSuperuser` from
  client storage (UI-only gate, ST-5), XOR "encryption" of the biometric flag
  on web (SEC-5).
- **Secrets**: no server secrets in client code; third-party API keys (ORS,
  OpenWeatherMap) are public by design but extractable (SEC-3); the secrets
  guard scans only config files (SEC-4); `FacebookClientToken` committed in
  `Info.plist` while treated as a secret elsewhere (DEP-3).
- **Logs**: production strips everything except `console.error`; no token,
  header or password logging found; `devError`/`devWarn` discipline is good.
- **Local storage**: travel drafts, wizard steps, route points, search
  history and scheduled reminders are not user-scoped or cleared on logout
  (SEC-2, PUSH-2, ST-10); module-level travel caches held authenticated
  payloads on web (API-3, fixed); persisted React Query cache is whitelisted
  and owner-scoped (good).
- **Network layer**: timeouts and linked AbortControllers (good); CSRF on
  unsafe methods (good); anonymous re-send of writes after 401 (API-2);
  uploads retried on 504 without idempotency (ST-7); 40 % of modules bypass
  the client and its protections (API-1); registration retried after a
  connection failure (API-6); dev Metro proxy forwards all headers with
  `ACAO *` (dev only).
- **HTML**: client guard on `safe_html` is bypassable (SEC-1) behind a CSP
  with `unsafe-inline`/`unsafe-eval` and a public CDN (backend-owned nginx);
  three allow-lists disagree, `http:` iframes allowed, author `allow`
  attribute passed through, no `sandbox` (SEC-6); DOMPurify is a no-op on
  native.
- **Deep links**: fail-closed parser and strict post-login redirect (good);
  three validators for return paths with different strictness (NAV-6);
  `/\host` treated as relative (SEC-8).
- **WebViews**: strict bridge parsing and safe `OPEN_URL` (good); no
  `onShouldStartLoadWithRequest`, `originWhitelist={['*']}` in the route
  picker (SEC-7).
- **Permissions**: Android media permissions blocked, iOS usage strings clear
  (good); latent background-location request in dead code (PERM-4).

## 4. Phase 1 changes shipped with this audit

Behaviour-preserving cleanups and verified bug fixes, each with targeted
tests (see the commit for the exact diff):

- ST-2: `context/MapFiltersContext.tsx` — context memo dependencies derived
  from a compile-time-exhaustive key list (fixes stale `isBusy`).
- ST-7: `utils/reactQueryConfig.ts` — mutations no longer retry by default
  (the mounted client already overrode this; the geo client now matches).
- DL-3: `utils/incomingAppLinks.ts` — `/quests` and `/quests/<city>` accepted,
  so the 7-day quest reminder opens its city page.
- PUSH-1: `services/notifications*.ts` — dedicated `quests` channel
  (DEFAULT importance) for quest reminders and geofence arrival; i18n in
  RU/BE/UK/PL/EN.
- NAV-1: `hooks/useAndroidBackHandler.ts` — subscribes only while the screen
  is focused; `pathname` read from a ref.
- API-3: `api/travelDetailMemoryCache.ts` (new, extracted so
  `travelDetailsQueries.ts` stays under the 800-LOC guard) — guest-only
  memory caches decide "authenticated" from the auth store on web, are
  dropped on session-owner change and capped at 50 entries.
- PERF-2: `components/travel/ZoomableGalleryImage.tsx`,
  `FullscreenGallery.tsx` — numeric `width`/`height` reach `ImageCardMedia`
  (resized sources instead of originals); FlatList window props.
- LC-3 / OFF-3 / HK-10: `SyncIndicator` nested timer cleanup;
  `useOfflineCatalog` error handling and stale-user guard;
  `useNetworkStatus` rejection handling; `useYupForm` logs swallowed submit
  errors; `useVisitedCountries` and `useProfileCountriesData` share one core
  hook.
- NAV-5 / CQ-3 / DEP-7: removed byte-identical `login/registration/
  set-password/userpoints.native.tsx`, dead `context/FiltersProvider.tsx`
  (and its four stale test mocks), dead `metro.config.optimized.js`, dead
  `getGuestFavoritesStorageKey`, stale `tsconfig` excludes.

Deliberately not touched (owner-gated by `AGENTS.md` or needing a product
decision): `scripts/`, `.github/workflows/`, `app.json`, `plugins/`,
`nginx/`, dependency removals, ST-1 favorites persistence, retry policy for
500s and 504 uploads, PERM-1 (needs an iOS device pass), NAV-2.
