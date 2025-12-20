# MeTravel Regression Summary

## Scope
- Platforms: Web, iOS, Android (shared codebase).
- Goal: verify all regression suites before release.

## Regression command
- `npm run test:coverage`
  - Runs the full Jest suite with coverage reporting for both web and native helpers.
  - Latest run exits with code 1 because:
    1. `__tests__/api/travels.auth.test.ts` still asserts against a bare string but the mocked registration helper now returns `{ message, ok }`.
    2. `__tests__/components/travel/UpsertTravel.integration.test.ts` cannot find the moderation warning text `Нужно дополнить перед модерацией` while required fields stay empty.
  - Known noise: React Native console warnings about deprecated modules (ProgressBarAndroid, Clipboard, PushNotificationIOS) continue to appear in Jest logs.

## Tests status
- ✅ `isNetworkError` test suite rerun (via `npx jest __tests__/utils/networkErrorHandler.test.ts --runInBand`) — now passes after the `navigator.onLine` guard was rewritten.
- ⚠️ Full coverage run remains blocked by the two failing suites above.
- Note: `ImageErrorHandler` tests intentionally emit console errors when they trigger their network- and CORS-related mocks.

## Follow-up
- Re-run `npm run test:coverage` once the failing suites are aligned with the current API/UX behavior.
- Keep `.env.preprod` aligned with the pre-prod environment when redeploying (file already exists in the repo).
