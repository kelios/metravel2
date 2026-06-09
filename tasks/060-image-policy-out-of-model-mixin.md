# TASK-20260609-060: Extract image processing policy from model mixin into a service

Status: Backlog
Owner: Backend
Support: Developer (BE), Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Move image processing business policy (watermark, resize, WebP conversion, quality) out of `BaseFields.set_image()` mixin and into a dedicated image-processing service, so the policy can be configured per use-case and tested without going through the ORM.

## Context

`metravel/common/models.py:68` — `set_image()` mixin method:

- Line ~94: hardcodes watermark text `"MeTravel.by"`
- Hardcodes resize to 1024px
- Hardcodes WebP conversion with `quality=85`
- Shared by Travel, Profile, Gallery models

Problems:
- Watermark is inappropriate for avatar/profile images but applied universally.
- Policy cannot change without editing the model base class.
- Integration-only testable (requires ORM/DB).
- Constants are also duplicated in `maintenance/views.py` and `mtravel_async` (see TASK-059).

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] `BaseFields.set_image()` (or its replacement) contains no hardcoded watermark text, resize pixel value, or quality integer.
- [ ] An `ImageProcessingService` (or equivalent) receives policy config (watermark: yes/no, max_width, quality) and applies it; the model passes the appropriate config.
- [ ] Profile/avatar images do not receive a watermark; travel images continue to receive one.
- [ ] The service is unit-testable without touching the database.
- [ ] Existing image processing behavior for Travel and Gallery is unchanged — same output dimensions, quality, watermark position.
- [ ] Tests cover: watermark applied to travel, watermark skipped for avatar, resize to configured width, WebP output.

## Gherkin Tests

```gherkin
Feature: Image processing policy is configurable per model

  Scenario: Travel image receives watermark
    Given an ImageProcessingService configured with watermark enabled
    When a travel image is processed
    Then the output image contains the watermark text

  Scenario: Profile avatar image does not receive watermark
    Given an ImageProcessingService configured with watermark disabled
    When a profile avatar image is processed
    Then the output image contains no watermark text

  Scenario: Service is testable without ORM
    Given a PIL Image object and a processing config
    When ImageProcessingService.process(image, config) is called
    Then it returns a processed PIL Image without any database interaction

  Scenario: Resize respects configured max_width
    Given a config with max_width=800
    When a 2000px wide image is processed
    Then the output image width is 800px
```

## Assignment

Primary owner: Backend developer
Support agents: Tester (image output regression for all model types), Reviewer (config contract review)

## Likely Files Or Areas

- `metravel/common/models.py` (lines 68–~110 — `set_image()` mixin)
- New file: `metravel/common/image_processing_service.py` (or `metravel_shared/image_processing.py`)
- `travels/models.py` — call site for `set_image`
- `users/models.py` — call site for `set_image` on Profile
- `maintenance/models.py` — call site for `set_image` on Gallery
- `tests/` — new unit tests for the service

## Plan

1. Extract the image processing logic from `set_image()` into `ImageProcessingService.process(image, config)`.
2. Define a config dataclass/dict: `{watermark: bool, watermark_text: str, max_width: int, quality: int, output_format: str}`.
3. Update `BaseFields.set_image()` (or remove it) so each model provides its config; the mixin delegates to the service.
4. Set per-model configs: Travel/Gallery get watermark, Profile gets no watermark.
5. Write unit tests for the service (no DB required).
6. Run full test suite to confirm no regressions.

## Validation

```bash
# Unit tests for the new service
pytest tests/test_image_processing_service.py -v

# Integration: upload a profile avatar and confirm no watermark
curl -s -X PATCH -H "Authorization: Token <token>" https://metravel.by/api/users/profile/ \
  -F "avatar=@test_avatar.jpg" | jq .avatar

# Integration: upload a travel image and confirm watermark present
# (visual inspection or pixel-level assertion in test)

# Full test suite
pytest tests/ -x -q
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
