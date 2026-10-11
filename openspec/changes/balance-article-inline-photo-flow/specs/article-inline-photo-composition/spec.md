## Purpose

Keep narrative paragraphs and their single inline photographs in a consistent readable column while preserving complete content, real text wrapping and semantic section boundaries.

## ADDED Requirements

### Requirement: Shared narrative measure

A single floated photograph and its eligible adjacent narrative text SHALL share a column no wider than the existing 720px narrative measure or the available article width. Where side-by-side wrapping is active, the complete photo and caption SHALL occupy at most 45% of that column with at least 16px between photo and text. Long text SHALL return to the full narrative width below the photo.

#### Scenario: Short paragraph in wide article

- **GIVEN** an article has a media lane wider than 720px and a short paragraph associated with a right or left portrait
- **WHEN** the article is displayed in a desktop viewport with a column wider than 560px
- **THEN** that photo/text association occupies at most 720px and the photo is positioned relative to the association rather than the wider media lane
- **AND** visible text lines overlap the photo vertically without intersecting it horizontally
- **AND** any remaining space from short text does not receive invented or duplicated content

#### Scenario: Long paragraph flows below image

- **WHEN** an associated paragraph extends below the photograph
- **THEN** lines beside the photo use the remaining column and lines below its lower edge return to the full narrative width

### Requirement: Safe visual association and semantic boundaries

Presentation SHALL preserve canonical authored content, photo sides, URLs, alternative text and captions. A single photo SHALL associate only with eligible unclaimed adjacent text in its own semantic section; headings, other photographs or groups, tables and independent semantic blocks SHALL terminate that association. No paragraph SHALL be assigned to two photos.

#### Scenario: Previously authored paragraph before orphaned photo

- **GIVEN** a substantial paragraph precedes a single photo with no following eligible text
- **WHEN** the article is rendered
- **THEN** the existing safe visual association can place that photo alongside the preceding paragraph without changing stored content
- **AND** the following heading begins below the associated photograph and caption

#### Scenario: Interleaved photos have separate owners

- **WHEN** content contains text, photoA, textB, photoB and a new heading
- **THEN** textB remains associated with photoA if already claimed by its forward flow
- **AND** photoB does not steal textB or merge with photoA
- **AND** all text and photos appear exactly once

#### Scenario: No adjacent eligible paragraph

- **WHEN** a single photo has no eligible adjacent text
- **THEN** it remains a standalone photograph and no text is fabricated or imported from another section

#### Scenario: Captions and independent blocks

- **WHEN** a photo has a caption and is followed by a table or an independent semantic block
- **THEN** the caption stays with the photo and the following block starts below it

### Requirement: Responsive and adjacent-media preservation

The article SHALL preserve one-column presentation on mobile viewports up to 768px and on actual desktop article columns up to 560px. Landscape images, galleries and explicit wide media SHALL retain their existing breakout. Photos SHALL remain complete and accessible through the existing full-photo view.

#### Scenario: Mobile and narrow desktop column

- **WHEN** the viewport is 390px or a desktop split view provides a column no wider than 560px
- **THEN** text and photograph appear in one column without a narrow side strip or horizontal overflow
- **AND** current reading behavior and complete photograph visibility are preserved

#### Scenario: Landscape and gallery neighbors

- **WHEN** a landscape photograph or gallery follows an inline-photo association
- **THEN** it retains its original wide-media geometry and starts as a separate block

#### Scenario: Full photograph access

- **WHEN** a reader activates an inline photograph with pointer or keyboard
- **THEN** the existing full-photo view opens the same uncropped photo and remains dismissible

### Requirement: Stable preparation and failure behavior

The association SHALL be present from the first prepared article frame without requiring post-paint height measurement or new media requests. Slow, missing or offline images SHALL not lose narrative text, overlap a new section or alter canonical content.

#### Scenario: Initial frame and resize

- **WHEN** server-sanitized article content initially appears and its width later changes
- **THEN** the same associations remain in place with responsive geometry and no lost, duplicated or reassigned blocks

#### Scenario: Slow or failed photo

- **WHEN** an inline photo loads slowly, fails or is unavailable offline
- **THEN** its existing fallback remains accessible and text continues to occupy the intended narrative column without overlapping headings
- **AND** no additional raster is requested to fill the slot
