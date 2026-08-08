## 1. Baseline and Open Questions

- [ ] 1.1 Reproduce the defect on the current build and record it: a trip whose payload carries an ISO date-time renders the raw string on my trips, planned trip detail, the public list, and public trip detail, and its edit form opens with an empty time field.
- [ ] 1.2 Resolve proposal Open question 1 (write payload format) and Open question 2 (unavailable-date copy) with the user before writing code; record the answers in the change artifacts and do not start section 5 on an unstated assumption.

## 2. Shared Normalization Contract

- [ ] 2.1 Add `utils/tripDateTime.ts` exporting `TripDateTime` and `parseTripDateTime`, covering date-only, `Z`, numeric-offset, offset-less legacy date-time, and bounded rejection of unreadable input, with date-only values built from local components so they never shift timezone.
- [ ] 2.2 Add the shared localized presentation primitives in the same module (date, date plus local time, range, and the unavailable-date text) on top of `i18n/format.ts`, passing a `Date` rather than a bare string so `formatDate` cannot re-introduce a UTC-midnight shift.
- [ ] 2.3 Add the unit matrix under `TZ=Europe/Minsk` for date-only, `09:00+00:00` → `12:00`, `09:00Z`, `12:00+03:00`, offset-less legacy, the `23:30Z` day-boundary case, and every malformed input, plus one negative-offset case proving a date-only value keeps its calendar day.

## 3. Remove the Duplicate Parsers

- [ ] 3.1 Delete `parseTripIsoDate` from `components/trips/planning/tripPlanFormatting.ts`, delegate `formatTripDisplayDate` and `formatTripDateTime` to the shared module, and keep `formatTripDateTime`'s two-argument signature while making it safe for a date-time first argument.
- [ ] 3.2 Delete the private `fmt` from `components/trips/tripFormatting.ts` and delegate `formatTripDates` to the shared range formatter, preserving the existing `18 июл. – 20 июл.` and `28 июн.` output.
- [ ] 3.3 Re-point the `parseTripCreateIsoDate` re-export in `components/trips/planning/TripCreateForm.tsx` at the shared parser without changing the create form's schema, `DATE_RE`, or `TIME_RE`.
- [ ] 3.4 Run the existing `__tests__/trips/tripPlanFormatting.test.ts`, `__tests__/trips/tripFormatting.test.ts`, and `__tests__/components/trips/tripCreateForm.test.tsx` unchanged and confirm every currently passing expectation still passes.

## 4. Preserve Time at the API Boundary

- [ ] 4.1 Normalize `startDate`/`startTime` in `mapPlannedTrip` and `mapCommunityTrip` in `api/plannedTripsNormalizers.ts`, replacing the hardcoded `startTime: null`, and leave `createdAt` untouched.
- [ ] 4.2 Normalize `startDate` and any end value in `mapTrip` in `api/publicTrips.ts`, keeping `endDate: null` when the catalog serializer provides no end field.
- [ ] 4.3 Extend `__tests__/trips/plannedTripsAdapter.test.ts` and `__tests__/trips/api.publicTrips.test.ts` with real DTO fixtures for date-only, `+00:00`, `Z`, and malformed values, asserting derived local date and time rather than mocking the parser.
- [ ] 4.4 Confirm `sortPublicTrips` ordering and the fallback-cover season are unchanged, adding a day-boundary case to `__tests__/trips/publicTripCatalogUtils.test.ts` and `__tests__/components/trips/tripFallbackCover.test.ts`.

## 5. Edit Form and Write Round Trip

- [ ] 5.1 Delete `toDateInputValue` from `app/(tabs)/trips/plan/[id].tsx` and fill `initialEditValues` from the parsed date and time parts, keeping the existing user-input validation for what the owner types.
- [ ] 5.2 Apply the resolved answer to Open question 1 in `createTrip` and `updatePlannedTrip` in `api/plannedTripsRequests.ts` through one shared serializer, keeping the `09:00` default only for a create with no user-supplied time.
- [ ] 5.3 Prove the round trip against the real API: save an existing trip without changing its start, refetch, and confirm the same local date and time; capture the request payload and the refetched value. Do not use the mock branches as evidence.
- [ ] 5.4 If the real API rejects the sent format, stop implementation, keep the lossy payload out of the code, and record the blocker with the exact request, response, and reproduction, prepared as an `area=back` board task for the user to authorize.

## 6. Unavailable State and Localization

- [ ] 6.1 Render the localized unavailable-date text wherever a trip start or end is missing or unreadable on my trips, planned trip detail, the public list, and public trip detail, keeping it distinct from the edit form's "choose a date" prompt.
- [ ] 6.2 Add the new key to `i18n/locales/{ru,be,uk,pl,en}/static/trips_static.ts` in this change and confirm no new hardcoded string was introduced on any touched surface.
- [ ] 6.3 Run `npm run test:i18n` through the shared quality gate and fix any failure in the touched scope.

## 7. Regression Control

- [ ] 7.1 Add the governance test asserting that only `utils/tripDateTime.ts` interprets a trips date value, so adding a second trips date parser or a `new Date(<trip date field>)` construction elsewhere fails the suite and names the location.
- [ ] 7.2 Add the rendering test that drives the real card and detail components with each accepted and rejected input shape and fails when output contains a `T` separator, a `Z` suffix, a `±HH:MM` offset, or text byte-identical to the API value.
- [ ] 7.3 Verify both new tests actually fail against the pre-change behavior before accepting them as regression control.

## 8. Automated Validation

- [ ] 8.1 Check the shared quality gate before starting; if a live owner holds it, record `validation delegated` or `validation skipped` per `AGENTS.md` instead of waiting, polling, or running a narrower bypass.
- [ ] 8.2 Run the focused trips unit, adapter, component, and governance suites with no `.skip`, and fix every failure inside the task scope.
- [ ] 8.3 Run `npm run check:fast`, classify any pre-existing unrelated failure without touching user-owned changes, and fix all failures in the task-owned scope.

## 9. Active-Surface Validation

- [ ] 9.1 Verify desktop web on `/trips`, `/trips/[id]`, `/trips/my`, `/trips/plan/[id]`, and `/trips/community` with a trip carrying an ISO date-time: correct local date and time on each surface, screenshots saved to an ignored folder, clean console with no hydration warning.
- [ ] 9.2 Verify the full edit round trip in the browser: open an existing trip, confirm the pre-filled local date and time, save, reload, and confirm the same local time.
- [ ] 9.3 Verify mobile web at the narrowest supported width on the same trip and locale: same text and position as desktop, no truncation to an unrecognizable fragment, clean console.
- [ ] 9.4 Confirm the USB device with `adb devices -l`, build and install the Android app locally, record the device timezone, and run the same five surfaces plus the edit round trip, confirming pairwise parity with mobile web.
- [ ] 9.5 Verify the date, time, and unavailable placeholder in RU, BE, UK, PL, and EN on at least one card surface and one detail surface, checking layout fit at the narrowest supported width.

## 10. Review and Handoff

- [ ] 10.1 Run the mandatory metravel code-review-and-fix pass over the complete task diff, correcting confirmed correctness, duplication, reuse, and regression findings without touching unrelated user changes, then re-review the resulting diff.
- [ ] 10.2 Re-run every affected automated suite and the desktop web, mobile web, and Android scenarios after the review fixes.
- [ ] 10.3 Run `openspec validate fix-trips-date-normalization --type change --strict` and `openspec validate --all`, and update this checklist with the recorded evidence.
- [ ] 10.4 Report the outcome as `local fix ready; production verification pending`; do not claim a production fix without a separately authorized deploy followed by a live production check.
