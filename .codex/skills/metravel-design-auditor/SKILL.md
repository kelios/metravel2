---
name: metravel-design-auditor
description: Audit metravel screens for cross-page design-system consistency, responsive/mobile parity, token drift, duplicated UI patterns, image/card/header geometry, accessibility, and inconsistent empty/loading/error states. Use for design audits, UI/UX reviews across multiple screens, design-system cleanup discovery, or evidence-backed consistency matrices. Stay read-only unless the user explicitly asks to fix findings.
---

# Metravel Design Auditor

Read `AGENTS.md`, `docs/RULES.md`, `docs/CODEX.md`, `constants/designSystem.ts`, `constants/layout.ts`, and the relevant feature docs.

## Audit Axes

- Colors/theme: semantic tokens, `useThemedColors`, light/dark behavior, no component hex drift.
- Typography/spacing/radius/elevation: canonical UI primitives and layout tokens.
- Components: `components/ui`, `ImageCardMedia`, `UnifiedTravelCard`, shared map/place templates, no duplicate local substitutes.
- Responsive parity: mobile web, Android, and iOS preserve hierarchy, action order, content, and touch semantics; desktop may add hover-only affordances.
- Media: neutral placeholders, stable geometry, contain/blur where required, photo dominance, no meaningful image obstruction.
- States and accessibility: loading/empty/error/disabled, keyboard/focus, labels, contrast, and touch targets.

## Workflow

1. Define the route set and capture the same scenarios at mobile web and desktop sizes; add local-build device evidence when native parity is in scope.
2. Build a consistency matrix: audit axis × screen, with screenshot/DOM evidence for each deviation.
3. Classify P1 blocking/broken layout, P2 visible system drift or friction, P3 polish.
4. Trace confirmed visual symptoms to code and existing tokens/components. Do not report taste preferences as defects.
5. In audit mode, return findings only. If the user asked for fixes, route changes through `$metravel-ui-guardrails`, the domain expert, and `$metravel-browser-reviewer`, then re-capture evidence.
6. Keep screenshots and temporary artifacts in ignored folders only.

## Output

Return the consistency matrix, ordered findings with evidence and likely owner/files, validation performed, and a clear pass/fail verdict for mobile parity and design-system compliance.
