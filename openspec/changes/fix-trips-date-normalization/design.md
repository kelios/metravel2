## Context

See [proposal.md](proposal.md) for motivation and [the capability spec](specs/trips-date-normalization/spec.md) for observable behavior.

The trips domain currently holds three independent interpretations of one value.

- `components/trips/planning/tripPlanFormatting.ts:184` — `parseTripIsoDate(value)` matches `^(\d{4})-(\d{2})-(\d{2})$`, builds `new Date(year, month - 1, day)`, and re-validates the round-trip. `formatTripDisplayDate` (line 202) and `formatTripDateTime` (line 210) call it and **return the input unchanged when it does not match**. That passthrough is what prints `2026-10-12T09:00:00+00:00` to users.
- `components/trips/tripFormatting.ts:58` — a module-private `fmt(iso)` re-implements the identical regex, the identical `new Date(y, m - 1, d)` construction, the identical round-trip validation, and the identical raw passthrough, differing only in its `formatDate` options. This is the duplicate formatter the task asks to remove; `formatTripDates` (line 78) and `tripCardMeta` (line 90) are its only callers.
- `app/(tabs)/trips/plan/[id].tsx:69` — `toDateInputValue(value)` slices the string at `T` (or at 10 characters) to seed the edit form. It never converts the instant, so an evening UTC value yields the previous local calendar day, and the time is discarded entirely.

The API boundary drops the time before any of that runs:

- `api/plannedTripsNormalizers.ts:412` sets `startDate: dto.start_date ?? ''` and line 413 hardcodes `startTime: null`.
- `api/plannedTripsNormalizers.ts:460` sets `startDate: dto.start_at ?? ''` and line 461 hardcodes `startTime: null`.
- `api/publicTrips.ts:276` sets `startDate: dto.start_at` verbatim and line 277 sets `endDate: null` (the catalog serializer has no end field).

So `PlannedTrip.startTime` (`api/plannedTripsTypes.ts:63`) is `null` for every trip that came from the API; only the mock store (`api/plannedTripsMock.ts`) ever carries a time, which is why local mock development hides the defect.

The write path closes the loop: `api/plannedTripsRequests.ts:233` (create) and `:266` (update) build `start_date: \`${input.startDate}T${input.startTime || '09:00'}:00\`` — an offset-less local string with a hardcoded 09:00 default. Because the read path returns `startTime: null`, the edit form always submits that default, so saving an existing trip silently rewrites its start time.

`i18n/format.ts` already provides `formatDate` and `formatDateTime` over `Intl`, resolving the active locale from `i18n/config.ts`. Note that `formatDate` funnels its argument through `new Date(value)`, which parses a bare `YYYY-MM-DD` as **UTC** midnight — this is exactly why the current code hand-builds a local `Date` for date-only values, and the new contract must keep doing so.

The backend is a read-only dependency in this workspace. `start_date` and `start_at` are ISO 8601 date-time values with an offset; date-only remains accepted legacy input on the read side.

## Goals / Non-Goals

**Goals:**

- One parsing entry point for trips start/end values, with every other trips date helper delegating to it.
- Keep the existing `PlannedTrip.startDate` / `PlannedTrip.startTime` shape so no consumer, card, or test has to learn a new domain model.
- Normalize at the API boundary, so components receive an already-local calendar day and an already-local time, and no component re-derives a timezone.
- Preserve the exact current output for every input that works today (`2026-07-11` → `11 июля 2026 г.`, `18 июл. – 20 июл.`), so this change is observable only where it was broken.
- Make the two failure modes provable by test: raw ISO reaching the UI, and a second parser being added.

**Non-Goals:**

- Replacing `Intl`-based formatting or adding a date library.
- Introducing an app-wide date abstraction outside the trips domain.
- Reworking the date picker component, the yup schema shape, or the edit panel layout.
- Consolidating trip chat message timestamps (`components/trips/chat/TripChatPanel.tsx:39`) or notification relative time (`components/trips/TripNotificationsList.tsx:69`); both already handle full ISO date-times and belong to different capabilities.
- Adding a `scripts/` guard binary (see the regression-control decision below).

## Decisions

### One parser, returning parts rather than a formatted string

Add `utils/tripDateTime.ts` as the single normalization module. It sits in `utils/` rather than under `components/trips/` because `api/plannedTripsNormalizers.ts` and `api/publicTrips.ts` must import it, and the API layer must not depend on components. `utils/tripPlanLinks.ts` establishes the precedent for trips-domain helpers living there.

The exported contract:

```ts
export interface TripDateTime {
  /** Device-local calendar day, `YYYY-MM-DD`. Safe for a date input or picker. */
  readonly date: string
  /** Device-local wall-clock time `HH:mm`, or null when the source carried none. */
  readonly time: string | null
  /** Exact instant for a date-time input; local midnight for a date-only input. */
  readonly value: Date
  /** True when the source carried an explicit time of day. */
  readonly hasTime: boolean
}

/** The only place a trips date string is interpreted. Returns null when unreadable. */
export function parseTripDateTime(input: string | null | undefined): TripDateTime | null
```

Returning parts rather than a string is what lets the same call serve a card (`date` + `time` formatted for display), the edit form (`date` and `time` as separate field values), and any future consumer, without a second parser appearing for the form's sake. `hasTime` is explicit rather than inferred from `time === null` so that "no time in payload" stays distinguishable from "time failed to parse", which the current code cannot express.

Parsing rules, in order: reject non-strings and blank input; `^\d{4}-\d{2}-\d{2}$` builds a local `Date` and keeps the calendar day with `hasTime: false`; a date-time with `Z` or `±HH:MM` is parsed as an instant and read back through local getters; a date-time with no offset is treated as device-local wall clock, because this application's own writer produced exactly that shape. Every branch re-validates the constructed `Date` against its components the way the current code does, so `2026-02-30` and `2026-13-45` stay rejected. Input longer than a bounded length is rejected without parsing, so an untrusted API string cannot drive unbounded work.

Alternative considered: widen the existing `parseTripIsoDate` regex in place. Rejected because it leaves the duplicate in `tripFormatting.ts`, leaves `toDateInputValue` in the screen, and returns only a `Date`, which cannot express "the payload carried no time".

Alternative considered: keep the raw ISO string in the domain model and parse at every render. Rejected because it keeps the raw value one mistake away from the screen, and forces every consumer to repeat the timezone decision.

### Normalize at the API boundary, keep the domain shape

`mapPlannedTrip`, `mapCommunityTrip` (`api/plannedTripsNormalizers.ts`) and `mapTrip` (`api/publicTrips.ts`) call `parseTripDateTime` once and fill `startDate` with the local `YYYY-MM-DD` and `startTime` with the local `HH:mm` or `null`. `PublicTrip.endDate` is normalized the same way when a source field exists. `createdAt` on those objects keeps its current raw value; it feeds relative-time rendering, not this capability.

This keeps `api/plannedTripsTypes.ts` unchanged and means every existing consumer — `TripPlanCard`, `MyCreatedTripsList`, `CommunityRoutesCatalog`, `PublicTripCard`, `PublicTripDetail`, `PublicTripsCatalog` — starts receiving a correct time without any change to how it reads the trip. It also keeps `sortPublicTrips` (`components/trips/publicTripCatalogUtils.ts:7`) lexicographically correct, because after normalization every `startDate` is the same fixed-width shape.

An unreadable payload yields `startDate: ''` and `startTime: null`, which the display layer turns into the localized unavailable state. The normalizer does not substitute today's date or any other guess.

Alternative considered: add a new `startAt: string` instant field alongside the existing two. Rejected as a wider domain change than the defect needs, and it would leave two sources of truth for the same trip start.

### Presentation helpers stay where their consumers already import them

`utils/tripDateTime.ts` also exports the shared formatting primitives (localized date, localized date + time, localized range, and the unavailable placeholder). The two existing presentation modules keep their public names as thin delegates, so no consumer import changes:

- `components/trips/planning/tripPlanFormatting.ts`: `formatTripDisplayDate` and `formatTripDateTime` delegate; `parseTripIsoDate` is deleted, and `TripCreateForm`'s re-export `parseTripCreateIsoDate` (`components/trips/planning/TripCreateForm.tsx:48`) is re-pointed at the new parser so `__tests__/components/trips/tripCreateForm.test.tsx` keeps its entry point.
- `components/trips/tripFormatting.ts`: the private `fmt` is deleted and `formatTripDates` delegates to the shared range formatter with the existing `{ day: 'numeric', month: 'short' }` presentation.

`formatTripDateTime(dateIso, time)` keeps its two-argument signature because `TripPlanCard.tsx:129` and `app/(tabs)/trips/plan/[id].tsx:289` both pass `trip.startDate, trip.startTime`; after normalization the second argument is finally non-null when the payload had a time. The function additionally accepts a date-time in its first argument so a not-yet-normalized value can never fall through to a raw print.

Alternative considered: move all trips date formatting into one new module and update every import. Rejected as churn that widens the review diff without changing behavior.

### The edit form consumes parts, not a string slice

`toDateInputValue` in `app/(tabs)/trips/plan/[id].tsx:69` is deleted. `initialEditValues` (line 75) fills `startDate` from `TripDateTime.date` and `startTime` from `TripDateTime.time ?? ''`, so the form opens on the correct local day with the correct local time. The existing `^\d{4}-\d{2}-\d{2}$` and `^\d{2}:\d{2}$` checks at lines 201 and 205 stay as user-input validation — they now guard what the user typed, not what the API returned, which is the only role they can correctly play. The picker label at line 433 keeps calling `formatTripDisplayDate`, which now delegates.

`TripCreateForm`'s `DATE_RE`/`TIME_RE` and yup schema are unchanged: the create form has no API value to normalize, only user input.

### Write-side round trip

Recorded default, tied to Open question 1 in the proposal: `api/plannedTripsRequests.ts` builds the `start_date` payload through one shared serializer in `utils/tripDateTime.ts` that emits an explicit ISO 8601 offset from the local date and time, replacing the offset-less concatenation at lines 233 and 266. The hardcoded `'09:00'` default remains only for a create with no time supplied, where the user genuinely provided none.

This must be proven by a real save-then-refetch probe against the API — not by a mock — because the mock branches at lines 273 and 295 write straight back into the in-memory store and would show success regardless. If the API rejects the offset form, the change stops there and the gap is filed as an `area=back` task; the lossy naive payload is not restored as a workaround, and no mock fallback is used to claim the round trip works.

Alternative considered: leave the write path untouched. Rejected because once the read path shows a true local time, an unchanged naive write can move a saved trip by the device offset, converting a display bug into a data bug.

### Regression control as a repository test, not a new guard script

`scripts/` is a protected path under `AGENTS.md` and `docs/RULES.md` and must not be edited without an explicit user request, so the "no second parser" control is implemented as a Jest governance test in `__tests__/trips/` that reads the trips source files and asserts that only `utils/tripDateTime.ts` contains a trips date-parsing regex or a `new Date(<trip date field>)` construction. It runs inside `npm run test:run` and the changed-scope selective runs without any new command.

The complementary control is behavioral: a rendering test drives the real card and detail components with each accepted and rejected input shape and asserts the output contains no `T` separator, no `Z`, and no `±HH:MM`, and is never byte-identical to the input. Per `docs/RULES.md` evidence rules, at least one test must exercise the real construction path rather than mocking the value under investigation — so the API-normalizer tests feed real DTO fixtures through `mapPlannedTrip`, `mapCommunityTrip`, and `mapTrip` rather than stubbing the parser.

If the user later authorizes a `scripts/` change, this test is the specification a `guard-trips-date-normalization.js` binary would implement; that promotion is a separate change.

## Affected frontend paths

- `utils/tripDateTime.ts` — **new**: `parseTripDateTime`, `TripDateTime`, shared localized formatters, and the payload serializer.
- `components/trips/planning/tripPlanFormatting.ts` — delete `parseTripIsoDate`; `formatTripDisplayDate` and `formatTripDateTime` delegate.
- `components/trips/tripFormatting.ts` — delete the private `fmt`; `formatTripDates` delegates; `tripCardMeta` unchanged.
- `api/plannedTripsNormalizers.ts` — `mapPlannedTrip` (lines ~412–413) and `mapCommunityTrip` (lines ~460–461) fill `startDate`/`startTime` from the parser.
- `api/publicTrips.ts` — `mapTrip` (lines ~276–277) normalizes `start_at` and any end value.
- `api/plannedTripsRequests.ts` — `createTrip` (line ~233) and `updatePlannedTrip` (line ~266) use the shared serializer.
- `app/(tabs)/trips/plan/[id].tsx` — delete `toDateInputValue`; `initialEditValues` uses the parsed parts.
- `components/trips/planning/TripCreateForm.tsx` — re-point the `parseTripCreateIsoDate` re-export; no schema change.
- `i18n/locales/{ru,be,uk,pl,en}/static/trips_static.ts` — one new unavailable-date key in all five locales.
- Tests: `__tests__/trips/tripPlanFormatting.test.ts`, `__tests__/trips/tripFormatting.test.ts`, `__tests__/trips/plannedTripsAdapter.test.ts`, `__tests__/trips/api.publicTrips.test.ts`, `__tests__/trips/publicTripCatalogUtils.test.ts`, `__tests__/components/trips/TripPlanCard.test.tsx`, `__tests__/components/trips/tripCreateForm.test.tsx`, plus new `utils/tripDateTime` matrix and governance tests.
- Read-only, not edited: `../metravel-backend`. Any serializer or timezone gap found there is an `area=back` board task.

## Data and API contract

| Direction | Field | Accepted / emitted | Result |
| --- | --- | --- | --- |
| Read | `start_date` (planned) | `2026-10-12` | `startDate: '2026-10-12'`, `startTime: null` |
| Read | `start_date` (planned) | `2026-10-12T09:00:00+00:00` | Europe/Minsk → `startDate: '2026-10-12'`, `startTime: '12:00'` |
| Read | `start_at` (community/public) | `2026-10-12T09:00:00Z` | identical to the `+00:00` case |
| Read | either | `2026-10-12T09:00:00` (legacy, no offset) | treated as local wall clock → `startTime: '09:00'` |
| Read | either | `''`, `null`, `not-a-date`, `2026-02-30` | `startDate: ''`, `startTime: null`, unavailable state rendered |
| Write | `start_date` | built from local date + local time | ISO 8601 with explicit offset — subject to the real-API probe in Open question 1 |

No endpoint, field name, pagination, or auth change. Authorization and ownership behavior are untouched.

## Risks / Trade-offs

- [Device timezone differs between the SSR/prerendered web shell and the hydrated client, producing a hydration mismatch on a date] → Trips screens are client-router app screens, not prerendered content; still, verify the first paint of `/trips` and `/trips/my` for a React hydration warning in the console as part of desktop-web evidence.
- [`new Date('2026-10-12')` parses as UTC midnight, so a careless delegation to `formatDate` re-introduces the day shift the current code avoids] → The parser always builds date-only values with local components and passes a `Date`, never a bare string, to `i18n/format.ts`; the negative-offset scenario in the spec is an explicit test case.
- [Jest and the Android device may run in different timezones, so a test that passes locally can hide the bug] → Pin `TZ=Europe/Minsk` for the date matrix and add at least one negative-offset case; device evidence is captured on a phone with a known, recorded timezone.
- [Normalizing `startDate` to a local day changes catalog sort order for trips whose UTC and local days differ] → Ordering stays start-date ascending with featured first; assert the existing ordering test still passes and add a case with a day-boundary trip.
- [Changing the write payload could be rejected by the deployed API and is not observable through the mock branches] → Prove with a real save-then-refetch probe, and stop with an `area=back` task on rejection rather than reverting to the lossy format.
- [The fallback cover season reads the raw string prefix (`components/trips/planning/tripFallbackCover.ts:63`) and will now see a local day] → Behavior is unchanged for date-only values and for any value whose local and UTC month agree; assert the existing `tripFallbackCover` tests and add a day-boundary case so a season flip is caught rather than discovered on a card.
- [Five locales plus a longer string (date + time) can overflow the single-line card meta row on narrow screens] → Verify RU/BE/UK/PL/EN at the narrowest supported mobile width on both mobile web and Android; the meta row already uses `numberOfLines={1}`, so the failure mode is truncation, not layout break.
- [Deleting the duplicate `fmt` changes `formatTripDates` output if the shared range formatter is given different options] → Keep `{ day: 'numeric', month: 'short' }` for the public range and assert the existing `18 июл. – 20 июл.` / `28 июн.` expectations unchanged.

## Migration Plan

1. Add `utils/tripDateTime.ts` with its unit matrix before touching any consumer; no behavior changes yet.
2. Re-point the two presentation modules and delete the duplicate `fmt` and `parseTripIsoDate`; the existing formatting tests must pass unchanged.
3. Normalize in the three API mappers; the adapter tests gain date-time fixtures.
4. Switch the edit form to parsed parts and delete `toDateInputValue`.
5. Switch the write serializer and run the real save-then-refetch probe; stop here and file `area=back` if the API rejects it.
6. Add the governance test and the raw-ISO rendering test.
7. Run active-surface validation on desktop web, mobile web, and a locally built Android app.
8. No persisted client state, cache schema, or stored user data changes, so rollback is reverting the frontend diff; already-stored trips remain readable by both the old and new code.
9. Deployment is outside this change.

## Validation Matrix

| Surface / area | Required evidence |
| --- | --- |
| `utils/tripDateTime` unit matrix | `TZ=Europe/Minsk`: date-only, `+00:00`, `Z`, non-zero offset, offset-less legacy, day-boundary `23:30Z` → next local day, malformed (`''`, `null`, `not-a-date`, `2026-13-45`, `2026-02-30`), plus one negative-offset timezone case proving a date-only value does not shift |
| API normalizers | Real DTO fixtures through `mapPlannedTrip`, `mapCommunityTrip`, `mapTrip`: `09:00Z` → `startTime: '12:00'` in Europe/Minsk; date-only → `startTime: null`; malformed → empty date and no fabricated value |
| Duplicate removal | `parseTripIsoDate` and the private `fmt` no longer exist; governance test fails when a second trips date parser is added |
| Negative / fail-closed probe | A malformed value renders the localized unavailable text on card and detail, and no rendered trips date output contains `T`, `Z`, `+HH:MM`, or `-HH:MM` |
| Desktop web | `/trips`, `/trips/[id]`, `/trips/my`, `/trips/plan/[id]`, `/trips/community`: correct local date and time on each, screenshots, clean console including no hydration warning |
| Edit round trip | On desktop web, open an existing trip with a time, confirm pre-filled date and time, save, refetch, and confirm the same local time; capture the request payload and the refetched value |
| Mobile web | Same trip and locale at the narrowest supported width: same text, same position, no truncation to an unrecognizable fragment, clean console |
| Android | `adb devices -l`, local Gradle build installed over USB, same five surfaces and the same edit round trip, recorded device timezone, mobile-web parity confirmed pairwise |
| Locales | RU/BE/UK/PL/EN date, time, and unavailable placeholder on at least one card and one detail surface; `npm run test:i18n` green |
| Regression | Public catalog featured-first and start-date ordering, single-date vs. range collapse, fallback cover season, trip chat timestamps and notification relative time unchanged, `MyCreatedTripsList` and `CommunityRoutesCatalog` cards unchanged apart from the date text |
