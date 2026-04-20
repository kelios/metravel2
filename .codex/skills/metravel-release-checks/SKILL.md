---
name: metravel-release-checks
description: Choose and run the correct metravel verification flow for local changes, PR-ready validation, governance-sensitive updates, release preparation, and production web checks. Use when Codex must decide which commands to run after code changes or before deploy in this repository.
---

# Metravel Release Checks

Read `docs/RULES.md`, `docs/DEVELOPMENT.md`, `docs/TESTING.md`, and `docs/RELEASE.md` before deciding the verification plan.

Select checks by change scope instead of defaulting to the heaviest run every time:

- Small finished logical block: prefer `npm run check:fast`.
- Need to inspect the selective plan first: use `npm run check:fast:dry`, `npm run check:changed:dry`, or `npm run check:e2e:changed:dry`.
- Medium change touching a bounded area: run the relevant targeted tests plus the matching selective checks.
- Large, cross-cutting, or infrastructure-heavy change: run `npm run lint` and `npm run test:run`.

Use the project-specific command map:

- External-link or governance-sensitive changes: run `npm run guard:external-links` or `npm run governance:verify`.
- Before PR or after notable refactor: run `npm run check:preflight`.
- Changes in travel/search/map/account/messages flows that need browser smoke coverage: use `npm run check:e2e:changed`.
- Full release confidence: run `npm run release:check`.

Keep release and performance validation aligned with repo policy:

- Build web for production checks with `npm run build:web:prod`.
- Run Lighthouse against a production build or the real production URL, never against a dev server.
- Use post-deploy checks against the real site after release, for example `npm run test:seo:postdeploy`.
- Do not reintroduce service worker runtime/static caching or any user-facing "clear cache" workaround.

Account for UI-specific completion rules:

- If a task changes visible web UI, do real-browser verification before calling it done.
- Confirm the final state with a screenshot and no new console errors.

Stay within repo workflow boundaries:

- Run commands from the repo root.
- Prefer scope-based validation after each logical step, then repeat the appropriate checks before final handoff.
- Treat `npm run typecheck` as an explicit wider audit for larger refactors or debt cleanup, not as the default after every tiny edit.
