## Purpose

Provide downloadable thematic photo diaries whose selected destinations, photographs and mountain route facts remain verifiable without changing accepted country or quest editions.

## ADDED Requirements

### Requirement: Verified thematic composition
The system SHALL preserve the approved forty mountain destinations and thirty castles, exclude overlap with existing country books, and distinguish a source point from the physical map target. Contextual source points MUST NOT create exact-place related-book links.

#### Scenario: Context source for a summit
- **WHEN** an article source point describes an approach or surrounding area
- **THEN** the book retains that source relationship and maps the independently verified physical target without inventing a published point ID.

### Requirement: Truthful photograph provenance
The system SHALL distinguish public image variants from owner-provided original bytes, retain their independent hashes and native dimensions, strip private metadata from publication derivatives, and visibly caption context images. Native placed resolution MUST NOT be inferred from an enlarged canvas.

#### Scenario: An unpublished original illustrates surrounding scenery
- **WHEN** the selected photograph is an owner original depicting the surrounding massif
- **THEN** the book labels the scene as context and does not claim that a public thumbnail URL identifies those original bytes.

### Requirement: Scoped mountain route facts
Every mountain entry SHALL visibly provide a named start/end/scope, sourced distance, ascent and duration, preserve ranges, distinguish estimates and historical references, and show dated access limitations. Restricted access MUST NOT waive missing metrics or become a current route recommendation.

#### Scenario: A historical waterfall walk meets a current restriction
- **WHEN** historical route metrics are complete and official notices restrict the damaged-dam area
- **THEN** the book prints the historical scope and current restriction separately and does not recommend crossing barriers.

### Requirement: Independent series selection and readiness
The catalogue SHALL offer declared theme selection, distinguish planned from available diaries, and expose download/preview only for published editions. Style alternatives MUST remain inside the same country or thematic series family.

#### Scenario: Two photographic thematic series coexist
- **WHEN** the user opens the Poland country photo book
- **THEN** its style alternatives exclude the mountain and castle series, which remain separately discoverable by theme.

### Requirement: Additive physical publication
Both physical profiles SHALL use the accepted three-page place composition and shared physical pipeline. Reading PDFs, full previews, hashes and revision SHALL agree, and publication MUST preserve all prior immutable objects/resources. Digital diary availability SHALL remain distinct from paper/provider acceptance.

Accepted PDF checks MUST bind the exact editorial input bytes to the metadata published for that edition.

#### Scenario: The two thematic diaries are released
- **WHEN** both editions pass source, PDF, QR, revision and production checks
- **THEN** they are downloadable without registration and retain honest measured print limitations alongside the unchanged existing editions.

#### Scenario: Editorial facts change after PDF acceptance
- **WHEN** a route fact changes in the editorial source while its edition ID and revision remain unchanged
- **THEN** publication rejects the changed bytes until the PDF acceptance is repeated for that exact source.

### Requirement: Distinct place-card actions
Place cards SHALL offer separate book and article actions. A book action MUST use the selected canonical source point, have an accessible localized name and tooltip, and render as a 44-pixel icon without the former long book caption. The article action SHALL keep its original article destination.

#### Scenario: A selected point belongs to a published book
- **WHEN** the primary source point has an exact related-book association
- **THEN** the book icon opens that book and the separate file-text article action opens the original article.

#### Scenario: Only the article matches a book
- **WHEN** the place has no exact canonical point association
- **THEN** no book icon is shown even if the article contains other book places.
