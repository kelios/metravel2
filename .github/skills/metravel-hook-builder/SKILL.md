---
name: metravel-hook-builder
description: Design, extract, and refine focused React hooks for metravel features without breaking public contracts. Use when Codex needs to move local logic into hooks, simplify components, or improve reuse across `hooks/` and feature modules.
---

# Metravel Hook Builder

Read `AGENTS.md`, `docs/RULES.md`, `docs/DEVELOPMENT.md`, `docs/CODEX.md`, and the relevant feature doc from `docs/features/` before changing hook architecture.

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
- If the hook affects visible web behavior, verify the scenario in a real browser too.

