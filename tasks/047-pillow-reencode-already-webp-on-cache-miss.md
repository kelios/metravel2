# TASK-20260609-047: Pillow re-encodes already-WebP source images on every cache miss

Status: Backlog
Owner: Backend
Support: Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Skip Pillow re-encoding when the source image is already in the target format and its
dimensions are sufficient for the requested width, returning the source bytes directly
and eliminating unnecessary CPU work on cache misses.

## Context

`maintenance/views.py:233` (and the async equivalent in `mtravel_async/`) runs the image
transform pipeline on every cache miss:

1. Open source file from S3 with Pillow.
2. Resize to requested `?w=`.
3. Re-encode to `output_format` (usually WebP).
4. Cache and return result.

However, `set_image` already saves uploads as WebP. So when `output_format == WEBP` and
the source file is a `.webp` with `width >= requested_w`, step 3 is redundant: the
re-encode produces an identical or lower-quality result at non-trivial CPU cost.

Prod observation (2026-06-09): cold `?w=720` on a synchronous gunicorn worker takes
~1.1 s CPU. A bot traversing all 7 width variants for a moderately sized catalogue (e.g.
500 images × 7 widths = 3 500 cold misses) can saturate workers for minutes.

The short-circuit condition: `source_format == target_format AND source.width <= requested_w`
→ return source bytes without re-encode (no upscaling, format already correct).

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] When source image is WebP and `source.width <= requested_w`, the transform returns source bytes without calling Pillow encode.
- [ ] A resize still occurs when `source.width > requested_w`.
- [ ] Re-encoding still occurs when `output_format != source_format`.
- [ ] Cold `?w=720` on a same-size WebP source is measurably faster (target: ≤ 0.3 s CPU, down from 1.1 s).
- [ ] A unit test covers the short-circuit path (mocked Pillow encode not called).

## Gherkin Tests

```gherkin
Feature: Skip redundant Pillow re-encode for matching WebP sources

  Scenario: Source is WebP and requested width is larger than source width
    Given a source image stored as WebP with width 800px
    When the transform endpoint is called with ?w=1200&fmt=webp
    Then the source bytes are returned directly without Pillow encode
    And no resize is performed

  Scenario: Source is WebP but requested width is smaller — resize needed
    Given a source image stored as WebP with width 1200px
    When the transform endpoint is called with ?w=720&fmt=webp
    Then Pillow resizes the image to 720px
    And then encodes it as WebP normally

  Scenario: Source is JPEG, output is WebP — encode is always required
    Given a source image stored as JPEG
    When the transform endpoint is called with ?fmt=webp
    Then Pillow opens, converts, and encodes the image as WebP

  Scenario: Cold WebP passthrough is fast
    Given a WebP source image and a cold cache
    When GET /api/image/?w=720&fmt=webp is called
    Then the response is returned in under 0.3 s
```

## Assignment

Primary owner: Backend Developer
Support agents: Tester (unit test for encode skip, timing benchmark), Reviewer (format detection logic)

## Likely Files Or Areas

- `maintenance/views.py` (image transform handler, ~line 233)
- `mtravel_async/` image read task (`image_read.py`)
- Any shared image-transform utility/service class used by both sync and async paths

## Plan

1. Identify the transform entry point shared by sync (`maintenance/views.py`) and async (`image_read.py`) paths.
2. After opening the source image with Pillow, add a short-circuit check:
   ```python
   if source_img.format.lower() == output_format.lower() and source_img.width <= requested_w:
       return raw_source_bytes  # skip encode
   ```
3. Ensure `raw_source_bytes` are read before the Pillow open (or read again cheaply from the already-fetched S3 response).
4. Write unit test: mock `Image.save` and assert it is NOT called on the passthrough path.
5. Benchmark cold `?w=720` on a WebP source before and after.

## Validation

```bash
# Timing benchmark — cold cache (flush relevant key first)
python manage.py shell -c "
import time
from django.core.cache import caches
caches['images'].clear()
"

time curl -o /dev/null -s \
  "https://metravel.by/api/image/?url=<webp_s3_path>&w=720&fmt=webp"
# Target after fix: ≤ 0.30 s (baseline ~1.1 s)

# Unit test
python manage.py test maintenance.tests.test_image_transform.SkipEncodePassthroughTestCase -v 2
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
