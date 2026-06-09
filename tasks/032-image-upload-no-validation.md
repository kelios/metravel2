# TASK-20260609-032: Image upload lacks type, size and content validation

Status: Backlog
Owner: Backend
Support: Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Add proper content-type, extension whitelist, file-size limit and Pillow verification to
the maintenance image upload endpoint so that SVG-based XSS payloads, polyglot files and
oversized uploads are rejected before they reach storage.

## Context

`maintenance/serializers.py:12` uses a plain `serializers.FileField()` with no size cap,
no extension whitelist and no MIME check. The MIME type sent to storage is derived purely
from the filename extension (`maintenance/views.py:288`: `image/{file_ext.split('.')[1]}`),
which means an attacker can upload a `.png`-named SVG containing `<script>` and have it
served as `image/png`. An SVG served with any image/* content-type can still execute JS in
browsers that honour the file's actual content. A polyglot or gigabyte file is accepted
in full, loaded into `BytesIO` in RAM, causing potential memory DoS.

A correct approach already exists in the codebase: `TravelRouteUploadSerializer`
(`travels/serializers.py:577`) uses `ImageField` and Pillow `.verify()`. This task
extends the same discipline to the maintenance upload path. Complements task 013
(which covers auth on the same endpoint); this task covers content validation.

Source task:

- Source id:   TASK-013
- Source path: tasks/013-unauthenticated-image-upload.md

## Acceptance Criteria

- [ ] Upload field uses `ImageField` (or equivalent) — plain non-image files are rejected with 400.
- [ ] Allowed extensions are whitelisted (jpg, jpeg, png, webp, gif); other extensions return 400.
- [ ] File size is capped (e.g. 10 MB); oversized uploads return 400 before reading full body into RAM.
- [ ] MIME type stored/returned is derived from verified content, not from the filename extension.
- [ ] Pillow `.verify()` (or equivalent) confirms the binary is a valid image; corrupt/polyglot files return 400.
- [ ] SVG file upload is rejected with 400.
- [ ] Regression: valid JPEG/PNG uploads continue to work and return 200.

## Gherkin Tests

```gherkin
Feature: Maintenance image upload content validation

  Scenario: SVG upload is rejected
    Given an authenticated admin user
    When a file with .png extension but SVG content is uploaded to /api/maintenance/image/
    Then the response status is 400
    And the response body contains a validation error

  Scenario: Oversized file is rejected
    Given an authenticated admin user
    When a valid JPEG file exceeding 10 MB is uploaded
    Then the response status is 400
    And the response body indicates the file is too large

  Scenario: Disallowed extension is rejected
    Given an authenticated admin user
    When a .exe file is uploaded
    Then the response status is 400

  Scenario: Valid JPEG upload succeeds
    Given an authenticated admin user
    When a valid JPEG file under 10 MB is uploaded
    Then the response status is 200
    And the stored MIME type is derived from the actual image content

  Scenario: Polyglot file is rejected
    Given an authenticated admin user
    When a file that is both a valid ZIP and a valid PNG (polyglot) is uploaded
    Then Pillow verify fails and the response status is 400
```

## Assignment

Primary owner: Backend Developer
Support agents: Tester (upload security test cases), Reviewer (security review of serializer changes)

## Likely Files Or Areas

- `maintenance/serializers.py` (line 12 — replace FileField)
- `maintenance/views.py` (line 288 — MIME derivation from filename)
- `travels/serializers.py` (lines 577+ — reference implementation with Pillow verify)
- `metravel/settings/` (optional: central MAX_UPLOAD_SIZE constant)

## Plan

1. Replace `serializers.FileField()` in `maintenance/serializers.py` with `ImageField` plus
   a custom validator: extension whitelist, size limit, Pillow `.verify()`.
2. Extract shared logic into a reusable `validate_image_upload(file, max_mb=10)` helper
   (e.g. `utils/image_validation.py`) so it can be shared with `TravelRouteUploadSerializer`.
3. Update `maintenance/views.py:288` to derive MIME from the Pillow-verified format
   (`image.format.lower()`) rather than the filename extension.
4. Write unit tests covering: valid image, SVG, oversized file, bad extension, polyglot.
5. Run full maintenance + travels test suites; confirm no regression.

## Validation

```bash
# Attempt SVG upload (should get 400)
curl -s -o /dev/null -w "%{http_code}" -X POST https://metravel.by/api/maintenance/image/ \
  -H "Authorization: Token $ADMIN_TOKEN" \
  -F "file=@test.svg"
# Expected: 400

# Valid JPEG upload (should succeed)
curl -s -o /dev/null -w "%{http_code}" -X POST https://metravel.by/api/maintenance/image/ \
  -H "Authorization: Token $ADMIN_TOKEN" \
  -F "file=@valid.jpg"
# Expected: 200

# Run test suite
python manage.py test maintenance -v 2
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
