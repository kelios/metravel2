## Context

The web and native apps share code and dependencies. Store builds have additional platform configuration, device smoke and artifact checks.

## Goals / Non-Goals

- Use one quality lock and one test selector for both native source gates.
- Preserve separate device, signed artifact and store authorization stages.
- Keep the web command compatible for its existing callers.

## Decisions

Use the existing Jest configuration and run named shared contracts plus native and target-specific test files. A platform marker takes precedence over a shared native marker. Test selection must exclude the web and server renderer families by scope. Keep the existing shared typecheck and dependency audit. Android runs its local toolchain doctor. iOS runs its source release and store-listing guards.

## Risks / Trade-offs

A shared test with an unmarked filename needs an explicit entry if it guards a release-critical contract. A focused selector test protects the platform boundary. Rollback removes the two new commands and restores the operator runbook references.
