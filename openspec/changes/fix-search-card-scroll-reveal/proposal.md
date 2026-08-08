## Why

On production `/search`, a fast 1160 px scroll leaves all six newly visible
travel-card covers hidden behind their dominant-color fill for at least 100 ms;
the sharp images become visible only around 600 ms later. The behavior was
introduced deliberately by board task #1294 to prevent a recycled `<img>` from
showing another travel's already-decoded photo, but its Done gate accepted the
resulting fill-to-photo replacement and did not cover the now-rejected scroll
jank.

This is a recurrence of the insufficient FlashList lookahead invariant from
board task #1263. That task fixed Android with a 560 dp draw distance but
explicitly preserved the web values at 160/180 px, which are shorter than one
search-card row and the observed decode window.

## What Changes

- Make the search/catalog list prepare a bounded web row window early enough
  that ordinary downward and return scrolling brings already-decoded covers
  into view.
- Preserve the #1294 correctness gate: a recycled card MUST NOT expose a photo
  belonging to another travel while the next source is pending.
- Preserve the one-slot/one-raster media contract, canonical manifest sources,
  `contain` geometry, dominant-color error/loading fallback, pagination, and
  current responsive image width ladder.
- Add a regression scenario that measures visible card-image readiness during
  scroll instead of accepting the mere presence of a stable placeholder.
- Keep the lookahead bounded by a numeric request/byte budget; do not eagerly
  mount or download the complete result set.

### Goal and user-visible result

Travel cards on `/search` and `/travelsby` enter the viewport with their own
cover already visible during the agreed desktop-web and mobile-web scroll
scenarios. Scrolling back does not redraw a previously viewed card, and no card
ever displays another travel's image.

### Platform impact

- **Desktop web:** direct behavior change and required production-like browser
  evidence at 1280×900.
- **Mobile web:** direct behavior change and paired evidence at 390×844.
- **Android:** no intended configuration change; the existing 560 dp native
  contract from #1263 must be regression-tested on the connected USB device
  because the model and list component are shared.
- iOS is inactive and out of scope.

### Localization impact

`none`. No app-owned text, translation key, locale persistence, formatting, SEO
locale, or accessibility copy changes.

### Dependencies and fallback/mock policy

- Canonical board task: reopen #1263; related corrective task: #1294; problem
  family: `MEDIA-001`.
- No backend or API contract change. Existing `/api/travels/` fields and
  `media.cover.{src,srcset,sizes,dominant_color}` are consumed unchanged.
- No mock or second-image fallback may mask a missing decode. A solid
  dominant-color layer remains only the neutral error/loading fallback and is
  not accepted as a successful scroll-ready cover.
- No production deploy is authorized by this planning change. Without a later
  deploy, handoff wording must remain `local fix ready; production verification
  pending`.

### Existing behavior to preserve

- No stale/wrong travel photo during cell recycling (#1294).
- One visual slot equals one raster and one effective network URL (#1111/#1208).
- Stable card/media geometry, `contain` fit, alt text, focus/keyboard behavior,
  filters, sorting, infinite pagination, and navigation.
- Existing native lookahead and Android memory-cache behavior (#1263).

### Non-goals

- Redesigning cards, filters, toolbar, density controls, or list layout.
- Changing image URLs, source manifests, proxy/cache headers, quality, width
  ladder, or backend image processing.
- Adding a second LQIP/blur image, reveal timer, cache-busting URL, or duplicated
  source-construction path.
- Removing virtualization or eagerly rendering the unbounded paginated catalog.
- Changing the `viewportWidth > 0` hydration gate; the live reproduction occurs
  after layout and isolates recycle/decode behavior.

## Capabilities

### New Capabilities

- `travel-search-card-media`: Observable scroll-readiness, recycling correctness,
  bounded media loading, and cross-platform parity for travel search cards.

### Modified Capabilities

None. There is no existing OpenSpec capability for travel search-card media;
the legacy `specs/001-search-card-image-loading/` draft is provenance only and
is not a living OpenSpec spec.

## Impact

- **Expected frontend scope:**
  `components/listTravel/rightColumnModel.ts`, its focused model tests, and a
  real browser regression scenario for `/search`. `RightColumn.tsx` or
  `ImageCardMedia` enter scope only if measurement proves the model-only change
  cannot satisfy both scroll readiness and the one-raster budget.
- **Data/API:** unchanged; no backend work or migrations.
- **SEO:** route, canonical, metadata, sitemap, robots, and SSG markup unchanged.
- **Accessibility:** existing alt text and card semantics preserved; no new
  interactive element or announcement.
- **Performance:** target `0` visible own-cover nodes with `opacity: 0` in the
  defined scroll samples, `0` stale/wrong-photo swaps, and a bounded initial
  cover-request/byte delta recorded before implementation. Production baseline
  on 2026-08-08: first rendered window 9 cover assets / 613,978 downloaded bytes;
  after the 1160 px scroll 18 assets / 1,237,294 bytes. The implementation may
  move a bounded subset earlier but MUST NOT add a second raster per slot or load
  the full catalog.
- **Security:** no new URL construction, input, storage, token, or redirect path.
- **Analytics:** no events added or removed.
