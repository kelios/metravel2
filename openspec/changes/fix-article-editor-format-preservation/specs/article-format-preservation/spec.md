## Purpose

Ensure that supported article formatting survives persistence and remains visible
to readers, with complete coverage of authoring controls and explicit unsupported
format boundaries.

## ADDED Requirements

### Requirement: Supported text formatting survives save and reading

The system SHALL preserve supported alignment, font, size and indentation when
saving rich-text content and SHALL render their visible effect on desktop web,
mobile web, Android and iOS readers.

#### Scenario: Formatted article round trip

- **WHEN** an author centers a paragraph and applies a supported non-default font
  and large size, then saves and opens the article
- **THEN** stored and canonical safe content retain those formats and the reader
  displays centered, differently styled, larger text

#### Scenario: Block formatting on headings and list items

- **WHEN** an author applies supported block alignment or indentation to a heading
  or list item
- **THEN** saving preserves its block semantics and formatting without flattening
  the heading or changing the list type

#### Scenario: Reopening formatted content on mobile

- **WHEN** an author reopens content containing supported text formatting on mobile
- **THEN** the simplified plain-text editor cannot silently flatten that content
  and the existing rich-content editing flow remains available

### Requirement: Every rich-text field uses equivalent safe persistence

Description, plus, minus and recommendation SHALL preserve the same supported
format and list semantics on full and content-only saves, while retaining their
existing length limits and save-versus-moderation behavior.

#### Scenario: Supplemental rich-text fields

- **WHEN** an author saves a bullet list and formatted text in any supplemental
  rich-text field
- **THEN** the saved field and reader retain bullet-list type and the supported
  formatting just as the main description does

#### Scenario: Existing disclosure content

- **WHEN** an existing article containing FAQ disclosures is saved without
  removing them intentionally
- **THEN** its disclosure structure and FAQ section marker survive persistence

### Requirement: Formatting preservation does not weaken sanitization

The editor output boundary SHALL reject arbitrary classes and unsupported inline
styling while preserving the supported formatting vocabulary. Existing safeguards
against executable markup, event handlers and unsafe URLs SHALL remain intact.
Previously stored editorial HTML SHALL retain its existing safe-write contract.

#### Scenario: Untrusted formatting attributes

- **WHEN** editor output mixes supported formatting with arbitrary classes, script
  content, an event handler or an unsafe link
- **THEN** the supported formatting remains and the unsafe or unsupported parts
  are removed before the editor output is persisted

### Requirement: Authoring controls have complete regression coverage

Automated validation MUST enumerate every configured authoring format and option,
and MUST fail when a new format or option lacks an explicit preservation or
unsupported-boundary case.

#### Scenario: Newly added authoring control

- **WHEN** a new format or option is added without its round-trip contract
- **THEN** automated validation fails rather than silently excluding the control

### Requirement: Unsupported color and background controls are not offered

The system SHALL NOT offer color and background controls while those formats
cannot survive the supported save/read path. Validation MUST reject accidental
reintroduction without a working preservation contract.

#### Scenario: Author opens a toolbar

- **WHEN** an author opens any supported toolbar variant
- **THEN** authors cannot select either control in any affected toolbar variant
  and all retained controls remain covered by validation

#### Scenario: Unsupported control is reintroduced

- **WHEN** color or background is added without an end-to-end preservation contract
- **THEN** automated validation fails rather than silently promising persistence
