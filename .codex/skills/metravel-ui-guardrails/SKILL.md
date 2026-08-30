---
name: metravel-ui-guardrails
description: "Apply metravel UI contracts to visible layout, cards, interactions, media, icons, tokens, placeholders, or external links. Use for UI implementation or redesign across web/mobile surfaces."
---

# Metravel UI Guardrails

`AGENTS.md` is inherited. Load only the exact `docs/RULES.md` headings and
supporting references that match the UI change:

- Read `docs/adr/0001-no-direct-linking-openurl.md` for external-link governance intent.
- Read `docs/adr/0002-images-via-image-card-media.md` for image/card architecture decisions.
- Read `docs/DEVELOPMENT.md` when the task changes SEO, page structure, or visible web flows.
- Use `$metravel-i18n-guardrails` when UI copy, accessibility labels,
  validation/errors, formatting, language settings, or SEO locale changes.

Build UI by extending existing primitives first:

- Reuse `components/ui` and existing feature components before inventing new one-off building blocks.
- Prefer the existing `Button`, `IconButton`, and `Chip` primitives for small controls.
- Keep layout stable across loading, success, and error states.
- Keep mobile web, Android, and iPhone visually and behaviorally aligned for the
  same shared mobile flow. Do not introduce platform-specific alternate UX unless the
  platform API makes it technically unavoidable.
- Design translated layouts for RU/BE/UK/PL/EN: labels may expand, wrap, or use
  different plural forms. Do not solve overflow by hiding meaning or shortening
  only one locale outside translation resources.
- For map/place/travel-point UI, prefer the shared fullscreen point/place
  template: visible app header/footer, hero image around 70%, title/meta,
  coordinates with copy, article/page action, expandable navigation choices, and
  existing save/add/share/route actions.
- The shared point/place template must expose Google Maps, Apple Maps, Organic
  Maps/offline, Waze, Яндекс Карты, Яндекс Навигатор, and OpenStreetMap when
  coordinates exist. Telegram/share is extra and must not replace navigation.
- Related travel status controls must be legible text ("Был здесь",
  "Хочу поехать", "Планирую" or "Был / Хочу / Планирую"), not only a compact
  icon without visible meaning.
- Fix source-level UI problems found while implementing the touched flow.
  Observable overlap, layout, console, and interaction results are accepted in
  `testing`; a failure there returns to implementation with evidence.
- If a UI problem cannot be fixed safely in the current scope, document the blocker and exact scenario instead of leaving it implicit.

For a new page or redesign:

- Define the route goal and section hierarchy before implementation; reuse `ResponsiveContainer`, `ResponsiveStack`, typography, SEO helpers, and feature components.
- Define testing scenarios for common/shared responsive screens on desktop web
  and mobile web, including light/dark, loading/empty/error, keyboard/focus, and
  parity. Add device scenarios only for platform-specific scope.
- Use `$metravel-design-auditor` for a cross-screen consistency matrix; use this
  skill for implementation and `$metravel-browser-reviewer` only as the
  read-only browser QA gate after review in `testing`.
- Use `$metravel-visual-asset-designer` only when an existing primitive, Feather icon, local asset, or real/photorealistic media cannot satisfy the requested slot.

Enforce the repository's UI contracts:

- Do not call `window.open(...)` directly.
- Do not call `Linking.openURL(...)` directly outside `utils/externalLinks.ts`.
- Use `openExternalUrl(...)`, `openExternalUrlInNewTab(...)`, or `openWebWindow(...)` only in the allowed cases.
- Use `@expo/vector-icons/Feather` by default for production icons. Avoid emoji as icons.
- Verify icon names belong to the chosen family; do not copy names across icon families.
- Use `DESIGN_TOKENS` from `constants/designSystem.ts` and web CSS variables from `app/global.css`; do not hardcode hex colors.
- Do not hardcode app-owned UI strings. Use `@/i18n`, localize accessibility
  text and states, and use `i18n/format.ts` for locale-sensitive output.

Handle images and placeholders the metravel way:

- Placeholder blocks must stay neutral: no emoji, no text, no decorative icons.
- Preserve the same geometry as the final media to avoid layout jumps.
- Keep images in `contain` mode with blurred fill around unused space when the pattern already exists for that surface.
- For critical web hero/slider media, keep visible image and blur backdrop on the same effective source whenever possible.
- Do not defer hero/background/slider appearance with click gates, scroll gates, or reveal timers.
- On web travel hero and gallery surfaces, preserve the canonical `70vh` height contract.

Preserve rich-text embeds:

- On web travel/article rich text, valid Instagram post/reel/tv iframes and standalone post/reel/tv URLs must render as visible embedded posts.
- Do not downgrade valid Instagram post/reel/tv embeds to generic fallback cards on web; fallback cards are only for non-embeddable or unsupported Instagram URLs such as stories/highlights/profile links.
- Keep Instagram iframe handling inside the existing sanitize/normalize pipeline and verify changed Instagram rich-text behavior in a real browser.

Respect web interaction constraints:

- Avoid nested button semantics on web.
- Inside clickable cards, render secondary actions in a non-button wrapper with `role="button"`, keyboard handlers, and `data-card-action="true"` when needed.
- On `/places`, keep filters scan-friendly: country filters above categories, stable card grid geometry, no nested cards, and no rendering of the full catalog at once.

Prepare visual testing before code-review handoff:

- Record the changed browser scenario, desktop/mobile viewports, required
  screenshots, console/network expectations, and target environment.
- For Android/iOS-specific observable behavior, record the required local USB
  or simulator/physical/TestFlight case. Browser/device execution happens only
  after code review in `testing`.
- Run `npm run guard:external-links` or `npm run governance:verify` whenever link handling or policy-sensitive UI changed.
- Run `npm run test:i18n` and verify affected locales whenever UI copy or
  locale-sensitive behavior changed.
