# Social block — Metrics, Events & KPI map

**Tickets:** FE-social-metrics-doc (#464) · part of Sprint 13 «Планирование поездок и совместные выезды».

Единый источник правды по тому, **что и где меряем** в социальном блоке (подписки → поездки → совместные выезды → шаринг → геймификация): соответствие **событие → KPI → спринт**. Документ — основа для месячного growth-review и приёмки телеметрических BA-тикетов каждого спринта.

Связанные документы:
- [`docs/GROWTH_PLAN.md`](../GROWTH_PLAN.md) — baseline-метрики (GSC / Yandex Metrika / GA4) и общий план роста. **KPI-значения и таргеты живут там**, здесь — только маппинг событий.
- [`docs/features/social-trips-gamification-backlog.md`](./social-trips-gamification-backlog.md) — BA-бэклог соц-блока (спринты A–I): проблема, гипотеза, user stories, North Star, KPI, монетизация, риски. Master-источник формулировок North Star/KPI ниже.
- [`docs/features/social-trips-gamification-roadmap.md`](./social-trips-gamification-roadmap.md) — продуктовый spec-лист (концепции).

---

## 1. Как мы шлём события

Единый трекинг-слой — [`utils/analytics.ts`](../../utils/analytics.ts). Шлёт параллельно в **GA4** (`gtag('event', …)`) и **Yandex Metrika** (`ym(id, 'reachGoal', …)`).

| Функция | Когда использовать |
|---|---|
| `queueAnalyticsEvent(name, params)` | Пассивные сигналы: просмотры, impression-события. Неблокирующая (`requestIdleCallback` на web). |
| `sendAnalyticsEvent(name, params)` | Конверсии и явные действия: создание, отправка, клик, RSVP. |
| `trackWizardEvent(...)` | Обёртка для шагов форм/визардов. |

**Типизированные обёртки.** Для фичи заводим тонкий типизированный слой поверх `sendAnalyticsEvent`, по образцу [`utils/gamificationAnalytics.ts`](../../utils/gamificationAnalytics.ts) (`trackPlaceFirstBadgeEarned`, `trackProgressionLevelUp`, …). Для Sprint D создаётся `utils/tripAnalytics.ts` (тикет **FE-trip-analytics #459**) с обёртками на события поездок.

### Соглашение об именовании
- **Имя соц-события** — `snake_case` (как в backlog и `gamificationAnalytics.ts`): `trip_created`, `route_point_added`. *(Старые UI-события в коде используют PascalCase — `HomeViewed`, `PDF_Export`; новые соц-события идут только в snake_case.)*
- **Параметры** — `snake_case`, GA4-совместимо: `trip_id`, `route_point_count`, `export_format`, `rsvp_status`.
- Пустой параметр **не передаём** (`value || undefined`, не слать `undefined`).
- Yandex Metrika режет имя цели до 64 символов и заменяет спецсимволы на `_` — держим имена короткими.

---

## 2. Маппинг по спринтам

Статус: ✅ реализовано · ⏳ требует реализации · 🔒 заблокировано бэком.

### Sprint A — Геймификация-2 (бейджи мест, прогрессии, персонажи)
**North Star:** число новых мест, добавленных пользователями в неделю.
**KPI:** % пользователей с ≥1 бейджем; D7/D30 retention earners vs non-earners; среднее мест на активного автора; рост profile-views.

| Событие | Параметры | Триггер | Статус |
|---|---|---|---|
| `place_first_badge_earned` | `place_id`, `place_name`, `date` | Получен бейдж первооткрывателя | ✅ `utils/gamificationAnalytics.ts` |
| `progression_level_up` | `line_slug`, `activity_kind`, `new_level` | Повышение уровня прогрессии | ✅ |
| `path_chosen` | `path_slug`, `character_level` | Выбран путь персонажа | ✅ |
| `character_block_viewed` | `context`, `pending_choice` | Просмотр блока персонажа в профиле | ✅ |

### Sprint C — Шаринг достижений
**North Star:** регистрации, атрибутированные расшаренным карточкам (UTM).
**KPI:** share rate (доля earners, поделившихся); CTR по карточкам; конверсия клик→регистрация.

| Событие | Параметры | Триггер | Статус |
|---|---|---|---|
| `badge_share_opened` | `badge_slug`, `channel` | Открыт диалог шаринга бейджа | ⏳ FE-share-attribution |
| `badge_shared` | `badge_slug`, `channel` | Карточка отправлена в канал | ⏳ |
| `share_card_click` | `badge_slug`, `utm_source` | Клик по расшаренной карточке (вход с UTM) | ⏳ |

### Sprint D — Планирование поездок (текущий, Sprint 13)
**North Star:** число созданных поездок/маршрутов в месяц.
**KPI:** trips created; routes exported; среднее точек на поездку; conversion место→маршрут; возвраты создателей.

Воронка: `trip_created → route_point_added → route_exported → trip_invite_sent → trip_rsvp`.

| Событие | Параметры | Триггер | Тикет / статус |
|---|---|---|---|
| `trip_created` | `trip_id`, `transport_mode`, `is_public` | Сабмит формы «Запланировать поездку» | FE-trip-create #396 · 🔒 BE-trip-model |
| `route_point_added` | `trip_id`, `point_source` (`metravel`/`custom`/`rest`/`overnight`), `route_point_count` | Добавлена точка в конструкторе маршрута | FE-trip-route-builder #397 · 🔒 BE-trip-route |
| `route_exported` | `trip_id`, `export_format` (`gpx`/`kml`/`google`/`apple`/`garmin`/`komoot`) | Экспорт/«Открыть в навигаторе» | FE-trip-export #399 · ⏳ |
| `trip_invite_sent` | `trip_id`, `invite_channel`, `invitee_count` | Отправлено приглашение/шаринг поездки | FE-trip-invite #400 · 🔒 BE-participants |
| `trip_rsvp` | `trip_id`, `rsvp_status` (`going`/`maybe`/`declined`) | Ответ участника | FE-trip-rsvp #402 · 🔒 BE-participants |
| `trip_affiliate_click` | `trip_id`, `program`, `city` | Клик по affiliate-офферу на остановке/странице поездки | FE-trip-monetization #460 · ⏳ |

> **Зависимости.** `export_format` значения навигаторов соответствуют слою [`utils/routeExport/navigator.ts`](../../utils/routeExport/navigator.ts) (`ROUTE_NAVIGATORS`, `buildNavigatorUrl`). На 2026-06-20 trips-бэкенд (`/api/trips/*`) на проде отсутствует (404) — события поездок реализуются по мере появления контракта BE-trip-model / BE-trip-route.

### Sprint E — Публичные поездки «Поехали со мной»
**North Star:** число успешно укомплектованных публичных поездок.
**KPI:** public trips published; заявок на поездку; conversion заявка→одобрение; repeat-организаторы.

> 🔒 **Launch gate:** публичные поездки нельзя выкатывать без Sprint G (trust & safety) и Sprint H (legal) — см. backlog.

| Событие | Параметры | Триггер | Статус |
|---|---|---|---|
| `public_trip_published` | `trip_id`, `seats` | Поездка опубликована в каталоге | ⏳ FE-public-trips-analytics |
| `trip_application_submitted` | `trip_id` | Подана заявка на участие | ⏳ |
| `application_approved` | `trip_id`, `applicant_id` | Заявка одобрена организатором | ⏳ |
| `application_rejected` | `trip_id`, `applicant_id` | Заявка отклонена | ⏳ |

### Подписки (фундамент соц-блока)
Не отдельный North Star, но воронка подписок питает приглашения в поездки (FE-trip-invite). Рекомендованные события (⏳, добавляются при следующем касании follow-UI):

| Событие | Параметры | Триггер |
|---|---|---|
| `user_followed` | `target_user_id`, `source` (`profile`/`subscriptions`) | Нажата «Подписаться» |
| `user_unfollowed` | `target_user_id` | Нажата «Отписаться» |

---

## 3. Сводная таблица event → KPI → sprint

| Событие | Спринт | Главный KPI | Отправка | Статус |
|---|---|---|---|---|
| `place_first_badge_earned` | A | % earners; retention | queue | ✅ |
| `progression_level_up` | A | бейджи/юзер | send | ✅ |
| `path_chosen`, `character_block_viewed` | A | adoption персонажей | queue | ✅ |
| `badge_shared`, `share_card_click` | C | share rate; signup-атрибуция | send | ⏳ |
| `trip_created` | D | trips/month (North Star) | send | 🔒 |
| `route_point_added` | D | среднее точек на поездку | send | 🔒 |
| `route_exported` | D | routes exported | send | ⏳ |
| `trip_invite_sent`, `trip_rsvp` | D | invite→rsvp conversion | send | 🔒 |
| `trip_affiliate_click` | D | affiliate CPC/revenue | send | ⏳ |
| `public_trip_published`, `trip_application_*` | E | укомплектованные поездки | send | ⏳ |
| `user_followed` | подписки | follow-граф | send | ⏳ |

---

## 4. Дашборды

- **GA4** — основной источник по событиям/воронкам; имена событий = `snake_case` выше.
- **Yandex Metrika** — цели (`reachGoal`) с теми же именами.
- **Growth-review** (месячный) сверяет фактические значения KPI с таргетами из [`docs/GROWTH_PLAN.md`](../GROWTH_PLAN.md) и отмечает, какие события уже текут в GA4, а какие ещё ⏳/🔒.

**Definition of done для телеметрии спринта:** все события спринта (1) реализованы типизированной обёрткой, (2) видны в GA4 DebugView, (3) внесены в этот документ со статусом ✅.
