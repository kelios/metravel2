# Социальные поездки — North Star, KPI и аналитика (Sprint 13)

Спека к задаче **FE-social-metrics-doc (#464)**. Источник продуктовой логики — `docs/features/social-trips-gamification-backlog.md`. Здесь зафиксировано, какие события шлёт фронт планировщика поездок, в какой KPI они складываются и к какому шагу воронки относятся.

## North Star

**Состоявшиеся совместные поездки** (организатор отметил «Поездка состоялась» + опубликовал отчёт). Прокси-метрика роста сообщества: путешественники не просто смотрят контент, а едут вместе.

## Воронка планирования

```
создание поездки → построение маршрута → экспорт/приглашение → RSVP участников → отчёт
```

| Шаг | Событие (GA4) | Где шлётся | KPI |
|-----|---------------|-----------|-----|
| 1. Создание | `trip_created` | `useCreateTrip` onSuccess (`hooks/usePlannedTripsApi.ts`) | Кол-во созданных поездок / неделя |
| 2. Маршрут | `route_point_added` | `RouteBuilder` при добавлении точки | Поездок с маршрутом ≥2 точек |
| 3a. Экспорт | `route_exported` | `TripRouteExportMenu` (GPX/KML/навигатор) | Доля поездок с экспортом маршрута |
| 3b. Приглашение | `trip_invite_sent` | `useInviteParticipants` onSuccess | Приглашений на поездку / поездка |
| 4. RSVP | `trip_rsvp` | `useSetRsvp` onSuccess | Доля приглашённых, ответивших «Поеду» |
| 5. Монетизация | `trip_affiliate_click` | `TripAffiliateBlock` → `AffiliateOffers.onOfferClick` | Affiliate-клики / просмотр поездки |

Все события объявлены в `utils/tripAnalytics.ts` (`TRIP_EVENTS`) и уходят через общий `queueAnalyticsEvent`. Дополнительно `Affiliate_Impression` / `Affiliate_Click` шлёт `components/affiliate/AffiliateOffers.tsx` (общий механизм партнёрки, переиспользован из #32).

## KPI-дашборд (что и где смотреть)

- **Активация:** `trip_created` (уникальные организаторы) — основной счётчик блока D.
- **Глубина:** медиана `route_point_added` на поездку; доля поездок дошедших до `route_exported` или `trip_invite_sent`.
- **Соц-эффект:** `trip_invite_sent` → `trip_rsvp` (conversion приглашение→ответ); доля `going`.
- **Монетизация:** `trip_affiliate_click` / просмотр страницы поездки.
- **North Star:** поездки со статусом `completed` + опубликованным отчётом (`publish_to_catalog`), считается на бэке (`/api/trips/{id}/complete/`).

## Карта спринтов (где какой блок)

- **Блок D (Sprint 13)** — планировщик: создание, маршрут, RSVP, coedit, отчёт, каталог сообщества. События выше.
- **Блок E (Sprint 14)** — каталог «Поехали со мной» (`api/publicTrips.ts`): заявки/одобрения/нотификации. Метрики заявок — отдельная спека.
- **Блок A/C** — гейминфикация (бейджи/ранги) — `docs/features/social-trips-gamification-backlog.md`.

## Замечания по контракту

- Бэкенд планировщика задеплоен на **dev** (`http://192.168.50.36`), на прод (`metravel.by`) — нет (деплой за владельцем бэка). До прод-деплоя события идут, но реальные поездки создаются только на dev.
- RSVP на уровне planned-facade поддерживает только `accepted|declined` — событие `trip_rsvp` шлёт фактический выбор пользователя.
