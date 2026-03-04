# Docs index

Source of truth: `docs/` (see `docs/RULES.md`).

## Start here (canonical)

- `docs/RULES.md` — mandatory project rules and policies
- `docs/DEVELOPMENT.md` — local setup and day-to-day workflow
- `docs/TESTING.md` — Jest + Playwright (E2E) + CI quality gate
- `docs/MANUAL_QA_RUNBOOK.md` — full manual QA scenarios (P0/P1/P2), including registration, travel CRUD, map/search, profile, messages, legal/cookies
- `docs/TRAVEL_CREATE_FULL_QA_CASE.md` — detailed P0.3 test case for travel creation (all fields, modes, fullscreen map, coordinates, gallery, persistence, filtering)
- `docs/MOBILE_WEB_SCREENSHOT_QA.md` — mobile web screenshot audit scenarios (page-by-page run, report JSON/MD, defect criteria)
- `docs/RELEASE.md` — release/deploy flow
- `docs/PRODUCTION_CHECKLIST.md` — production checklist

## Development and operations

- `docs/README.md` — project docs quick start + API reference
- `docs/MODULE_OWNERS.md` — module ownership matrix

## Policy and PR templates

- `docs/EXTERNAL_LINK_GOVERNANCE_PR_SUMMARY.md` — governance change summary
- `docs/EXTERNAL_LINK_GOVERNANCE_PR_BODY.md` — PR body template

## Auth

- `docs/GOOGLE_OAUTH_SETUP.md` — Google OAuth integration

## Android

- `docs/ANDROID_TODO.md` — нереализованные Android-задачи (App Links, Google Sign-In native, Push, etc.)

## ADRs (Architecture Decision Records)

- `docs/ADR_MAP_ARCHITECTURE.md` — map-core unified contract
- `docs/ADR_STATE_MANAGEMENT.md` — state ownership boundaries (Zustand / Context / React Query)
- `docs/ADR_API_ERROR_CONTRACT.md` — API error normalization and parsing
- `docs/ADR_RNW_TREE_SHAKE.md` — React Native Web tree-shaking (opt-in slim barrel)
