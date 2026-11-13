## Context

See proposal.md for the observed screenshot and production measurements. `DirectoryGroup` unconditionally renders every list under an `h2`; the footer already follows the grid. The fix belongs to this web-only presentation component, not grid loading or scroll restoration.

## Goals / Non-Goals

**Goals:** compact default presentation, unchanged server links and native browser accessibility.
**Non-Goals:** grid/paging, scroll reset, country/city routes, query/API/auth, Android/iOS, editorial text and SEO metadata.

## Decisions

- Reuse native `details/summary`, already used in `components/games/TravelRouteTasks.web.tsx` and book sections. No new accordion component or React state is needed. Each `summary` contains the existing `h2` so heading navigation is retained; native disclosure supplies its state and keyboard support.
- Keep the complete `ul` in server HTML within its group. Rejected: removing links, hiding the directory through CSS, client-only rendering, or truncating long lists, which would weaken navigation or the crawlable-link contract.
- Use existing design tokens for section spacing, typography and the 44 px summary target; theme colors remain CSS variables. The CSS targets only direct disclosure children to avoid changing link wrapping.
- Reuse existing locale keys. No new labels, translation resources, dependencies, API fields or requests.
- Task-owned paths: web directory, its server-markup tests, `docs/design/quest-catalog-directory.md`, the relevant feature paragraph and this change. Other sessions' e2e changes are excluded.

## Risks / Trade-offs

- [Collapsed content needs discoverability] → visible existing headings and native disclosure markers; no script dependency and no cloaked alternative for crawlers.
- [Existing mid-word wrapping regression] → preserve the separator CSS and existing link tests.
- [Mobile disclosure or keyboard regressions] → production checks at 390 and 1980 px, Enter/Space and no-JS activation; collect screenshots and console evidence after review.
- [SEO link loss] → compare link href sequence in raw HTML and verify expanded links without scripts. URL/canonical/sitemap/robots/JSON-LD are unchanged.
- [Security/analytics] → no new HTML inputs, redirects, auth paths or events; existing internal href builders remain unchanged.

## Migration Plan

Run focused server-markup tests and lint, independent code-review gate, explicit-path commit/push to main, canonical frontend deployment, then mobile/desktop production acceptance. Rollback reverts the component change through the normal deployment script; no data migration is required.
