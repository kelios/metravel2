# План ускорения публичных страниц (PERF-013)

Создан: 2026-06-01. Сквозной план ускорения для главной, поиска, карты, мест + travel-доводка.
Источник модели: `docs/TRAVEL_PERFORMANCE_REFACTOR.md` (`SSR-first + deferred islands`). Бэклог задач: `docs/AGENT_WORKBOARD.md` (PERF-001…015).

## 1. Цель и метрики

- Целевые пороги: mobile Lighthouse ≥ 60, desktop ≥ 70; CLS < 0.1; снижение initial JS на critical path.
- Измеритель: `e2e/pages-perf-budget.spec.ts` (CWV + network + CLS-source capture), запуск `npm run e2e:perf-budget:pages`.

Baseline (desktop, e2e-сборка, локально — оптимистичнее prod):

| Страница | LCP | CLS | totalKB | jsKB | req |
|---|---|---|---|---|---|
| `/` | 868ms | 0.0006 | 2276 | 1223 | 52 |
| `/search` | 1592ms | 0.054 | 2654 | 1185 | 49 |
| `/map` | 1276ms | 0.013 | 2852 | 1241 | 38 |
| `/places` | 148ms | 0.097 | 1427 | 1185 | 46 |

Узкие места: общий `jsKB ~1.2MB` (shared `entry`/`__common`); `/map` — самый тяжёлый transfer; `/search` — LCP; `/places` — CLS у границы.

## 2. Принципы

- Точки входа важнее: главная и поиск → карта/места → доводка travel.
- Измеряй до/после каждой правки тем же perf-spec (регресс-гард).
- Маленькие поэтапные правки, не big-bang. Не ломать SSR-SEO и web cache policy.
- Каждое видимое/web-изменение → mandatory verification rule (browser + sprint + reviewer) до `Done`.
- Доменная маршрутизация: `components/MapPage/**` → `map-expert`; travel → `travel-expert`; god-файлы → `refactor-surgeon`.

## 3. Фазы

**A — Точки входа (P1):** PERF-015 (`/places` CLS), PERF-005 (`/search` список — виртуализация/lazy-image, снизить LCP).
**B — Карта (P1, `map-expert`):** PERF-008 (распил `MapQuickFilters`, defer Leaflet/панелей), PERF-009 (кластеризация маркеров, отложенный ORS, дебаунс).
**C — Сквозное shared-runtime (P2, главный резерв):** PERF-014 (аудит `entry`/`__common`, тиражировать `useWindowDimensions` + interaction-defer providers), PERF-012 (bundle-size + perf-budget regression guard в CI).
**D — Travel-доводка (P1):** PERF-006 (Этапы 4/5/7 travel-доки), PERF-007 (тяжёлые чанки Map/Comments секций).

## 4. Verification gate (каждая задача)

1. Targeted `typecheck` + `check:fast` + guards (image/external) на scope.
2. Perf-spec до/после: `npm run e2e:perf-budget:pages` (числа в evidence).
3. Browser ✅ (e2e pass / скриншот / консоль без новых ошибок).
4. Reviewer ✅ (code-review diff).
5. Sprint ✅ (Approver sign-off) → только тогда `Done`.

## 5. Риски / координация

- Параллельная dirty-работа активно коммитится — перед правкой `git status`, не лезть в чужие dirty-файлы.
- Карта/travel — только через профильных агентов (нужен явный opt-in).
- Baseline снят на e2e-сборке локально (оптимистичнее prod) — финальные пороги снять отдельной prod-URL Lighthouse задачей (вне текущего спринта).

## Рекомендуемый порядок

`PERF-015 → PERF-005 → PERF-014 (+012) → PERF-008/009 (map-expert) → PERF-006/007`
