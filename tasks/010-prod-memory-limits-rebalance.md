# TASK-20260609-010: Rebalance prod container memory limits to stop intermittent 502s

Status: Backlog
Owner: Backend
Support: Frontend Developer, Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Eliminate intermittent 502s on production by giving the Django `app` container enough
memory headroom and reclaiming the unused headroom from the over-provisioned PostGIS
container, so no worker is OOM-killed or pushed into swap during on-the-fly image encoding.

## Context

Production (`metravel.by`) was returning intermittent 502s. Box is small: **1 vCPU, ~1.8 GiB
RAM, 15 GB SSD** (`/dev/sda1` 7.9G used / 6.3G free). Repository: `../metravel-backend`
(`sergey-savran/metravel`, branch `master`).

Already applied by Backend (commit `3731147`, 2026-06-09) and confirmed effective:

- gunicorn `--workers 4→2`, `--threads 4→2`, `--timeout 20→60`, `--max-requests 100→1000`
  (`deploy/prod/app/entrypoint.sh`).
- Removed on-the-fly AVIF encoding (`maintenance/views.py`, `metravel/common/image_support.py`).
- Fixed `no-store` regression — failed transforms are cached again (`maintenance/views.py`).
- Normalized nginx image cache key `img$http_accept$request_uri` → `img:$image_cache_format:$request_uri`
  and bumped `proxy_cache_path max_size 1g→3g` (`deploy/prod/nginx/nginx.conf`).
- Redis `maxmemory 150mb` + `allkeys-lru`, `mem_limit 200m`.
- PostGIS `mem_limit 512m` + `shared_buffers=128MB, work_mem=8MB, max_connections=20`.
- Django app `mem_limit` set to `700m`.
- Operator added **2 GB swap** with `vm.swappiness=10` (swap currently unused = no active pressure).

Remaining problem — observed via the metrics collector (`~/metravel-monitor/metrics.jsonl`,
cron every minute) **at idle, no traffic**:

```json
{"name":"metravel_app_1","mem_mb":670,"mem_limit_mb":700,"mem_pct":95.72,"restarts":0,"oom_killed":false}
{"name":"metravel_metravel-gis_1","mem_mb":53,"mem_limit_mb":512,"mem_pct":10.40}
{"name":"metravel_redis_1","mem_mb":43,"mem_limit_mb":200}
{"name":"metravel_nginx_1","mem_mb":34}
```

The Django `app` container sits at **95.7 % of its 700 MB cap with zero traffic**. Any image
encode spike pushes it over 700 MB → either cgroup OOM-kill of a worker (→ 502) or a spill to
swap (→ latency spikes). Meanwhile PostGIS holds 512 MB but uses only 53 MB (≈459 MB idle).
Memory is mis-allocated: `app` is starved, `gis` is over-provisioned.

Physical budget on 1.8 GiB box (caps are ceilings; actual pg/redis usage is tiny, so app gets
real RAM): app 900 + pg 384 + redis 200 + nginx ~40 + OS ~300 ≈ 1.82 GiB, with the 2 GB swap
absorbing rare spikes.

Source task:

- Source id:
- Source path: prod 502 investigation 2026-06-09 + `~/metravel-monitor/metrics.jsonl`

## Files / where to change (backend repo `../metravel-backend`)

- `docker-compose-prod.app.yaml` — service `app`: `mem_limit: 700m` → `900m`.
- `docker-compose-prod.infrastructure.yaml` — service `metravel-gis`: `mem_limit: 512m` → `384m`.
- (Optional, disk hygiene) `deploy/prod/nginx/nginx.conf` — `proxy_cache_path ... max_size 3g`
  → `1.5g` so the image cache cannot crowd out the growing PostGIS data dir on the 15 GB disk.

## Acceptance Criteria

- [ ] `app` container `mem_limit` is `900m`; `metravel-gis` container `mem_limit` is `384m`.
- [ ] After redeploy (`docker compose -f docker-compose-prod.app.yaml up -d`,
      `docker compose -f docker-compose-prod.infrastructure.yaml up -d`), `docker stats --no-stream`
      shows `app` mem usage under ~75 % of its new cap at idle (headroom restored).
- [ ] PostGIS stays healthy at `384m` under normal browsing load (no restarts, no slow queries,
      `max_connections=20` not exhausted).
- [ ] Over a 24 h window the metrics log shows: `app` `restarts` does not increase,
      `oom_killed=false` for all containers, `oom_total` delta = 0, and `swap.used_mb` stays low
      (not steadily climbing).
- [ ] HTTP probes in the metrics log show no 502/504 for `home_code` / `api_code` over the window.
- [ ] (If applied) nginx `proxy_cache_path max_size` is `1.5g` and disk `use_pct` stays well below 90 %.

## Gherkin Tests

```gherkin
Feature: Production memory limits keep the app off the OOM/swap boundary

  Scenario: App has memory headroom at idle after rebalance
    Given the app container mem_limit is raised to 900m and postgis lowered to 384m
    And the new compose config is redeployed
    When no user traffic is hitting the box
    Then docker stats shows the app container below 75 percent of its memory cap

  Scenario: Image encoding spike does not kill a worker
    Given a cold-cache request that triggers on-the-fly WebP encoding
    When the app container memory rises during the encode
    Then it stays within the 900m cap or spills briefly to swap
    And no gunicorn worker is OOM-killed and the response returns 200 not 502

  Scenario: 24h stability window is clean
    Given the metrics collector runs every minute for 24 hours
    When the log is analyzed
    Then app restarts do not increase, oom_total delta is zero, and no 502/504 is recorded
```

## Assignment

Primary owner: Backend (prod infra / docker-compose). Operator applies redeploy on the prod
host. Validation via `~/metravel-monitor/metrics.jsonl` (24 h) + `docker stats` + `dmesg/journalctl`
OOM check.

## Progress Log

- 2026-06-09: The `app` `mem_limit: 700m → 900m` edit was applied **directly on the prod host**
  (`sx3@178.172.137.129:/home/sx3/metravel/docker-compose-prod.app.yaml`) as an uncommitted
  hot-edit — diverging the live file from git (`git diff` showed only `-mem_limit: 700m` /
  `+mem_limit: 900m`). This violates the project rule (backend changes go through the owner's git,
  not a prod hot-edit). **Reverted** the file on the server with `git checkout -- docker-compose-prod.app.yaml`
  (live file is back in sync with git, `mem_limit: 700m`; running container not restarted, so no
  runtime impact). The 700→900 change must be made **in the backend repo by the owner** under
  this task and redeployed through the normal flow — not hot-edited on prod.

## Notes / follow-ups (not in scope here)

- Long-term root-cause fix tracked separately: **pre-generate image variants at upload** and store
  them in S3 so image transcoding leaves the request path entirely (relates to TASK-001 image
  server). This would make even a 1 vCPU box comfortable and is the durable elimination of this
  502 class.
- Returning the `mtravel_async` FastAPI image service to prod requires more RAM/CPU — defer until a
  2 vCPU / 4 GB upgrade. Do not re-enable on the current 2 GB box.
