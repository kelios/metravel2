# Design system

This document records product-level design-token decisions that are too broad for
one component but too specific for `docs/RULES.md`.

## Orange accents

Status: accepted, 2026-07-02.

The project keeps one orange family with explicit semantic roles instead of
collapsing all orange values into a single token. The values are intentionally
close, but they are not interchangeable:

| Token | Value | Role |
| --- | --- | --- |
| `brand` | `#f5842c` | Primary warm orange for brand marks, logo-adjacent accents, and non-text visual emphasis. |
| `brandDark` | `#e07020` | Hover/active depth for brand accents. |
| `brandText` | `#b35900` | Orange text on light surfaces; use instead of `brand` for readable text and icons. |
| `brandLight` | `#fff8f3` | Warm brand-tinted background. |
| `brandSoft` | `rgba(245, 132, 44, 0.10)` | Soft brand highlight. |
| `bookPageAccent` | `#b35900` | Static accent for always-light book-page surfaces. |
| `travelPoint` | `#ff922b` | Travel-point/category marker accent. |
| `mapPin` | `#ff8a00` | Map pin accent that must remain legible against OSM/Leaflet tiles. |

Decision:

- Keep `travelPoint` and `mapPin` as separate semantic tokens. They represent
  map/travel affordances, not general brand CTAs.
- Do not use raw Tailwind amber/orange hex values in app components. New orange
  UI should choose an existing semantic token first.
- Use `brandText` or `bookPageAccent` for orange text on light surfaces. Do not
  use `brand` as text on light backgrounds.
- If a future screen needs a new orange role, add a named token with a documented
  semantic purpose instead of adding an ad-hoc hex literal.

Sources:

- Runtime tokens: `constants/designSystem.ts`
- Palette values: `constants/modernMattePalette.ts`
- Web CSS variables: `app/global.css`

## Primary foreground contrast

Status: accepted, 2026-07-02.

The light-theme `primary` token (`#7a9d8f`) is kept unchanged as a brand/UI
surface accent. It is not the default foreground color for text or icons on
light surfaces because its contrast against white is below the project target
for foreground UI.

Use these roles instead:

| Role | Token | Contrast target |
| --- | --- | --- |
| Text and links on light surfaces | `primaryText` (`#547769`) | WCAG AA for normal text. |
| Icons, active glyphs, and small foreground UI | `primaryDark` (`#6a8d7f`) | At least 3:1 for non-text UI. |
| Backgrounds, fills, progress, and soft accent surfaces | `primary`, `primaryLight`, `primarySoft` | Not foreground text. |

Decision:

- Do not darken `primary` globally without an explicit owner decision; it is a
  broad brand-token change.
- New text-style declarations should use `primaryText`, not `primary`.
- New icon/glyph props should use `primaryDark`, not `primary`, unless the icon
  sits on a dark surface where the themed runtime color already provides enough
  contrast.

## Intentional exceptions to the canonical `ui/Button`

Status: accepted, 2026-07-19.

`components/ui/Button.tsx` is the canonical button primitive. It exposes only
**semantic** variant colors (`primary`, `secondary`, `ghost`, `danger`,
`outline`, `soft`, `danger-outline`) and a single icon slot (`icon` +
`iconPosition`). This is by design: the primitive intentionally does not carry
per-brand colors outside the semantic palette, and does not carry transient
self-toggling states. New buttons should use the primitive unless they are
listed below as a documented exception.

### `components/travel/ShareButtons.tsx`

Status: accepted exception, task #1013 (FE-BTN-1).

`ShareButtons` stays a context-specific component and is **not** migrated to
`ui/Button`. Rationale, grounded in the current implementation:

- **Per-brand icon color, not a semantic variant.** Each share action paints its
  `Feather` icon with a brand-specific color drawn from a `palette` `useMemo`
  (`export` → warning/accent, `telegram` → accent, `vk` → info, `whatsapp` →
  success) on a shared neutral surface. These are brand affordances, not the
  semantic role colors the canonical `Button` exposes, so they fall outside the
  primitive's palette by design.
- **Transient success toggle.** The copy action carries an ephemeral "copied"
  state (`copied` flag + a timer that clears it after ~2s), swapping the tile to
  the `buttonCopied` style (`colors.successSoft` background) and rendering a
  `Feather name="check"` glyph. The canonical `Button` deliberately has no
  self-toggling success state.
- **Multi-mode composition.** The component renders in two layouts — a `sticky`
  icon-only round variant and a grouped icon+label variant with sections
  (including a dedicated PDF-export group) — plus a collapsed mode on mobile and
  a lazily loaded PDF-export bridge. This layout/state machinery is specific to
  the share affordance and is not something the single-shape primitive models.

Because these requirements sit outside the canonical `Button`'s semantic,
single-icon, stateless contract, `ShareButtons` is kept as a deliberate
exception rather than forced onto the primitive. If the primitive later grows a
brand-color or transient-state contract, revisit this entry.

New exceptions should be added here with the same shape — component path, the
specific contract it needs that the primitive does not provide, and the task
reference — so that "why isn't this a `ui/Button`?" always has a documented
answer.
