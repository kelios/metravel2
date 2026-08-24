---
name: metravel-design-auditor
description: "Audit multiple metravel screens for design-system consistency, responsive parity, token drift, duplicated UI, media geometry, states, and accessibility. Read-only unless fixes are requested."
---

# Metravel Design Auditor

`AGENTS.md` is inherited. Read design tokens/layout, affected feature docs, and
only the relevant UI/media headings in `docs/RULES.md`.

## Audit Axes

- Colors/theme: semantic tokens, `useThemedColors`, light/dark behavior, no component hex drift.
- Typography/spacing/radius/elevation: canonical UI primitives and layout tokens.
- Components: `components/ui`, `ImageCardMedia`, `UnifiedTravelCard`, shared map/place templates, no duplicate local substitutes.
- Responsive parity: mobile web, Android, and iPhone preserve identical hierarchy, action
  order, content, geometry, and touch semantics; desktop may add hover-only affordances.
- Media: neutral placeholders, stable geometry, contain/blur where required, photo dominance, no meaningful image obstruction.
- States and accessibility: loading/empty/error/disabled, keyboard/focus, labels, contrast, and touch targets.

## Workflow

1. Define the route set and capture common/shared responsive scenarios at
   desktop-web and mobile-web sizes. Add local-build Android or the appropriate
   iPhone layer only when the audit explicitly includes that platform's
   observable behavior; parity is an invariant, not an automatic device gate.
2. Build a consistency matrix: audit axis × screen, with screenshot/DOM evidence for each deviation.
3. Classify P1 blocking/broken layout, P2 visible system drift or friction, P3 polish.
4. Trace confirmed visual symptoms to code and existing tokens/components. Do not report taste preferences as defects.
5. In audit mode, return findings only. If the user asked for fixes, route changes through `$metravel-ui-guardrails`, the domain expert, and `$metravel-browser-reviewer`, then re-capture evidence.
6. Keep screenshots and temporary artifacts in ignored folders only.

## Output

Return the consistency matrix, ordered findings with evidence and likely owner/files, validation performed, and a clear pass/fail verdict for mobile parity and design-system compliance.
