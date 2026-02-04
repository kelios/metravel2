# Design system consolidation

## Source of truth

- Tokens: `constants/designSystem.ts` (`DESIGN_TOKENS`)
- Web CSS variables: `app/global.css` (driven by `data-theme`)

## Rules (summary)

- Prefer `DESIGN_TOKENS` over hardcoded colors.
- Avoid importing legacy design modules directly:
  - `@/constants/Colors`
  - `@/constants/designTokens`
  - `@/styles/modernRedesign`
  - `@/constants/airyColors`
  - `@/constants/modernMattePalette` (should only be imported by `constants/designSystem.ts`)

## Migration helpers

- Dry run: `yarn design:migrate:dry`
- Apply: `yarn design:migrate`
- Verify: `yarn design:verify`
