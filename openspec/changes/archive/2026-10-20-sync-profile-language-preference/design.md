## Context

See proposal.md. Evidence: `api/user.ts` exposes the owner profile GET/PUT but omits language; `localeStorage.ts:27-55` maps absent, invalid and failed reads to explicit RU; web provider active locale can instead come from a quest URL. Existing auth/profile consumers share `queryKeys.userProfile(ownerId)`, including suffix variants. Root `ThemedContent` already mounts invisible runtimes inside AppProviders on both platforms.

## Goals / Non-Goals

**Goals:** implement the new observable profile-language capability, preserve locale boot/URL behavior, prevent stale owner/cache writes, and make remote failures visible.

**Non-Goals:** backend changes, profile-driven UI locale, new native discovery/lifecycle, selector geometry, new auth state, unrelated profile/cache refactoring, editorial or email prose.

## Decisions

### Preference provenance belongs to the existing storage boundary

Add nullable persisted-preference parsing/reading while retaining the existing fallback API. The shared supported-locale guard accepts only registry-owned locale keys, excluding inherited object properties for both persisted and system preferences. A small subscription reports successful deliberate writes. Serialize storage writes and suppress superseded completion notifications so out-of-order storage promises cannot persist an older final preference. Reads wait for the current write queue and ignore a read overtaken by another write. The web explicit setters also use an intent generation around asynchronous catalog loading; an older catalog must not cause a later stale write.

Rejected: observe `locale`, HTML lang or `languageChanged`; those include RU bootstrap and quest URL overrides. Rejected: infer intent from `isHydrated` plus explicit RU because a fallback has the same shape. Native provider and device discovery stay unchanged; boot/storage regression suites protect their existing contract.

### One stable shared authenticated runtime

Mount `ProfileLanguageSyncRuntime` beside the other invisible root runtimes. It consumes only locale hydration from the provider, reads valid persisted preferences and subscribes to deliberate writes. An initial-read generation prevents a late read from replacing a newer event. Subscribe directly to auth-store identity transitions so A→logout→A is observed even if React batches renders; only auth-ready authenticated state supplies the owner ID.

### Serial requests and session generations

A focused testable coordinator keeps one in-flight save and a replaceable latest desired target. It retains the in-flight lock across auth changes while invalidating the old session's queued work. Before sending, after each await and before cache/error effects, recheck owner/session and target generation. A failure does not automatically retry the same attempt; a fresh explicit choice permits another attempt. Cleanup invalidates pending work without letting a late request recreate cache.

Rejected: parallel PUTs with only a response sequence guard; that protects cache but can leave the server on the older language. Do not add language state to the auth store or a separate profile query key.

### Cache updates own their fields

After a current successful language response, cancel matching owner profile GETs, recheck the attempt, and patch only `language` in existing owner profile entries, including suffix variants. Do not create a partial profile when no cache entry exists, replace the whole response, or touch another owner's entries. Immediately restart cancelled active initial GETs before yielding so a superseded language choice cannot strand the first profile load.

Extend the existing profile setter with an optional updated-field mask and functional merge. Settings name/social and notification saves pass their payload keys; the avatar callback passes only `avatar`. Existing full-replace callers retain their contract. This prevents a delayed full DTO from overwriting the accepted language without introducing an overlay store.

### Existing API and notification contracts

DTO and optional update payload use `SupportedLocale | null`; the sync runtime sends a concrete supported string through `updateUserProfile`, retaining existing cookie/CSRF/native-token behavior. A mismatching successful response is not treated as a confirmed save. On current failure, use existing `showToast` with common RU/BE/UK/PL/EN text translated at emission time; local preference remains. Existing selector error handling must not create an unhandled rejected promise. No backend edits are planned.

## Owned Paths

- `api/user.ts`, `hooks/useUserProfile.ts`, `hooks/useSettingsProfileForm.ts`, the avatar cache commits in `components/screens/{profile/ProfileScreen,settings/SettingsScreen}.tsx` and their targeted tests.
- `i18n/config.ts` supported-locale guard, `i18n/localeStorage.ts`, web explicit-selection sequencing in `i18n/LocaleProvider.web.tsx`, `components/layout/{LanguageOptionList,CustomHeaderMobileMenu}.tsx`, settings language handlers, and related tests.
- A shared profile-language coordinator/runtime and root mounting in `app/_layout.tsx`.
- `i18n/locales/{ru,be,uk,pl,en}/common.ts`; this OpenSpec change and final canonical capability.
- Unrelated #2677 travel resources/docs and backend paths are excluded.

## Validation Matrix

| Surface | Checks |
| --- | --- |
| Storage/web/native boot | Nullable provenance, invalid/error fallback parity, serialized writes, stale reads, existing native/web mount/hydration and quest URL suites |
| Auth/API/cache | Guest/boot/no-preference suppression; login in both hydration orders; system→effective locale; serial/coalesced saves; failures/retry; logout/A→B/A→logout→A; no partial/foreign cache; stale GET and profile/avatar field masks |
| All current locales | `npm run test:i18n`; error keys RU/BE/UK/PL/EN; translations evaluated when shown |
| Code level | Focused Jest/eslint/typecheck/guards, full lint and full Jest for this cross-cutting diff, independent review-auditor then code-review-gate |
| Production testing | Deploy reviewed final SHA; browser desktop1440/mobile390; real owner GET/PUT across selection/reload/login, guest/no-preference/temporary quest no writes, EN-device system mode, delayed PL→EN/error, screenshots and console |

Device QA is conditional on introducing native-specific lifecycle/config behavior; none is planned. No new SEO/URL/canonical, analytics, media, focus, keyboard or layout behavior is introduced. Bundle impact is one small shared runtime; no eager platform module or recurring retry/request polling.

## Risks / Trade-offs

- A slow in-flight save delays the newest request → preserve correct server ordering and coalesce intermediate choices.
- Auth or initial storage read races → synchronous session invalidation and generation checks before every effect.
- Warm profile GET/full mutation response races → cancel old reads and merge only owned fields.
- Provider/bootstrap regression → retain fallback and native provider behavior; run existing boot/URL tests before release.

## Migration Plan

Backend #2687 is already deployed. No local preference format, database or dependency migration is needed. Follow #2691 review→commit/push→testing→canonical production deploy→real acceptance. Revert task commits to disable synchronization while leaving local preference and the backend field intact. Synchronize/archive OpenSpec only after the complete Done gate.
