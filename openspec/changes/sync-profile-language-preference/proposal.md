## Why

The interface language is persisted only on the device, so authenticated authors keep receiving Russian moderation emails even after choosing another supported language. Backend #2687 now supports the owner's optional profile language; #2691 connects deliberate preferences to that existing API without treating Russian startup or a translated quest URL as user intent.

## What Changes

- Add the optional nullable supported-language field to the profile DTO and update payload.
- Distinguish valid persisted preferences from missing, invalid or failed storage reads; publish deliberate preference writes without changing provider boot or URL-locale contracts.
- Add one shared authenticated runtime that synchronizes after preference hydration/login and on explicit selection, resolving system mode to a supported device language.
- Serialize/coalesce language requests and invalidate stale sessions; update only the accepted language in existing owner profile cache entries.
- Make existing settings/avatar cache commits own only their updated fields so a delayed full profile response preserves a newer language.
- Show a translated error through the existing toast when the current profile-language save fails; retain the local selection and permit another explicit attempt.

## Capabilities

### New Capabilities

- `profile-language-preference`: Persisted and explicit interface preferences synchronize safely to the authenticated owner's profile language.

### Modified Capabilities

None. Existing locale bootstrap, temporary quest locale, authentication, profile endpoint permissions and email rendering contracts remain in force.

## Impact

- Scope: profile DTO/cache and settings/avatar commit masks; locale storage; one shared runtime in the existing root; language selection handlers; common RU/BE/UK/PL/EN messages; focused tests.
- Platform impact: shared code, desktop/mobile web acceptance. No native provider, device discovery, configuration or lifecycle change is planned; native boot regressions remain mandatory unit controls.
- Localization impact: RU/BE/UK/PL/EN, common namespace error copy only. API/editorial content is not translated.
- API/data: existing owner PUT `/api/user/{id}/profile/update/` with a supported language string; system never sends null. Backend #2687 is done. No backend changes or new dependencies.
- User-visible/accessibility: current controls and geometry remain; a failed server save is visible in the current UI language.
- SEO/performance/analytics: no routing/indexing/analytics changes; no startup preference write without valid user intent and no unbounded network retry.
- Security: source owner solely from authenticated state, guard logout/account changes and ignore stale responses.
- Non-goals: email translations, cross-device system mode, profile-driven interface selection, editorial translation, selector redesign.
- Fallback/mock policy: keep local selection on API failure and report it; fixtures only for unit tests, real production owner API and browser acceptance after review/push/deploy.
