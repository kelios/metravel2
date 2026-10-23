## Context

See `proposal.md` for scope. Source evidence established before implementation:

| Mechanism | Source at investigation |
| --- | --- |
| Home route is a hydration/SEO shell; content has its own ScrollView | `app/(tabs)/index.tsx:145`, `components/home/Home.tsx:264` |
| Catalog shares the search list and already has a contribution footer | `app/(tabs)/travelsby.tsx:71`, `components/listTravel/RightColumn.tsx:517` |
| Catalog mode is already detected | `components/listTravel/ListTravelBase.tsx:69` |
| Registration and login preserve the same safe post-auth destination | `utils/authNavigation.ts:113`, `components/auth/RegistrationForm.tsx:90`, `components/auth/LoginForm.tsx:103` |
| Static registry injects metadata and writes both route forms | `scripts/generate-seo-pages.js:3588`, `:4092`, `:4143` |
| Content-create click-event helper already exists | `utils/growthFunnelAnalytics.ts:301` |

Feature truth: `docs/features/travel.md` (map/wizard/export) and
`docs/features/user.md` (profile, subscriptions, achievement integrations).
Durable visual specification: `docs/design/become-author-landing.md`.

## Goals / Non-Goals

Goals: one shared public screen; existing safe auth continuation; one catalog
banner placement; static indexability without backend changes. Platform impact:
shared; localization: RU/BE/UK/PL/EN. No new API, storage, data migration, external
service, app-store reference, or platform-specific code.

## Decisions

1. Thin `app/(tabs)/become-author.tsx` delegates to a static screen using existing
   `ResponsiveContainer`, `ResponsiveStack`, `Heading`, `Body`, `Button`, Feather,
   `useResponsive`, and `useThemedColors`. Add a hidden tab registration if needed;
   coordinate the dirty layout file with its active owner. No generated art.
2. Add author landing variants to `ContributionBanner`; home places it after the
   weekend grid inside `Home.tsx`'s ScrollView. `ListTravelBase` passes a catalog
   variant to `RightColumn` only for `isTravelBy`; the existing footer changes
   destination. Include the new prop in `rightColumnModel`'s memo comparator.
   Rejected: route-level home sibling or second catalog banner, which would
   split scrolling or duplicate promotion. Other variants retain their actions.
3. Landing CTA uses `buildRegistrationHref({ redirect: '/travel/new', intent:
   'create-travel' })` for guests and `/travel/new` for authenticated users.
   During auth initialization keep the static page visible and prevent premature
   guest navigation. Existing registration-to-login links preserve context.
   Rejected: raw `returnTo` or a login-first shortcut; this flow already owns
   a sanitized `redirect` contract and the task explicitly asks registration.
4. The author banner action is an ordinary internal Expo Link with minimum 44px
   target and themed link text; it emits a real `href`. Canonical Button currently
   fixes role=button and cannot serve as Link asChild without API expansion.
   Keep create actions as canonical Button; avoid nested link/button semantics.
5. Use existing home/homeStatic and seoStatic resource families in all locales.
   Follow their nearest key style, use literal translation keys, and keep labels
   reactive. RU HTML and initial hydration match; persisted locale is applied by
   existing providers. No locale URL prefixes or hreflang.
6. Add `/become-author` to `STATIC_PAGES` with RU metadata from required locale
   keys; use InstantSEO and canonical/OG helpers at runtime. Extend the existing
   critical head route mapping only where required to avoid generic metadata
   during boot. Preserve unrelated edits in these shared files. The route is not
   robots-blocked. Title ≤60 and description 120–160 for every locale.
   A sitemap is not an indexing prerequisite: Google's
   [sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview)
   permits discovery through internal links. No backend sitemap dependency is
   needed for eligibility. Actual search-engine indexing has no immediate SLA.
7. Keep `content_create_cta_click`: landing source `become_author_page`, content
   type `route`, intent `create-travel`, action `register|create`. Guest CTA may
   also use the existing registration CTA event. Banner navigation uses this same
   click event with action `learn_more`, source `home|travelsby`, optional variant
   `author-home|author-catalog`, and auth state. Do not add a new event name.
   Emit each event once per activation, no PII.

## Risks / Trade-offs

- Generic boot metadata can overwrite new route tags → test raw generated HTML
  and hydrated metadata; use the established critical route mapping.
- Catalog banner is below results → preserve its existing placement and test it
  after scrolling; do not alter list pagination or insert a second promotion.
- A new footer prop can be swallowed by memoization → comparator regression.
- Unknown API/auth state → no fictional counters, automatic registration or
  draft; static content does not depend on catalog API availability.
- Contest is not launched → render no placeholder, disabled control, rules,
  dates, prize, or promise; #2684 will add separately verified content.
- SEO discovery relies on internal anchors → verify href in rendered banner.

## Validation matrix

| Surface | Required evidence |
| --- | --- |
| Code-level | Focused banner/screen/auth-navigation/analytics/static-metadata tests; lint/typecheck and i18n; prompt audit for planning docs |
| Desktop 1440 and mobile 390 | In testing after review: home/catalog banner, one catalog placement, landing four benefits and CTA, no horizontal scroll, keyboard focus, ≥44px targets |
| Themes/locales | Light/dark screenshots; RU/BE/UK/PL/EN page and banners, expanded labels, localized metadata |
| Auth | Guest CTA to registration; registration/login preserves redirect; successful authenticated continuation to wizard without publishing |
| SEO | Production HTTP 200, title/description/canonical/OG in raw HTML and after hydration, no noindex, correct deployed sha |
| Regression | Search and existing banner variants preserve old actions; catalog filters/footer/loading/error remain usable |
| Android/iOS | Shared visual/navigation contract preserved in source; no platform-specific runtime gate introduced |

Browser/API/device execution stays in testing after independent code review.

## Migration Plan

No migration. After code checks and independent review, the task owner follows
the authorized commit/push/testing/deploy/production acceptance pipeline. Rollback
reverts only task-owned changes or uses the last good frontend deployment; there
are no data writes or backend files to undo.
