# TASK-DRAFT-20260729-QUESTS-API: [FE-QUESTS-PERF] `/quests` loads 12 paginated catalog requests

Status: Backlog
Owner: Developer
Support: Performance Analyst, Reviewer
Created: 2026-07-29
Updated: 2026-07-29

> Временный fallback-черновик: board MCP не стартует из-за отсутствующего
> backend MCP checkout. После восстановления MCP создать карточку в sprint `1`,
> связать с `#1053/#735/#734`, затем удалить файл.

## Board payload

- area: `front`
- kind: `bug`
- status: `todo`
- sprint_id: `1`
- related_to_ids: `1053`, `735`, `734`
- problem key: `QUEST-CATALOG-REQUEST-001`
- problem-memory verdict: `create-linked` — симптом найден в том же `/quests`
  flow, но причина не media: sequential pagination policy `fetchAllPages`.

## Goal

Сократить initial quest catalog API fan-out с 12 запросов к списку/городам до
трёх, не меняя состав 137 квестов и 95 городов.

## Context

Live browser audit `https://metravel.by/quests` 2026-07-29:

- `/api/quests/` запрашивается 7 страниц;
- `/api/quests/cities/` запрашивается 5 страниц;
- суммарно эти ответы — 20 937 B compressed для quests и 3 668 B для cities,
  но последовательный fan-out добавляет 12 round trips (отдельные пробы дали
  около 0.25–0.89 s на запрос);
- read-only production probe подтвердил: `?perPage=100` отдаёт 100 + 37 quests
  в двух запросах и все 95 cities в одном. Итого три запроса без backend change.

Причина: `api/quests.ts::fetchAllPages` стартует с bare path и следует default
20-item pagination, хотя endpoint уже поддерживает bounded `perPage=100`.

## Acceptance Criteria

- [ ] `fetchQuestsList` получает все 137 записей максимум за 2 requests при
      текущем production count; `fetchQuestCities` — максимум за 1 request.
- [ ] Порядок, city grouping, offline cache, React Query key и fallback semantics
      не меняются.
- [ ] AbortSignal прекращает оставшиеся page requests.
- [ ] Live `/quests` initial audit показывает ровно 3 catalog page requests,
      без дублирующего bare `/quests/`/`cities/` запроса.
- [ ] Quest cards, filters, city grouping and detail navigation unchanged on
      desktop web, mobile web and paired Android flow.

## Gherkin Tests

```gherkin
Feature: Bounded quest catalogue pagination

  Scenario: Full catalogue uses the largest supported bounded page
    Given production has 137 quests and 95 quest cities
    When the quest catalogue loads
    Then the client makes two quest-list requests and one city-list request
    And all records remain available in the original order
```

## Task Contract

Scope: `api/quests.ts` pagination entry paths, focused API/hook tests and live
`/quests` request inventory. Do not change backend pagination limits.

User-visible result: filters and cards become usable with less serial network
latency and lower API request pressure.

Data/API contract: existing `GET /api/quests/?perPage=100` and
`GET /api/quests/cities/?perPage=100`; follow server `next` until exhausted.

Platform impact: shared desktop web, mobile web and Android.

Localization impact: none.

Dependencies: none; production endpoint capability is already verified.

Fallback/mock policy: cached offline list remains the network-error fallback;
no smaller mock catalogue may hide partial pagination.

Validation: real API construction-path test, hook test, live production request
inventory, paired mobile-web/Android quest list flow.

Regression control: test the request URLs/count and complete record count, not
only the merged array; route budget fails above 3 catalog requests.

Done gate: deploy, repeat the live `/quests` production probe, confirm exactly
3 catalogue page requests and all 137/95 records. Without deploy stay `testing`.

## Progress Log

- 2026-07-29: production fan-out measured and `perPage=100` capability verified;
  implementation not started.
