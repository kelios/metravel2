## Purpose

Expose an article's explicit editorial description consistently to static crawlers and hydrated web metadata while preserving the established fallback for articles without usable stored metadata.

## ADDED Requirements

### Requirement: Usable stored metadata takes precedence

The system SHALL prefer a stored string description that normalizes to at least 80 plain-text characters over the body-derived fallback. The same selected explicit description MUST appear in the main, Open Graph and Twitter descriptions in static HTML and after client hydration or navigation.

#### Scenario: Canonical stored metadata survives a direct visit and navigation
- **GIVEN** a published article has a canonical stored description between 80 characters and a 160-character escaped attribute budget and a different body lead
- **WHEN** a crawler requests the static page or a reader loads or navigates to the article
- **THEN** all three head descriptions equal the stored plain text after HTML attribute decoding and each description tag exists once

### Requirement: Explicit metadata is plain text within an encoded budget

The system SHALL remove markup and executable content, decode entities and normalize whitespace and invisible spacers without applying body-introduction removal heuristics. It MUST constrain the selected explicit description to at most 160 HTML-attribute-encoded characters, preferring a word boundary and preserving Unicode character boundaries.

#### Scenario: Markup and encoded punctuation remain safe
- **WHEN** stored metadata includes markup, executable blocks, entities, quotes, ampersands and whitespace
- **THEN** only its normalized readable text appears as escaped metadata, no executable nodes are introduced and the encoded attribute stays within 160 characters

#### Scenario: Long metadata is clipped safely
- **WHEN** otherwise usable metadata exceeds the escaped attribute budget
- **THEN** it ends at a safe boundary within that budget and contains no broken Unicode character

### Requirement: Existing fallback and unloaded head are preserved

The system SHALL retain the existing body/context fallback for missing, null, non-string, empty or normalized descriptions shorter than 80 characters, including when safe clipping leaves an unusable short description. While article data is unavailable, the client MUST leave an already rendered static description untouched.

#### Scenario: Unusable explicit metadata
- **WHEN** an article has null, whitespace, tag-only or short stored metadata
- **THEN** the description equals the existing fallback for that article

#### Scenario: Slow or failed initial detail load
- **GIVEN** a direct visit already contains an article-specific static head
- **WHEN** client article data has not arrived or its initial load fails
- **THEN** a slug-derived or generic description does not replace the static description

#### Scenario: The early head script runs before application loading
- **GIVEN** generated HTML contains its static main, Open Graph and Twitter descriptions
- **WHEN** the browser parser reaches the existing critical-head script before application data is available
- **THEN** all three descriptions are already present once and their non-generic values are preserved, while charset remains first and generic route fallbacks retain their current behavior

#### Scenario: Explicit metadata resembles a generic fallback
- **GIVEN** usable canonical stored metadata begins with the current generic platform-description prefix
- **WHEN** the existing early head script sees the generated descriptions with SSG provenance
- **THEN** the exact selected nonblank text remains in all three description tags; the same unmarked generic text and blank marked tags still use the existing route fallback

### Requirement: Metadata inputs remain consistent without changing content

The system MUST retain authoritative stored metadata through captured and replayed article inputs and SHALL produce the same selected explicit description from live and replayed data. It MUST NOT change article titles, canonical addresses, body, FAQ, media, points, ownership or publication state when rendering descriptions.

#### Scenario: Offline input replay
- **GIVEN** a captured public article detail includes a stored description
- **WHEN** its static page is generated from that capture without further network access
- **THEN** its selected head descriptions equal those generated from the same live detail and the other article content and identity remain unchanged

#### Scenario: An authoritative empty detail overrides stale summaries
- **GIVEN** an older summary has a stored description but the current article detail clears it
- **WHEN** descriptions are generated from that current detail
- **THEN** the current body/context fallback is used without resurrecting the older summary value

#### Scenario: Legacy or invalid detail metadata does not leak a summary value into hydration
- **GIVEN** an older summary has usable stored metadata and the current detail omits the field or supplies an invalid type
- **WHEN** that detail is normalized, captured or replayed and merged into the inline client bootstrap
- **THEN** the bootstrap does not inherit the summary metadata and the client retains the existing fallback policy
