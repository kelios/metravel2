## Context

See `proposal.md` and `docs/design/advent-2026-approved.md`. Existing shared RN campaign hooks already provide 27 real door states, today's door, callbacks, auth boundaries, sync and query-param return. The current grid alone owns the replaceable 3/6-column visual layout. Work proceeds in a dirty shared main checkout with unrelated home/base-theme edits.

## Goals / Non-Goals

**Goals:** faithfully implement the approved house/window lighting and compact Christmas mark with existing UI/media primitives, stable first-render geometry and local art. Preserve campaign and sheet behavior.

**Non-Goals:** new business stores, credit rules, backend work, future-date production bypasses, editorial changes, a global home redesign or store builds.

## Decisions

1. Keep `AdventScreen` as the real integration owner and preserve its opening callback, hydration/locked gates, deep links and test IDs. The renderer receives existing door views; a separate demo progression model is rejected.
2. Use a shared RN house component with invariant 2:3 geometry and percentage targets from the approved facade. This avoids `onLayout`/viewport hydration shifts. Split 24 main and three bonus doors at the presentation boundary, preserving campaign IDs. Remove obsolete advent grid critical CSS registration only if no consumer remains.
3. Render local artwork through `ImageCardMedia`, including the facade and four technically sliced frost variants. Use a shared translucent glaze and existing linear-gradient support for moonlight; do not port CSS `backdrop-filter`, blend modes or `cqw` into a native-specific renderer. Exact browser blur is secondary to matching the approved dim/frost/clear states on all shared consumers.
4. Centralize the artwork sources and fixed illustration palette in `constants/adventVisuals.ts`. Import the house pack only from advent; importing it through the global logo is rejected because previous advent work changed `/search` initial chunking.
5. Preserve canonical media geometry and use an image-identity-scoped failure state for optional gift images. No image means no media container, rather than a permanent placeholder. Add an opt-in canonical `onTerminalError` callback after existing retry exhaustion; preserve the current `onError` notification and all retry policy for existing consumers.
6. Implement cap/tree as a small shared, non-interactive brand accessory using local code-authored decorative assets. Keep the original bird source/preload and route/header ownership. Limit global CSS edits to Christmas-specific selectors; do not modify the separately owned base theme or HomeHero.
7. Keep new visible/a11y labels in five existing locale resources and reuse existing copy where possible. Never translate campaign prose on the client or add narrative window tooltips.

## Risks / Trade-offs

- [Artwork/target alignment] → one source geometry table, asset dimension check and targeted mobile/desktop screenshots.
- [Touch target overlap] → preserve at least 44px effective phone targets and test neighbouring windows against the narrow house width.
- [Native/web visual differences] → shared RN rendering and static frost assets; any later platform-only renderer adds an explicit matching runtime gate.
- [Shared checkout contamination] → explicit-path stage/commit, no unrelated hunks, isolated project deployment worktree.
- [Performance/chunk regression] → advent-only artwork imports, compressed local media and existing initial-render/loading contracts; no animation/particle libraries.
- [Future server dates] → production acceptance distinguishes real current-date gates from client-clock guest visual preview; existing temporal backend/progression testing remains separate.

## Migration Plan

Implement the three linked FE cards as one train, run relevant static/unit checks, obtain independent review-and-fix and the required code-review gate. Commit/push only task paths, move the train to testing, deploy the exact SHA via the canonical frontend operator, then accept the published UI in mobile and desktop browsers. Roll back the task commit through the existing publication mechanism if the changed surface fails acceptance. No data migration is required.
