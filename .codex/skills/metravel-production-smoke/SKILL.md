---
name: metravel-production-smoke
description: Run read-only production health checks for metravel.by. Use after deploys, when the user asks whether production is alive, or when diagnosing 502/white-screen/static/API/sitemap regressions with GET/browser probes and no production writes.
---

# Metravel Production Smoke

Use this skill for read-only production validation. Use `$metravel-devops-agent` for deploy execution or rollback.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/RELEASE.md`
- `docs/PRODUCTION_CHECKLIST.md` when production release context matters.

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
3. Use `curl -I`/`curl -s` or browser probes; never send mutating requests.
4. For white-screen or UI suspicion, run a real browser snapshot and console check.
5. If a new production regression is found, compare with open board tasks when available to avoid duplicate reports.
6. Route confirmed frontend regressions to `$metravel-feature-builder` or `$metravel-browser-reviewer`; backend/API regressions to `$metravel-backend-diagnostician` or a board task.

## Output

Return a `Production Smoke` report:

- checked URLs/endpoints
- status codes and visible/browser result
- console or static asset failures
- pass/fail verdict
- linked existing blocker or new recommended owner

Do not claim deployment success from smoke alone if deploy logs or required post-deploy checks are missing.
