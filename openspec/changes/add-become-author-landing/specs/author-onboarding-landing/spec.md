## Purpose

Explain existing author benefits and let readers safely start publishing their
own trips through a localized, discoverable public author landing page.

## ADDED Requirements

### Requirement: Truthful public author benefits

The system SHALL expose `/become-author` with map, PDF-book, badges/ranks, and
reader/subscriber benefits and a visible create-trip action. It MUST NOT show
contest content before published contest rules or mention mobile app stores.

#### Scenario: Visitor reads available benefits
- **WHEN** a guest or authenticated visitor opens the page
- **THEN** all four benefits and the create-trip action are visible
- **AND** contest promises, fake statistics, and app-store references are absent

#### Scenario: Catalog API is slow or unavailable
- **WHEN** the landing opens while catalog requests fail or remain pending
- **THEN** its static benefits stay readable and independent of those requests

### Requirement: Discoverable contribution promotion

Home and the catalog SHALL expose a contribution promotion linking to the author
landing. The catalog MUST retain one promotion placement. Existing contribution
promotions on other screens SHALL retain their previous destinations.

#### Scenario: Reader follows either placement
- **WHEN** a reader activates the home or catalog author promotion
- **THEN** the author landing opens through an internal link
- **AND** exactly one click event identifies the promotion variant or placement

#### Scenario: Existing search promotion
- **WHEN** a reader uses the contribution promotion in search
- **THEN** its existing login/create behavior remains available

### Requirement: Safe auth continuation into creation

The landing action SHALL send guests to registration with an internal return to
`/travel/new`, and authenticated visitors directly to creation. Switching from
registration to login MUST retain that return destination.

#### Scenario: Guest registers or signs in
- **WHEN** a guest selects the create-trip action and completes authentication
- **THEN** the existing trip creation flow opens without publishing anything
- **AND** the click event has source `become_author_page` and action `register`

#### Scenario: Authenticated visitor starts a trip
- **WHEN** an authenticated visitor selects the create-trip action
- **THEN** `/travel/new` opens directly
- **AND** the click event has source `become_author_page` and action `create`

### Requirement: Localized accessible responsive layout

The page and new promotions SHALL support RU/BE/UK/PL/EN and light/dark themes,
with semantic headings, keyboard focus, 44px targets, and readable wrapped labels
without horizontal scrolling at 390px and 1440px.

#### Scenario: Visitor changes language and theme
- **WHEN** a visitor chooses any supported language and light or dark theme
- **THEN** app-owned labels, accessible names, and page metadata follow that choice
- **AND** benefits and primary actions remain readable at both target widths

### Requirement: Public static metadata

The public page SHALL return indexable HTML with self-canonical, title of at most
60 characters, description of 120–160 characters, and Open Graph metadata without
requiring JavaScript for those metadata values.

#### Scenario: Crawler requests the page
- **WHEN** a crawler requests `/become-author`
- **THEN** HTTP 200 HTML includes the required RU metadata and self-canonical
- **AND** no robots noindex directive is present

#### Scenario: Client hydration completes
- **WHEN** the page hydrates and its preferred locale is applied
- **THEN** its metadata retains the author-landing identity and canonical URL
