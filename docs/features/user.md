# User/profile feature map

Актуализировано: 2026-10-05.

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

## Сообщения: список диалогов (`/messages`)

Решение #2264 и #2267 (05.10.2026). Владение: `components/messages/ThreadList.tsx`
(панель и шапка), `ThreadRow.tsx` (строка), `messageTime.ts` (метки времени),
`components/screens/messages/` (двухпанельная раскладка), правило показа кнопки
удаления — `app/global.css`.

Строка диалога:

- имя собеседника — главный элемент: оно одно на первой линии колонки текста и
  обрезается многоточием в конце только когда не помещается в колонку целиком;
  полное имя — в web-подсказке `title` (`webTitleRef`) и в подписи строки для
  скринридера;
- дата и счётчик непрочитанных («99+» после 99) — на второй линии, ширину у
  имени не берут; шеврона нет — выбранная строка подсвечена;
- дата — через `i18n/format.ts` по языку интерфейса: сегодня — время, раньше —
  день и месяц, вне текущего года — с годом;
- удаление не стоит постоянной кнопкой в строке. Web: кнопка 44×44 поверх правого
  края появляется по наведению мыши и по фокусу клавиатуры внутри строки (Tab),
  на это время колонка текста отдаёт ей 48 px; в DOM кнопка есть всегда. Тач и
  native: долгое нажатие; native — ещё действие доступности «Удалить диалог с …».
  Подтверждение (строка под диалогом на web, системный диалог на native)
  обязательно на всех путях;
- числа на панели 320 px и на телефоне 320 px: колонка текста 221 px (было 62 px
  имени), «Редакция metravel» и «Julia Sauran» целиком при дате и бейдже «99+»,
  из имени в 40 знаков видно 22; на телефоне 390 px — 291 px и 29 знаков.
  Регресс-контроль — `ThreadList.dom.web.test.tsx` (состав строки) и пробы
  320/390/1440 в `e2e/messages.spec.ts` (ширина и обрезка).

Панель и пустые состояния:

- «Новый диалог» — действие шапки панели: иконка-кнопка 44×44 (`Button`,
  `variant="primary"`, `iconOnly`) рядом с полем поиска, не элемент списка;
- шапка панели (поиск и «Новый диалог») — рамка, а не содержимое: один и тот же
  узел стоит над загрузкой, ошибкой, пустым состоянием и списком и со списком не
  прокручивается. До первого ответа сервера панель показывает загрузку, а не
  «Нет сообщений» (`useThreads().loaded`); экран читает ширину с
  `useResponsive({ clientOnly: true })`, поэтому на desktop нет первого кадра в
  мобильной раскладке. Контроль — проба коммитов в `e2e/messages.spec.ts`
  (`headerNodes: 1`, `emptyFlashed: false`) на 1440/768/390;
- пустая правая панель на desktop — `EmptyState` с кнопкой «Новый диалог»; при
  пустом списке кнопку несёт она же, а в левой панели остаются шапка и текст
  (`hideEmptyStateAction`). На телефоне правой панели нет, кнопка пустого списка
  остаётся;
- плотность: строка 62 px, зазор 4 px — три диалога занимают 194 px (было около
  255 px), потолок решения — 200 px;
- ширина панели остаётся 320 px: имя получает 221 px, контейнер ограничен
  1000 px, и каждые +10 px панели отнимались бы у чата (680 px). Адаптивная
  ширина 320–380 px отклонена по этой причине.

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

