## Purpose

Preserve meaningful text flow around side photos in browser-generated travel books while conserving original authored content and supporting physical-page continuation.

## ADDED Requirements

### Requirement: Orphan side photo is associated with its eligible paragraph
A side photo with no following wrap target SHALL wrap its immediately preceding eligible paragraph when that paragraph is not already associated with an earlier side photo. This SHALL affect display only and SHALL preserve authored image side, source text, links, alt text and captions.

#### Scenario: Paragraph followed by side photo and heading
- **WHEN** an eligible paragraph is followed by a single left or right photo and then a new heading
- **THEN** that paragraph has text lines alongside the photo in both book preview and actual printed PDF, and the next heading begins after the associated photo/text flow

#### Scenario: Figure and paragraph image shapes
- **WHEN** the same orphan side photo is authored as a figure with caption or as an image paragraph
- **THEN** both shapes support association while preserving the side, caption, alt text and link destinations

### Requirement: Existing flow ownership and source boundaries are preserved
The book SHALL preserve forward wrapping and image occurrence order, SHALL NOT reassign a paragraph already claimed by an earlier float, and SHALL NOT associate across headings, galleries, lists, tables or informational boundaries. Rendering SHALL NOT modify stored article HTML.

#### Scenario: Interleaved photos and text
- **WHEN** content contains paragraph, photo A, paragraph, photo B and a heading
- **THEN** photo A keeps its forward wrap paragraph, photo B does not steal that paragraph, image order remains A then B and all text/link content appears once

#### Scenario: Full-width image or semantic boundary
- **WHEN** an image is full-width or a heading, gallery, list or table separates it from a preceding paragraph
- **THEN** the existing full-width or semantic-boundary behavior remains unchanged

### Requirement: Wrapping remains valid at physical page boundaries
The book SHALL keep an associated side photo with actual wrapping text when approaching a physical page boundary, retain the complete photo using contain sizing and allow long text to continue onto subsequent pages. It SHALL NOT create a photo-only placement with a blank side column by splitting a valid association, lose content, crop the photo or exceed the printable area.

#### Scenario: Pair near the end of a page
- **WHEN** an associated paragraph and side photo approach the bottom of an A4 page
- **THEN** the printed placement contains the photo with wrapping text on the same page, with no clipping, unintended image-only split or duplication

#### Scenario: Paragraph longer than one page
- **WHEN** an associated paragraph exceeds one printable page
- **THEN** the photo retains wrapping text on its page and the remaining text continues in order without forcing the entire paragraph into an unbreakable block

### Requirement: Acceptance identifies the actual export path
The acceptance evidence MUST identify the actual single-article browser export path and physical PDF output. A separate segmented export with source ledgers SHALL NOT be claimed fixed unless its path independently satisfies these flow and source conservation requirements.

#### Scenario: Production affected article export
- **WHEN** article 672 is exported from the ordinary production article action
- **THEN** evidence records the reviewed production revision, actual export path, preview and printed wrapping geometry and exact conservation of text, links and media occurrences
