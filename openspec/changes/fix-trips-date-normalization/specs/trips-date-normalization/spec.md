## Purpose

Defines how a trip start value received from the API is interpreted as either a calendar day or an instant, which timezone it is presented in, how its date and time reach both read-only surfaces and the edit form, and what a user sees when the value is missing or unreadable.

## ADDED Requirements

### Requirement: Accepted trip date input shapes
The system SHALL interpret a trip start value expressed as a calendar date `YYYY-MM-DD` or as an ISO 8601 date-time with a `Z` suffix, a numeric UTC offset, or no offset. Any other value MUST be treated as unreadable.

#### Scenario: Calendar date input
- **WHEN** a trip start value is `2026-10-12`
- **THEN** the system interprets it as the calendar day 12 October 2026
- **AND** the system reports that the value carries no time of day

#### Scenario: Date-time input with zero offset
- **WHEN** a trip start value is `2026-10-12T09:00:00+00:00`
- **THEN** the system interprets it as the instant 09:00 UTC on 12 October 2026
- **AND** the system reports that the value carries a time of day

#### Scenario: Date-time input with Z suffix
- **WHEN** a trip start value is `2026-10-12T09:00:00Z`
- **THEN** the system interprets it as the same instant as the equivalent `+00:00` value

#### Scenario: Date-time input with a non-zero offset
- **WHEN** a trip start value is `2026-10-12T12:00:00+03:00`
- **THEN** the system interprets it as the instant 09:00 UTC on 12 October 2026

#### Scenario: Legacy date-time input without an offset
- **GIVEN** the value was written by an earlier version of this application, which sent local wall-clock time with no offset
- **WHEN** a trip start value is `2026-10-12T09:00:00`
- **THEN** the system interprets it as 09:00 device-local wall-clock time on 12 October 2026

#### Scenario: Unreadable input
- **WHEN** a trip start value is empty, whitespace only, `null`, `not-a-date`, `2026-13-45`, or `2026-02-30`
- **THEN** the system reports the value as unreadable
- **AND** the system does not derive a date or a time from it

### Requirement: Timezone treatment
The system SHALL present an instant-bearing trip start value in the timezone of the user's device, and SHALL present a calendar-date value on its stated calendar day in every timezone.

#### Scenario: Instant is shown in device time
- **GIVEN** the device timezone is Europe/Minsk (UTC+03:00)
- **WHEN** a trip start value is `2026-10-12T09:00:00+00:00`
- **THEN** the displayed day is 12 October 2026
- **AND** the displayed time is 12:00

#### Scenario: Instant crossing a day boundary
- **GIVEN** the device timezone is Europe/Minsk (UTC+03:00)
- **WHEN** a trip start value is `2026-10-12T23:30:00+00:00`
- **THEN** the displayed day is 13 October 2026
- **AND** the displayed time is 02:30

#### Scenario: Calendar date is not shifted
- **GIVEN** the device timezone is behind UTC, for example UTC-05:00
- **WHEN** a trip start value is `2026-10-12`
- **THEN** the displayed day is 12 October 2026
- **AND** no time is displayed

### Requirement: Single normalization contract for trip dates
Every user-visible trip date and time in the trips domain MUST be produced from one normalization contract, and no trips surface may render an API date string that has not passed through it.

#### Scenario: Raw API text never reaches a trips surface
- **WHEN** any trips surface renders a trip start for any accepted or unreadable input shape
- **THEN** the rendered text contains no `T` separator between date and time, no `Z` suffix, and no `+HH:MM` or `-HH:MM` offset
- **AND** the rendered text is not byte-identical to the API value

#### Scenario: A second parser is introduced
- **WHEN** a change adds another trips date parser or formatter that interprets a trip start value outside the shared contract
- **THEN** an automated repository check fails and names the offending location

### Requirement: Trip start time is preserved from the payload
The system SHALL retain the time of day carried by a trip payload for the whole lifetime of that trip object, and MUST NOT replace a payload-provided time with an absent or default time.

#### Scenario: Time survives loading
- **WHEN** a trip payload carries a start value with a time of day
- **THEN** every consumer of that trip receives both its local calendar day and its local time
- **AND** the time is the one derived from the payload, not a substituted default

#### Scenario: Absent time stays absent
- **WHEN** a trip payload carries a calendar-date start value
- **THEN** consumers receive the calendar day and an explicitly absent time
- **AND** no surface invents a time for it

### Requirement: Localized display of a trip start
The system SHALL render a trip start using locale-aware date and time formatting for RU, BE, UK, PL, and EN, and SHALL append the time only when the value carries one.

#### Scenario: Date-time value in Russian
- **GIVEN** the active locale is RU and the device timezone is Europe/Minsk
- **WHEN** a trip start value is `2026-10-12T09:00:00+00:00`
- **THEN** the surface shows the localized long date for 12 October 2026 followed by the local time 12:00

#### Scenario: Calendar-date value in Russian
- **GIVEN** the active locale is RU
- **WHEN** a trip start value is `2026-10-12`
- **THEN** the surface shows the localized long date for 12 October 2026 with no time component

#### Scenario: Every production locale renders the same instant
- **WHEN** the same trip start value is rendered in RU, BE, UK, PL, and EN
- **THEN** each locale shows its own localized date and time formatting for the same calendar day and time of day
- **AND** none of them falls back to the raw API value

### Requirement: Trip date range display
The system SHALL render a trip whose end value is absent, unreadable, or equal to its start value as a single date, and a trip with a distinct readable end value as a range.

#### Scenario: Single-date trip
- **WHEN** a trip has a start value and no end value, or an end value equal to the start value
- **THEN** the surface shows one date

#### Scenario: Multi-date trip
- **WHEN** a trip has a start value and a different readable end value
- **THEN** the surface shows both dates as a range in start-to-end order

#### Scenario: Unreadable end value
- **WHEN** a trip has a readable start value and an unreadable end value
- **THEN** the surface shows the start date alone
- **AND** the surface does not show the unreadable end text

### Requirement: Unavailable-date state
The system MUST show one consistent localized placeholder wherever a trip start or end value is missing or unreadable, on every trips surface and in every production locale.

#### Scenario: Card with an unreadable date
- **WHEN** a trip list or detail surface receives a trip whose start value is missing or unreadable
- **THEN** the surface shows the localized unavailable-date text in place of the date
- **AND** the surface does not show the raw value, an empty gap, or a machine code

#### Scenario: Placeholder is distinct from the input prompt
- **WHEN** a read-only surface shows the unavailable-date text
- **THEN** that text does not instruct the user to pick a date

### Requirement: Edit form receives separate date and time values
The system SHALL pre-fill the trip edit form with a date value and a time value derived from the same normalization used for display, so that an existing trip opens without a format error and its time is not silently dropped.

#### Scenario: Opening an existing trip with a time
- **GIVEN** the device timezone is Europe/Minsk
- **WHEN** the owner opens the edit form for a trip whose stored start is `2026-10-12T09:00:00+00:00`
- **THEN** the date field contains the local calendar day 12 October 2026 in the form's date format
- **AND** the time field contains `12:00`
- **AND** no date-format validation error is shown before the user edits anything

#### Scenario: Opening an existing trip without a time
- **WHEN** the owner opens the edit form for a trip whose stored start is `2026-10-12`
- **THEN** the date field contains 12 October 2026 in the form's date format
- **AND** the time field is empty

#### Scenario: Opening a trip with an unreadable start
- **WHEN** the owner opens the edit form for a trip whose stored start is unreadable
- **THEN** the form does not place the raw value into the date field
- **AND** the form requires the owner to supply a valid date before saving

### Requirement: Edit round-trip preserves the start instant
The system MUST persist an unmodified trip start so that reloading the trip shows the same local date and time the owner saw before saving, and MUST surface a failure rather than silently storing a shifted or defaulted time.

#### Scenario: Saving without changing the date
- **GIVEN** the owner opened a trip that displays 12 October 2026, 12:00 local
- **WHEN** the owner changes an unrelated field and saves
- **THEN** the reloaded trip still displays 12 October 2026, 12:00 local

#### Scenario: Saving a changed time
- **WHEN** the owner sets the time to 07:45 local and saves
- **THEN** the reloaded trip displays 07:45 local on the same calendar day

#### Scenario: Backend rejects the persisted format
- **WHEN** the real API rejects the trip start value the client sends
- **THEN** the client reports a save failure to the owner
- **AND** the client does not report success
- **AND** the client does not fall back to a fabricated or mock-only saved value

### Requirement: Consistent behavior across active surfaces
The system SHALL apply the same interpretation, timezone treatment, localized formatting, and unavailable state on my trips, planned trip detail, the planned trip edit form, the public trips list, and public trip detail, on desktop web, mobile web, and Android.

#### Scenario: Same trip on every surface
- **WHEN** the same trip is viewed on my trips, planned trip detail, the public trips list, and public trip detail with the same locale and device timezone
- **THEN** each surface shows the same calendar day and, when present, the same time of day

#### Scenario: Mobile web and Android parity
- **WHEN** the same trip and locale are viewed on mobile web and on the Android application
- **THEN** both show the same date and time text in the same position within the surface
- **AND** the date text remains readable without truncating into an unrecognizable fragment at the narrowest supported width
