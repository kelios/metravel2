# Design system consolidation

## Source of truth

- Tokens: `constants/designSystem.ts` (`DESIGN_TOKENS`)
- Web CSS variables: `app/global.css` (driven by `data-theme`)

## Status: ✅ Migration complete (Feb 2026)

Legacy files have been deleted:
- `constants/Colors.ts`
- `constants/designTokens.ts`
- `constants/airyColors.ts`
- `constants/lightModernDesignTokens.ts`
- `styles/modernRedesign.ts`
- `src/theme.ts`

Remaining internal module (not for direct import):
- `constants/modernMattePalette.ts` — only imported by `constants/designSystem.ts`

## Rules

- Use `DESIGN_TOKENS` for all colors, spacing, typography.
- Do not create new color/design files — extend `constants/designSystem.ts`.

## Migration helpers (kept for reference)

- Dry run: `yarn design:migrate:dry`
- Apply: `yarn design:migrate`
- Verify: `yarn design:verify`
