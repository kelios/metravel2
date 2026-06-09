# TASK-20260609-046: Full image binaries stored in DEFAULT Redis cache — memory bloat risk

Status: Backlog
Owner: Backend
Support: Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Move image-byte cache entries out of the shared `DEFAULT` Redis namespace into a
dedicated Redis instance or namespace configured with LRU eviction and a shorter TTL
(~30 days), so that large image blobs cannot evict hot application keys or cause OOM on
the shared cache.

## Context

Two code paths write encoded image bytes into the `DEFAULT` Redis cache:

- `maintenance/views.py:220-248` — synchronous image transform endpoint
- `mtravel_async/.../image_read.py:93-107` — async image read task

Both use `CACHE_TTL = 31536000` (1 year). Each cached entry is a base64/binary blob of
50–130 KB. The cache key varies across: format × width (7 values) × quality × fit mode,
producing dozens of variants per image.

All of these blobs share memory with Django session data, per-view cache fragments, and
other short-lived application keys. Under memory pressure Redis applies the DEFAULT cache
eviction policy (likely `noeviction` or `allkeys-lru` configured for app keys), risking
either OOM or eviction of hot session/view keys.

This issue is related to the prod memory pressure documented in tasks BE-020/010.

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] Image binary cache entries are stored in a separate Redis connection (e.g. `CACHES['images']`) distinct from `CACHES['default']`.
- [ ] The images cache is configured with `maxmemory-policy: allkeys-lru` and a TTL of ≤ 30 days.
- [ ] Application keys (sessions, view cache) are not evicted by image cache growth.
- [ ] Image serving functionality is unchanged: cache hit returns the same bytes as before.
- [ ] `DEFAULT` Redis memory consumption does not grow when image transform endpoints are called.

## Gherkin Tests

```gherkin
Feature: Image cache isolated from application cache

  Scenario: Image bytes go to the images cache, not default
    Given a cold image cache
    When GET /api/image/?url=...&w=720&fmt=webp is requested
    Then the response image bytes are stored in CACHES['images']
    And CACHES['default'] contains no new image-byte key

  Scenario: Application cache keys survive image cache memory pressure
    Given the images cache is nearly full and uses allkeys-lru eviction
    When a large batch of new image variants is cached
    Then session and view-cache keys in CACHES['default'] are unaffected
    And no OOM error is raised

  Scenario: Cache hit still returns correct image
    Given an image variant is cached in CACHES['images']
    When the same URL+parameters are requested again
    Then the response is served from cache (no Pillow re-encode)
    And the image bytes are identical to the first response
```

## Assignment

Primary owner: Backend Developer
Support agents: Reviewer (Redis config review), Releaser (prod Redis provisioning if separate instance needed)

## Likely Files Or Areas

- `maintenance/views.py` (lines 220-248 — image transform cache write)
- `mtravel_async/` image read task (`image_read.py`, lines 93-107)
- `metravel/settings/` or `config/settings.py` — `CACHES` configuration
- Redis server config / docker-compose (if separate instance is provisioned)

## Plan

1. Add `CACHES['images']` entry in Django settings pointing to the same or a separate
   Redis DB with `maxmemory-policy allkeys-lru` and `TIMEOUT = 2592000` (30 days).
2. Replace `cache.set(key, data, CACHE_TTL)` calls in `maintenance/views.py` and
   `image_read.py` with `caches['images'].set(key, data, 2592000)` (use Django's
   `django.core.cache import caches`).
3. Replace corresponding `cache.get(key)` calls with `caches['images'].get(key)`.
4. If a separate Redis instance is needed: update docker-compose / infra config.
5. Write a smoke test: after a transform request, assert the key exists in `caches['images']`
   and NOT in `caches['default']`.
6. Monitor DEFAULT Redis memory before/after on staging.

## Validation

```bash
# After fix: verify key NOT in default, IS in images
python manage.py shell -c "
from django.core.cache import caches
default = caches['default']
images = caches['images']
key = 'img:test_key'
print('in default:', default.get(key))
print('in images:', images.get(key))
"

# Measure DEFAULT cache memory before/after image flood
redis-cli -n 0 INFO memory | grep used_memory_human
# Trigger 20 image transforms, then re-check

# Smoke test
python manage.py test maintenance.tests.test_image_cache_isolation -v 2
```

## Release Checklist

- [ ] Changed files are listed in `## Results`.
- [ ] New files created by this task are identified.
- [ ] Generated/cache/secret/local files are excluded.
- [ ] Task-scope files are staged when the user asks to prepare git.
- [ ] Skipped files and release blockers are recorded.

## Progress Log

- 2026-06-09: Created.

## Results

Changed files:

Validation evidence:

Reviewer findings:

Release notes:

Blockers:
