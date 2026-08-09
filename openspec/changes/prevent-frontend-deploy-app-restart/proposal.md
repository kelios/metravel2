## Why

The canonical frontend-only production deploy restarts the sole Django app container after atomically publishing static files. On 2026-08-09 that unnecessary restart left every dynamic/API route without an upstream for 44 seconds and produced 38 client-facing `502` responses, while static pages remained available; the restart also made the deploy's own SEO and media gates fail for the wrong reason.

The frontend deploy must preserve backend availability and must not reset the clean 24-hour worker-recycle acceptance window owned by backend task #1054. Full zero-downtime backend image rollout remains the separate backend/ops problem in #1321.

## What Changes

- Publish the frontend static tree without restarting or recreating the Django app container.
- Validate the existing production Nginx configuration and use a graceful Nginx reload after the static swap so open-file caches move to the new tree without dropping active connections.
- Keep the previous static tree until the graceful reload and bounded public readiness probe succeed; restore it on failure.
- Run post-deploy checks only after the public `/health` route returns HTTP 200 within a bounded retry window.
- Add a regression test that fails if the canonical frontend deploy reintroduces an app restart or omits the graceful-reload/readiness ordering.
- Update release documentation to state that frontend-only deploys preserve the app process.

Goal: during a frontend-only deploy, the app container identity and start time remain unchanged, the public health route becomes ready before acceptance gates run, and a concurrent API probe records zero client-facing 5xx responses.

User-visible result: desktop web, mobile web, and Android clients continue to use API and dynamic routes during a frontend web release instead of seeing `Bad Gateway`.

Platform impact: **shared** — the changed operation protects the common backend consumed by desktop web, mobile web, and Android; there is no app UI/layout change and no device-specific behavior.

Localization impact: **none** — no app-owned copy, locale resources, formatting, routing, or editorial content changes.

Dependencies: backend task #1321 remains responsible for full backend image/container rollout and the nightly hard restart. This frontend change depends only on the already deployed `/health` route, the running Nginx container, and the existing production deploy transport. It does not depend on a RAM upgrade.

Fallback/mock policy: client retries, mock data, fixed sleeps, and a fallback hard restart of the app are not accepted. A failed Nginx validation, reload, or bounded readiness probe fails closed and restores the previous static tree while leaving the live app process untouched.

Existing behavior to preserve:

- atomic `static/dist` publication and rollback safety;
- bounded old Expo asset overlap for open browser tabs;
- quest fallback publication and tracked-path guards;
- current Gunicorn one-worker/two-thread/two-bind topology and #1054 recycle retry;
- post-deploy SEO and media checks;
- production checkout immutability and documented runtime-path exceptions.

Non-goals:

- zero-downtime backend image or dependency rollout;
- changing Gunicorn worker/thread/bind settings or Nginx upstream retry semantics;
- changing or hot-patching backend tracked files;
- changing the nightly `/home/sx3/restart_metravel_app.sh` job;
- adding client-side retry, service-worker caching, cache busting, or maintenance UI;
- changing any API request/response shape.

Open questions: none. The backend rollout and host-capacity decision are intentionally outside this frontend-owned change and remain on #1321.

## Capabilities

### New Capabilities

- `frontend-production-deploy`: Availability, rollback, readiness, and regression requirements for publishing a frontend-only production release without restarting the backend application.

### Modified Capabilities

None; no living OpenSpec capability currently covers the frontend production deploy.

## Impact

- Code: `build-prod.sh` and the nearest deploy-contract Jest suite.
- Documentation: `docs/RELEASE.md` and any directly contradictory deploy wording.
- Data/API: unchanged; `/health` is only observed as an existing public readiness contract.
- Backend/server: no tracked backend edit from this workspace; the live app process must remain untouched by the frontend deploy.
- SEO: no metadata/route change; post-deploy SEO validation starts only after readiness succeeds.
- Accessibility: not applicable because no user interface changes.
- Performance: removes a 44-second API outage and false acceptance failures; no bundle, image, Core Web Vitals, or request-shape change.
- Security: deploy target and secrets remain in existing ignored configuration; no credential value is logged or added to artifacts.
- Analytics: no events or parameters change; fewer restart-generated 5xx responses improve existing operational signals rather than redefining them.
