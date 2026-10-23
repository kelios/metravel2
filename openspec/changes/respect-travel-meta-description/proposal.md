## Why

Stored travel `meta_description` currently reaches the API but is discarded by SSG normalization and ignored by both static and hydrated metadata. Frontend feature #2700 enables the metadata-only editorial work in #2658 without requiring changes to article prose, titles or URLs; the prior body-only behavior was intentional, not a regression.

## What Changes

- Prefer usable stored metadata consistently in static and hydrated travel head descriptions, preserving the existing body/context fallback for missing, blank, invalid or short values.
- Normalize explicit metadata as plain text and constrain its escaped attribute length to 160 characters; prepared canonical values remain exact.
- Preserve the field through live and captured/replayed SSG detail input, and keep existing metadata untouched while client detail data is unavailable.
- Document the new precedence and replace stale SEO instructions that require body edits for metadata-only work.

### Existing behavior and non-goals

Keep title, canonical, URLs, article body, FAQ, ownership, publication state, points and media unchanged. This change does not write content, rename articles, translate editorial content, add per-article overrides, change Google snippets directly, or promise CTR improvement. #2658 separately owns its author-1 write scope, seven-day locks and 28-day GSC gate.

## Capabilities

### New Capabilities

- `travel-meta-description`: safe explicit metadata precedence across static and hydrated travel heads with the existing fallback preserved.

### Modified Capabilities

None; no existing main capability currently describes this precedence.

## Impact

- User-visible result / SEO: stored editorial metadata becomes the submitted search/social description and survives hydration. Existing SSG Article metadata naturally follows its already shared selected description; FAQ and client body-derived structured data retain their current owners.
- Platform impact: desktop web and mobile web. Android/iOS: no device-specific behavior or configuration.
- Localization impact: none. Article content stays in its authored language; no app copy or translation keys change.
- Data/API: consume the existing optional `meta_description` string/null; no new endpoint or backend writes. Public API availability is a prerequisite, confirmed by 14 real public detail GETs in #2658's discovery; missing metadata remains compatible through fallback.
- Affected areas: shared SEO text utilities, SSG detail normalization/rendering and captured replay, travel head viewmodel/types, existing critical-head description preservation, focused regression tests, travel documentation and canonical SEO role/skill instructions.
- Dependencies: current public detail API must expose the field; no backend change is indicated by discovery. Before production rollout, inspect the old/new metadata effect over the full published cohort because existing values outside #2658 also gain precedence. #2700 is related to #2658 with an explicit production-acceptance/Done gate, not a hard block on existing-API editorial staging. The shared train can safely stage authorized eligible metadata, review once and roll out once; locked articles retain their later dated content/SSG gates.
- Fallback/mock policy: preserve the real current body/context fallback; unit fixtures prove contracts, production acceptance proves deployment. No mock-only substitute for a missing API contract.
- Accessibility: no visible semantics, focus or controls change.
- Performance: no extra requests, media work or loading deferral; one pure shared utility. Existing slider/performance checks remain required for the touched details directory during testing.
- Security: plain text only, existing attribute escaping/head setters, no raw markup or secret handling.
- Analytics: events and parameters are unchanged.
- Open questions: none; explicit minimum 80 plain-text characters and maximum 160 escaped attribute characters were selected before implementation.
