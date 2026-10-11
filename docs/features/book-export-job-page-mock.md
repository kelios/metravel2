# Страница PDF-книги из письма — #2357

Статус: дизайн и архитектурный план до реализации. Контракт уже опубликован
в `docs/features/export.md` (асинхронная отдача, коммит `03d556842`).

## Technical Design

Scope: приватная страница `/book-exports/[job_id]`, ссылка на неё и уведомление
о письме в существующей панели `/export`. Старые лимиты/renderer не меняются.
Data/API impact: без новых endpoints/DTO. Уже существующие owner detail,
cancel/retry и download-ticket; никакого создания задания при открытии страницы.
Platform impact: desktop web и mobile web 320/390. Native large delivery вне scope.
Localization impact: RU/BE/UK/PL/EN, namespace `export`, файл `export_01`.
External-link impact: скачивание через `downloadFullBookFile` и существующий
`startBrowserFileDownload`; переходы внутри приложения через Expo Router.
Task Contract: дополнение F2 в `docs/features/export.md`; полный Done требует
реального письма, complete PDF, capability и приёмки backend B3.

Existing code to reuse:

- `useRequireAuth`, `buildLoginHref`: вход с возвратом на тот же job URL;
  без intent `build-pdf`, который отправляет пользователя на `/export`.
- `useQueryOwner`, `queryKeys.fullBookExportJob(owner, jobId)`: приватный cache.
- `getBookExportV2Job`, `cancelBookExportV2Job`, `retryBookExportV2Job`.
- `isFullBookJobActive`, `isFullBookJobDownloadable`, `fullBookErrorCode`.
- `FullBookJobStatus`: серверные состояния, настоящие/null counters, ошибки,
  страницы/размер/срок хранения, actions и Lambda-stage mapping.
- `ResponsiveContainer`, `useScreenHeader`, `EmptyState`, `Button`,
  `SkeletonLoader`, `useThemedColors`, `InstantSEO`, `useScrollBottomPadding`.

## Визуальный макет

Одна колонка в существующем app shell, общий header/footer. Центрированный
контент ограниченной ширины на desktop; на 320/390 занимает доступную ширину
с обычными responsive insets. Заголовок «Книга путешествий», пояснение, одна
карточка состояния. Нет hero, декоративных изображений и дополнительных вкладок.
Основное действие скачивания сохраняет текст на телефоне. Короткие secondary
actions не вытесняют основной статус; кнопки имеют обычные touch targets.
Под карточкой — переход к `/export`, когда нужно собрать книгу заново.

| Состояние | Контент | Действия |
| --- | --- | --- |
| Auth loading | Заголовок и нейтральный skeleton карточки | Нет запросов job |
| Guest | «Войдите, чтобы открыть книгу» | Вход с безопасным return URL |
| Job loading | Skeleton той же ширины | Нет действий над отсутствующим job |
| Foreign/missing/invalid ID | «Книга не найдена» без ID/данных владельца | Перейти к экспорту |
| Connection error | Явное «Не удалось обновить статус»; подтверждённый статус, если был | Повторить чтение; нет нового job |
| Queued/running/retry_wait/cancel_requested | Текущая стадия, настоящие counters, письмо после завершения | Cancel по существующему контракту; disabled во время mutation и после cancel_requested |
| Done complete/frozen/download available | Готовность, страницы, размер и срок хранения | Скачать свежим билетом |
| Done без complete/download | Статус без ложной готовности | Перечитать статус, явное сообщение о недоступности файла |
| Failed retryable | Локализованная причина и стабильный код ошибки | Retry того же job |
| REBUILD_REQUIRED/nonretryable | Объяснение необходимости пересборки | Перейти к `/export` |
| Expired/cancelled | Объяснение завершения/срока хранения | Перейти к `/export` |

Темы используют `useThemedColors`; типографика/spacing/radii — существующие
tokens. Layout одинаков в светлой/тёмной теме и пяти локалях. Статус — polite
live region, заголовок — heading, действия имеют label; keyboard/focus не
скачет при каждом poll. Unknown expected не превращается в 0/процент/ETA.
SEO всегда `noindex,nofollow`, без private fields/ID в title/description.

## Архитектурные ограничения

`useBookExportJob(jobId)` читает exact route job независимо от capabilities
создания и owner latest list; не зависит от скрытого job в Zustand. Запрос
разрешён только после authReady и owner, без keepPreviousData другого job.
Активный job опрашивается с уже установленным интервалом 3 секунды; reconnect
возобновляет чтение. Чужой/missing 403/404 не повторяется и сразу скрывает даже
cached metadata. Ответ и
ошибки mutation принадлежат captured owner+job; смена owner/route их скрывает.
Успешный retry/cancel обновляет exact query и инвалидирует existing latest list.
Ни retry, ни просмотр страницы не вызывают POST создания selection/book.

Для переиспользования `FullBookJobStatus` нужен узкий structural controller
contract вместо обязательных полей выбора/submit; dismiss на странице означает
переход к экспорту, с отдельной локализованной подписью. Нельзя конструировать
фальшивый полный controller или копировать status renderer.

Download helper получает необязательный owner guard: проверить владельца до
запроса и после ответа ticket, перед запуском файла. URL/ticket нигде не
сохраняются; каждая попытка получает свежий билет, TTL/URL validation остаются
в текущем helper. Нельзя держать account token в URL или читать весь Blob.
`JOB_EXPIRED` от ticket блокирует stale download и перечитывает exact job;
`REBUILD_REQUIRED` от job/retry/download ведёт к пересборке через экспорт.

Email аккаунта отсутствует в `useAuth` и `UserProfileDto`, но предоставлен
существующим `fetchEmailSubscriptionStatus` (`GET /subscribe/status/`).
Переиспользуем owner cache `queryKeys.emailSubscriptionStatus(owner)`;
`subscribed` не является разрешением для service-письма готовой книги.
При загрузке/отсутствии адреса текст говорит «на почту аккаунта»; при известном
адресе показывает его. Никаких новых auth DTO или API.

Cold-link gate: production nginx generic `location /` заканчивается `404`,
если нет `$uri`, `$uri.html` или `$uri/index.html`; fallback для `/book-exports/`
отсутствует (backend `origin/master:deploy/prod/nginx/nginx.conf:971–985`).
Один dynamic Expo route не доказывает HTTP 200 по письму/refresh. До реализации
root определяет принятый route-shell/fallback и при необходимости оформляет
backend routing dependency; локальный `nginx/` не меняется. Клиентская
навигация не заменяет обязательную cold email navigation приёмку.

## Реализация и проверки

1. Root синхронизирует дополнение карточки и claim; подтверждает дополнительное
   владение `FullBookJobStatus.tsx` и минимальным owner guard download helper.
2. Hook exact-job observation/mutations; narrow status props; responsive screen
   и thin route; panel integration; все пять локалей в одной правке.
3. Unit: auth/owner/route isolation, no create, poll terminal/active, missing/
   offline, stale action error, retry REBUILD_REQUIRED, delayed ticket owner
   switch, expired ticket, required download completeness; UI states/return URL.
4. Code checks: targeted Jest, `check:fast`, typecheck, `test:i18n`,
   external-link/query-key/screen-action guards; независимое review и gate.
5. В testing после своего deploy: desktop 1440/mobile 320 и 390, light/dark,
   все локали, keyboard, guest→login return, foreign/missing, reload/offline,
   actual письмо→page→ticket→PDF. Console errors 0; no duplicate create.

Risks: настоящий done/download сейчас нельзя подтвердить: прод capabilities
false, B3/Lambda capacity закрыты owner waiver. Это не основание включать
delivery или снимать count guards. Rollback: явный revert только task paths.
