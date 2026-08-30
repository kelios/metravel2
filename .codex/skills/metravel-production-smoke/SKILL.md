---
name: metravel-production-smoke
description: Run read-only production health checks for metravel.by. Use after deploys, when the user asks whether production is alive, or when diagnosing 502/white-screen/static/API/sitemap regressions with GET/browser probes and no production writes.
---

# Metravel Production Smoke

Use this skill for read-only production validation. Use `$metravel-devops-agent` for deploy execution or rollback.

`AGENTS.md` is inherited. Load only the changed surface's production probe and,
after a release, the relevant `docs/RELEASE.md` or
`docs/PRODUCTION_CHECKLIST.md` checklist section.

## Smoke Scope

Check only what is safe to read:

- `https://metravel.by/`
- key routes such as `/search`, `/map`, `/articles` or a changed route
- representative travel/article pages when relevant
- `/sitemap.xml` and SEO static files when SEO changed
- API GET endpoints needed by the changed flow
- static JS/CSS availability for the current HTML

## Process

1. State target URL and reason for the smoke.
2. Check operation gate before launching long browser/e2e/Lighthouse work. Simple `curl` GET probes are read-only and do not need a lock.
3. Use `curl -I`/`curl -s` or browser probes; never send mutating requests. A
   server-side `git status --short`, `git diff`, or `git ls-files` check may be
   used as read-only evidence, but never clean, stash, reset, checkout, pull, or
   modify a Git-tracked server path.
4. For white-screen or UI suspicion, run a real browser snapshot and console check.
5. If a new production regression is found, compare with open board tasks when available to avoid duplicate reports.
6. Route confirmed frontend regressions to `$metravel-feature-builder`; after
   code review, use `$metravel-browser-reviewer` only for the read-only testing
   recheck. Route backend/API regressions to `$metravel-backend-diagnostician`
   or a board task.

## Performance/request audit mode

When the smoke is used for a production performance, media, or request-fan-out
incident, add a bounded route matrix rather than stopping at `200`/visible:

- record exact URL, viewport/browser/DPR, auth state, cache state, and timestamp;
- count page requests and API calls by endpoint family, including pagination and
  duplicate query variants;
- inventory images started before scroll, eager/lazy split, unsized same-origin
  media, rendered versus intrinsic/selected dimensions, response codes, and
  transfer bytes for suspicious samples;
- repeat after scroll when lazy/progressive loading is part of the contract;
- compare with open and closed problem-family tasks before creating or reopening
  a ticket, and attach the numeric evidence to the canonical chain.

A smoke can discover or verify a regression, but it cannot mark a production
optimization `done` unless it reruns the same post-deploy live-URL probe required
by that task's Done gate.

## Output

Return a `Production Smoke` report:

- checked URLs/endpoints
- status codes and visible/browser result
- request/API counts and media-byte evidence when performance is in scope
- console or static asset failures
- pass/fail verdict
- linked existing blocker or new recommended owner

Do not claim deployment success from smoke alone if deploy logs or required post-deploy checks are missing.
