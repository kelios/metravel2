## Why

MeTravel has separate exploratory QA instructions, web tests and native suites. A reusable reviewer should turn a user goal into evidence and deduplicated findings in one manually started Codex session, with no incremental service charges.

## What Changes

- Add a discoverable `qa-ux-reviewer` agent for goal-driven exploration, independent replay and reporting.
- Start with mobile and desktop web. Support targeted Android emulator and iOS simulator runs using an available local test build.
- Use the existing MeTravel board workflow for confirmed defects when publication is requested.
- Reuse installed tools and test accounts. Limit the pilot to local execution and manually initiated sessions.

## Capabilities

### New Capabilities

- `local-ai-qa-reviewer`: Cost-bounded exploratory QA, replay and issue handoff from Codex.

### Modified Capabilities

None.

## Impact

- Platform impact: desktop web, mobile web, Android emulator and iOS simulator QA. No app changes.
- Localization impact: none to resources. Start in RU and select other supported locales when relevant.
- Reuse Playwright, Maestro, axe-core, feature contracts and board operators. No app API, SEO, performance or analytics changes. Accessibility is an evidence surface.
- Use isolated test data for write flows and redact artifacts. A missing runner, account or fixture limits coverage. Mock evidence proves only the mocked scenario.
