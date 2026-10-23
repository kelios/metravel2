## Why

Task #2667: readers cannot find a page explaining the value of publishing their
trips. The home page has no ContributionBanner. The catalog already inherits a
search banner in its shared list footer; the reported absence there was disproved
by source inspection, so that placement will be reused rather than duplicated.

## What Changes

- Add public `/become-author` explaining four existing benefits: trips on the map,
  PDF books, badges/ranks, and readers/subscribers, with a create-trip CTA.
- Show author-landing banners on home and in the existing catalog footer.
- Send guests through registration with a safe return to `/travel/new`; signed-in
  users go directly to creation. Track banner and landing CTA clicks.
- Provide static page metadata and RU/BE/UK/PL/EN interface/SEO copy.
- Keep the contest absent until separately published rules exist (#2684).

Goal/user-visible result: a reader reaches a truthful author value proposition
from home/catalog and can begin publishing without losing their auth return path.

Non-goals: contest rules/prize, publication-wizard changes, existing banners on
other screens, app-store promotion, new media, backend implementation.

## Capabilities

### New Capabilities

- `author-onboarding-landing`: public author benefits, discovery, auth-aware CTA,
  localized and indexable page, and conversion analytics.

### Modified Capabilities

None.

## Impact

- Platform impact: shared. Evidence: desktop web 1440 and mobile web 390; this
  change introduces no Android/iOS-specific runtime behavior or device gate.
- Localization impact: all current locales (RU/BE/UK/PL/EN). Static HTML remains
  RU baseline; language changes update client UI/metadata without locale URLs.
- Paths: route/screen, ContributionBanner, Home, catalog list orchestration,
  growth analytics, locale resources, SSG static-page registry and focused tests.
- Data/API: no new endpoints, persisted state, or mocks. Static benefits stay
  available independently of catalog/auth API success.
- SEO: self-canonical, title ≤60 characters, description 120–160 characters,
  OG/Twitter metadata in generated HTML, crawlable internal link. Backend sitemap
  is unchanged; sitemap membership is not required for indexing eligibility.
- Accessibility: semantic heading hierarchy, visible focus, wrapped labels,
  targets ≥44px. Performance: no new requests, fonts, artwork, or animation.
- Security: reuse sanitized internal-auth redirects; no secret or token changes.
- Analytics: existing `content_create_cta_click`, landing source
  `become_author_page`, banner variant/placement attached without PII.
- Preserve existing search/about/favorites/articles/history banner actions and
  catalog filtering, pagination, errors, and footer behavior.
- Dependencies: #2684 only controls future contest content and does not block.
  Fallback/mock policy: no mocks or fabricated benefits/statistics.
- Open questions: none; implementation is authorized by the owner's “делай”.
