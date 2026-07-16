# Travel-status calendar feature map

Актуализировано: 2026-07-15.

`/calendar` объединяет explicit статусы пользователя и его опубликованные
авторские travels:

- `visited` — «Был»;
- `planned` — «Планирую», с датой;
- `wishlist` — «Хочу».

Опубликованный authored travel без explicit статуса считается default
`visited`. Explicit status всегда имеет приоритет.

## Ownership

| Слой | Файлы |
| --- | --- |
| Route | `app/(tabs)/calendar.tsx` |
| Calendar UI | `components/calendar/**` |
| Status action | `components/travel/TravelStatusButton.tsx` |
| Client/API merge | `stores/travelStatusStore.ts` |
| API DTO/requests | `api/user.ts` |
| Profile entry | `components/profile/ProfileQuickActions.tsx` |

`components/layout/AppProvidersDeferredRuntime.tsx` инициирует загрузку status
store в общем runtime.

## Data model

Основная client entry содержит travel id, title/media/URL metadata, status,
optional `plannedDate`/`visitedDate` и `addedAt`.

Store:

- загружает user-scoped local cache;
- получает explicit server statuses;
- получает authored published travels для default `visited`;
- нормализует id/date/media metadata;
- дедуплицирует travel;
- применяет правило explicit status > authored default;
- синхронизирует create/update/delete с API;
- очищает user-scoped state при смене auth identity.

Local storage — cache/recovery layer, не доказательство server success.

## API contract

User status family:

```text
GET    /api/user/{id}/travel-statuses/
POST   /api/user/{id}/travel-statuses/
PATCH  /api/user/{id}/travel-statuses/{travel_id}/
DELETE /api/user/{id}/travel-statuses/{travel_id}/
```

Payload использует `travel_id`, status и optional ISO dates
`planned_date`/`visited_date`. Adapter поддерживает paginated/enveloped
responses и query filters из `UserTravelStatusesQuery`.

Frontend не предполагает bulk-sync или embedded `user_status` в travel detail,
пока такой contract не подтверждён. Если endpoint unavailable, UI показывает
recoverable state; fake-success запрещён.

## Date rules

- `planned` использует explicit `planned_date`.
- `visited` предпочитает explicit `visited_date`.
- Если точной visited date нет, authored travel может получить
  детерминированный fallback из year/month metadata.
- `wishlist` не требует даты.
- Date parsing/formatting идёт через общий locale layer; business logic не
  сравнивает переведённые labels.

## UI contracts

- Три статуса подписаны текстом, а не представлены только иконкой.
- Planned tab связывает month grid и список выбранного дня/месяца.
- Empty/loading/error/auth states видимы.
- Personal route имеет `noindex,nofollow`.
- Status action требует auth и не сообщает success до завершения mutation.
- Mobile web и Android сохраняют один UX и проверяются парно; platform date input может
  отличаться технической реализацией.

## Validation

- store/API merge: tests для `travelStatusStore` и `api/user.ts`;
- calendar UI: ближайшие `MiniCalendar`, `CalendarScreen`,
  `TravelStatusButton` tests;
- visible web flow: browser + console/network;
- native status/date flow: installed Android build и relevant `AND-USB-*`;
- finished block: `npm run check:fast`.

Fresh runtime evidence требуется для server synchronization; существующий local
cache или unit test не подтверждает production endpoint.
