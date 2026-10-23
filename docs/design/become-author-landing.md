# Become-author landing — design evidence

Task: #2667. Decision: 2026-10-23. Status: implementation specification; runtime
evidence is recorded separately during testing.

## Hierarchy and reuse

Shared route `/become-author`, native/web same block order and actions. Thin route
delegates to a static screen. Reuse ResponsiveContainer/ResponsiveStack,
Heading/Body, Button, Feather and useThemedColors; no new artwork, new UI kit,
numbers, testimonials, ranking promises, or store badges.

```text
Existing app header / breadcrumbs
H1: Стать автором MeTravel
Short value proposition + primary «Рассказать о поездке»
Benefits:  map              | PDF book
           badges / ranks  | readers / subscribers
Primary «Рассказать о поездке» (same destination and event)
Existing app footer / mobile dock clearance
```

Desktop 1440: bounded content container, readable text width, two benefit columns,
CTA aligned with content. Mobile 390: one column, same order, full-width primary
actions with wrapping labels, no fixed promotional overlay. App header remains
compact. Benefits are informative sections with Feather glyphs, not pretend
interactive cards. A contest section does not exist until #2684 publishes rules.

Home placement: one existing ContributionBanner composition after weekend routes
inside the home ScrollView. Catalog placement: reuse existing list footer banner;
source inspection disproved the card's claim that this banner was missing.
Author variant links to landing through a real internal anchor (44px target,
text plus arrow); existing banner variants keep their own actions.

## States

| State | Behavior |
| --- | --- |
| Guest | Benefits always visible; CTA goes to registration with creation return |
| Authenticated | Same content and CTA label; CTA goes directly to wizard |
| Auth initializing | Content visible; CTA does not misroute a signed-in user as guest |
| Catalog loading/empty/error | Static landing is unaffected; catalog's existing list status remains intact |
| Light/dark | Background/surface/text/border/primaryText/primaryDark from live theme |
| RU/BE/UK/PL/EN | Same information, natural wrapping; no ellipsis truncates meaning |
| Offline or slow page navigation | Standard app/browser failure behavior; no fabricated success |

## Accessibility and acceptance evidence

One H1; benefit H2s; visible keyboard focus; label and accessible name translated;
minimum 44px actions; no nested button/link; dark contrast uses theme roles.
There are no media placeholders or animations. New text is app-owned locale
content, not a translation of editorial/API prose.

After review, capture desktop/mobile landing and both banner placements in light
and dark themes; verify all five locales, keyboard activation, no horizontal
overflow, guest/auth continuation, metadata after hydration and console errors.
Shared layout does not introduce a platform-specific device gate.

Chosen: shared static page + existing banner. Rejected: duplicated catalog
promotion or route-level home overlay. Risk: new footer prop missed by memo
comparator; include it and a focused regression. Rollback: task-owned frontend
diff/deployment; no content or data migration.
