---
name: metravel-feature-builder
description: "Implement, refactor, or debug metravel app, component, hook, service, API, SEO, or feature logic. Use for ordinary frontend changes after selecting any needed domain owner."
---

# Metravel Feature Builder

`AGENTS.md` is inherited. Load only the feature contract and canonical headings
that match the task:

- Read `docs/DEVELOPMENT.md` for local workflow, selective checks, route-point-from-photo flow, and SEO utility usage.
- Read `docs/TESTING.md` when choosing targeted validation.
- Read `docs/features/travel.md`, `docs/features/map.md`, or `docs/features/places.md` for feature-specific work.
- Read `docs/RELEASE.md` only when the task touches release or deployment flow.
- Use `$metravel-domain-router` first when the change is in travel, map, profile, achievements, quests, PDF/export, new pages, or design-system drift.
- Use `$metravel-i18n-guardrails` when the change affects app-owned UI copy,
  accessibility, errors/validation, locale state, formatting, SEO locale, or translations.

Implement the smallest change that solves the task.

Before editing, record
`Platform impact: desktop web | mobile web | Android | iOS | shared | none`
and `Localization impact: RU/BE/UK/PL/EN | selected locales | none`. Treat
shared Expo/React Native code as cross-platform until the platform boundary proves otherwise.

- Before editing, run `git status --short` and keep unrelated user changes separate.
- If the work comes from a FE/BE board task, read its `Task Contract` first. If the contract is missing or does not define scope, Data/API contract, platform/localization impact, dependencies, validation, and Done gate, stop implementation and send it back to refinement.
- Put temporary screenshots, traces, logs, JSON reports, and other debug output only under ignored local folders such as `.codex-temp/` or `.codex-debug/`; remove stale or unnecessary debug artifacts before handoff.
- Reuse existing components, hooks, helpers, and utilities before creating new ones.
- Keep functions and components local, readable, and easy to remove or extend later.
- Remove clearly dead code in the touched area when it is safe to do so.
- Do not edit backend/Django/API/server repositories, files, migrations, tests, or settings from this frontend workspace. If FE is blocked by backend behavior, diagnose read-only and create/update an `area=back` board task instead.
- Fix every real issue found in the touched area or code-level validation output
  before review: failing focused tests, invalid external-link usage, dead imports,
  and obvious source regressions. Runtime/UI failures belong to the subsequent
  `testing` pass and return to implementation with evidence.
- If a found issue is outside scope, requires unavailable server/secret access, or needs a risky migration, record it as a blocker with the concrete risk and next verification instead of ignoring it.
- For FE depending on BE, do not call the task done from mocks or unit tests
  alone; hand the exact endpoint/field/event probe to `testing`, where it is
  verified on the target environment.
- Do not change server paths, SSL paths, or deployment targets unless they were explicitly verified on the server.

For a production incident or any optimization of requests, images, LCP, bundle,
cache, pagination, or API fan-out:

- Capture the real production baseline before editing: exact URL,
  viewport/browser/DPR, auth/cache state, request and API counts, transfer bytes,
  response codes, and rendered versus selected media dimensions.
- Define a numeric page-wide target in the Task Contract. An assertion about one
  component or URL is insufficient when the page can still fan out elsewhere.
- Exercise the real value-construction path in tests; mocking `ImageCardMedia`,
  the URL builder, transport, cache key, or pagination primitive under
  investigation is not contract evidence.
- After an authorized deploy, repeat the same production probe and compare
  before/after, including initial viewport, scroll/lazy behavior, duplicate URL
  variants, oversized/unsized media, and 4xx/5xx.
- Without a deployed live-URL rerun, never claim the production problem is
  fixed. When that rerun is mandatory for acceptance, request exact deploy
  authorization/result and resume after it; do not finish by parking the board
  task in `testing`.
- When shared media/source/pagination code changes, audit adjacent consumers and
  add or link a regression guard for the problem family instead of accepting a
  consumer-only point fix as the durable solution.

Follow these repo-specific rules while building features:

- Use repo-root commands from the folder with `package.json`.
- Keep external navigation inside `utils/externalLinks.ts` helpers; do not call `window.open(...)` or `Linking.openURL(...)` directly in feature code.
- Use design tokens from `constants/designSystem.ts`; do not hardcode hex colors in components.
- For new pages or SEO-bearing screens, use centralized SEO helpers from `docs/DEVELOPMENT.md`: `buildCanonicalUrl`, `buildOgImageUrl`, and `components/seo/LazyInstantSEO`.
- For `/places`, preserve the point-level contract from `docs/features/places.md`: render places/coordinates, not travel cards; keep country/category/search filters, 20-item incremental loading, map focus links, and centralized external-link helpers.
- For route-point-from-photo work, preserve the documented flow in `docs/DEVELOPMENT.md`: keep local `blob:` preview in UI state, never send `blob:` URLs to backend, and upload the real point photo after the backend returns a point id.
- For e2e auth or test accounts, use `.env.e2e` values if they already exist; never print secrets.
- Localize new app-owned UI through `@/i18n`, add new keys to RU/BE/UK/PL/EN,
  and use `i18n/format.ts` instead of hardcoded locale formatting. Do not
  client-translate API/editorial content without a separate data contract.

Choose code-level validation by scope after each finished logical block and
before code review:

- Small focused change: run targeted checks for the touched area. Prefer `npm run check:fast` for a finished local block, plus any narrow test command that directly covers the feature.
- Need to inspect the scope before running checks: use `npm run check:fast:dry` or `npm run check:changed:dry`.
- Medium change: run the relevant targeted tests plus lint/selective checks for the affected module set.
- Large or cross-cutting change: run `npm run lint` and `npm run test:run`.
- If the change affects visible web UI, write the exact browser flow, screenshot
  viewport, and console/network expectations for the `testing` handoff; do not
  open a browser during implementation or review.
- If the change affects visible common/shared responsive UI, hand desktop web
  and mobile web scenarios to `testing`. Add a local Android or iPhone scenario
  only for corresponding platform-specific scope; the tester runs it after
  code-review pass.
- If localization is affected, run `npm run test:i18n` and verify the changed
  locale resources statically. Hand affected observable locale and native
  cold-restart/lifecycle scenarios to `testing` only when that platform's
  locale storage, provider, configuration, or runtime behavior changed.

After code-level self-checks, use `$metravel-code-reviewer` on the complete
task-owned diff. Pass the original task, changed paths, and static/unit/guard
evidence to a dedicated `review-auditor` agent when available. Let the reviewer
patch confirmed findings, re-read the complete resulting diff, and rerun only
code-level checks. After pass/push/status=`testing`, route observable browser,
API, simulator, and device scenarios to QA. Do not include or rewrite unrelated
dirty worktree changes.

Avoid dev-environment false positives:

- Missing production-hosted media in local dev is not automatically a frontend bug.
- Do not infer production network or chunk behavior from Expo dev bundles; use `npm run build:web:prod` or production URL checks for real web performance conclusions.
