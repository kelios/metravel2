## Why

Trip start dates are printed to users as the raw backend string, for example `2026-10-12T09:00:00+00:00`, because the only trips date parser accepts the single shape `YYYY-MM-DD` and returns its input unchanged on any other shape. The same payload also loses its time: the planned-trip normalizers hardcode `startTime: null`, so a trip that starts at 12:00 local time is shown, edited, and re-saved as if it had no time at all. Board task #1313 (`area=front`, sprint 2 "Android Release") records this on five user-facing surfaces at once, so a per-screen patch would leave the same defect in the next consumer.

Three independent date parsers exist for one domain concept, which is why the defect reappears per screen: a strict `YYYY-MM-DD` parser plus a raw passthrough, a byte-identical copy of it with different output options, and an ad-hoc string slice used to seed the edit form.

## What Changes

- Introduce one shared trips date normalization contract that accepts both a calendar date (`YYYY-MM-DD`) and an ISO 8601 date-time (`Z`, `+00:00`, and any other offset), and rejects everything else instead of echoing it.
- Convert an instant-bearing value into the device timezone before it is displayed, and keep a date-only value on its own calendar day with no UTC shift.
- Preserve the time carried by the payload in the trips domain model instead of discarding it at the API boundary.
- Give the trip edit form separate date and time values derived from that single normalization, so an existing trip opens, validates, and saves without a format error and without silently rewriting its start time.
- Remove the duplicated trips date formatter and the ad-hoc date slice, leaving one parsing entry point behind every trips date rendering.
- Render a consistent localized unavailable state for missing, empty, or malformed input on every trips surface; never the raw string.
- Add a unit matrix and a regression guard that fail when a raw ISO value can reach the UI or when a second trips date parser is introduced.

### User-visible result

On my trips, planned trip detail, the planned trip edit form, the public trips list, and public trip detail, a trip start reads as a localized date plus, when the payload carries one, a local time (`12 октября 2026 г., 12:00` in RU on a device set to Europe/Minsk for a `2026-10-12T09:00:00+00:00` payload). Opening an existing trip for editing pre-fills the correct local date and time, saving succeeds, and reopening shows the same local time. Missing or unreadable dates show one localized placeholder instead of machine text.

### Existing behavior to preserve

- A legacy date-only payload still shows the same calendar day it shows today, in every timezone, with no time appended.
- Public trip date ranges keep collapsing to a single date when the end date is absent or equal to the start date.
- Trip status, seats, region, transport, participants, route summary, and card geometry are unchanged; only the date/time text changes.
- Featured-first ordering and start-date ordering of the public catalog stay stable.
- Trip chat message timestamps and notification relative times keep their current behavior.
- Season selection for the trip fallback cover keeps returning the same season for the same trip.
- Mobile web and Android keep identical block order, hierarchy, and touch semantics on the affected surfaces.

### Dependencies and fallback/mock policy

- The backend is a read-only dependency. `start_date` (planned trips) and `start_at` (community/public catalog) are ISO 8601 date-time values with an offset; date-only remains an accepted legacy input on the read path. No backend edit is planned or permitted from this workspace.
- No blocking dependency on another open task.
- Fixtures in the trips mock modules may support layout and unit tests only. Mock data must not be used to demonstrate that the real contract works, and a normalization failure must never be hidden behind a fabricated date.
- Invalid or null input must resolve to the localized unavailable state, never to the raw ISO string and never to a guessed date. A negative test covers this explicitly.
- If the real API rejects the round-trip write format required to keep the edited time (see Open questions), the change stops and the gap is filed as an `area=back` task rather than silently reverting to a lossy payload.

### Out of scope / Non-goals

- Any backend, serializer, or database change; any edit under `../metravel-backend`.
- A per-user or per-trip timezone preference. The device timezone is the only display timezone in this change.
- Consolidating trip chat message timestamps or notification relative time into the new contract.
- Introducing a date library dependency.
- Redesigning the trip edit form, its date picker, the trip cards, or the public catalog layout.
- Adding an end-time or multi-day time range to the trips model.
- Changing sort, filter, pagination, or caching behavior of any trips list.
- Commit, push, deploy, or publication of this change.

### Open questions

1. The write path currently serializes `start_date` as a naive local string with no offset (`YYYY-MM-DDTHH:mm:00`). Once the read path shows a true local time, an unchanged naive write can shift a saved trip by the device offset. Recorded default for apply: send an explicit ISO 8601 offset so the saved instant round-trips, and prove it with a real save-then-refetch probe against the API rather than a mock. If the API rejects the offset form, stop and open an `area=back` task instead of restoring the lossy payload. This materially affects the "time is not lost" acceptance and must be confirmed before apply.
2. Whether the localized unavailable placeholder should reuse the existing "choose a date" copy of the edit form or a distinct read-only copy. Assumption recorded for apply: a distinct read-only placeholder, because "choose a date" is an input affordance and is wrong on a card.

## Capabilities

### New Capabilities

- `trips-date-normalization`: how a trip start value from the API is interpreted (calendar date vs. instant), which timezone it is presented in, how date and time are surfaced to display and to the edit form, and what is shown when the value is missing or unreadable.

### Modified Capabilities

None; no living OpenSpec capability under `openspec/specs/` currently describes trips date behavior.

## Impact

- **Frontend paths:** shared trips date normalization utility; trips presentation helpers for the public catalog and for planning; planned-trip and public-trip API normalizers; the planned-trip screen edit form; trips localization resources for the unavailable placeholder; focused unit, regression, browser, and Android validation artifacts.
- **Data/API:** read-only contract clarification. Accepted input on read: `YYYY-MM-DD`, `YYYY-MM-DDTHH:mm:ss(.sss)?Z`, `...±HH:MM`, and the legacy offset-less date-time. Write payload format is the subject of Open question 1; no endpoint, field name, or schema changes.
- **Platform impact:** shared — desktop web, mobile web, and Android; mobile web and Android require paired evidence on the same trip and locale.
- **Localization impact:** all current locales — RU/BE/UK/PL/EN. All date and time output goes through `i18n/format.ts`; the placeholder copy is added to every locale in this change.
- **Accessibility:** the date text must stay a single readable string in the card meta row without truncation at the narrowest supported width, and the placeholder must be real localized text rather than a dash-only glyph that reads as noise to a screen reader.
- **Performance:** none expected; parsing replaces a regex test with a bounded parse per rendered date. No new request, no new dependency, no measurable bundle change. Baseline is the current trips screens.
- **SEO:** none; all five surfaces are app screens behind the client router with no indexed metadata, canonical, or structured-data output derived from trip dates.
- **Security:** input hardening only. The parser must treat the API string as untrusted, reject unbounded or malformed input, and never interpolate an unvalidated value into rendered text.
- **Analytics:** none; no trips event carries a formatted date, and no event is added or removed.
