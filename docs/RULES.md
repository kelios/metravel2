# Rules

## Project scope

- Current project is `metravel2`.
- The app codebase root is `metravel2/` (the folder that contains `package.json`).
- Treat `docs/` (this folder) as the source of truth for development rules.

## Development workflow

- Before starting any change, review relevant files in `docs/`.
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
- If you find unused code during work, remove it.

## UI rules

### Component reuse

- Before creating new UI components or styles, check `components/ui` and existing feature components and reuse them.
- Add new components only when no existing component can be reasonably extended or composed.
- When adding buttons, icons, or small UI primitives, prefer existing `components/ui` primitives (`Button`, `IconButton`, `Chip`) over custom one-offs.

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
