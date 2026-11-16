# quest-qr-print-kit Specification

## Purpose
Provide reproducible, readable venue flyers and stickers backed by real published quest data and campaign-preserving QR links.
## Requirements
### Requirement: Verified public quest source
The generator SHALL resolve a public quest_id or numeric id from published discovery and validate its matching published detail before creating files. It SHALL print the source title, known duration and API free flag without gameplay reads or fabricated data. Missing duration SHALL be explicitly labelled unknown. A paid flag SHALL NOT produce a free claim. A published noindex quest SHALL remain eligible.

#### Scenario: Real selected quest
- **WHEN** a published quest and valid placement are requested
- **THEN** both output formats carry that quest's title and source-backed facts

#### Scenario: Failed source
- **WHEN** discovery/detail is unavailable, invalid or belongs to a different quest
- **THEN** generation fails without a successful manifest or partially published kit

### Requirement: Canonical attributed QR target
The QR and PDF clickable target SHALL be the matching canonical published HTTPS quest URL with utm_source=qr, utm_medium=referral and utm_campaign equal to a required non-personal placement code. Placement SHALL be 1–64 lowercase ASCII letters/digits/underscores/hyphens, beginning with a letter or digit. Canonical locale SHALL come from an available publication, never assumed from translation availability.

#### Scenario: Placement attribution
- **WHEN** a kit is generated for park-start-01
- **THEN** decoded QR and PDF links preserve the exact qr/referral/park-start-01 UTM values

#### Scenario: Translation unavailable
- **WHEN** a requested translated detail is404
- **THEN** the generator may use the actual RU publication with selected-locale paper labels and records both locales

#### Scenario: Temporary failure is not a translation fallback
- **WHEN** a translated source returns503
- **THEN** generation fails rather than hiding it behind a RU result

### Requirement: Physical and localized output
Each kit SHALL contain one 148×210 mm A5 flyer PDF and one100×120 mm sticker PDF. Fonts SHALL be embedded with Cyrillic/Latin coverage; QR SHALL have four quiet modules and at least0.4 mm per module at printed size. Titles SHALL fit within readable minimum sizes or fail clearly; no title truncation is permitted. RU/BE/UK/PL/EN paper labels SHALL use the shared translation resources, while API title content is not translated by the client.

#### Scenario: Digital scan acceptance
- **WHEN** the generated pages are rasterized at300 dpi in color and grayscale
- **THEN** every QR decodes to its exact expected campaign-bearing target

#### Scenario: Long source title
- **WHEN** a title needs more than its allocated space at minimum readable size
- **THEN** generation fails with overflow instead of producing clipped text

### Requirement: Reproducible local deliverables
The local generator SHALL write a manifest identifying source revision, locales, campaign, printed text, target URL, PDF sizes and hashes. Existing output files SHALL NOT be overwritten silently. It SHALL NOT print/distribute materials, create gameplay starts or change account state.

#### Scenario: Existing kit
- **WHEN** the selected output directory is already occupied
- **THEN** the generator refuses to replace its contents
