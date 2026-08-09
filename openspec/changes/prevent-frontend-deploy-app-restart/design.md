## Context

See `proposal.md` for the incident and scope. The current remote deploy payload already stages the new web export, overlays bounded historical Expo assets, and atomically renames `static/dist`. It then deletes `static/dist.old` and executes a hard `restart app nginx` when Docker Compose v2 is present. The fallback Compose v1 branch restarts only Nginx, so the application lifecycle is already inconsistent across equivalent deploy paths.

Production Nginx serves the bind-mounted `static/dist` directly and keeps an open-file cache valid for 30 seconds. A process reload is useful to make new workers resolve the new tree immediately, but neither the app nor the Nginx container needs to be stopped. The production host exposes `/usr/bin/curl`, Docker Compose v2, and `/etc/nginx/sbin/nginx` inside the Nginx container. The public `/health` route is already deployed and performs a lightweight response through the same public proxy path used by clients.

The backend repository and its production tracked files remain read-only from this workspace. Backend image cutover, Gunicorn lifecycle, the nightly restart script, and host capacity are owned by #1321 and are not implementation paths for this change.

## Goals / Non-Goals

**Goals:**

- make both Compose v1 and v2 frontend deploy paths preserve the running app container;
- refresh Nginx workers and their open-file cache without terminating active connections;
- keep an atomic rollback point until Nginx activation and public readiness succeed;
- make readiness event-driven and bounded rather than using a fixed post-restart sleep;
- enforce the safe sequence with a deterministic source-contract test;
- preserve the current static overlay, quest fallback, checkout-safety, SEO, and media gates.

**Non-Goals:**

- provide zero-downtime backend image/dependency deployment;
- modify backend Compose, Nginx, Gunicorn, cron, migrations, or API code;
- prove the separate #1321 backend rollout Done gate;
- add UI, localization, client retry, or analytics changes;
- generalize the deploy script into a new framework or dependency.

## Decisions

### 1. Never restart the app in a frontend-only deploy

The deploy payload will remove every frontend-path command that restarts or recreates `app`. Static files are served from a bind mount and the frontend artifact does not change Python code, environment, dependencies, database schema, or the image-baked entrypoint, so an app lifecycle operation has no functional purpose.

Alternative rejected: retain `restart app` and wait longer before checks. A readiness wait would make the gates less flaky but would preserve the measured client outage and reset #1054's observation window.

Alternative rejected: add client retries. That masks the server-created outage, does not protect all clients or non-idempotent work, and violates the task fallback policy.

### 2. Validate and gracefully reload the existing Nginx container

The remote payload will use the detected Compose command to run the existing Nginx binary with the active configuration:

1. configuration validation;
2. graceful reload signal;
3. public readiness polling.

A graceful reload starts new Nginx workers and drains old workers, preserving active connections while clearing the old workers' open-file cache. The same operation is used for both Compose implementations so there is no v1/v2 lifecycle split.

Alternative rejected: hard restart only Nginx. It is faster than the app restart but still intentionally drops proxy connections and is unnecessary.

Alternative rejected: no Nginx lifecycle operation. The bind-mounted tree would eventually be observed, but the configured 30-second open-file cache can keep old file descriptors during the release transition and makes activation timing ambiguous.

### 3. Keep `static/dist.old` until activation and readiness pass

The existing atomic rename remains authoritative. Cleanup of `static/dist.old` moves from immediately after the swap to after successful Nginx validation, graceful reload, and readiness. A focused rollback function will:

- remove the failed live tree through the existing root-in-container deletion chokepoint;
- rename `static/dist.old` back to `static/dist`;
- validate and gracefully reload Nginx again;
- return a failing deploy status.

The rollback function operates only on the already documented untracked static targets. It never writes a tracked backend path.

Alternative rejected: leave the new tree live after a failed readiness check. That would report failure without returning the production web surface to the last accepted artifact.

### 4. Poll the public health route for at most 30 seconds

The remote host will probe the public HTTPS `/health` route with bounded per-request timeouts and short retry intervals. Success is an actual HTTP 200 through production Nginx, not only Docker's internal container-health flag. Thirty seconds is deliberately shorter than the measured 44-second hard-restart outage: this change must not hide a reintroduced app restart by waiting through it. With the app preserved, readiness should normally succeed on the first probe.

Alternative rejected: a fixed sleep. It measures elapsed time rather than service readiness and caused the existing false-red acceptance behavior.

Alternative rejected: probe the app container directly. That would not prove Nginx successfully reloaded or that the public path is ready.

### 5. Extend the existing deploy source-contract test

The nearest Jest suite already reads the canonical deploy source and asserts ordering around the remote payload. It will be extended instead of adding a shell-test framework. Assertions will cover:

- no app restart/recreate in the remote frontend publication path;
- Nginx validation precedes graceful reload;
- rollback cleanup occurs only after readiness;
- post-deploy checks are reached only after the remote readiness gate returns success;
- the extracted remote payload remains valid Bash.

The test exercises the real deployment source rather than mocking a helper. A full destructive container restart reproduction belongs to #1321, not this frontend repository.

## Data/API and Ownership Contract

- API request and response shapes remain unchanged.
- `/health` is consumed read-only and must return HTTP 200 to accept the release.
- Web continues using cookie auth and Android continues using token auth; the deploy does not inspect either.
- No backend tracked file, server config, secret store, SSL path, database, or user data is changed.
- Task #1321 remains the hard owner for backend image rollout and nightly restart behavior.

## Compatibility and Rollback

- Compose v2 and v1 use the same logical validation/reload contract.
- The static directory names and Expo overlap policy remain compatible with current releases and rollback tooling.
- If validation, reload, or readiness fails, the remote payload restores the previous static directory before returning failure.
- If the local build/upload fails before the swap, current behavior remains unchanged.
- Manual emergency recovery remains outside this normal-path change.

## Risk Analysis

- [Public health transient unrelated to this deploy causes rollback] → Allow bounded retries inside 30 seconds, record the last status, and keep the app untouched.
- [Nginx reload succeeds but its public route is still stale/unavailable] → Accept only the public HTTPS 200 probe, not command success alone.
- [Rollback reload also fails] → Preserve the restored static tree, return non-zero, and report both failures without falling back to an app restart.
- [Source assertion is too broad and flags documentation/comments] → Extract and assert the remote deploy payload rather than scanning unrelated repository text.
- [Production checkout contains unexpected changes] → Preserve the existing cleanliness and tracked-path gates; this change does not weaken them.
- [Static publish is briefly visible before a later rollback] → Atomic directory swaps bound each transition; old Expo assets are retained in the new tree, and acceptance occurs only after readiness.

## Impact Areas

- SEO: URL, canonical, redirects, sitemap, metadata, structured data, and SSG contents are unchanged; existing gates simply run after readiness.
- Accessibility: not applicable; no rendered UI changes.
- Performance: no bundle/request/media change. Operational availability improves by removing the measured 44-second upstream gap.
- Security: existing ignored deploy target remains the only SSH source; commands do not print credentials or environment values.
- Analytics: no product event change; existing logs should show fewer deploy-correlated 5xx responses.

## Validation Matrix

| Surface | Required evidence |
| --- | --- |
| Repository contract | Targeted Jest deploy suite passes and extracted remote payload passes `bash -n`. |
| Local production build | Existing build-only production flow completes without deploying; operation gate checked first. |
| Desktop web | No visual change. After an explicitly authorized rollout, public `/health`, one dynamic page, and one API GET remain available during the frontend deploy. |
| Mobile web | Same shared API availability evidence as desktop; no viewport/UI validation is needed because no client code or UI changes. |
| Android | Same shared API availability contract; no APK rebuild/device UI flow is needed because the binary and API schema do not change. |
| Production process | App container ID, `StartedAt`, and restart counter are identical before/after the frontend deploy; continuous GET probe records 0 client 5xx. |
| Localization | None: no locale files or locale-sensitive behavior change; `test:i18n` is not required. |
| Backend/ops #1321 | Remains open for backend image cutover and nightly hard restart; this frontend validation cannot close it. |

## Migration Plan

1. Apply the source, test, and documentation changes in the frontend repository.
2. Run the targeted deploy-contract suite and the repository's narrow release checks, respecting the operation gate.
3. Complete the mandatory code-review-and-fix pass and re-run affected checks.
4. Only after a separate explicit production deploy authorization, record the app container identity/start time and start a bounded continuous public API probe.
5. Deploy through the canonical frontend production command, verify the app process did not restart, and compare client 5xx counts with the 38-response baseline.
6. If the release fails its readiness gate, confirm the previous static tree was restored and the app process stayed unchanged.

The backend rollout and RAM decision continue independently in #1321.
