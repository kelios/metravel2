# TASK-20260609-021: Re-evaluate async image service and gunicorn worker sizing to prevent 502s

Status: Backlog
Owner: Backend
Support: Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Eliminate the class of 502/504 errors caused by synchronous Pillow image encoding
blocking Gunicorn WSGI workers, by either enabling the already-built async FastAPI image
service or adopting a viable alternative approach for the current 1-vCPU / 1.8 GB host.

## Context

Security review 2026-06-09. The async FastAPI image service (`mtravel_async`) was built to
handle image reading and Pillow encoding off the synchronous Django request path. It is
already defined in `docker-compose-prod.app.yaml:42-75` and its nginx upstream is at
`nginx.conf:111-116`, but both are commented out. All image encoding therefore runs
synchronously inside `maintenance/views._cached_image_view_impl` via Pillow in the
Gunicorn WSGI worker.

Current Gunicorn config (`deploy/prod/app/entrypoint.sh:24-34`): 2 workers × 2 threads,
timeout 60 s. With the `app` container at `mem_limit 700m` and the image encoder
consuming CPU for 100-300 ms per encode, concurrent image requests starve the 2 workers
and cause 502/504.

**Constraint (from `tasks/010-prod-memory-limits-rebalance.md`):** the async service
requires more RAM/CPU than the current 1-vCPU / 1.8 GB box can safely provide alongside
PostGIS + Redis. Re-enabling it is deferred until a 2 vCPU / 4 GB upgrade.

Scope of this task: document the deferral explicitly, plan the pre-conditions for
re-enabling, and identify any short-term mitigations (worker count tuning, per-request
encode timeout, or pre-generating image variants at upload — see also `tasks/001`). This
is an infrastructure/planning task; code changes are limited to Gunicorn config and
optionally docker-compose comments.

Related: `tasks/010-prod-memory-limits-rebalance.md` (memory rebalance already applied),
`tasks/001-image-server-resize-cache.md` (long-term: pre-generate variants at upload).

Source task:

- Source id: TASK-20260609-010
- Source path: tasks/010-prod-memory-limits-rebalance.md

## Acceptance Criteria

- [ ] `deploy/prod/app/entrypoint.sh` Gunicorn worker count is set to `2*CPU_COUNT + 1`
      (currently 1 vCPU → 3 workers) with timeout reviewed against typical image-encode
      duration.
- [ ] `docker-compose-prod.app.yaml` app service has a `healthcheck` defined so Docker
      restarts an unresponsive container before nginx returns 502.
- [ ] The async FastAPI service section in `docker-compose-prod.app.yaml:42-75` and the
      nginx upstream in `nginx.conf:111-116` carry a comment stating the pre-conditions
      for re-enabling (RAM ≥ 4 GB, CPU ≥ 2 cores).
- [ ] After Gunicorn worker count adjustment, the metrics log shows no 502/504 during
      a simulated 5-concurrent-image-request burst on staging.
- [ ] A follow-up task (or reference to `tasks/001`) is recorded in `## Results` /
      Blockers for the durable fix (pre-generated image variants).

## Gherkin Tests

```gherkin
Feature: Image encoding does not block all Gunicorn workers

  Scenario: Concurrent image requests do not cause 502
    Given Gunicorn is configured with 3 workers on a 1-vCPU host
    When 5 concurrent image requests arrive for cold-cache paths
    Then all responses eventually return 200 (possibly after a short delay)
    And no response returns 502 or 504

  Scenario: Unhealthy container is restarted before nginx returns 502
    Given a Docker healthcheck is defined for the app service
    When the app container becomes unresponsive
    Then Docker restarts the container and nginx resumes serving within the healthcheck interval
```

## Assignment

Primary owner: Backend / operator — entrypoint.sh worker count + healthcheck in compose.
Support agents: Tester to run concurrent image burst on staging; Reviewer to confirm async
service deferral comment is accurate.

## Likely Files Or Areas

- `deploy/prod/app/entrypoint.sh` lines 24-34 (Gunicorn workers/threads/timeout)
- `docker-compose-prod.app.yaml` lines 18 (mem_limit), 42-75 (async service block)
- `deploy/prod/nginx/nginx.conf` lines 111-116 (async upstream)
- Related: `tasks/010-prod-memory-limits-rebalance.md`, `tasks/001-image-server-resize-cache.md`

## Plan

1. Update `entrypoint.sh`: change workers from 2 to 3 (2*1+1 for 1 vCPU); review timeout
   (60 s is generous — consider 30 s to fail fast).
2. Add a `healthcheck` to the `app` service in `docker-compose-prod.app.yaml`
   (e.g., `test: ["CMD", "curl", "-f", "http://localhost:8000/api/travels/?page_size=1"]`).
3. Add explanatory comments to the async service block and nginx upstream explaining the
   RAM/CPU pre-conditions for re-enabling.
4. Redeploy on prod; run a 5-concurrent-image burst and observe metrics log for 502s.
5. Record the deferral and link `tasks/001` as the long-term fix in `## Results`.

## Validation

```bash
# Check current worker count after deploy
docker exec metravel_app_1 ps aux | grep gunicorn
# Expected: 3 worker processes

# Verify healthcheck is defined
docker inspect metravel_app_1 | python3 -m json.tool | grep -A5 '"Health"'
# Expected: healthcheck config present

# Concurrent image burst (5 parallel requests)
for i in $(seq 1 5); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    "https://metravel.by/api/image/?path=some/image.jpg&w=800" &
done
wait
# Expected: all 200, no 502/504
```

## Release Checklist

- [ ] Changed files are listed in `## Results`.
- [ ] New files created by this task are identified.
- [ ] Generated/cache/secret/local files are excluded.
- [ ] Task-scope files are staged when the user asks to prepare git.
- [ ] Skipped files and release blockers are recorded.

## Progress Log

- 2026-06-09: Created from backend security review finding [HIGH].

## Results

Changed files:

Validation evidence:

Reviewer findings:

Release notes:

Blockers:
