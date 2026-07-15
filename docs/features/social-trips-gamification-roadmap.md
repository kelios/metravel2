# Social trips and gamification feature map

Актуализировано: 2026-07-15.

Документ описывает текущий frontend scope совместных поездок, planned trips,
trust/contact flows и gamification. Это не backlog и не подтверждение production
готовности backend endpoints. Открытые работы живут на MCP task board.

## Статус

| Область | Frontend | Runtime status |
| --- | --- | --- |
| Public/community trips | routes, catalog, detail, apply UI и adapters существуют | backend-dependent |
| My created trips | dashboard/list и mutations wiring существуют | backend-dependent |
| Planned trips | create/detail/list, route plan, RSVP, suggestions, reports | backend-dependent |
| Trip chat/Telegram | UI и typed adapters существуют | partial/backend-dependent |
| Contacts/trust/safety | protected contacts, requests и safety surfaces | partial/backend-dependent |
| Achievements/ranks | API, React Query hooks, UI, profile/author embeds | implemented adapters/UI; production data requires runtime evidence |
| Rare/peer awards | catalog, grant/toggle UI и optimistic mutations | backend-dependent |

Dev fixtures и mocks не считаются production evidence и должны быть включены
только явным development flag.

## Routes

| Route | Owner |
| --- | --- |
| `/trips` | `app/(tabs)/trips/index*.tsx` |
| `/trips/community` | `app/(tabs)/trips/community*.tsx` |
| `/trips/my` | `app/(tabs)/trips/my*.tsx` |
| `/trips/:id` | `app/(tabs)/trips/[id]*.tsx` |
| `/trips/plan` | `app/(tabs)/trips/plan/index.tsx` |
| `/trips/plan/create` | `app/(tabs)/trips/plan/create.tsx` |
| `/trips/plan/:id` | `app/(tabs)/trips/plan/[id].tsx` |
| `/trip-rules` | `app/(tabs)/trip-rules.tsx` |

## Frontend ownership

- `components/trips/` — catalogs, cards, detail/apply и dashboard;
- `components/trips/planning/` — plan editor, participants, route, RSVP,
  suggestions, rating/report/export;
- `components/trips/chat/` и `communication/` — chat/Telegram surfaces;
- `components/profile/ProtectedContacts.tsx` и
  `ContactRequestsInbox.tsx` — contact/trust UI;
- `components/achievements/` — ranks, badges, progression, rare/peer awards;
- `hooks/usePublicTripsApi.ts`, `usePlannedTripsApi.ts`, `useTripChatApi.ts`,
  `useTripTelegramGroupApi.ts`, `useContactRequestsApi.ts` — React Query owners;
- `hooks/useAchievementsApi.ts`, `useGamification.ts` — gamification queries and
  mutations.

## API ownership

- `api/publicTrips.ts` и `api/publicTripsMock.ts`;
- `api/plannedTrips*.ts` и `api/plannedTripsMock.ts`;
- `api/tripChat.ts`, `api/tripTelegramGroup.ts`, `api/contactRequests.ts`;
- `api/achievements*.ts`, `api/achievementsMock.ts`;
- `api/gamification.ts`, `api/gamificationMock.ts`.

Types/normalizers/requests остаются разделёнными. Server state не дублируется в
Zustand. Recoverable unavailable/auth/error state должен быть виден в UI; fake
success fallback в production запрещён.

## Product and safety contracts

- Пользователь видит автора/организатора, статус, даты, capacity и правила до
  apply/RSVP.
- Contact details раскрываются только через подтверждённый permission/trust flow.
- Report/block/safety actions не маскируются декоративной кнопкой без backend
  contract.
- External Telegram/map/payment links проходят через centralized external-link
  helpers.
- Route/meeting-point media и координаты используют общие map/place contracts.
- Public trip и planned trip — разные сущности; adapters не должны молча
  смешивать DTO.
- Privacy/legal copy проверяется отдельно; этот feature map не заменяет policy.

## Achievements boundary

Детальный badge/rank/XP/peer/rare contract находится в
`docs/ACHIEVEMENTS_DESIGN.md`. Справочник server state — `api/achievements.ts`,
визуальный default — `BadgeEmblem`, а optional `image_url` не должен приводить к
fake media URL.

## Метрики

Список events не дублируется в документации: источник правды — текущие analytics
helpers и schema/tests. Для продуктового решения фиксируйте абсолютное окно
измерения, source (GA4/GSC/Yandex/backend) и отдельно отмечайте отсутствующую
instrumentation. Dated audits остаются snapshots, а не live dashboard.

## Проверки

- adapters/normalizers: ближайшие `__tests__/trips/**` и
  `__tests__/achievements/**`;
- trip UI: `__tests__/components/trips/**`;
- achievements UI/hooks: achievement tests и profile/AuthorCard integrations;
- visible web flow: browser screenshot + console/network;
- native flow: локальная Android build/install на USB device; iOS только с
  simulator/device evidence;
- finished local block: `yarn check:fast`.

Production readiness требует реальных API payloads и mutation evidence. Любой
missing server contract оформляется как `area=back` task с Task Contract.
