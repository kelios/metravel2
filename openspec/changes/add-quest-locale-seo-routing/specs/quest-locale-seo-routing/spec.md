## Purpose

Make published quest translations independently crawlable while preserving Russian search URLs and keeping served language, canonical, alternate links and discovery consistent.

## ADDED Requirements

### Requirement: Stable language-specific quest URLs
The system SHALL retain existing Russian quest detail canonicals and city landing aliases. Eligible BE/UK/PL/EN quest details SHALL use `/be/quests/{numericCityId}/{questSlug}`, `/uk/quests/{numericCityId}/{questSlug}`, `/pl/quests/{numericCityId}/{questSlug}` and `/en/quests/{numericCityId}/{questSlug}` respectively, with unchanged quest identity and slug. Existing detail aliases SHALL retain their current canonical relationship. Language-prefixed city, country, catalogue and scenario landings SHALL NOT be introduced by this capability.

#### Scenario: Existing Russian detail and alias
- **WHEN** a visitor loads `/quests/1/krakow-dragon` or its existing city alias `/quests/krakow/krakow-dragon`
- **THEN** the established route remains reachable and its canonical remains `https://metravel.by/quests/1/krakow-dragon`

#### Scenario: Polish published detail
- **GIVEN** the Polish version is eligible for publication
- **WHEN** a visitor loads `/pl/quests/1/krakow-dragon`
- **THEN** the response is a Polish quest detail with self-canonical `https://metravel.by/pl/quests/1/krakow-dragon`

#### Scenario: Known prefixed detail alias
- **WHEN** a visitor loads the known alias `/pl/quests/krakow/krakow-dragon`
- **THEN** an eligible PL member returns a no-store HTTP 302 to `/pl/quests/1/krakow-dragon`, an ineligible member returns noindex HTTP 404, and the alias never enters sitemap or alternate clusters

#### Scenario: City landing remains Russian
- **WHEN** a visitor loads `/quests/krakow`
- **THEN** its Russian canonical and language remain unchanged and it declares no translated city alternatives

#### Scenario: Unsupported language or prefixed landing
- **WHEN** a visitor requests `/de/quests/1/krakow-dragon` or `/pl/quests/krakow`
- **THEN** the response is HTTP 404 with noindex and is absent from sitemap and alternate links

### Requirement: Translation and quality eligibility
The system SHALL publish a language version only when its locale is declared available, its complete public content is published, the returned content language equals the requested language, and its rendered content passes the existing quest-page indexability thresholds of at least 300 prose words and at least 30 percent unique five-grams. Comparison SHALL use sibling quest detail pages in the same language. Eligibility SHALL NOT be inferred from a translated interface, browser preference, an offline copy or a fallback response. A translated member SHALL enter an alternate cluster only when the Russian source is indexable too.

#### Scenario: Complete available translation
- **GIVEN** PL is available and the returned complete published content declares PL and passes the quality thresholds with an indexable Russian source
- **WHEN** publication eligibility is evaluated
- **THEN** the Polish canonical is eligible for static publication, reciprocal alternate links and sitemap membership

#### Scenario: Available flag disagrees with returned content
- **GIVEN** PL appears available but the requested content declares RU or lacks required translated public content
- **WHEN** eligibility is evaluated
- **THEN** no Polish indexable page, alternate link or sitemap URL is produced

#### Scenario: Translation below quality threshold
- **GIVEN** a complete published translation fails either prose or uniqueness threshold
- **WHEN** publication eligibility is evaluated
- **THEN** its prefixed URL is excluded from indexable publication, alternate links and sitemap

#### Scenario: Timeout is not absence
- **WHEN** required publication content cannot be read because of timeout, network error or invalid response
- **THEN** publication is rejected without activating a partial or empty release and the preceding consistent release remains active

### Requirement: Canonical and reciprocal alternate clusters
Every indexable quest language version SHALL declare one self-canonical and the same fully qualified HTTPS alternate cluster containing itself, each other eligible language version and `x-default` pointing to the established Russian canonical. Language codes SHALL be `ru`, `be`, `uk`, `pl`, `en`; absent versions and city aliases SHALL NOT be alternate members. A Russian detail with no eligible translations SHALL retain its canonical and omit the alternate cluster. Query parameters SHALL NOT create additional canonical or alternate members.

#### Scenario: Russian and Polish cluster
- **GIVEN** only RU and PL are eligible
- **WHEN** either canonical is fetched without JavaScript
- **THEN** its head contains exactly RU, PL and Russian x-default alternates, both pages point reciprocally, and each has its own canonical

#### Scenario: Untranslated quest
- **WHEN** only the Russian quest detail is eligible
- **THEN** the Russian detail retains its existing canonical and contains no claimed non-Russian alternates

#### Scenario: Share parameters
- **WHEN** an eligible prefixed detail is loaded with tracking or print parameters
- **THEN** its ordinary detail canonical and alternate URLs omit those parameters and existing print noindex behavior is preserved

### Requirement: URL-bound rendered language
For an eligible prefixed quest detail, the URL language SHALL determine the initial static HTML, document language, public quest content, metadata, structured-data language and initial hydrated interface. Saved preference and browser language SHALL NOT replace that language or automatically redirect the request. Initial hydration SHALL preserve the requested language and one content locale per query. Unprefixed Russian quest details SHALL retain Russian static content and existing subsequent preference/fallback behavior.

#### Scenario: Conflicting saved preference
- **GIVEN** the visitor saved EN and the browser prefers UK
- **WHEN** the visitor opens an eligible PL detail directly or refreshes it
- **THEN** static HTML and initial hydrated content are PL, `<html lang="pl">` is retained, the content request uses PL and no automatic redirect or RU content flash occurs

#### Scenario: Slow locale catalogue
- **WHEN** application locale resources load slowly for an eligible prefixed detail
- **THEN** its translated static public body remains readable and Russian content is not mounted or fetched as an intermediate version

#### Scenario: Offline revisit
- **WHEN** an eligible prefixed page is revisited offline with a saved quest in another language
- **THEN** the saved snapshot can retain existing offline gameplay and its language notice but cannot change canonical, alternate eligibility or claim translated online publication

### Requirement: Explicit language navigation
Eligible quest pages SHALL offer crawlable explicit links to the active release's other eligible versions, using full language labels and an accessible current-language indication. Selecting a version SHALL navigate to its canonical URL and preserve quest identity. An unavailable language SHALL NOT create a prefixed Russian fallback page. Non-quest sections SHALL keep their established interface-language behavior.

#### Scenario: Select available language
- **WHEN** a keyboard or touch user follows the Polish version link on a Russian detail
- **THEN** navigation reaches that quest's Polish canonical with readable language labels and visible focus

#### Scenario: Select unavailable language
- **WHEN** a requested language has no eligible version
- **THEN** no prefixed URL is offered as that version and the existing Russian entry remains reachable through an explicit link

### Requirement: Coherent actual publication and withdrawal
Actual served quest pages, sitemap membership and alternate clusters SHALL use the same eligibility resolver. Each response SHALL pin one active immutable package and one consistent live publication snapshot. Activation SHALL switch the validated package as a whole: an advertised URL must have matching HTML and HTTP 200 within that snapshot, not a generic application shell. Newly prefixed publication SHALL include only eligible canonical details, retaining existing Russian detail availability, city pages and other sitemap sections. Missing, withdrawn and below-threshold prefixed details SHALL return HTTP 404 with noindex; they SHALL NOT redirect silently to Russian or leak old indexable HTML. Requests taking their live snapshot after a withdrawal commit SHALL exclude that version from serving, sitemap, sibling alternates and visible version links, including conditional/cache requests. In-flight responses and separate requests spanning a commit may reflect different snapshots; existing translation-write success semantics SHALL NOT change. A live eligibility read failure SHALL NOT serve stale translated success or be interpreted as withdrawal.

#### Scenario: Release has a missing file
- **WHEN** a candidate publication lists a prefixed URL whose matching page is missing or has a different language or release identity
- **THEN** activation is rejected and the preceding publication remains intact

#### Scenario: Withdraw Polish translation
- **GIVEN** an active release has reciprocal RU and PL pages
- **WHEN** a new response takes its live publication snapshot after the withdrawal commit
- **THEN** the PL URL returns noindex HTTP 404, sitemap, RU alternates and visible language links omit it, and old cached PL HTML or its ETag cannot bypass that check

#### Scenario: Publication changes during an in-flight response
- **GIVEN** a response already pinned its package and live snapshot
- **WHEN** publication changes or a new package activates before the response completes
- **THEN** that response remains internally consistent with its pinned snapshot and subsequent snapshots use the committed change, without requiring a distributed response barrier

#### Scenario: Russian source changes after build
- **GIVEN** an established RU page and translated members were built from an earlier source revision
- **WHEN** the Russian source revision changes without a matching rebuild
- **THEN** the established RU URL keeps its released body, canonical, status and depth verdict, while prefixed members and translated alternate/version links are excluded until a matching package is ready

#### Scenario: Eligibility resolver temporarily fails
- **WHEN** current publication eligibility cannot be read
- **THEN** a prefixed page and language sitemap return retryable 503 with noindex rather than stale translated 200 or a false missing-translation verdict, and the existing RU body may remain available without translated alternate/version links

#### Scenario: Page was never published
- **WHEN** a visitor directly requests a valid-language URL absent from the active publication
- **THEN** it returns noindex HTTP 404 rather than HTTP 200 with Russian fallback or the generic application shell

#### Scenario: Unrelated page regression control
- **WHEN** a quest language release is activated
- **THEN** Russian detail canonicals, city landing aliases, country landings, the quest catalogue, scenario landing and article routes preserve their existing address contracts
