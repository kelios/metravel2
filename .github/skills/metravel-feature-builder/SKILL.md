---
name: metravel-feature-builder
description: Implement, refactor, or debug features in the metravel Expo/React Native Web codebase. Use when Codex needs project-specific guidance for app, components, hooks, services, API flows, SEO wiring, or feature logic and must follow docs-first workflow, reuse-first coding, fix-all-found-real-issues discipline, and scope-based validation in this repository.
---

# Metravel Feature Builder

Read `AGENTS.md`, `docs/RULES.md`, `docs/README.md`, and the task triage section in `docs/CODEX.md` before changing code. Then load only the extra docs that match the task:

- Read `docs/DEVELOPMENT.md` for local workflow, selective checks, route-point-from-photo flow, and SEO utility usage.
- Read `docs/TESTING.md` when choosing targeted validation.
- Read `docs/features/travel.md`, `docs/features/map.md`, or `docs/features/places.md` for feature-specific work.
- Read `docs/RELEASE.md` only when the task touches release or deployment flow.
- Use `$metravel-i18n-guardrails` for app-owned UI copy, accessibility,
  locale state/formatting, SEO locale, or translation resources.

Implement the smallest change that solves the task.

Before editing, record `Platform impact: web | Android | iOS | shared | none`
and `Localization impact: RU/BE/UK/PL/EN | selected locales | none`.

- Before editing, run `git status --short` and keep unrelated user changes separate.
- Put temporary screenshots, traces, logs, JSON reports, and other debug output only under ignored local folders such as `.codex-temp/` or `.codex-debug/`; remove stale or unnecessary debug artifacts before handoff.
- Reuse existing components, hooks, helpers, and utilities before creating new ones.
- Keep functions and components local, readable, and easy to remove or extend later.
- Remove clearly dead code in the touched area when it is safe to do so.
- Fix every real issue found in the touched area or validation output before handoff: failing tests, runtime errors, broken UI states, invalid external-link usage, dead imports, and obvious regressions.
- If a found issue is outside scope, requires unavailable server/secret access, or needs a risky migration, record it as a blocker with the concrete risk and next verification instead of ignoring it.
- Do not change server paths, SSL paths, or deployment targets unless they were explicitly verified on the server.

Follow these repo-specific rules while building features:

- Use repo-root commands from the folder with `package.json`.
- Keep external navigation inside `utils/externalLinks.ts` helpers; do not call `window.open(...)` or `Linking.openURL(...)` directly in feature code.
- Use design tokens from `constants/designSystem.ts`; do not hardcode hex colors in components.
- For new pages or SEO-bearing screens, use centralized SEO helpers from `docs/DEVELOPMENT.md`: `buildCanonicalUrl`, `buildOgImageUrl`, and `components/seo/LazyInstantSEO`.
- For `/places`, preserve the point-level contract from `docs/features/places.md`: render places/coordinates, not travel cards; keep country/category/search filters, 20-item incremental loading, map focus links, and centralized external-link helpers.
- For route-point-from-photo work, preserve the documented flow in `docs/DEVELOPMENT.md`: keep local `blob:` preview in UI state, never send `blob:` URLs to backend, and upload the real point photo after the backend returns a point id.
- For e2e auth or test accounts, use `.env.e2e` values if they already exist; never print secrets.
- Localize app-owned UI through `@/i18n`, keep RU/BE/UK/PL/EN keys complete,
  and use `i18n/format.ts` for locale-sensitive output.

Choose validation by scope after each finished logical block and before wrapping up:

- Small focused change: run targeted checks for the touched area. Prefer `npm run check:fast` for a finished local block, plus any narrow test command that directly covers the feature.
- Need to inspect the scope before running checks: use `npm run check:fast:dry` or `npm run check:changed:dry`.
- Medium change: run the relevant targeted tests plus lint/selective checks for the affected module set.
- Large or cross-cutting change: run `npm run lint` and `npm run test:run`.
- If the change affects visible web UI, verify it in a real browser flow, capture a screenshot, and confirm the browser console has no new errors.
- If localization is affected, run `npm run test:i18n`; shared native scope needs
  separate Android/iOS evidence or an exact `verify pending` blocker.

Avoid dev-environment false positives:

- Missing production-hosted media in local dev is not automatically a frontend bug.
- Do not infer production network or chunk behavior from Expo dev bundles; use `npm run build:web:prod` or production URL checks for real web performance conclusions.
