## Purpose

Описания автоматических значков следуют применённому языку интерфейса, сохраняют серверный fallback и не смешиваются между языками или пользователями в клиентском кэше.

## ADDED Requirements

### Requirement: Explicit active locale on reads
Catalog, own achievements and public user achievements SHALL request their descriptions using the applied UI locale ru, be, uk, pl or en captured when each request starts.

#### Scenario: Five supported languages
- **WHEN** a user opens the badge catalog, own profile or public profile in any supported UI locale
- **THEN** the corresponding request contains the matching explicit lang and the displayed Badge.description matches the server response.

#### Scenario: Effective system or URL locale
- **WHEN** the effective UI locale differs from a saved preference or browser language
- **THEN** the request uses the applied UI locale and does not write a profile language preference.

#### Scenario: Server fallback
- **WHEN** a server translation is unavailable and the response contains the Russian fallback
- **THEN** the client displays that response without translating or replacing its content.

### Requirement: Locale and identity isolation
Cached achievement descriptions MUST be isolated by locale and their existing owner or public user identity, including derived reads and initial data.

#### Scenario: Warm rapid switching
- **WHEN** RU data is cached and the UI switches PL, EN and RU while an older request is delayed
- **THEN** each active view uses its matching locale and the late response cannot replace the active locale's descriptions.

#### Scenario: Error after switching
- **WHEN** a mutation started in one locale fails after the user changes locale
- **THEN** rollback affects only the originating cache entry and does not overwrite the active locale.

#### Scenario: Selected badge while switching
- **WHEN** a badge detail is selected in the gallery, recent awards or author card and the active locale changes
- **THEN** the detail uses the selected identity from current locale data and does not retain the previous locale's description while the current data is unavailable.

#### Scenario: Logout or another account
- **WHEN** identity changes while reads or a mutation are pending
- **THEN** previous personal data is removed and a late response or rollback does not restore it into the new identity's view.

### Requirement: Invalidation covers language copies
Achievement changes SHALL invalidate all relevant cached locale copies while preserving their owner and public-user boundaries.

#### Scenario: Mutate with warmed locales
- **WHEN** a reward changes after several locales have been cached
- **THEN** current and previously warmed relevant copies become stale and subsequent reads receive the updated data.

### Requirement: Existing badge presentation and unrelated semantics
The existing badge UI SHALL preserve its controls, layout, names, ranks and media while showing the localized automatic Badge.description.

#### Scenario: Desktop and mobile presentation
- **WHEN** users view own/public profiles, gallery and author card at 1440px or 390px
- **THEN** descriptions follow the active locale with unchanged controls and geometry, and loading or API errors retain the existing states.

#### Scenario: Place-first and other rewards
- **WHEN** place-first author status, peer awards or rare awards are rendered
- **THEN** their existing prose and neutral progression semantics remain intact without being presented as newly translated Badge.description.
