# TASK-20260610-074: Перенести geo-запросы Nominatim из компонентов в React Query

Status: Backlog
Owner: Frontend
Support: Reviewer, Tester
Created: 2026-06-10
Updated: 2026-06-10

## Goal

Вынести прямые `fetch` к Nominatim (reverse-geocode и поиск локаций) из
компонентов в слой `api/*Queries.ts` на React Query, чтобы соблюсти контракт
управления серверным стейтом (кэш, дедуп, отмена, состояния загрузки/ошибки).

## Context

Архитектурное ревью 2026-06-10 (skill `/review-architecture`). Контракт CLAUDE.md:
серверный стейт — только React Query (`api/*/Queries.ts`), не raw fetch в
компонентах. Нарушения:

- `components/travel/WebMapComponent.tsx` — `fetch` reverse-geocode к Nominatim
  прямо в компоненте.
- `components/travel/LocationSearchInput.tsx` — `fetch` к Nominatim Search с
  ручным `AbortController`.

Сейчас: нет кэша (повторные запросы при тех же координатах/строке), ручная
отмена, разрозненная обработка ошибок. Риск рефактора: геопоиск и обратное
геокодирование — живой UX визарда; нужна аккуратная проверка debounce и отмены.

Source task:

- Source id: review-architecture 2026-06-10
- Source path: (этот сеанс ревью)

## Acceptance Criteria

- [ ] Reverse-geocode и search вынесены в `api/geoQueries.ts` как
      `useReverseGeocodeQuery` / `useLocationSearchQuery` (React Query).
- [ ] Включён кэш (`staleTime`) и встроенная отмена React Query вместо ручного
      `AbortController`; debounce ввода сохранён.
- [ ] В `WebMapComponent.tsx` и `LocationSearchInput.tsx` нет прямых `fetch`.
- [ ] Поведение геопоиска и подстановки адреса не изменилось (ручная проверка).

## Gherkin Tests

```gherkin
Feature: Nominatim geo lookups via React Query

  Scenario: Repeated reverse geocode is served from cache
    Given the user picked a point on the map
    When the same coordinates are reverse-geocoded again within staleTime
    Then no second network request is made and the address appears

  Scenario: Stale search responses are discarded
    Given the user types a location query and quickly changes it
    When responses arrive out of order
    Then only the result for the latest query is shown
```

## Assignment

Primary owner: Frontend
Support agents: Reviewer, Tester

## Likely Files Or Areas

- `api/geoQueries.ts` (новый)
- `components/travel/WebMapComponent.tsx`
- `components/travel/LocationSearchInput.tsx`

## Plan

1. Создать `api/geoQueries.ts`: `useReverseGeocodeQuery(lat, lon)` и
   `useLocationSearchQuery(query)` с `enabled`-гейтами, `staleTime`, корректным
   `queryKey`.
2. Заменить `fetch` в компонентах на хуки; debounce оставить на уровне ввода.
3. Убрать ручные `AbortController` (React Query отменяет по смене ключа).
4. Проверить визард: выбор точки на карте → адрес; ввод строки → подсказки.

## Validation

`npm run typecheck`, `npm run guard:external-links`, целевые Jest, ручная
проверка геопоиска в preview (карта + поле локации).

## Release Checklist

- [ ] Changed files are listed in `## Results`.
- [ ] New files created by this task are identified.
- [ ] Generated/cache/secret/local files are excluded.
- [ ] Task-scope files are staged when the user asks to prepare git.
- [ ] Skipped files and release blockers are recorded.

## Progress Log

- 2026-06-10: Created из архитектурного ревью (P1 contract).

## Results

Changed files:

Validation evidence:

Reviewer findings:

Release notes:

Blockers:
