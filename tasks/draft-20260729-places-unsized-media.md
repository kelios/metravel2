# TASK-DRAFT-20260729-PLACES-MEDIA: [FE-PLACES-PERF] Original address images in 300 px cards

Status: Backlog
Owner: Developer
Support: Performance Analyst, Reviewer
Created: 2026-07-29
Updated: 2026-07-29

> Временный fallback-черновик: board MCP не стартует из-за отсутствующего
> backend MCP checkout. После восстановления MCP создать карточку в sprint `1`,
> связать с `#1113/#152/#725`, затем удалить файл.

## Board payload

- area: `front`
- kind: `bug`
- status: `todo`
- sprint_id: `1`
- related_to_ids: `1113`, `152`, `725`
- problem key: `MEDIA-001`
- problem-memory verdict: `create-linked` — invariant общий, но подтверждённая
  причина новая: places consumer запрещает web optimizer для fallback originals.

## Goal

Ни одна `/places` card не должна загружать исходный `address-image` 1024 px в
слот около 300 px только потому, что у записи отсутствует готовый `thumb_400`.

## Context

Live `https://metravel.by/places`, desktop web 2026-07-29:

- 22 address images появились после первого scroll; большинство уже являются
  `thumb_400`, но две fallback records пришли исходниками 1024 px;
- CSS slots: около 299–323 px;
- original 1: 287 902 B; тот же URL с `w=480&q=70&fit=cover`: 41 572 B;
- original 2: 222 750 B; `w=480`: 33 810 B;
- экономия на двух карточках — 435 270 B (85.3%) без потери полезного размера;
- `components/places/PlaceListCard.tsx` безусловно передаёт
  `mediaProps.optimizeWeb=false`, поэтому fallback original не ресайзится.

## Acceptance Criteria

- [ ] Готовый canonical `thumb_400` не получает лишний второй URL/transform.
- [ ] Fallback same-origin `address-image` без bounded variant получает
      поддерживаемый `w<=480` для desktop card slot около 300 px.
- [ ] На live `/places` нет image с `naturalWidth > cssWidth * 2.6` и нет
      same-origin original fallback без bounded source.
- [ ] Initial/first-scroll image bytes уменьшаются минимум на 400 KB на текущем
      representative page; zero image 4xx/5xx.
- [ ] Card geometry, contain/placeholder, actions and navigation unchanged on
      desktop web, mobile web and Android paired flow.

## Gherkin Tests

```gherkin
Feature: Bounded place card media

  Scenario: A place without a generated thumbnail uses the image proxy
    Given a catalogue record whose only image is a 1024 pixel address-image
    When the place is rendered in a 300 pixel card
    Then the selected production URL is bounded to at most 480 pixels
    And the card does not download the original file
```

## Task Contract

Scope: media source selection in `utils/placesCatalog.ts` and
`components/places/PlaceListCard.tsx`, focused tests and live `/places` network
probe. Preserve already-generated canonical thumbs.

User-visible result: place cards appear faster and use less traffic without
becoming blurry.

Data/API contract: no backend field change required; use current
`thumb_url/landscape_url` and supported same-origin proxy query contract.

Platform impact: shared desktop web, mobile web and Android.

Localization impact: none.

Dependencies: none; linked backend thumbnail completeness can be investigated
separately, but FE must bound a valid fallback.

Fallback/mock policy: neutral placeholder only when URL is absent/broken; no
mock thumbnail and no original-as-success fallback.

Validation: real URL-builder path, desktop/mobile browser DOM+network, byte
comparison for both current examples, paired Android card check.

Regression control: test mixed payload (`thumb_400` plus original fallback) and
route budget for unsized same-origin media/oversized ratio.

Done gate: deploy and repeat the exact live `/places` probe; no originals in
300 px cards and measured saving >=400 KB. Without live post-deploy evidence
stay `testing`.

## Progress Log

- 2026-07-29: two production examples and byte deltas confirmed; implementation
  not started.

