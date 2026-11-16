## Why

В #3441 отказ страницы 2+ сохраняет первые карточки, но тост исчезает через четыре секунды, а список остаётся замороженным без способа продолжить. Автор принимает неполный список за полный.

## What Changes

- Сохранять видимую причину сбоя и одно действие «Повторить подгрузку» в конце непустого списка web.
- Повторять ту же следующую страницу активного списка, сохраняя загруженные карточки и разделение общего списка, опубликованных и черновиков.
- Сохранить существующий retry первой страницы и native pull-to-refresh.

## Capabilities

### New Capabilities

- `profile-travel-pagination`: восстановление списка маршрутов после сбоя следующей страницы.

### Modified Capabilities

Нет существующей living spec для этого поведения.

## Impact

- Platform impact: desktop web и mobile web — footer; Android/iOS — общий hook, без изменения native-разметки.
- Localization impact: RU/BE/UK/PL/EN, `sharedStatic:myTravels.nextPageFailedTitle` и `myTravels.retryNextPage`.
- User-visible: постоянная причина и повтор; accessibility: видимая подпись и стандартная keyboard/touch кнопка.
- API/data: без изменений endpoint и payload; hook добавляет `nextPageError: string | null`, `retryNextPage: () => Promise<void>`.
- Performance: автоматические повторы остаются остановленными; двойное нажатие не запускает второй запрос.
- SEO/security/analytics: нет изменений, профиль и существующая граница авторизации сохраняются.
- Non-goals: backend, `api/travelUserQueries.ts`, native layout/pull-to-refresh, счётчики, изменения #3436.
- Dependencies: жёстких нет; связанные #3389, #1865/#1871 не переоткрываются.
- Fallback/mock policy: детерминированный 503 в unit и browser-only `page.route`; сервер не меняется, production fault injection запрещён.
- Validation: focused hook/adapter/DOM tests и i18n; mobile web затем desktop на local API8000, 20→40 карточек, footer >4s и repeated503, empty-list control; review и обычный web deploy с narrow smoke. Выполнение только после operation lease.
