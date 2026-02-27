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
- After each logical change, run:

```bash
npm run lint
npm run test:run
```

- Always run `npm run lint` and `npm run test:run` at the end of a task to verify nothing broke.
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
