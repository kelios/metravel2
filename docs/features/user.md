# User/profile feature map

Актуализировано: 2026-07-15.

Документ описывает личный и публичный профиль, settings, collections,
subscriptions, travel-status calendar, author engagement и profile integrations.
Наличие frontend adapter не подтверждает production deployment backend endpoint.

## Routes

| Route | Назначение |
| --- | --- |
| `/profile` | личный профиль |
| `/user/:id` | публичный профиль |
| `/settings` | редактирование профиля и account actions |
| `/favorites` | избранные travels |
| `/history` | история просмотров |
| `/subscriptions` | subscriptions/subscribers |
| `/calendar` | personal travel statuses |
| `/userpoints` | пользовательские geo points |

## Ownership

- `app/(tabs)/profile.tsx` и `app/(tabs)/user/[id].tsx` — route
  composition;
- `components/screens/profile/` — личные/public sections, countries/world map,
  author travels и stats;
- `components/profile/` — header, completeness, quick actions, contacts,
  safety и reusable profile blocks;
- `hooks/useUserProfile*.ts`, `useSettingsProfileForm.ts`,
  `useSubscriptionsData.ts`, `useMyTravels.ts` — data/form ownership;
- `api/user.ts` — profile, collections, statuses, country progress,
  subscriptions;
- `api/contactRequests.ts` — protected-contact requests;
- `stores/travelStatusStore.ts` — local/API-merged travel statuses.

## Data contracts

### Profile

`GET /api/user/{id}/profile/` нормализуется через `api/user.ts`. Optional
fields (cover, premium, contact access, verification/safety, participant rating,
`rank_summary`) должны давать graceful unavailable state, а не fake data.

`rank_summary` использует общий achievements mapper для первого paint; если поле
не пришло, UI сохраняет fallback на achievements query.

### Collections and subscriptions

- favorite/history/recommended adapters находятся в `api/user.ts`;
- subscriptions/subscribers — auth-required server state;
- UI не должен смешивать личные collections с author-facing aggregates;
- server state не дублируется новым Zustand store без offline/client-only причины.

### Author engagement

`api/travelUserQueries.ts` и `useMyTravels.ts` поддерживают optional
`engagement_summary` и per-travel engagement fields. UI показывает
favorites/wishlist/visited/planned metrics, когда backend прислал их, и
корректный unavailable/derived state — когда summary отсутствует.

Frontend implementation не доказывает, что aggregates доступны для каждого
production payload; это проверяется network evidence. Не добавляй отдельный
roundtrip или выдуманные нули, пока API contract не требует этого явно.

### Travel statuses

Explicit `visited|planned|wishlist` синхронизируются через user travel-status
API и объединяются с authored published travels. Детали — в
`docs/features/calendar.md`.

### Contacts, trust and safety

Protected contacts, requests, verification, rating, report/block surfaces
backend-dependent. Hidden contact нельзя раскрывать через fallback, cache или
альтернативный profile payload. Mutation success показывается только после
реального response.

## UI contracts

- Личный и публичный профиль различают owner-only actions.
- Empty/loading/error/access states видимы и стабильны.
- External social links открываются только через `utils/externalLinks.ts`.
- Avatar/cover media используют shared image layer и нейтральный fallback.
- Achievements/profile integrations следуют
  `docs/ACHIEVEMENTS_DESIGN.md`.
- Web/mobile/native сохраняют одинаковую information architecture и actions.

## Validation

- profile/API/hooks: ближайшие tests в `__tests__/api`,
  `__tests__/hooks` и `__tests__/components/profile`;
- finished block: `npm run check:fast`;
- visible web change: browser screenshot + console/network;
- auth/contact/status mutation: real API evidence;
- native-visible change: локальная Android build/install + relevant
  `AND-USB-*` cases.

Missing backend contract оформляется как `area=back` task с Task Contract;
frontend не подменяет его development mock в production.

