---
name: metravel-hook-builder
description: "Design, extract, or simplify focused metravel React hooks without breaking public contracts. Use for hook-boundary cleanup, local logic extraction, or proven reuse."
---

# Metravel Hook Builder

`AGENTS.md` is inherited. Read the relevant feature contract, nearest hooks and
callers, plus only the state/query guidance needed from `docs/DEVELOPMENT.md`.

## When to use

- Extracting bulky component logic into a focused hook
- Simplifying repeated feature logic already used in multiple places
- Refactoring existing hooks in `hooks/` or feature-local hook files
- Clarifying boundaries between React Query server state, Zustand client state, and local UI state

## Hook rules

- Prefer the smallest focused hook over generic one-off abstractions.
- Keep hook names explicit and feature-oriented.
- Preserve current public contracts unless the task explicitly changes them.
- Do not add new `any` in `hooks/`.
- Keep TanStack Query in `api/*Queries.ts` and Zustand in `stores/`; do not hide the wrong state layer inside a hook just for convenience.
- If logic is only local to one feature, a feature-local hook is preferable to a global utility hook.

## Validation

- Update or add the nearest relevant tests when hook behavior changes.
- Run the narrowest reliable checks for the touched hook and its main consumer.
- If the hook affects visible web behavior, define the real-browser scenario for
  testing after code review; do not open a browser during implementation/review.
