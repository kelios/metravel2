# Rules

## Project scope

- Current project is `metravel2`.
- The app codebase root is `metravel2/` (the folder that contains `package.json`).
- Treat `docs/` (this folder) as the source of truth for development rules.

## Development workflow

- Before starting any change, review relevant files in `docs/`.
- Before deploying to production, validate the local code in production-like conditions:
  - build a production web export (`dist/prod`)
  - run checks against that build (not against a dev server)
- After each logical change, run checks that match the scope of the change:
  - точечные, локальные изменения: запускай только релевантные проверки для затронутой области;
  - средние изменения: запускай релевантные тесты и линт для затронутых файлов/модулей;
  - крупные или сквозные изменения: обязательно запускай полный прогон:

```bash
npm run lint
npm run test:run
```

- Skipped tests are not allowed in the repository:
  - do not leave `it.skip`, `test.skip`, `describe.skip`, `xit`, or `xtest`;
  - if a test is broken, fix it, replace it with stable coverage at the correct level, or remove the obsolete test in the same task;
  - the green baseline is `0` skipped tests unless a documented project-level exception is explicitly added to `docs/`.

- If a task changes UI, layout, styling, visual states, or interaction behavior visible on web:
  - open a local browser preview and visually verify the changed scenario in the browser before considering the task complete;
  - take a screenshot of the result to confirm visual correctness;
  - check the browser console for errors (no new errors should appear after the change).
- Dev media caveat:
  - in local dev, article/travel images may fail to load because content can come from production data while media files remain tied to production storage/CDN access;
  - do not treat this alone as a frontend bug and do not change app code only to “fix” dev-only missing production media;
  - fix real frontend regressions instead, such as broken navigation, scrollspy/highlight logic, rendering bugs, or invalid URL normalization introduced by frontend code.
 
- Always verify the changed scope before finishing the task.
  - For small, isolated changes, this can be a targeted lint/test check instead of the full suite.
  - For larger changes, use the full `npm run lint` and `npm run test:run` pass.
- For performance checks (Lighthouse), run against a production web export:

```bash
npm run build:web:prod
npm run lighthouse:travel:mobile
npm run lighthouse:travel:desktop
```

- After deploying to production, validate performance against the real production URL (PageSpeed Insights or Lighthouse).
- Web caching policy (mandatory):
  - Do not re-introduce Service Worker runtime/static caching for web pages/assets.
  - Do not add user-facing flows that ask to "clear cache" after deploy.
  - Update rollout must be automatic (server headers + fresh build artifacts only).
  - Do not use client-side cache-bust/reload workarounds in runtime:
    - no forced `window.location.reload(...)` to recover from deploy mismatch,
    - no query-param cache busting like `?__r=` / `?__cb=` appended to JS/CSS URLs at runtime.
  - Do not add pre-hydration "self-heal" scripts that reload the page on version mismatch/chunk error.
  - Keep release consistency at the HTTP layer (Nginx/CDN headers + atomic static deploy), not via browser-side reload hacks.
  - Do not set `Cache-Control: immutable` for `/_expo/static/*.js` by default.
  - For Expo JS bundles/chunks, keep revalidation (`max-age=0, must-revalidate`) unless content-addressed hash stability is explicitly verified across releases.

### Code quality and simplicity (mandatory)

- Do not overcomplicate solutions. Prefer the simplest clear implementation that solves the task.
- Write code to be easy to read and maintain:
  - clear naming
  - small focused functions/components
  - predictable control flow
- Reuse existing components, hooks, helpers, and utilities before creating new ones.
- If you see clear duplication or overgrown logic, refactor to a simpler structure as part of the task.
- If you find unused code (dead imports, unused functions/components/files), remove it.
- If you find real errors or broken behavior during the task, fix them (or explicitly document blockers if fix is impossible in current scope).
- Write and refactor code using current 2026 practices by default:
  - prefer up-to-date, actively supported framework and language patterns;
  - avoid legacy or deprecated approaches when a modern project-approved alternative exists;
  - if compatibility constraints force an older pattern, keep it local and document the reason in code or the relevant doc.

### Server path safety (mandatory)

- Never change server file paths in configs unless existence is verified on the target host.
- This applies to all critical directives, including:
  - `ssl_certificate`, `ssl_certificate_key`, `ssl_trusted_certificate`
  - `root`, `alias`, `include`
  - `proxy_pass` targets and unix socket paths
- If path existence cannot be verified, do not modify the path; keep current value and mark as `needs server verification`.
- Before editing Nginx/Apache paths, run checks on the server first:

```bash
# Example for SSL files:
sudo test -f /path/to/fullchain.pem && echo OK || echo MISSING
sudo test -f /path/to/privkey.pem && echo OK || echo MISSING
sudo test -f /path/to/chain.pem && echo OK || echo MISSING

# Example for web root:
sudo test -d /path/to/web/root && echo OK || echo MISSING
```

- Any config change with path updates must be followed by:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Performance testing with metravel.by

Run Lighthouse directly against `https://metravel.by` to test real production performance.

**Step-by-step:**

```bash
# Desktop:
npx lighthouse https://metravel.by/ --preset=desktop --only-categories=performance --chrome-flags="--headless --no-sandbox"
npx lighthouse https://metravel.by/search --preset=desktop --only-categories=performance --chrome-flags="--headless --no-sandbox"
npx lighthouse https://metravel.by/map --preset=desktop --only-categories=performance --chrome-flags="--headless --no-sandbox"

# Mobile:
npx lighthouse https://metravel.by/ --form-factor=mobile --screenEmulation.mobile --throttling.cpuSlowdownMultiplier=4 --only-categories=performance --chrome-flags="--headless --no-sandbox"
npx lighthouse https://metravel.by/search --form-factor=mobile --screenEmulation.mobile --throttling.cpuSlowdownMultiplier=4 --only-categories=performance --chrome-flags="--headless --no-sandbox"
npx lighthouse https://metravel.by/map --form-factor=mobile --screenEmulation.mobile --throttling.cpuSlowdownMultiplier=4 --only-categories=performance --chrome-flags="--headless --no-sandbox"
```

For **local builds** (before deploy), serve and test via Network IP (not `localhost` — CORS blocks it):

```bash
npm run build:web:prod
npx serve dist/prod -l 3000 -s
# Use the Network IP from the output, e.g. http://192.168.50.10:3000
```

**Target scores:**
- Desktop: ≥ 70 (current: Home 92, Search 91, Map 89)
- Mobile: ≥ 60 (current: Home 65–68, Search 63–65, Map 62–64)
- Mobile scores are limited by entry bundle size (4.7MB) on Lighthouse 4× CPU throttling

**Important:**
- If port 3000 is occupied: `lsof -ti:3000 | xargs kill -9`
- Add `--output=json --output-path=/tmp/lh-report.json` to save reports for analysis
- If you find unused code during work, remove it.

### Timeout policy

- Do not use forced runtime/UI timeouts longer than `1000ms` to reveal content, hide skeletons, upgrade widgets, or "wait out" hydration/loading issues.
- If rendering or loading is unstable, fix the root cause:
  - remove duplicate requests
  - stabilize layout geometry
  - gate work on real events (`load`, `onLoad`, `IntersectionObserver`, user interaction, `requestIdleCallback`)
  - reserve space instead of delaying UI with timers
- Existing fallbacks in loading/hydration/render paths must stay at `<= 1000ms`.
- Network/request timeouts and explicit debounce/retry logic may exceed `1000ms` only when they are not used to mask UI readiness or visual instability.

### Web loading and hydration policy

- Do not treat Expo/Metro dev-network counts as production truth.
  - `localhost:8081/8082` may show extra `*.bundle?platform=web&dev=true...` requests that do not exist in `dist/prod`.
  - Real request-count, chunk-count, and Lighthouse decisions must be made from `npm run build:web:prod` or from the real production URL.
- Do not “fix” visual instability by adding delayed auto-reveal timers for:
  - headers
  - root chrome
  - hero upgrades
  - below-the-fold sections
  - post-LCP runtime widgets
- Above-the-fold UI must render from the critical shell on first paint.
  - Do not lazy-load desktop header, hero shell, or other first-screen chrome if that creates a second visual frame after the skeleton.
- All sections load immediately on page load — no delays, no waiting for scroll or interaction.
  - Show skeleton placeholders while content loads — page is never blocked.
  - No fallback timers, no IntersectionObserver gating — content starts loading right away.
- On travel pages, the web hero slider/background must appear immediately with the hero once runtime is ready.
  - Do not gate the slider/background on explicit click, pointer interaction, keyboard interaction, or scroll.
  - Keep the first rendered web hero visually complete from the start: main image, blurred side background, and slider chrome must arrive together.
  - This is the canonical behavior, not a temporary optimization.
  - Do not remove, downgrade, or defer the hero/slider blur backdrop just to improve Lighthouse or LCP metrics.
  - If a test expects the web hero slider/background to appear only after user interaction, the test is wrong and must be updated to assert the immediate-mount contract instead.
  - Do not re-introduce interaction-gated hero slider activation on web.
- When using preload scripts and React Query together, avoid duplicate first-load API requests.
  - Reuse the in-flight preload promise or preloaded payload instead of firing a second request for the same travel route.
- If a bug is visible only on web, verify it in a real browser flow.
  - Prefer Playwright or a headed browser capture over reasoning from code alone.
  - For visual loading bugs, inspect both DOM state and network state before changing timing logic.

## UI rules

### Component reuse

- Before creating new UI components or styles, check `components/ui` and existing feature components and reuse them.
- Add new components only when no existing component can be reasonably extended or composed.
- When adding buttons, icons, or small UI primitives, prefer existing `components/ui` primitives (`Button`, `IconButton`, `Chip`) over custom one-offs.

### External link policy

- Do not call `window.open(...)` directly in feature code.
- Do not call `Linking.openURL(...)` directly outside `utils/externalLinks.ts`.
- Use centralized helpers:
  - `openExternalUrl(...)` for standard external navigation.
  - `openExternalUrlInNewTab(...)` for web new-tab flows.
  - `openWebWindow(...)` only for low-level infrastructure cases (single chokepoint).
- CI enforcement:
  - `yarn guard:external-links`
  - `yarn governance:verify`
  - Canonical commands reference: `docs/TESTING.md#governance-commands`
- Allowlist expansion policy:
  - expanding guard allowlists is exceptional and must be temporary;
  - every allowlist expansion PR must include:
    - concrete business/technical reason,
    - risk statement,
    - rollback/removal plan,
    - owner and target removal date.

### Images and placeholders

- Show a placeholder when `imageUrl` is missing or image load fails.
- Placeholder must be neutral:
  - no icons
  - no text like “нет изображения”
  - no emoji
- no bright accent colors
- Placeholder must preserve the same geometry (size/radii) as the real media to avoid layout jumps.
- Images must preserve original aspect ratio (use `contain`) and any unused area should be filled by a blurred version of the same image.
- For web content images that intentionally use `contain + blurBackground` in cards, popups, inline rich-text media, map previews, and similar surfaces, enable the shared-source blur mode (`allowCriticalWebBlur` in `ImageCardMedia`, or `mediaProps.allowCriticalWebBlur` in `UnifiedTravelCard`).
  - The visible image and the blur backdrop must use the same effective image source whenever possible.
  - Sibling sections that use the same card/media pattern must not render different backdrop strength or timing.
- On web, travel hero/gallery media and description images must use the canonical `70vh` height contract.
  - The travel hero slider container on web must resolve to `70vh` and keep that height stable across the first paint and slider handoff.
  - Apply the limit at the authoritative container/layout level, not via ad-hoc per-page overrides.
  - Keep `contain` rendering and blurred surround inside that bounded area.
- For critical web hero/slider media, the blurred surround must reuse the same effective image source as the visible image whenever possible.
  - Do not create a second “blur-only” URL for first-paint hero/slider backdrops if the same source image can be reused.
  - The goal is to avoid a separate background request arriving after the main image and causing a visible second-stage backdrop reveal.
- Blur backdrops must be present in the DOM from the first relevant frame.
  - Fix missing backdrop rendering by correcting source selection or component structure, not by delaying the main image or adding reveal timers.
  - Do not disable slider/hero blur backdrops as a performance optimization; preserve the visual contract and optimize requests/structure instead.
- Keep image geometry stable across skeleton, static hero, and slider handoff.
  - Do not let the slider/background path introduce a different aspect-ratio box or a late background mount.

### Icons

- Avoid emoji in production UI.
- Use a single icon source across the UI (e.g. `@expo/vector-icons`).
- Avoid SVG icon stacks (`react-native-svg`, `lucide-react-native`) in components rendered on web.

#### Allowed icon libraries

- **Preferred (safe on web + native)**
  - `@expo/vector-icons/Feather` (default choice)
- **Allowed with caution**
  - Other `@expo/vector-icons/*` families are allowed only if they are not stubbed for web in `metro-stubs/`.
  - If a family is stubbed (example: `metro-stubs/MaterialCommunityIcons.js`), importing that family on web may actually render a different icon set (and cause runtime errors when `name` does not exist).

#### Rules to avoid runtime icon errors

- Only use icon names that exist in the chosen family.
- Do not copy icon names between families (e.g. `"google-maps"` is not a valid Feather icon name).
- If you need a new icon family:
  - verify it renders correctly on web (no Metro stub override)
  - or use an existing Feather alternative.

#### Web interaction rule (nested buttons)

- On web, avoid putting `Pressable`/`button` elements inside other clickable containers that render as `button`.
- For popup/card action icons inside a clickable card, prefer rendering actions as a `View`/`div` with:
  - `role="button"`, `tabIndex=0`, `onClick`/`onKeyDown`
  - `data-card-action="true"` to prevent card click handlers
  - and `title` for hover tooltips.

### Colors

- Use design tokens (`DESIGN_TOKENS`) instead of hardcoded hex colors.
- Status colors (error/success/warning) must use tokens only.

## Design system

- Tokens live in `constants/designSystem.ts`.
- Web CSS variables live in `app/global.css`.

## Travel card rules

### Stable layout

- Cards must have stable, uniform height within the same list/section.
- Image area uses a fixed height; content area must not cause “jumping”.

### Content rendering

- Author is shown only if `user.name` or `user.display_name` is non-empty.
- Views are shown only if `countUnicIpView > 0`.
- If a field is absent from backend payload, its UI block must not render.

## Documentation rules

- Project documentation lives in `docs/`.
- Keep docs minimal: prefer updating `docs/README.md` and `docs/RULES.md` instead of creating many one-off reports.
- Keep instructions compact and operational:
  - prefer scope-based rules over repeated global commands;
  - avoid duplicate guidance when a single authoritative rule already covers the same behavior.
