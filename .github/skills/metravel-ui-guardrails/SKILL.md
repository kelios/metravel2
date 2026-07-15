---
name: metravel-ui-guardrails
description: Apply metravel UI guardrails for screens, cards, interactions, images, icons, and styling across web and native. Use when Codex changes visible UI, layout, placeholders, media rendering, design tokens, external links, or interaction behavior and must preserve the repository's web/mobile contracts while fixing all real UI issues found in scope.
---

# Metravel UI Guardrails

Read `AGENTS.md` and `docs/RULES.md` before any UI change. Then load the exact supporting references that match the task:

- Read `docs/adr/0001-no-direct-linking-openurl.md` for external-link governance intent.
- Read `docs/adr/0002-images-via-image-card-media.md` for image/card architecture decisions.
- Read `docs/DEVELOPMENT.md` when the task changes SEO, page structure, or visible web flows.
- Use `$metravel-i18n-guardrails` for UI copy, accessibility, validation/errors,
  locale state/formatting, or SEO locale.

Build UI by extending existing primitives first:

- Reuse `components/ui` and existing feature components before inventing new one-off building blocks.
- Prefer the existing `Button`, `IconButton`, and `Chip` primitives for small controls.
- Keep layout stable across loading, success, and error states.
- Keep the same mobile product contract across web, Android, and iOS/iPadOS.
  Design labels and states for RU/BE/UK/PL/EN expansion and plural differences.
- Fix all real UI problems found while working in the touched flow: overlap, broken mobile/desktop layout, invalid icons, non-neutral placeholders, console errors, broken interactions, and direct external-link violations.
- If a UI problem cannot be fixed safely in the current scope, document the blocker and exact scenario instead of leaving it implicit.

Enforce the repository's UI contracts:

- Do not call `window.open(...)` directly.
- Do not call `Linking.openURL(...)` directly outside `utils/externalLinks.ts`.
- Use `openExternalUrl(...)`, `openExternalUrlInNewTab(...)`, or `openWebWindow(...)` only in the allowed cases.
- Use `@expo/vector-icons/Feather` by default for production icons. Avoid emoji as icons.
- Verify icon names belong to the chosen family; do not copy names across icon families.
- Use `DESIGN_TOKENS` from `constants/designSystem.ts` and web CSS variables from `app/global.css`; do not hardcode hex colors.
- Do not hardcode app-owned UI strings; use `@/i18n` and `i18n/format.ts`.

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

Verify visual changes before finishing:

- Open the changed scenario in a real browser if the task affects visible web UI.
- Capture a screenshot to confirm final rendering, storing it only in ignored local debug folders such as `.codex-temp/` or `.codex-debug/`.
- Check the browser console for new errors.
- Run `npm run guard:external-links` or `npm run governance:verify` whenever link handling or policy-sensitive UI changed.
- Run `npm run test:i18n` whenever UI copy or locale-sensitive behavior changed.
