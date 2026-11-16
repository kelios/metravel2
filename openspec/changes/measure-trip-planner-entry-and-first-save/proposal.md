## Why

Задача #3449: действия с черновиком точки выглядят как сохранение, а вход и готовая форма не связаны с подтверждённым созданием поездки. Нужно видеть переходы и исходы по источнику и состоянию входа.

## What Changes

- Общий ограниченный контекст входа travel|quest|assistant|navigation|direct, сохраняемый через авторизацию.
- События входа, доступной формы, ошибки создания и первой подтверждённой точки; переиспользование trip_created и route_point_added.
- Разделение черновиков и сохранённых точек, отчёт с одним знаменателем по источнику и исходному auth_state.
- Без редизайна, перестановки навигации и изменения backend API.

## Capabilities

### New Capabilities
- `trip-planner-funnel`: атрибуция входа и этапов подтверждённого сохранения.

### Modified Capabilities

Нет.

## Impact

Task type: analytics feature. Task-owned paths: utils/tripPlannerAnalytics.ts, hooks/useTripPlannerAnalytics.ts, hooks/usePlanTripFromSource.ts, utils/tripAnalytics.ts, hooks/usePlannedTripsApi.ts, экран создания, существующие CTA поездок, целевые тесты, документация и отчёт.
Platform impact: desktop web | mobile web; shared consumers сохраняют поведение.
Localization impact: none — новый текст интерфейса отсутствует.
API/data: только конечные значения источника, auth_state, outcome и существующий trip_id; без содержимого поездки.
SEO/accessibility: без изменений. Performance: runtime отложен до показа CTA или действия, без новых тяжёлых зависимостей. Security: согласие на аналитику соблюдается; в URL только конечный planner_source, случайный id и отпечаток цели остаются локально.
Dependencies: none. Fallback/mock policy: недоступное хранилище — память текущей страницы, без блокировки действия; моки только в unit-тестах.
Validation: Jest для переходов, ответа создания и первой сохранённой точки; scoped ESLint, TypeScript, strict OpenSpec; независимое review; один mobile web сценарий на разрешённых тестовых данных после публикации.
Risk: повторный учёт при навигации/повторе мутации. Rollback: revert коммита, существующие API и UI сохраняются.
Alternative rejected: отдельные несвязанные клики без контекста не связывают гостя с сохранением после входа.
