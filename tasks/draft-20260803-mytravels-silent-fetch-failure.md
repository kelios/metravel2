# [FE-PROFILE][P1] Сбой загрузки «Моих маршрутов» выглядит как пустой профиль, а в DEV показывает HTML-простыню вместо статуса

> **Fallback-файл.** Карточка на общий MCP task board не заведена: 2026-08-03 API
> борда отвечает `401 {"detail":"Invalid token."}` и на запись, и на чтение.
> Импортировать после замены staff-токена в `.secrets/metravel-task-board.env`.
>
> - kind: `bug` · area: `front` · status: `review` (реализовано, ждёт приёмки) · urgency: `high` · sprint: 2
> - assignee: `frontend` · reporter: `frontend`
> - related: #1212 (тот же класс — у `ImageCardMedia` не было состояния ошибки), #1214 (источник 5xx на проде)

## Симптом

Найдено на подключённом Pixel 10 Pro (dev-client, versionName 1.0.4 / versionCode 19),
скрин 2026-08-03 15:25. Поверх экрана висит баннер:

```
Error fetching MyTravels: Error: <html>…
```

Два разных дефекта под одним симптомом.

### 1. Статус-код терялся в тексте ошибки

`api/travelUserQueries.ts` на неуспешный ответ клал **всё тело** в `new Error()`:

```ts
const errorText = await res.text().catch(() => 'Unknown error');
throw new Error(errorText);
```

nginx на 5xx отдаёт HTML-страницу, поэтому сообщением ошибки становилась
многокилобайтная простыня, а `502` / `504` / `500` в ней было не различить.

### 2. В Play-сборке ошибка проглатывалась молча — это хуже

`fetchMyTravels` без `throwOnError` возвращает `[]`, а `useMyTravels` вызывал его
именно так. На 502 хук выставлял `myTravels=[]`, `totalCount=0`, `hasMore=false`
**без состояния ошибки**. Пользователь видел inspire-заглушку «Ваши маршруты
появятся здесь» с кнопкой «Создать маршрут» — то есть приложение предлагало
создать заново то, что просто не загрузилось. Ни причины, ни повтора.

DEV-баннер существовал только из-за `if (__DEV__)`; в сторовой сборке симптом
был полностью немой.

## Что сделано

- `api/travelUserQueries.ts` — `createMyTravelsError(status, statusText, body)`:
  message через `errorsStatic:api.myTravels.loadFailed` со статусом, `error.status`,
  тело ответа отдельным полем `responseBody` с обрезкой до 300 символов. Совпадает
  с существующим паттерном `createTravelQueryError` в `travelListQueries.ts`.
- `hooks/useMyTravels.ts` — поле `error: string | null` в `UseMyTravelsResult`,
  `throwOnError: true` на обеих страницах, `getLoadErrorMessage` (timeout / offline /
  message / generic). Сбой `loadMore` не стирает уже показанные маршруты: список
  остаётся, автоподгрузка глушится, причина уходит в тост.
- `components/screens/profile/useProfileTravelSections.ts` — при `travelsError` на
  вкладках `travels` / `publishedTravels` / `draftTravels` вместо заглушки «пусто»
  отдаётся `variant: 'error'` с причиной и кнопкой «Повторить». Вкладки
  `favorites` / `history` живут на других данных и не подменяются.
- `components/screens/profile/ProfileScreen.tsx` — `handleRetryTravels` идёт мимо
  one-shot guard `travelsRequestedRef` (он уже сожжён неудачной попыткой, иначе
  кнопка была бы декоративной).
- i18n: `errorsStatic:api.myTravels.loadFailed`, `sharedStatic:errors.retry`,
  `sharedStatic:myTravels.loadFailedTitle` — во всех пяти локалях RU/BE/UK/PL/EN.

## Task Contract

- **Scope:** frontend (api-слой, хук, профиль, i18n). Бэкенд не трогается.
- **User-visible result:** на недоступном API профиль показывает причину и «Повторить»
  вместо ложного «маршрутов нет».
- **Data/API contract:** не меняется.
- **Platform impact:** shared — общий код без Platform-ветвления; desktop web,
  mobile web и Android затронуты одинаково, mobile web и Android проверять парно.
- **Localization impact:** RU/BE/UK/PL/EN, все строки через `@/i18n`.
- **Fallback policy:** нет.

## Validation

- `npx tsc --noEmit` — чисто.
- `eslint` по изменённым файлам — чисто.
- Новые тесты: `__tests__/api/travels.test.ts` (+3), `__tests__/hooks/useMyTravels.error.test.tsx` (5),
  `__tests__/components/screens/profile/useProfileTravelSections.errorState.test.tsx` (6).
- `npm run test:run` — 7759 passed. 5 падений в `__tests__/constants/imageContract.test.ts`
  и `htmlTransform.responsiveImages.test.ts` — из параллельной чужой правки
  `constants/imageContract.ts` (лестница `articleBodyDesktop` 1920 → 1600),
  пересечения с этой задачей нет.

## Не проверено

Живой прогон против реального 502 не делался: для этого нужно уронить API или
подменить ответ на устройстве. Поведение закрыто юнит-тестами на всех трёх слоях.

## Done gate

На принудительном 5xx профиль показывает текст причины со статусом и рабочую
кнопку «Повторить»; успешный повтор гасит ошибку и показывает маршруты; сбой
второй страницы не стирает первую.
