# Фича: словарь событий аналитики (web)

**Последняя актуализация:** 2026-11-01 (#2908)
**Ответственный:** frontend

## TL;DR

Какие продуктовые события web-клиент отправляет в GA4 и Яндекс.Метрику, откуда,
с какими параметрами и при каком условии. Документ нужен, чтобы ноль в отчёте
читался однозначно: «действия не было», «событие не размечено» или «событие
не разрешено согласием». Native-телеметрия живёт отдельно (#2840–#2843) и здесь
не описывается.

## Транспорт

| Функция | Когда | Файл |
|---|---|---|
| `sendAnalyticsEvent` | синхронно с действием; для кликов, после которых вкладка уходит в фон или страница перезагружается | `utils/analytics.ts` |
| `queueAnalyticsEvent` | отложенно (`requestIdleCallback`, ≤2 с); для показов, шагов и SPA-переходов | `utils/analytics.ts` |

- На границе GA параметр `source` переименовывается в `ui_source`, `client_id` и
  `session_id` — в `metravel_client_id` / `metravel_session_id` (#2659): иначе
  они перетирали бы атрибуцию трафика GA. В отчётах GA фильтровать по `ui_source`;
  Метрика получает исходные имена.
- Имя цели Метрики — имя события, приведённое к `[A-Za-z0-9_]{1,64}`.
- Каждое событие один раз публикуется в окно как `metravel:analytics-intent` ещё
  до проверки согласия — на этом держатся e2e-пробы (`e2e/helpers/analytics.ts`).

## Согласие и автоматизация — правило чтения нуля

Модель opt-in (`utils/consent.ts`, ключ `metravel_consent_v1`; загрузчик —
`utils/analyticsInlineScript.ts`):

1. **Все** web-события, включая показы и шаги воронок, уходят в GA4 и Метрику
   только при `analytics: true`. Исключений «всегда отправлять» нет.
2. Событие, случившееся до согласия, **не копится**: `deliverWebAnalyticsEvent`
   отбрасывает его, а не ставит в очередь. Согласие не досылает прошлое.
   Очередь существует только для «согласие есть, счётчик ещё грузится».
3. Под автоматизацией (`navigator.webdriver`) события не отправляются никогда
   (#2192): наши e2e и приёмочные пробы в отчёты не попадают.

Следствие: абсолютные числа событий — нижняя граница поведения людей, давших
согласие. Доли внутри одной воронки (клик / показ, финиш / старт) сопоставимы,
потому что обе стороны режутся одним фильтром. Сравнивать событие GA с числом
из API (публикации, регистрации) напрямую нельзя — только как «есть / нет»
при достаточном объёме, с поправкой на долю согласий.

## Словарь

### Контент и публикация

| Событие | Где | Параметры | Смысл |
|---|---|---|---|
| `content_create_cta_impression` | `TravelArticleShareTripCta`, `ContributionBanner` (все варианты) | `content_type`, `source`, `intent`, `auth_state`, `source_travel_id?` | показ призыва «рассказать о поездке», ≥50 % в видимой области, один раз на ключ; обе поверхности ждут восстановления сессии (`authReady`), чтобы вошедший не считался ещё и гостем |
| `content_create_cta_click` | те же поверхности + вкладки `search`, `travelsby`, `BecomeAuthorScreen`, `UpsertTravelView` | как у показа + `action`, `variant?`, `mode?` | клик по призыву; CTR считать только по поверхностям, где есть и показ (`source` совпадает) |
| `route_create_started` | `UpsertTravelView` | `mode`, `source`, `travel_id?` | открыт мастер создания |
| `route_create_publish_attempt` / `_blocked` / `_error` | `useTravelPublishModeration`, `useTravelNoteFlow` | `mode`, `step`, `missing_fields_count`, `first_missing_field`, `error_type` | попытка отправить на модерацию и её исход |
| `travel_publish` | там же, после успешного ответа API сохранения с `intent: 'submit'` | `mode` (`note`/`full`), `travel_id`, `step`, чек-лист | маршрут **отправлен на модерацию** (не одобрен) |
| `wizard_moderation_attempt` / `_success` | `useTravelPublishModeration` | `travel_id`, чек-лист | дубль-детализация мастера, старше `travel_publish` |

`travel_publish` ≠ `published_at` в API: событие — момент отправки автором,
`published_at` — одобрение модератором. Сверка 01.11.2026: «66 публикаций не
автора 1 в августе» из `stats:summary` — это массовое проставление
`published_at` 04.08.2026 (все 66 в одну дату), а не действия авторов; в сентябре
таких публикаций 3, в октябре 0. При этом в GA4 за 02.09–31.10 нет ни одного
`route_create_publish_attempt` и всего 7 `wizard_step_view` от 3 пользователей —
ноль `travel_publish` соответствует реальности, а не потере события.

### Поиск маршрутов (`/search`, #2895)

| Событие | Параметры | Смысл |
|---|---|---|
| `search_submit` | `source=travel_catalog`, `query_len`, `has_filters`, `search_term?` | устоявшийся запрос + фильтры |
| `view_search_results` | + `results_count`, `relaxed_filters` | выдача непустая |
| `search_zero_results` | как у `search_submit` | выдача пустая |

`search_term` уходит только через PII-фильтр `utils/analyticsSearchTerm.ts`.
Имя `view_search_results` совпадает с автособытием GA4 Enhanced measurement
(site search по параметру `search` в URL). Решение: имя оставляем — это
рекомендованное событие GA4; наши отличаются `ui_source = travel_catalog`, и
отчёт по поиску маршрутов строится с этим фильтром. Автособытие можно выключить
в настройках потока GA4 (owner action), тогда фильтр перестанет быть нужен.

### Карта (`/map`, #2908)

Только web, отправка — `utils/mapAnalytics.ts`; координаты, адреса и текст
поиска не передаются.

| Событие | Где | Параметры | Смысл |
|---|---|---|---|
| `map_open` | `useMapAnalytics` | `entry` (`direct` / `place_link` / `coords_link`), `layout` (`mobile` / `desktop`) | экран получил фокус: вкладка карты после первого визита остаётся смонтированной, поэтому событие — на каждый переход в фокус, а не на монтирование |
| `map_filter_change` | `useMapAnalytics` → `onFilterChange` фильтров (панель и мобильные поповеры) | `filter` (`categories` / `categoryTravelAddress` / `radius` / `reset`), `value_count?`, `radius_km?` | выбор категории, радиуса или сброс; ввод текста (`searchQuery`, `address`) событием не считается |
| `map_marker_open` | `Map.web.tsx` → `handleMarkerZoom` → проп `onMarkerOpened`, который передаёт только экран /map (`useMapScreenController`) | `kind` (`place` / `travel_point` / `point`), `surface` (`popup` / `card`) | тап по маркеру на /map; общий `Map.web` карты квестов, планировщика и точек пользователя событие не шлёт |
| `map_route_build` | `useMapAnalytics` | `transport_mode`, `points_count`, `distance_km` (округлено) | маршрут построен; повторный расчёт той же геометрии и восстановленный после перезагрузки маршрут событие не дают |

### Вход и регистрация

| Событие | Где | Параметры | Смысл |
|---|---|---|---|
| `AuthViewed` | `LoginForm` → `trackAuthGateViewed` | `source = intent`, `intent` | показ формы входа, открытой с намерением |
| `login_success` | `LoginForm` (email, Google, Apple, Facebook) → `trackLoginSucceeded` | `method`, `intent` (пусто без намерения) | любой успешный вход |
| `registration_view` / `_submit` / `_complete` / `_error` | `RegistrationForm` | `source`, `intent`, `redirect`, `method`, `reason` | воронка регистрации |
| `AuthSuccess` | `LoginForm`, `RegistrationForm` → `trackAuthGateSucceeded` | `source = intent`, `intent`, `flow` (`login` / `registration`), `method` | цель гейта: вход или регистрация, начатые с намерением. Без намерения не отправляется. Пара к `AuthViewed` — только `flow=login`: форма регистрации `AuthViewed` не шлёт, её показ — `registration_view` |

Карточка #2898 просила `auth_intent_view{intent}` / `auth_intent_success{intent, method}`:
новых имён не заводим — это уже `AuthViewed{intent}` (вход) + `registration_view{intent}`
(регистрация) и `AuthSuccess{intent, flow, method}`. Гостевые `/profile` и `/favorites`
шлют `register_cta_impression` / `cta_register_click` с `source=guest_profile|guest_favorites`.

`AuthSuccess` и `login_success` — не дубли: первое шире (включает регистрации)
и уже (только с намерением). Оба имени остаются, потому что на них настроены
цели Метрики и исторические ряды. До 01.11.2026 `AuthSuccess.source` был то
намерением, то провайдером, то константой `home` — данные до этой даты по
`source` не группировать, провайдер теперь в `method`.

## Как проверить

- Unit: `__tests__/utils/growthFunnelAnalytics.test.ts`,
  `__tests__/utils/mapAnalytics.test.ts`, `__tests__/hooks/map/useMapAnalytics.test.ts`,
  `__tests__/components/common/ContributionBanner.author.test.tsx`.
- Прод: изолированный браузер, слушатель `metravel:analytics-intent`
  (`e2e/helpers/analytics.ts`) — события видны и под автоматизацией, хотя в
  счётчики не уходят.
- Отчёт: `npm run stats:ga4 -- --days 7 --events`.
