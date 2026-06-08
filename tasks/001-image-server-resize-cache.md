# TASK-20260520-001: Image Server Resize Params And Cache Headers

Status: Open - backend byte-budget follow-up required
Owner: Backend
Support: Frontend Developer, Tester, Reviewer, Releaser
Created: 2026-05-20
Updated: 2026-06-08

## Goal

Make the image server respect resize, quality, and fit query params for gallery conversion URLs, and return a single immutable cache header so mobile travel-page LCP can drop below 4.5 seconds.

## Context

Mobile LCP on travel pages is about 10.4 seconds in PSI/Lighthouse on Moto G Power with slow 4G. Frontend already sends responsive image params such as `w=320..720`, `q=35..45`, and `fit=contain`, but the image API currently returns the same 403,920 byte JPEG for every `w` and `q` combination.

Example affected URL:

```text
https://metravel.by/gallery/3038/conversions/OykHF4I8C4hX6tTx5S6Pt3CX9IFZbaQ71oNATQJu-detail_hd.jpg?w=480&q=55&fit=contain
```

Observed reproduction:

```bash
for w in 320 480 720 1200; do
 for q in 20 35 45 80; do
   curl -sS -o /dev/null -w "w=$w q=$q -> %{size_download}b\n" \
     "https://metravel.by/gallery/3038/conversions/OykHF4I8C4hX6tTx5S6Pt3CX9IFZbaQ71oNATQJu-detail_hd.jpg?w=$w&q=$q&fit=contain"
 done
done
```

Original 2026-05-20 evidence: all tested responses were `403920b`. Alternative conversion names such as `-detail.jpg`, `-thumb_400.jpg`, `-medium.jpg`, `-mobile.jpg`, and `-responsive_320.jpg` returned `404`; only `detail_hd` existed. Current 2026-06-05 status is improved but still not fully within the byte-budget acceptance criteria; see the progress log below.

Original response headers also included conflicting duplicates:

```text
cache-control: public, max-age=31536000, immutable
cache-control: public, max-age=3600, must-revalidate
```

and duplicate `Vary` values (`origin`, `Accept`).

Source task:

- Source id:
- Source path: production image API + mobile LCP profiling (PSI/Lighthouse, Moto G Power slow 4G)

## Acceptance Criteria

- [x] `/gallery/{id}/conversions/{hash}-{variant}.jpg` respects `?w=<int>` for verified widths `480`, `720`, and `1200`.
- [x] The endpoint respects `?q=<int>` for verified quality values `20`, `55`, and `80`.
- [ ] The endpoint respects `?fit=contain|cover`.
- [x] Content negotiation returns WebP when `Accept` includes `image/webp`.
- [ ] Content negotiation returns AVIF when `Accept` includes `image/avif`, if AVIF support is available in the backend image stack.
- [x] `curl '...?w=480&q=55'` returns less than `80 KB`.
- [x] `curl '...?w=720&q=60'` returns less than `130 KB`.
- [ ] Target WebP sizes are met or improved: `w=480&q=55 <= 60 KB`, `w=720&q=60 <= 110 KB`, `w=1200&q=65 <= 220 KB`.
- [x] Response contains exactly one `Cache-Control` header: `public, max-age=31536000, immutable`.
- [x] Response contains `Vary: Accept` and does not include duplicate/conflicting `Vary` values.
- [ ] After deployment, PSI mobile LCP on at least one representative travel page is below `4.5 s`.

## Gherkin Tests

```gherkin
Feature: Responsive gallery image delivery

  Scenario: Smaller requested widths return smaller files
    Given an existing gallery conversion URL for detail_hd
    When the client requests the image with w=480, q=55, and Accept including image/webp
    Then the server returns an image/webp response smaller than 80 KB
    And the image width is no larger than 480 pixels

  Scenario: Cache headers are stable for versioned image URLs
    Given an existing gallery conversion URL with versioned query params
    When the client requests the image
    Then the response has exactly one Cache-Control header
    And the Cache-Control header is "public, max-age=31536000, immutable"
    And the Vary header is "Accept"

  Scenario: AVIF is preferred when supported
    Given the backend image stack supports AVIF encoding
    When the client requests the image with Accept including image/avif
    Then the server returns an image/avif response
```

## Assignment

Primary owner: Backend developer
Support agents: Frontend developer for verification URLs and expected srcset behavior; Tester for curl, header, and PSI validation; Reviewer for cache and image-negotiation review.

## Likely Files Or Areas

- Backend image delivery route for `/gallery/{id}/conversions/{hash}-{variant}.jpg`
- Backend media/conversion storage lookup for `detail_hd`
- Image resize/encode pipeline
- HTTP response header middleware for media/gallery responses
- CDN or reverse proxy media cache configuration, if it overrides backend headers

## Plan

1. Locate the backend handler that serves gallery conversion files.
2. Preserve current `detail_hd` source lookup as the origin image when alternative conversion names are missing.
3. Parse and validate `w`, `q`, and `fit` query params using a strict allowlist/range.
4. Resize from the source image and encode according to `Accept`, preferring AVIF when supported, then WebP, then JPEG fallback.
5. Set exactly one cache policy for these versioned image URLs: `Cache-Control: public, max-age=31536000, immutable`.
6. Set `Vary: Accept` once and remove duplicate/conflicting cache or vary header sources.
7. Add backend tests for size variation, content type negotiation, and headers.
8. Deploy to the target environment and run curl plus PSI validation.

## Validation

```bash
for w in 480 720 1200; do
  curl -sS -H "Accept: image/webp" -o /dev/null \
    -w "w=$w -> %{http_code} %{content_type} %{size_download}b\n" \
    "https://metravel.by/gallery/3038/conversions/OykHF4I8C4hX6tTx5S6Pt3CX9IFZbaQ71oNATQJu-detail_hd.jpg?w=$w&q=55&fit=contain"
done
```

```bash
curl -sSI -H "Accept: image/webp" \
  "https://metravel.by/gallery/3038/conversions/OykHF4I8C4hX6tTx5S6Pt3CX9IFZbaQ71oNATQJu-detail_hd.jpg?w=480&q=55&fit=contain"
```

Expected header checks:

- exactly one `Cache-Control`
- `Cache-Control: public, max-age=31536000, immutable`
- `Vary: Accept`
- `Content-Type: image/webp` for WebP requests
- `Content-Type: image/avif` for AVIF requests when supported

Post-deploy performance check:

- PSI or Lighthouse mobile on a representative travel page must show LCP below `4.5 s`.

## Release Checklist

- [ ] Changed files are listed in `## Results`.
- [ ] New files created by this task are identified.
- [ ] Generated/cache/secret/local files are excluded.
- [ ] Task-scope files are staged when the user asks to prepare git.
- [ ] Skipped files and release blockers are recorded.

## Progress Log

- 2026-05-20: Created from reported production image API behavior and mobile LCP profiling.
- 2026-06-04: Re-verified against production `metravel.by`. Resize/content negotiation and headers are partly fixed: `w=480&q=55` returns WebP `51,362b`, `w=720&q=55` returns WebP `112,680b`, `w=1200&q=55` returns WebP `241,698b`; response has a single `Cache-Control: public, max-age=31536000, immutable` and `Vary: Accept`. The task stays active because the target WebP budget for `w=1200` (`<=220KB`) is still missed, and post-deploy PSI/LCP validation is not recorded.
- 2026-06-05: Re-verified after backend handoff. `q` is active (`w=480`: `q=20` -> `27,246b`, `q=55` -> `51,362b`, `q=80` -> `74,752b`). WebP works. Header contract is fixed. Remaining failures: `Accept: image/avif` returns JPEG, and `w=1200&q=65` returns `268,680b`, above the `<=220KB` target. Frontend follow-up completed in `api/places.ts` for the separate backend pagination change; travel LCP hero already requests mobile `w=720` variants and targeted image-contract Jest checks pass.

## Results

Changed files: `api/places.ts`, `__tests__/api/places.test.ts` for the frontend catalog pagination follow-up triggered by backend pagination.

Validation evidence: 2026-06-05 production curl probes for `w=480`, `w=720`, `w=1200`, `q=20/55/80`, `Accept: image/webp,image/*,*/*`, `Accept: image/avif`; targeted Jest:
`npm run test:run -- __tests__/components/travel/TravelDetailsContainer.performance.web.test.tsx __tests__/components/travel/sliderParts.utils.web.test.ts __tests__/components/ui/ImageCardMedia.blur.web.test.tsx`.

Reviewer findings:

Release notes:

Blockers: backend image encoder/quality tuning still needed for the `w=1200&q=65` byte budget; AVIF negotiation is not complete if the backend stack is expected to support AVIF; PSI/Lighthouse mobile LCP validation still pending after final backend tuning.
