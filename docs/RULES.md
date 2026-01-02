# Rules

## Development workflow

- Before starting any change, review relevant files in `docs/`.
- After each logical change, run:

```bash
npm run lint
npm run test
```

## UI rules

### Images and placeholders

- Show a placeholder when `imageUrl` is missing or image load fails.
- Placeholder must be neutral:
  - no icons
  - no text like “нет изображения”
  - no emoji
  - no bright accent colors
- Placeholder must preserve the same geometry (size/radii) as the real media to avoid layout jumps.

### Icons

- Avoid emoji in production UI.
- Use a single icon source across the UI (e.g. `@expo/vector-icons`).
- Avoid SVG icon stacks (`react-native-svg`, `lucide-react-native`) in components rendered on web.

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
