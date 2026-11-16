## Context

The route catalog already reports settled searches and the article navigation
already handles jumps to sections. The shared web analytics transport applies
consent before sending events to either provider.

## Decisions

- Count the current catalog outcome once it settles. If a visitor opens a
  result before the timer fires, record the outcome immediately. Keep one
  selection per recorded term, filter set, and outcome. Reuse the existing
  search-term privacy filter in both event payloads.
- Measure article actions at the existing navigation handler and at the
  description wrapper that captures clicks on telephone links. Derive the
  published article identifier with the existing publication resolver. Its
  read-only module lets the article start without the moderation code.
- Use the existing analytics transport for GA4 and Metrika. See
  `docs/features/analytics-events.md` for payloads and report filters.

## Validation and rollback

The browser acceptance covers a successful search and first selection, an empty
search, and jumps to the map and coordinates. DOM tests exercise telephone
links. The release must pass the unchanged Brotli budgets, mobile swipe tests
and performance budgets. Revert the instrumentation commits if production
navigation or delivery regresses.
