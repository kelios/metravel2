## Why

The supplied Krakow museum passport needs a discoverable place in Books with its cover and sticker set. Its A4 pages and A3 booklet imposition do not meet the existing photo-diary contracts.

## What Changes

- Add a separate museum passport catalogue and detail with reading, booklet, wrap-cover and sticker downloads.
- Preserve immutable files, exact checksums, publication rights and purpose-specific printing instructions.
- Keep only museums available to individual visitors, including individually bookable guided visits; editorial selection and printable files are supplied by the content owner.

## Capabilities

### New Capabilities
- `museum-passports`: Discover and download a complete museum passport edition.

### Modified Capabilities
None.

## Impact

Platform impact: desktop web and mobile web; native web-only boundary remains unchanged. Localization impact: UI in RU/BE/UK/PL/EN, editorial PDF and museum names retain their content language. User-visible catalogue/detail and SEO metadata change. Accessibility uses named headings, normal links and numbered contents. Data contract adds an optional collection; existing books are unchanged. No backend, auth, paid service or analytics-contract change. Existing immutable S3 storage and rights proof are dependencies; no mock download or placeholder PDF is published. Non-goals: photo-diary profile migration, native reader, live schedule service, or automatic PDF translation.
