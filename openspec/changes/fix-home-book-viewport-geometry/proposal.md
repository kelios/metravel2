## Why

Board #2405 measured the loaded guest homepage clipping search and its main action at 2048×900, and most content at 2560×640. Width-scaled typography and width-based vertical percentage padding consume a viewport-capped book page, so mandatory content cannot be reached.

## What Changes

- Use one book geometry model for actual viewport width/height, book width and usable page height; react to height-only resizing.
- Constrain title, subtitle and vertical spacing by the available page area while preserving readable text and 44px actions.
- Keep the two-page artwork and provide normal vertical scrolling for the entire left-page content when it cannot fit; do not hide mandatory elements or paint them outside the paper.
- Align static and loaded homepage geometry and add a regression that measures clipping and exercises real clicks.

Goal / user-visible result: title, description, search and action remain fully reachable inside the book at short/wide desktop sizes; tablet/mobile retain current order and interactions.
Non-goals: new copy/media, seasonal decoration redesign, palettes, navigation/API changes, native-specific behavior.
Dependencies: #1541 and #1358 are completed historical context; no backend change. Implementation requires a separate apply request after review of this plan.
Fallback/mock policy: existing loading/error/media fallbacks remain; geometric mocks do not replace real browser acceptance.
Existing behavior to preserve: book spread, right-page photographs and media ratio, guest content order, light/dark and seasonal treatment, mobile/tablet layouts.
Open questions: none; the proposed small-space fallback scrolls the complete left-page content inside the paper, including title and actions.

## Capabilities

### New Capabilities
- `home-book-viewport-accessibility`: accessible, scroll-reachable desktop book content with static/loaded geometry parity.

### Modified Capabilities
None.

## Impact

- Platform impact: desktop web and mobile web; no Android/iOS-specific runtime/config change or device gate. Planning files themselves have platform impact none.
- Localization impact: all current locales RU/BE/UK/PL/EN for wrapping/geometry; no translation changes. Planning text has localization impact none.
- Frontend paths: `components/home/HomeHero.tsx`, `HomeHeroBookLayout.tsx`, `homeHeroStyles.ts`, style groups/context, a focused shared book-geometry module, `scripts/ssg-skeletons.js`, relevant tests and a versioned viewport mock in `docs/features/`.
- API/data: preserve `HeroStyleParams` inputs and search callbacks; no server contract change.
- SEO: preserve headings, links and copy; static shell shares the book sizing rules.
- Accessibility: all content keyboard/scroll reachable, normal focus behavior, controls at least 44px, no horizontal scrolling.
- Performance: no extra media/API request; stable first frame, no resize layout/read feedback loop, preserve current media geometry and preload behavior.
- Security/analytics: no changed input or event contracts; existing search and navigation handlers preserved.
