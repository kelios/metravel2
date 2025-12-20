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

## Regression & pre-prod checklist
- `npx eslint --quiet`
  - Still exits with code 1 because 49 errors remain; the current blockers are concentrated in the travel-list surface (`components/listTravel/RenderTravelItem.tsx`, `components/listTravel/TravelListItem.tsx`, `components/listTravel/RightColumn.tsx`) plus the mobile slider stack (`components/travel/Slider.tsx`, `components/travel/TravelSectionTabs.tsx`, `components/travel/FiltersUpsertComponent.tsx`, `components/travel/details/TravelDetailsContainer.tsx`), several React Native hooks patterns (`components/ui/examples/ModernListTravel.tsx`), and a few `no-empty`/`no-useless-escape` leftovers (`components/seo/InstantSEO.tsx`, `components/travel/AuthorCard.tsx`). The missing definition for `react/no-array-index-key` is another lint configuration gap that blocks the RightColumn check.
  - Fixed targets from this run: `app/(tabs)/profile.tsx`, `app/(tabs)/settings.tsx`, `app/(tabs)/quests/index.tsx`, `app/_layout.tsx`, `components/CustomImageRenderer.tsx`, `components/HotelWidget/HotelWidget.tsx`, `components/Map/MapRoute.ts`, `components/Map/web.tsx`, `components/layout/ResponsiveStack.tsx`, `components/listTravel/ListTravel.tsx`, `components/listTravel/ListTravelRedesigned.tsx`, `components/MapPage/RoutingMachine.tsx`, `components/seo/InstantSEO.tsx`, `components/travel/AuthorCard.tsx`, and `components/ui/examples/ModernListTravel.tsx` to reduce the noise count; additional waves need to tackle the remaining hooks/empty-block issues in travel-list and slider components plus the missing `react/no-array-index-key` rule definition.
  - Next steps: keep refactoring hook usage in the larger list/slider components, fill in the missing ESLint rule, re-run `npx eslint --quiet` after each batch, and document any fresh blockers.
- Pre-prod readiness
  - Verify the manual staging preparation steps from `docs/RELEASE.md` (build, deploy, and monitor) while ensuring `.env.preprod` reflects the pre-prod API/configuration.
