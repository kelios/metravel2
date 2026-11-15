## Why

Task #3438 reports oversized body photos on the production travel page. The current read-only baseline confirms 324px floated photos with naturalWidth 883 and full-band sizes; these are authored floats, not generated grids. Narrow photos should select their own slot while wide photos retain existing addresses.

## What Changes

- Keep an import-free 324px desktop float slot beside the existing body slots.
- Feed parsed ancestor classes to the body source builder in the full render and inert server island.
- Preserve mobile 100vw, full-width pictures, media manifests, family caps and deferred release order.
- Refine #3438 to the observed float mechanism. Automatic groups remain a neighbouring coverage boundary, without an unverified defect claim.

## Capabilities

### New Capabilities
- `article-body-float-media`: bounded responsive delivery for authored floated body photos.

### Modified Capabilities

None.

## Impact

Platform impact: desktop web; mobile web is a no-change control. Native ignores web sizes and has no changed rendering branch.
Localization impact: none; no text changes.
Data/API contract: unchanged media.article_body and URLs; only the responsive slot hint changes for authored floats.
SEO/accessibility/security/analytics: existing canonical, alt, sanitizer, navigation and events are preserved.
Performance: on the named production page, oversized body floats >2x must become zero; full-width source addresses and the 558KB eager budget remain unchanged.
Dependencies: #3408 island addressing remains intact; no backend work.
Fallback/mock policy: unit fixtures exercise live source construction; live production baseline and post-deploy probes establish user impact.
Non-goals: generated grid classification, hero/gallery, media formats, backend changes or bundle budget increases.
Open questions: none; implementation is already authorized by the sprint request.
