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
| `search_submit` | `source=travel_catalog`, `event_category=travel_catalog`, `query_len`, `has_filters`, `search_term?`, `outcome` (`found` / `empty` / `error`), `results_count?`, `relaxed_filters?` | устоявшийся запрос с исходом. Число результатов есть при успешном ответе, включая 0 |
| `search_result_click` | `source=travel_catalog`, `event_category=travel_catalog`, `search_term?`, `travel_id`, `position` (начиная с 1), `results_count`, `has_filters`, `relaxed_filters` | первое открытие карточки маршрута из выдачи данного запроса и фильтров |
| `view_search_results` | параметры `search_zero_results` + `results_count`, `relaxed_filters` | выдача непустая |
| `search_zero_results` | `source=travel_catalog`, `query_len`, `has_filters`, `search_term?` | выдача пустая |
| `search_sort_change` | `sort` (`distance`, `relevance`, `newest`, …), `source=travel_catalog` | явный выбор сортировки каталога: тулбар, шторка фильтров, снятие чипа (#2903); координаты точки отсчёта не передаются |

`search_term` уходит только через PII-фильтр `utils/analyticsSearchTerm.ts`.
Имя `view_search_results` совпадает с автособытием GA4 Enhanced measurement
(site search по параметру `search` в URL). Решение: имя оставляем — это
рекомендованное событие GA4; наши отличаются `ui_source = travel_catalog`, и
отчёт по поиску маршрутов строится с этим фильтром. Автособытие можно выключить
в настройках потока GA4 (owner action), тогда фильтр перестанет быть нужен.

Для отчёта в GA4 выберите `search_submit` и `search_result_click` с
`event_category=travel_catalog`, добавьте `search_term` и `outcome` из
специальных измерений. Для открытых карточек используйте отдельный разрез
`search_result_click` по `travel_id` и `position`. Для этих двух параметров
начинайте сравнение с полных дней после регистрации в GA4 16.11.2026.
Поисковая попытка с исходом `found` — знаменатель для
доли попыток с открытием карточки. `empty` подсказывает, что проверить в
каталоге или подборе. `error` указывает на техническую проблему. Выделяйте
строки без фразы и `(other)` отдельно. Используйте окно после выката и
совпадающие фильтры источников и устройств. Повторное открытие карточки в
рамках той же попытки не увеличивает долю. После смены исхода при
повторной загрузке фиксируется новая попытка. Открытие до таймера или
сразу после согласия фиксирует попытку и переход одним действием. Клики по дополнительным блокам квестов и мест,
показанным рядом с выдачей, ведутся отдельно.

### Действия в статье о маршруте (`/travels/*`)

| Событие | Параметры | Смысл |
|---|---|---|
| `travel_detail_action` | `event_category=travel_detail`, `event_label` (`section_description`, `section_map`, `section_points`, `contact_phone`), `travel_id` | Явный переход к описанию, карте или координатам, либо нажатие на телефонную ссылку в тексте |
| `travel_navigator_open` | `travel_id`, `provider` | выбор навигатора и попытка его открытия |
| `travel_gpx_download` | `travel_id`, `points` | браузер или платформа приняла файл маршрута к сохранению |

В GA4 используйте путь страницы без параметров, `event_label`, источник
сеанса и тип устройства. Для доли визитов с действием используйте число
сеансов, в которых произошло действие, и число сеансов с просмотром той же
страницы. Число действий может превышать число сеансов. Нажатие на ссылку
телефона учитывается без передачи номера и показывает намерение связаться.
Номера, опубликованные обычным текстом, такого события не дают. Метрика
показывает параметры этих событий после настройки отдельных целей с
идентификаторами `search_submit`, `search_result_click` и `travel_detail_action`.

### Карта (`/map`, #2908)

Только web, отправка — `utils/mapAnalytics.ts`. Параметры этих событий не
содержат координат, адресов и текста поиска.

| Событие | Где | Параметры | Смысл |
|---|---|---|---|
| `map_open` | `useMapAnalytics` | `entry` (`direct` / `place_link` / `coords_link`), `layout` (`mobile` / `desktop`) | экран получил фокус: вкладка карты после первого визита остаётся смонтированной, поэтому событие — на каждый переход в фокус, а не на монтирование |
| `map_filter_change` | `useMapAnalytics` → `onFilterChange` фильтров (панель и мобильные поповеры) | `filter` (`categories` / `categoryTravelAddress` / `radius` / `reset`), `value_count?`, `radius_km?` | выбор категории, радиуса или сброс; ввод текста (`searchQuery`, `address`) событием не считается |
| `map_place_search` | `useMapDataController` и результат запроса из `useMapTravels` | `outcome` (`found` / `empty` / `error`), `layout`, `radius_km` | завершившийся поиск места по названию в режиме радиуса. Повторный запрос данных с тем же текстом и радиусом в открытом экране не считается. Для разреза по исходу в GA4 нужен параметр события `outcome`, в Метрике — отдельная JavaScript-цель `map_place_search` |
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

### Приложение (mobile web)

| Событие | Где | Параметры | Смысл |
|---|---|---|---|
| `AppInstallBar_Shown` / `_Click` / `_Dismiss` | `components/layout/AppInstallBar.tsx` | `platform`, `signal` | плавающая плашка после сигнала намерения (#2907); на странице квеста не показывается (#3220) |
| `QuestAppOffer_Shown` / `QuestAppOffer_Click` | `components/quests/QuestAppOffer.tsx` | `platform`, `placement` (`quest_intro` / `quest_finale`) | карточка приложения в потоке страницы квеста: до старта и на финале (#3220); показ — один раз на монтирование, клик — по кнопке витрины |
| `app_download_click` | `openAppStoreListing` (все поверхности) | `source` (`home_promo`, `install_bar`, `app_page`, `about_page`, `quest_intro`, `quest_finale`), `platform` | общая цель «Скачали приложение» |

У карточки свои имена, а не `AppInstallBar_*` с параметром: `placement` не
зарегистрирован измерением GA4, и общие имена смешали бы воронку плашки
«показ → клик» с показами карточки. Согласие — по общему правилу выше.

### Блоки «Похожие» (#3292)

| Событие | Где | Параметры | Смысл |
|---|---|---|---|
| `AiPick_Click` | `components/aiPicks/AiPickCard.tsx` (проп `analyticsBlock`; задаёт `AiSimilarSection`) | `block` (`similar_travel` — «Похожие статьи» на странице статьи, `similar_quest` — «Статьи по городу» на странице квеста), `type` (`travel`), `id` статьи-соседа | клик по карточке блока, до перехода на статью; показов блока событие не считает — доля переходов меряется к просмотрам страницы |

Чтобы отчёт делился по блокам, параметр `block` регистрируется пользовательским
измерением GA4 в день выката: регистрация задним числом не действует. Карточки в
панели подбора на `/search` и в «Рядом с маршрутом» события не шлют (`analyticsBlock`
не задан).

## Как проверить

- Unit: `__tests__/utils/growthFunnelAnalytics.test.ts`,
  `__tests__/utils/mapAnalytics.test.ts`, `__tests__/hooks/map/useMapAnalytics.test.ts`,
  `__tests__/hooks/map/useMapPlaceSearchAnalytics.test.tsx`,
  `__tests__/components/common/ContributionBanner.author.test.tsx`.
- Прод: изолированный браузер, слушатель `metravel:analytics-intent`
  (`e2e/helpers/analytics.ts`) — события видны и под автоматизацией, хотя в
  счётчики не уходят.
- Отчёт: `npm run stats:ga4 -- --days 7 --events`; поиск по каталогу квестов —
  `npm run stats:ga4 -- --days 7 --quest-search`.
- **Новый параметр события → регистрация измерения GA4.** Data API отдаёт
  параметр события только как зарегистрированное event-scoped измерение
  (Администратор → Специальные определения), и регистрация не ретроактивна.
  Параметр, который нужен в отчётах по API, регистрируется в день выката
  эмиттера. Зарегистрированы (список на 09.11.2026): `auth_state`,
  `traffic_source`, `quest_id`, `city_id`, `outcome`, `radius_km`,
  `event_category`, `event_label`, `search_term` и `results_count` (#3183);
  метрика `duration_sec`. С 14.11.2026 (#3379): `match_mode` (`quest_search`),
  `catalog_order` (`quest_catalog_card_click`), `channel`
  (`quest_invite_click`); данные по ним читаются с этой даты. Без регистрации
  `runReport` отвечает 400 «is not a valid dimension».


## Воронка планировщика поездки (#3449)

Источники: `travel|quest|assistant|navigation|direct`. `auth_state=guest|authenticated`
обозначает состояние при первом переходе, сохраняется через авторизацию.
`event_category=trip_planner`, `event_label` равен источнику; транспорт GA4
переименовывает `source` в `ui_source`, отчёт использует уже зарегистрированный
`event_label`. Контекст действует 30 минут в текущей вкладке, максимум 20 входов.
В адрес формы и вложенный redirect входа добавляется только конечный
`planner_source`; он независим от `source` материала. Случайный id входа и
отпечаток канонического адреса остаются локально и не попадают в URL или события.
В хранилище нет исходных заголовков, координат и других значений формы.
Session storage используется только при согласии на аналитику; без согласия
контекст остаётся в памяти страницы, а доставка подчиняется `sendAnalyticsEvent`.
Форма выбирает последний неистёкший вход с тем же локальным отпечатком адреса;
порядок параметров и отсутствие явного `planner_source` не меняют совпадение.
При восстановлении авторизации источник переносится сразу, классификация
`auth_state` и событие входа ждут готовности сессии.

| Событие | Исход | Когда фиксируется |
| --- | --- | --- |
| `trip_planner_impression` | `visible` | ≥50% существующей кнопки планировщика в статье или помощнике; покрытие частичное |
| `trip_planner_entry` | `opened` / `auth_required` | один переход, включая направление гостя на вход |
| `trip_planner_form_view` | `ready` / `auth_required` | форма действительно доступна после восстановления сессии и чтения черновика либо показан гейт гостя |
| `trip_created` | `success` | подтверждённый ответ создания, один раз на вход; прежнее имя результата сохранено |
| `trip_create_failed` | `error` | неуспешная попытка запроса создания; повторы считаются попытками |
| `route_point_added` | `draft` | прежние события редактирования черновика, без зачёта в сохранение |
| `route_point_added` | `first_saved` | первая непустая подтверждённая сервером маршрутная точка после создания, один раз на вход |

`trip_id`, `transport`, `point_type` сохраняют прежний смысл. Непустой отправленный
черновик с пустым ответом сервера не считается сохранением. Маршрут при создании
и последующий PUT проходят один общий учёт подтверждённой точки.

«Добавить в план» (`TravelStatusButton`) открывает календарную отметку,
а не создание поездки. В статье настоящий вход — «Организовать поездку», только
для вошедшего. В помощнике карточка статьи также меняет календарную отметку;
карточка квеста и общий план по дням открывают планировщик. Эти действия
не смешиваются. `/trips/plan` перенаправляет в `/trips/my`.

Запуск, общий знаменатель, ограничения видимости/согласия и границы периода:
[отчёт планировщика](./trip-planner-funnel-report.md).
