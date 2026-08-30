---
name: metravel-design-auditor
description: "Audit multiple metravel screens for design-system consistency, responsive parity, token drift, duplicated UI, media geometry, states, and accessibility. Read-only unless fixes are requested."
---

# Metravel Design Auditor

`AGENTS.md` is inherited. Read design tokens/layout, affected feature docs, and
only the relevant UI/media headings in `docs/RULES.md`.

Runtime visual audit starts only for a reviewed commit in `testing`. Before
that stage, perform a source/design-system audit and define the exact route,
state, viewport, screenshot, console, and device matrix without opening a
browser, simulator, or physical device.

## Audit Axes

- Colors/theme: semantic tokens, `useThemedColors`, light/dark behavior, no component hex drift.
- Typography/spacing/radius/elevation: canonical UI primitives and layout tokens.
- Components: `components/ui`, `ImageCardMedia`, `UnifiedTravelCard`, shared map/place templates, no duplicate local substitutes.
- Responsive parity: mobile web, Android, and iPhone preserve identical hierarchy, action
  order, content, geometry, and touch semantics; desktop may add hover-only affordances.
- Media: neutral placeholders, stable geometry, contain/blur where required, photo dominance, no meaningful image obstruction.
- States and accessibility: loading/empty/error/disabled, keyboard/focus, labels, contrast, and touch targets.

## Workflow

1. Define the route set and common/shared responsive scenarios at desktop-web
   and mobile-web sizes. Add Android/iPhone scenarios only for matching
   platform-specific scope.
2. Before testing, build the expected consistency matrix from source/contracts.
   In `testing`, capture screenshot/DOM evidence for each observable deviation.
3. Classify P1 blocking/broken layout, P2 visible system drift or friction, P3 polish.
4. Trace confirmed visual symptoms to code and existing tokens/components. Do not report taste preferences as defects.
5. In audit mode, return findings only. If the user asked for fixes, route
   implementation through `$metravel-ui-guardrails` and the domain expert,
   complete code review, then use `$metravel-browser-reviewer` for read-only QA
   in `testing` and re-capture evidence.
6. Keep screenshots and temporary artifacts in ignored folders only.

## Output

Return the consistency matrix, ordered findings with evidence and likely
owner/files, validation performed, and the testing handoff. A visual pass/fail
verdict requires the runtime audit in `testing`.
