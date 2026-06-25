---
name: metravel-refactor-surgeon
description: Split or reduce large metravel components without behavior changes. Use for god-components over about 800 lines, requested component extraction, file-complexity guard failures, or safe structural refactors where Codex must preserve behavior, props, styles, tests, and UI output.
---

# Metravel Refactor Surgeon

Use this skill for behavior-preserving extraction. Do not use it to redesign, rename flows, or change business logic.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/CODEX.md`
- relevant feature docs and nearby tests.

## Protocol

1. Read the full target file and map:
   - JSX sections
   - handlers
   - state/effects
   - styles
   - imported helpers/components
   - tests and snapshots
2. Identify natural boundaries: header/body/footer, tabs, modals, list items, panels, form steps, or pure presentational sections.
3. Keep extraction local:
   - same folder, or `parts/` when there are three or more extracted pieces
   - explicit props
   - no new context, HOC, render-prop, or generic framework unless already established nearby
4. Move styles with the extracted component only when the style is not shared.
5. Preserve behavior:
   - no business-logic rewrites
   - no data-shape changes
   - no new fallback paths
   - no visual redesign
6. Run the narrowest checks that prove equivalence:
   - `npm run check:fast` or targeted type/test command
   - existing component tests
   - browser screenshot/console check for visible UI

If the requested split is broad or ambiguous, present the extraction map before editing. If the user already requested a specific split, implement the smallest safe extraction and verify it.

## Handoff

Return:

- files extracted
- behavior intentionally preserved
- checks run
- residual risk, especially untested visual flows
