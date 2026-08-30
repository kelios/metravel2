---
name: metravel-test-writer
description: "Write or update metravel unit, integration, or governance tests for a real behavior or regression. Use for new coverage, broken tests, or flaky assertions."
---

# Metravel Test Writer

`AGENTS.md` is inherited. Read the nearest tests, the matching feature contract,
and only the relevant section of `docs/TESTING.md`.

Use this skill when the task is to add or update tests for a bug fix, refactor, feature, or governance contract.

## Writing rules

- Prefer the nearest existing test suite and assertion style instead of inventing a new harness.
- Test the real contract at the closest reliable level: unit first, integration when boundaries matter, governance when repo rules are the contract.
- Keep tests deterministic: avoid timing hacks, broad sleeps, and assertions that depend on unstable incidental markup.
- Do not add `.skip` or leave flaky coverage behind.
- If the code path is browser-only or interaction-heavy, author the Playwright
  coverage and hand execution to `$metravel-e2e-runner` after code review in
  `testing` instead of forcing weak unit coverage.
- For shared code, cover the platform boundary instead of assuming a desktop or
  mobile-web unit test proves native behavior. Keep technical platform
  differences explicit; add Android or iPhone runtime scenarios only when the
  task changes that platform's observable behavior/configuration/runtime, and
  execute them only in `testing`.
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

- For Jest/static tests, run the smallest command that proves the new or updated
  test passes. For Playwright/e2e, run only type/static checks before review and
  hand actual browser execution to `testing`.
- Rerun the same command after each relevant fix.
- For larger test changes before review, escalate only to code-level checks;
  `check:preflight`/e2e execution belongs to `testing`.
