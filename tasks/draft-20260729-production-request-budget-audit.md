# TASK-DRAFT-20260729-PROD-AUDIT: [FE-PERF] Public route request/media budget audit

Status: In Progress
Owner: Performance Analyst
Support: QA, Reviewer, Feature Owners
Created: 2026-07-29
Updated: 2026-07-29

> Временный fallback-черновик: board MCP не стартует из-за отсутствующего
> backend MCP checkout. После восстановления MCP создать карточку в sprint `1`,
> связать с `#1053/#1103/#1111/#1113/#1115/#1116/#1120/#1137`, затем удалить
> файл. Direct board writes через `curl` не использовать.

## Board payload

- area: `front`
- kind: `task`
- status: `in_progress`
- sprint_id: `1`
- related_to_ids: `1053`, `1103`, `1111`, `1113`, `1115`, `1116`, `1120`, `1137`
- problem key: `MEDIA-001` (audit/control layer)
- problem-memory verdict: `create-linked` — это production route-matrix и
  regression-control работа, не competing implementation task.

## Goal

Построить воспроизводимую production matrix по ключевым публичным маршрутам,
найти page-level request/API/media waste, и для каждого подтверждённого breach
переоткрыть каноническую задачу либо создать linked task с числовым evidence.

## Acceptance Criteria

- [ ] Проверены desktop и mobile web для `/`, `/travelsby`, `/articles`,
      `/places`, `/quests`, `/map`, representative travel/article/quest detail.
- [ ] Для каждого route записаны URL, viewport/browser/DPR, auth/cache state,
      initial request count, API endpoint families, image count/bytes, eager/lazy,
      unsized sources, oversized ratio, duplicate variants and 4xx/5xx.
- [ ] Для catalog/detail lazy flows повторён замер после controlled scroll.
- [ ] Auth-dependent запросы сравнены в guest и authenticated state, где это
      влияет на `user-points`, favorites, profile/status endpoints.
- [ ] Каждый P0/P1 breach имеет Problem Memory Verdict и canonical board link;
      нет competing duplicate tickets.
- [ ] Для повторяющихся media/source/pagination дефектов определён route-level
      regression guard, который падает по request/byte/cardinality budget.

## Gherkin Tests

```gherkin
Feature: Production request budget audit

  Scenario: A public route exceeds its network budget
    Given the route is measured on live production with recorded browser state
    When request, API, and media budgets are collected before and after scroll
    Then every confirmed breach is linked to one canonical task
    And that task contains numeric reproduction and a post-deploy Done gate
```

## Task Contract

Scope: read-only browser/GET audit and task routing. No deploy and no feature
implementation inside the audit task.

User-visible result: performance regressions become visible before closure and
each confirmed issue has an owned, measurable fix task.

Data/API contract: existing public GET endpoints only; no mutating probes.

Platform impact: desktop web and mobile web audit; Android is required in each
linked shared fix, not as a substitute for live web measurements.

Localization impact: none for audit; use RU default consistently, then spot-check
locale-specific route fan-out only where findings indicate it.

Dependencies: board MCP availability for sync; audit itself proceeds read-only.
MCP outage is not `blocked_by` for measurement.

Fallback/mock policy: no mocked network evidence and no dev-bundle counts.

Validation: live production browser asset/network inventory, safe GET byte/time
probes, repeatable route matrix, problem-memory and board dedupe.

Regression control: resulting committed route budget(s) must measure the real
construction path; `200`, visible page, build success, or one optimized element
is not a pass.

Done gate: route matrix complete, all confirmed P0/P1 findings routed, and no
untriaged breach remains. Individual fix tasks close only after their own live
post-deploy before/after evidence.

## Progress Log

- 2026-07-29: audit started on live production. `/` healthy in sampled initial
  state. `/quests`: 15 API calls total, including 7 quest pages and 5 city pages;
  137 cover DOM nodes select `w=1280` in 420 px slots on current production.
- 2026-07-29: `/travelsby`: first loaded list state shows six API families and
  bounded unique image requests, but 15 web card layers are marked eager; keep
  under observation until cold byte inventory distinguishes intended bounded
  virtualization from a real budget breach.
- 2026-07-29: `/articles`: four API families after first scroll; no confirmed
  media breach in the sampled state.
- 2026-07-29: `/places`: ten API requests after first scroll; four are separate
  collection-count catalog calls and one is authenticated
  `user-points?perPage=1000`. Two unsized original address images waste 435270 B;
  linked fix draft created. Count/user-points calls require guest/auth comparison
  before being classified as defects.
- 2026-07-29: representative travel detail opened without initial foreign-screen
  API fan-out in the sampled state; deeper cold/scroll byte pass remains.

