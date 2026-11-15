## Why

Task #3439: Article list/detail endpoints omit their trailing slash. The detail screen and breadcrumbs fetch the same article independently: production baseline has two 301 and two 200 responses for article 1.

## What Changes

Opening the article catalog or an article produces zero article API redirects; a healthy numeric detail has exactly one detail request shared with breadcrumbs; first-party covers use their proxy URL.

## Capabilities

### New Capabilities
- `article-resource-requests`: bounded request identity for the affected public web surface.

### Modified Capabilities
None.

## Impact

Paths: api/articles.ts, api/articleQueries.ts, hooks/useBreadcrumbModel.ts, app/(tabs)/article/[id].web.tsx, components/article/SafeHtml.tsx. Platform impact: desktop web and mobile web; existing native API/media callers retain their contracts. Localization impact: none. Data/API: existing response fields and endpoint semantics preserved. SEO/accessibility/analytics/security: existing metadata, alt, session and event contracts preserved. Performance: zero duplicate URLs/redirects, measured in the stored real production baseline. No backend changes, catalog redesign, content changes or new dependencies. No hard dependencies. Mock policy: deterministic unit fixtures may prove code behavior; final acceptance uses the real published URLs. No unresolved product choices.
