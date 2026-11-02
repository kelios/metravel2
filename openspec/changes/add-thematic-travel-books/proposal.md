## Why

#2809 has an approved composition of 40 mountain places and 30 castles in Poland, but no downloadable thematic diaries. Existing country-book identity assumes that the source API point, physical target and photograph are identical; several verified thematic sources need an explicit contextual relationship.

## What Changes

- Publish the two approved thematic diaries through the existing physical PDF, preview and immutable-publication pipeline.
- Add a strict thematic source contract separating physical targets, source points, media bytes, context captions, scoped route metrics and current access notices.
- Add declared series families and catalogue theme selection, keeping country style alternatives isolated.
- Show separate book and article actions on place cards: a compact exact-point book icon and the existing article action, as requested by the owner.
- Preserve all accepted country/quest objects and resources. No backend changes, new format, stock imagery, paid render, printer contact, orders or native release.

## Capabilities

### New Capabilities

- `thematic-travel-books`: verified thematic composition, visible route/media context, independent edition families and honest publication readiness.

### Modified Capabilities

None; existing country and quest contracts remain compatible.

## Impact

Platform impact: desktop web | mobile web; existing local shared PDF engine. Native implementation is unchanged.
Localization impact: editorial/PDF RU; catalogue UI RU/BE/UK/PL/EN in books namespace.
Data: additive thematic-v1 source and publication metadata; strict legacy validation retained.
Accessibility: labelled theme controls, planned/ready states and truthful image descriptions.
Performance: thin catalogue only; full metadata/PDF remain lazy. Security: existing verified-resource/hash and external-link boundaries, stripped publication EXIF, no private archive paths.
SEO/analytics: existing routes, canonical helpers and event model reused; no new tracking.
Dependencies: approved 70-source draft and existing renderer/publication. Unknown paper/provider acceptance remains explicit; production has no fixture fallback.
