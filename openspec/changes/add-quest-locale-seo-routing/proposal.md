## Why

Published quest translations are now available through the accepted #2193 API, but search crawlers receive Russian-only static pages. A quest-specific URL contract is needed before exposing translated pages without disturbing existing Russian search results.

## What Changes

- Propose language-prefixed quest detail URLs for BE/UK/PL/EN, retaining current Russian detail canonicals and city aliases.
- Publish an indexable language version only when a complete published translation is actually returned and the existing page-quality gate passes.
- Define self-canonical pages, reciprocal HTML hreflang clusters, Russian x-default, language-bound hydration, explicit language switching, and safe handling of absent or withdrawn translations.
- Define a common immutable SSG release package plus a proposed backend-owned live eligibility/static gateway for actual pages, production sitemap and Nginx routing; propose separately owned implementation cards after owner acceptance.
- Keep city landing pages Russian in the first implementation, with no untranslated prefixed landing or hreflang claims.

## Capabilities

### New Capabilities

- `quest-locale-seo-routing`: Crawlable translated quest detail URLs, publication eligibility, canonical/alternate consistency and deterministic language selection.

### Modified Capabilities

None. This proposal does not change the currently accepted unprefixed runtime routing contract.

## Impact

Problem: live sitemap lists 232 Russian quest details and 176 city landings; translated content currently has no separate crawlable URL. GSC search analytics for `/quests/*`, 2026-09-08 through 2026-10-05, records 78 clicks and 1,598 impressions. Search-exposure rows are not an indexed-page count; independent URL Inspection supplies that baseline in design.

Goal: make complete published translations independently discoverable with consistent routing and metadata, while preserving all current Russian canonicals.

User-visible result: after a separately authorized implementation, visitors can open and share a language-specific quest page and switch to available versions through explicit links.

Platform impact: none during planning; implementation targets desktop web and mobile web. Android/iOS runtime, deep links and store releases remain outside this change.

Localization impact: all current locales, RU/BE/UK/PL/EN. API/editorial content is consumed in its declared content_locale; application-owned labels and SEO UI use i18n.

Dependencies: #2193 and #2201 are done; #2202 provides translations incrementally, but full catalogue coverage is not a prerequisite. Owner acceptance of this proposed routing contract and a later apply request precede implementation. Backend sitemap/Nginx work requires separate area=back cards and its backend owner.

Fallback/mock policy: an unavailable translation never becomes an indexable prefixed Russian page. Existing Russian content and fallback gameplay remain accessible through their established unprefixed URLs. No mock-only localization is acceptance evidence.

Impact summary:
- Data/API: existing lang, content_locale and available_locales remain unchanged; proposed private revision receipt, release-manifest handoff and anonymous serving projection support snapshot-safe delivery without changing translation-write success semantics.
- SEO: URL/canonical/hreflang/SSG/production sitemap consistency is the primary scope.
- Accessibility: explicit language links retain full labels, keyboard operation and existing touch targets.
- Performance: avoid multiplied request waterfalls; preserve existing page-quality and media geometry gates, measure build duration before rollout.
- Security: allowlisted locales and same-origin routes; no user-controlled redirects or credentials in public manifests.
- Analytics: preserve events and quest identity; attribute prefixed page paths without changing consent behavior.

Existing behavior to preserve: Russian detail canonicals use numeric city IDs; city landings prefer canonical city aliases. Quest IDs, API identifiers, answer semantics, progress, offline locale isolation and media URLs remain unchanged.

Non-goals: article or site-wide URL localization (#1332), new translations or creative copy, translated city/country/catalogue/scenario landings, a canonical migration from numeric city IDs, or implementation in this planning task.

Open questions: owner acceptance of the proposed prefix, Russian-only city-landing first phase and immutable-package/live-gateway publication contract. The proposed gateway also mediates existing RU detail responses to revoke stale sibling alternates; it adds backend/Nginx topology work and potential request latency, and must preserve immediate existing translation-write/gameplay semantics. It is a separate backend-owner dependency, not implementation authorization. Material choices remain proposed until that decision is recorded.
