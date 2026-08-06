<!--
Sync Impact Report
- Version change: none → 1.0.0 (initial ratification)
- Modified principles: none (initial adoption; no prior version existed)
- Added sections:
  - Core Principles I–X
  - Platform, Localization and Ownership Constraints
  - Development Workflow and Quality Gates
  - Governance
- Removed sections: none
- Templates requiring review:
  - .specify/templates/spec-template.md — left vendor-managed; MeTravel-mandatory
    sections are enforced by docs/spec-driven-development-requirements.md
  - .specify/templates/plan-template.md — no change required
  - .specify/templates/tasks-template.md — no change required
- Deferred items: none. No TODO placeholders remain.
-->

# MeTravel Constitution

This constitution governs Spec-Driven Development for **metravel.by**. It is
subordinate to `AGENTS.md` and `docs/RULES.md`: where this document and
`docs/RULES.md` disagree, `docs/RULES.md` wins and this file MUST be amended to
match. Commands quoted here are real scripts in `package.json`.

## Core Principles

### I. Existing Production System First

metravel.by is a live production application with real users and indexed
content. It is not a greenfield project.

- Changes MUST be minimal and local to the area named by the specification.
- Refactoring unrelated to the specification is FORBIDDEN. If unrelated debt is
  found, list it in the report and stop there; do not fix it in the same change.
- Existing user-facing behavior MUST be preserved unless the specification
  explicitly requires changing it. A behavior change that is not written in
  `spec.md` is a defect, not an improvement.
- Big-bang rewrites are FORBIDDEN. Reduce file size and coupling by extracting
  focused hooks, helpers, or components instead.
- Protected files (`eas.json`, `app.json`, `.github/workflows/`, `nginx/`,
  `plugins/`, `scripts/`, `public/robots.txt`, `public/sitemap.xml`, `entry.js`)
  MUST NOT be edited unless the user's request puts that file or its behavior in
  scope. Incidental cleanup of these files is FORBIDDEN.

### II. Reuse Before Creation

- Before adding any component, hook, utility, service, or dependency, search the
  repository for an existing one and state in `plan.md` what was searched and
  what was found.
- UI primitives MUST come from `components/ui` (`Button`, `IconButton`, `Chip`,
  `ToolActionsRow`) before any one-off is written.
- Images in feature components MUST go through `components/ui/ImageCardMedia.tsx`.
  Travel cards MUST go through `components/ui/UnifiedTravelCard.tsx`.
- Server state MUST use TanStack Query via `api/*Queries.ts`. Client state MUST
  use Zustand via `stores/`. Do not introduce a third state mechanism.
- External links MUST go through `@/utils/externalLinks`. Direct `window.open(...)`
  and direct `Linking.openURL(...)` outside `utils/externalLinks.ts` are
  FORBIDDEN and are enforced by `yarn guard:external-links`.
- Imports MUST use the `@/` alias.
- A new runtime dependency requires a written justification in `plan.md` naming
  the rejected in-repo alternative, the bundle-size cost, and the native/web
  compatibility impact. Without that justification, adding a dependency is
  FORBIDDEN.
- Frontend and backend MUST NOT be changed together merely for convenience. Split
  the work unless the specification requires one atomic contract change.

### III. SEO Is a Release Gate

- Public URLs MUST NOT regress. Renaming or removing a route requires a 301
  redirect in the same change.
- Redirects, canonical URLs, `sitemap.xml`, `robots.txt`, structured data, and
  `title`/`meta description` MUST be preserved unless the specification changes
  them explicitly.
- A page that is indexable today MUST NOT become `noindex`, blocked, or
  soft-404 as a side effect.
- Any routing change MUST include an "SEO impact" section in `spec.md` naming
  the affected URLs and the redirect plan.
- SSG/prerender output MUST keep serving crawlable content; do not replace a
  prerendered shell with a client-only placeholder.
- Verify with `yarn test:seo:prod` (or `yarn test:seo:postdeploy` after deploy)
  when routes, metadata, or prerendering are touched.

### IV. Performance and Image Discipline

- Core Web Vitals MUST NOT regress. Measurements MUST come from a production
  export (`yarn build:web:prod`) or the real production URL — never from the
  Metro dev server, whose `dev=true` bundle requests are not production truth.
- One visual image slot MUST resolve to exactly one effective network URI, and
  on web exactly one raster. A second blur-only URL, `blurSrc`, `blurSource`, or
  CSS `background-image` backdrop is FORBIDDEN.
- Letterbox fill MUST come from `utils/mediaPlaceholderIndex.ts` and nowhere
  else. Enforced by `yarn check:image-architecture`.
- Images MUST preserve aspect ratio (`contain`) and MUST reserve stable geometry
  across skeleton, static hero, and slider handoff so no layout shift occurs.
- A placeholder MUST render when `imageUrl` is missing or loading fails. It MUST
  be neutral: no icon, no text, no emoji, no bright accent color, and the same
  size and radii as the real media.
- Duplicate requests for the same resource are FORBIDDEN. Reuse the in-flight
  preload promise instead of firing a second request.
- Forced UI timeouts above `1000ms` to reveal content, hide skeletons, or wait
  out hydration are FORBIDDEN. Gate on real events (`load`, `onLoad`,
  `IntersectionObserver`, interaction, `requestIdleCallback`) or reserve space.
- Lazy loading is allowed only below the fold and only where it does not create a
  second visual frame. Above-the-fold chrome MUST render from the critical shell
  on first paint.
- Caching behavior MUST NOT be weakened. Service-worker caching, cache-busting
  hacks, forced reloads, and "clear your cache" UX are FORBIDDEN.
- Changes to `components/travel/sliderParts/**`, `components/travel/details/**`,
  `ImageCardMedia`, hero decode gates, or responsive image layout MUST pass BOTH
  `yarn verify:slider` and `yarn verify:slider-perf`. One green side is not
  enough.
- Bundle changes MUST pass `yarn guard:bundle-budget:fail` and
  `yarn guard:eager-web:fail`.

### V. Accessibility and Responsive Parity

- Every change MUST work on desktop web and mobile web. Mobile web and Android
  are a coupled validation pair: a change to one is not complete until the same
  scenario is verified on the other.
- Interactive elements MUST be keyboard reachable and operable, with a visible
  focus state.
- Touch targets MUST meet the enforced minimum; verify with
  `yarn guard:touch-targets`.
- Images that carry meaning MUST have a descriptive `alt`. Decorative images MUST
  be explicitly empty-alt so screen readers skip them.
- HTML semantics and heading order MUST NOT be degraded, and text contrast MUST
  NOT be reduced.
- Colors MUST come from `DESIGN_TOKENS` and the theme system. Hardcoded hex
  values in components are FORBIDDEN.
- Emoji MUST NOT be used as production icons; use `@expo/vector-icons/Feather`.
- A control that a platform cannot support MUST NOT ship permanently `disabled`.
  Render it only where it works and explain the alternative.

### VI. Security

- All user-supplied and external input MUST be validated before use.
- Rich text and any HTML from the API MUST pass through the existing
  sanitization pipeline. Bypassing sanitization to preserve an embed is
  FORBIDDEN. Values interpolated into `ld+json` MUST be escaped.
- Tokens, credentials, internal URLs, and infrastructure configuration MUST NOT
  appear in code, logs, screenshots, tests, error messages, or documentation.
- Security headers, CSP, and authorization rules MUST NOT be weakened.
- Secrets MUST NEVER be committed. `.env*`, `.secrets/`, and credential files
  stay untracked; verify with `yarn guard:env-secrets`.
- Credentials for authenticated QA come only from `.env.e2e` and MUST NOT be
  printed, logged, screenshotted, or committed.
- New `any` types in `api/`, `hooks/`, and `stores/` are FORBIDDEN.

### VII. Database and Migrations

Schema and migrations live in the backend repository (`../metravel-backend`),
which is **read-only from this workspace**.

- This repository MUST NOT edit backend models, migrations, settings, or server
  code. A schema need becomes an `area=back` task on the MCP task board with
  evidence, not a local edit.
- A specification that implies a schema change MUST state the required contract
  (fields, types, nullability, defaults) and MUST NOT ship a frontend that
  silently fails or mocks the missing data.
- When a migration is proposed, it MUST be minimal, reviewable, and
  backward-compatible where possible: additive columns with defaults, backfill
  separated from schema change, and reads tolerant of both shapes during rollout.
- Destructive operations (dropping columns or tables, deleting rows, rewriting
  data in place) MUST NOT be proposed or executed without a separate explicit
  instruction naming the operation.
- A migration that can be long-running MUST document estimated runtime, table
  lock risk, and an explicit rollback strategy before it is approved.
- Production deploy does not automatically run `migrate`; a specification that
  depends on a migration MUST include verifying `showmigrations` on the target
  environment as an acceptance step.

### VIII. Testing and Validation

- Every functional change MUST carry verification at the layer it changed: unit
  or integration tests via Jest for logic, hooks, and components; Playwright e2e
  for user flows; browser verification for anything visible.
- Use the existing tooling — Jest and Playwright. Introducing another test
  framework is FORBIDDEN without a documented justification.
- Skipped tests are FORBIDDEN. `it.skip`, `test.skip`, `describe.skip`, `xit`,
  and `xtest` MUST NOT be left in the repository. The green baseline is zero
  skipped tests.
- Scope the checks to the change:
  - small and local → `yarn check:fast`
  - medium → targeted lint and tests for the touched modules
  - large or cross-cutting → `yarn lint` and `yarn test:run`
- Localization-affecting changes MUST additionally pass `yarn test:i18n`.
- Governance-affecting changes MUST additionally pass `yarn governance:verify`.
- `yarn lint`, `yarn typecheck`, the relevant tests, and `yarn build:web:prod`
  MUST pass before a specification is considered implemented.
- The agent MUST verify its own work. Asking the user to refresh, scroll, open
  devtools, run a console snippet, or report what they see is NOT verification
  and MUST NOT be substituted for it.
- Acceptance criteria MUST be checkable by a named command, a named URL, or a
  described observation. "Works correctly" is not an acceptance criterion.
- If verification is genuinely blocked, the item MUST be reported as
  `verify pending` with the concrete blocker and the list of paths already
  attempted. It MUST NOT be reported as done.

### IX. Specification Quality

- `spec.md` describes required behavior, user value, constraints, and acceptance
  criteria. Implementation details — component names, file paths, library
  choices, data structures — MUST NOT appear in `spec.md`.
- `plan.md` owns implementation detail: the files to touch, the existing
  primitives reused, the rejected alternatives, and the platform impact.
- `tasks.md` MUST contain small, concrete, individually verifiable tasks. A task
  whose completion cannot be checked is not a task.
- `spec.md`, `plan.md`, and `tasks.md` MUST be mutually consistent and agreed
  before implementation starts.
- After implementation, the result MUST be checked back against the
  specification and each acceptance criterion, and the outcome recorded.
- Unresolved ambiguity MUST be marked `[NEEDS CLARIFICATION: question]` rather
  than silently resolved by invention.
- Every specification MUST record `Platform impact:
  desktop web | mobile web | Android | shared | none` and `Localization impact:
  all current locales | selected locales | none`. `none` MUST be a considered
  conclusion, not an omitted check. iOS is out of scope.

### X. Scope Control

- Every specification and every task MUST have an explicit `Out of scope`
  section. An empty one is not acceptable; state what was deliberately excluded.
- Files outside the approved plan MUST NOT be modified. If a change outside the
  plan proves necessary, stop, state why, and get agreement before proceeding.
- Adjacent problems discovered during implementation MUST NOT be fixed
  opportunistically. List them under `Out of scope` or file them on the MCP task
  board, and leave the code alone.
- One feature, or one logically connected bug fix, equals one specification
  directory. Bundling unrelated changes into one specification is FORBIDDEN.
- Business requirements MUST NOT be invented. If the specification does not say
  it, ask; do not assume.

## Platform, Localization and Ownership Constraints

- Active product surfaces are **desktop web, mobile web, and Android**. The
  repository retains `ios/` scaffolding, but iOS is not a QA, release-readiness,
  Done-gate, or `verify pending` surface until the user reactivates it.
- Shared Expo/React Native code MUST preserve all active platforms. Platform
  files may adapt map engines, permissions, safe areas, storage, or native APIs,
  but MUST NOT silently fork product behavior, block order, primary actions, or
  tap semantics.
- The production locale registry is `i18n/config.ts` — currently RU/BE/UK/PL/EN
  with RU as default and fallback.
- App-owned UI copy, accessibility text, validation, errors, toasts, empty
  states, and legal/SEO/PDF UI MUST be added through `@/i18n` in **all**
  production locales in the same change. Locale-sensitive dates, numbers,
  plurals, and collation MUST use `i18n/format.ts`; hardcoding `ru-RU` or manual
  plural rules is FORBIDDEN.
- User, editorial, and API content MUST NOT be client-translated.
- Implementation ownership in this workspace is **frontend, app, and docs only**.
  Backend work is analysis-only: read source, run read-only probes, file
  `area=back` board tasks with evidence.
- Work happens on `main`. Do not create or switch branches without an explicit
  new instruction from the user.
- The MCP task board is the source of truth for tasks; `tasks/*.md` is a
  temporary fallback only.

## Development Workflow and Quality Gates

1. **Read first.** `AGENTS.md`, `docs/RULES.md`, this constitution, then only the
   relevant documents from `docs/INDEX.md`. Do not recursively load all of
   `docs/`; dated audits and legacy adapters are not canonical rules.
2. **Study the existing implementation** in the affected area before designing
   anything. Name what already exists.
3. **Specify** — `/speckit-specify` produces `specs/NNN-slug/spec.md`. Record
   platform impact, localization impact, and `Out of scope`.
4. **Clarify** — `/speckit-clarify` resolves `[NEEDS CLARIFICATION]` markers
   before planning.
5. **Plan** — `/speckit-plan` produces `plan.md` with the reuse search result,
   the files to touch, and the rejected alternatives.
6. **Tasks** — `/speckit-tasks` produces small, checkable `tasks.md` entries.
7. **Agree** before writing feature code. For a complex change, code written
   before `spec.md`, `plan.md`, and `tasks.md` are agreed is out of process.
8. **Implement** — `/speckit-implement`, staying inside the planned file set.
9. **Validate** — run the checks matching the scope (Principle VIII), verify
   visible changes in a real browser on desktop and mobile web, plus Android when
   the surface is shared, and capture evidence.
10. **Report** — list every changed file, the checks run and their results, any
    constitution violation encountered, and everything deliberately left out.

Definition of done for a specification: acceptance criteria verified with
evidence, required checks green, changed files listed, `Out of scope` respected.
Nothing is committed or pushed without explicit user permission.

## Governance

- This constitution applies to all Spec-Driven Development work in this
  repository, for human contributors and AI agents alike.
- `docs/RULES.md` and `AGENTS.md` remain the canonical project rules. This
  document adapts them to the specification workflow and MUST NOT contradict
  them. On conflict, `docs/RULES.md` wins and this file is amended.
- Amendments are made by editing `.specify/memory/constitution.md` (via
  `/speckit-constitution`), updating the version line, and recording the change
  in the Sync Impact Report comment at the top of this file.
- Versioning is semantic:
  - **MAJOR** — a principle is removed or redefined so that previously compliant
    work becomes non-compliant;
  - **MINOR** — a new principle or a materially expanded rule is added;
  - **PATCH** — clarification, wording, or a corrected command that does not
    change what is required.
- Compliance is reviewed at two points: before implementation, when `spec.md`,
  `plan.md`, and `tasks.md` are agreed; and after implementation, when the result
  is checked against acceptance criteria.
- A violation MUST be reported explicitly rather than silently accommodated. If a
  principle blocks required work, raise it and get an explicit decision; do not
  route around it.
- A rule that becomes untrue — a renamed command, a retired guard — is a defect
  in this document and MUST be fixed in the next change that notices it.

**Version**: 1.0.0 | **Ratified**: 2026-08-06 | **Last Amended**: 2026-08-06
