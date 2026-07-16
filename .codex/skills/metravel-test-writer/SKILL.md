---
name: metravel-test-writer
description: Write or update metravel unit, integration, or governance tests that lock real behavior, follow the nearest existing test style, avoid flaky assertions, and never use skipped tests as a shortcut.
---

# Metravel Test Writer

Read `AGENTS.md`, `docs/RULES.md`, `docs/TESTING.md`, `docs/CODEX.md`, and the relevant feature doc from `docs/features/` before adding or changing tests.

Use this skill when the task is to add or update tests for a bug fix, refactor, feature, or governance contract.

## Writing rules

- Prefer the nearest existing test suite and assertion style instead of inventing a new harness.
- Test the real contract at the closest reliable level: unit first, integration when boundaries matter, governance when repo rules are the contract.
- Keep tests deterministic: avoid timing hacks, broad sleeps, and assertions that depend on unstable incidental markup.
- Do not add `.skip` or leave flaky coverage behind.
- If the code path is browser-only or interaction-heavy, coordinate with `$metravel-e2e-runner` instead of forcing weak unit coverage.
- For shared code, cover the platform boundary instead of assuming a desktop or
  mobile web unit test proves Android behavior. Keep technical platform
  differences explicit and pair mobile-web coverage with Android evidence.
- For localization, follow `$metravel-i18n-guardrails`: assert RU/BE/UK/PL/EN
  resource parity, locale persistence, formatting/plurals, SSR/hydration, and
  native lifecycle at the nearest reliable level without snapshotting whole catalogs.

## Repo specifics

- Use `__tests__/` for Jest coverage and `e2e/` only when the requested test truly belongs in Playwright.
- Preserve project policies around external links, image architecture, immediate web hero behavior, and no direct cache-busting workarounds.
- When updating governance-sensitive tests, keep docs and command references in sync.
- Keep `__tests__/i18n/uiLiteralGovernance.test.ts` strict; fix app-owned copy
  through translation resources instead of expanding allowlists without a data-contract reason.

## Validation

- Run the smallest command that proves the new or updated test passes.
- Rerun the same command after each relevant fix.
- For larger test changes, escalate to `npm run check:fast`, `npm run check:preflight`, or the full suite by scope.
