# Отказ Apple 25.09.2026 — 1.2 UGC и 5.1.2(i) ATT/cookies

Заявка `2caaff34-ee6a-4546-b599-a27d056195dd`, версия 1.0.5 (10), review device
iPad Air 11-inch (M3), дата ревью 25.09.2026. Предыдущие раунды:
10.09 — `Guideline 2.1 Information Needed` (`docs/IOS_APP_REVIEW_RESPONSE_20260910.md:25`;
в описании #1940 ошибочно записан как 2.5(i)), 14.09 — 2.1(a) connection error
(`docs/IOS_APP_REVIEW_REJECTION_20260914.md`). Разбор 03.10.2026, уровень L,
роли: ios-analyst (требования, история), ios-designer (UX/HIG), ios-architect
(контракты, границы), backend-expert (бэк read-only, `origin/master` `6958035`),
problem-memory (дедуп борда). Ничего не собиралось, Reply не отправлялся, ASC не
менялся.

## Что требует Apple

**1.2 Safety — UGC**: (a) согласие с условиями (EULA) до регистрации или входа,
в условиях — нулевая терпимость к objectionable content и abusive users;
(b) фильтрация objectionable content; (c) жалоба на контент; (d) блокировка
пользователя, которая уведомляет разработчика и мгновенно убирает контент из
ленты блокирующего; (e) реакция на жалобы ≤24 ч: удалить контент, выгнать
автора. Видео с физического устройства: условия до регистрации/входа, жалоба,
блокировка — в Reply и в Notes всех будущих подач.

**5.1.2(i) — Data Use and Sharing**: приложение открывает наш веб-контент с
cookie-запросами без ATT. Либо не трекать и убрать/переписать cookie-запросы,
либо App Privacy «tracking» + ATT до сбора.

## Факты по пунктам 1.2

| Пункт | Состояние | Доказательство |
| --- | --- | --- |
| (a) согласие до регистрации | **Нет.** Ни галки, ни ссылки, ни текста | `components/auth/RegistrationForm.tsx:384-405,528` — grep terms/consent пуст |
| (a) согласие до входа, Apple/Google/Facebook | **Нет.** Кнопки провайдеров активны сразу; аккаунт создаётся на бэке по токену без согласия | `components/auth/LoginForm.tsx:345-363,439`; бэк `users/views.py:1008`, `users/services/apple_login_service.py:669`, `facebook_login_service.py:478` |
| (a) тип согласия «условия» | Клиент не знает; бэк-модель есть, но не применяется нигде | `utils/actionConsent.ts:15-21`; бэк `users/models.py:610-660` (`TYPE_TERMS`, `version`), grep использования вне тестов = 0 |
| (a) запись согласия | `postConsentRecord` глотает ошибки, гостю 401 | `api/consent.ts:18-36` |
| (a) «нулевая терпимость» | Нет ни в одной локали; есть запрет оскорбительного контента и «возможна блокировка»; тексты помечены «на юр-проверке» (#436) | `i18n/.../legal_01.ts:11,14,130` |
| (b) фильтрация | Премодерация путешествий и отзывов квестов; комментарии и сообщения публикуются сразу; словарного фильтра нет | бэк `travels/models.py:477`, `quests/models.py:596`, `travel_comments/models.py:26-46` |
| (c) жалоба | **Только на пользователя целиком**, из профиля и списка участников поездки. На путешествие, комментарий, сообщение, отзыв/фото квеста, чат поездки — нет | `components/profile/UserSafetyMenu.tsx:155` в `PublicProfileHeader.tsx:126-133`, `TripParticipantsList.tsx:62`; `CommentItem.tsx:103` (меню только при `canEdit/canDelete`), `MessageBubble.tsx:57-71` (Копировать/Удалить), `QuestReviewsModal.tsx:31`; бэк `UserReport.target=User` `users/models.py:462-533` |
| (d) блокировка — UI | Есть, из того же меню; без подтверждения; подпись описывает обратное направление («не сможет видеть ваш контент») | `UserSafetyMenu.tsx:99-113,169-187` |
| (d) мгновенное скрытие | Сервер скрывает в обе стороны в travels/comments/messages/profile; **не** в отзывах квестов, статьях, trips, чате поездки. Клиент после блока сбрасывает только `userProfile` и `myBlockedUsers` — контент остаётся на экране до перезапроса | бэк `users/services/blocking_service.py:12-82`; `hooks/useUserSafety.ts:61-70` |
| (d) уведомление разработчика | **Нет** ни при блоке, ни при жалобе — только запись в БД и очередь админки | бэк `users/views.py:2446-2472,2527-2561`, `users/admin.py:62-74` |
| (d) экран «Заблокированные» | Хук есть, экрана нет | `hooks/useUserSafety.ts:40` |
| (e) 24 ч | Регламента, `due_at`, admin actions «удалить + забанить», поля бана и каскадного скрытия нет. Наш гайд обещает Apple «24–48 hours» | бэк `users/views.py:2924-2981`, `users/admin.py:62-67`; `docs/IOS_APP_REVIEW_GUIDE.md:174-176` |

## Факты по 5.1.2(i)

| Поверхность | Состояние | Доказательство |
| --- | --- | --- |
| Пункт «Cookie settings» в приложении | Рендерится без platform-guard в `AccountMenu`, который на native включается при ширине ≥1024 pt — **iPad в ландшафте** (review device — iPad). Гипотеза: это и есть «cookie prompt», который видел ревьюер | `components/layout/AccountMenu.tsx:88,429`, `customHeaderModel.ts:21`; в BottomDock скрыт `BottomDock.tsx:410,457,501` |
| Экран `/cookies` на native | Текст «приложение не использует cookies… настройте cookies в веб-версии» — прямая отсылка к cookie-согласию сайта | `app/(tabs)/cookies.tsx:127`, `i18n/locales/en/generated/legal_01.ts:40` |
| Ссылки на metravel.by из карты | `TravelMap.native` открывает любые `metravel.by/travels/...` во внешнем Safari, где баннер | `components/MapPage/TravelMap.native.tsx:239-243`, `utils/externalLinks.ts:83`; в `Map.ios.tsx:865-870` уже есть внутренний резолвер |
| Сторонние WebView | Belkraj (`partner=u180793`) и Instagram с `sharedCookiesEnabled`/`thirdPartyCookiesEnabled` | `components/belkraj/BelkrajWidget.native.tsx:106,131-132`, `components/iframe/InstagramEmbed.native.tsx:243,250` |
| Сайт | Opt-in баннер, категории necessary/analytics; до согласия GA4 и Метрика не грузятся; GA4 без `allow_google_signals:false`/`allow_ad_personalization_signals:false`; Метрика с webvisor по флагу | `components/layout/ConsentBanner.tsx:74-77,101-104`, `utils/analyticsInlineScript.ts:46-106` |
| Native-трекинг | Нет: `NSPrivacyTracking=false`, нет `NSUserTrackingUsageDescription`, FBSDK с выключенными advertiser ID/auto events | `ios/metravel/PrivacyInfo.xcprivacy:194-197`, `app.config.js:41-61`, `docs/IOS_APP_REVIEW_GUIDE.md:158` |

Вывод: трекинга в приложении нет, но приложение само показывает cookie-UI и
отсылает к cookie-согласию сайта, а две сторонние WebView держат сторонние
cookies. Для Apple это неотличимо от трекинга без ATT.

## Почему пропустили

В предсабмитной матрице не было сверки по разделам App Review Guidelines с
доказательством на каждый подпункт: `docs/MANUAL_TEST_CASES.md:608-623`
(IOS-01..16) не содержит кейса UGC 1.2, `.claude/skills/ios-release/SKILL.md`
знает только 4.8, `app-review-packager` проверяет покрытие сцен, но не
требования. Пункт 1.2 считался закрытым по факту «report/block есть» (#426,
#430, июнь), хотя Apple проверяет пять подпунктов; каталог сцен
`.codex/skills/metravel-app-review-evidence/scenes.json` содержит только
`ugc-report`/`ugc-block` на автора, сцены «условия до входа» нет, поэтому её не
было и в видео (снято на build 9, к build 10 не переснималось — оно показывало
жалобу и блок автора из профиля, 04:41 и 05:08). Privacy закрывалась по
манифесту и SDK-флагам (#1416, #1894, #1895), а не по тому, что ревьюер видит в
UI: общий `AccountMenu` с пунктом cookies на широком native-экране никто не
проверял. Отказы 10.09 и 14.09 не дали ревьюеру дойти до авторизованных
UGC-сценариев, поэтому 1.2 всплыл только в третьем раунде.

## Архитектурное решение

**1. Согласие с условиями — shared контракт для всех платформ.** Один
`AuthTermsGate` в общем auth-flow: обязательная галка над блоком провайдеров
(`LoginForm.tsx:344`, `RegistrationForm.tsx:383`), кнопки email/Apple/Google/
Facebook видимы, но disabled, пока галки нет (Apple-кнопка не прячется — HIG).
Принятая `terms_version` уходит в тело регистрации и всех трёх соцвходов; бэк
создаёт `UserConsent(terms, community_rules)` в одной транзакции с
пользователем; версия — настройка бэка. Существующие пользователи:
`/user/me → terms_accepted_current`, при `false` — `TermsReacceptGate` до
UGC-действий. Новый строгий `acceptTerms()` (ошибка не глотается). Выкат:
бэк принимает поле опционально → клиенты → флагом обязательность.
Отвергнуто: `POST /consents/` после входа (аккаунт уже создан, 401 гостю);
пассивная фраза «Продолжая, вы принимаете» (Apple требует agree); галка у
каждой кнопки (дубли 3×2×платформы); только iOS (Google Play требует того же,
единая продуктовая модель).

**2. Жалоба — единый `ContentSafetyActions(ContentRef)`.**
`ContentRef = {content_type, object_id, author_id}`, типы travel,
travel_comment, message, trip_chat_message, quest_review, article, photo, user;
действия «Пожаловаться», «Скрыть», «Заблокировать автора» через
`ActionListSheet`. `UserSafetyMenu` становится случаем `user`, шаг причины —
общий `ReportReasonSheet`. Защита от забытого UGC: `Record<ContentType,…>` в
типах, `guard-ugc-actions` по реестру UGC-рендеров, на бэке тест
`REPORTABLE_CONTENT` по всем публичным моделям с автором. Отвергнуто:
отдельные кнопки на каждом экране (семейство не закрыто); ESLint «любой рендер
DTO» (нет надёжного маркера UGC).

**3. Блокировка — слой кэша, а не экраны.** Реестр
`BLOCK_SENSITIVE_QUERIES` и `applyAuthorBlock(qc, authorId)` в `onMutate`:
оптимистичное удаление по автору из comments, сообщений, trip chat, отзывов
квестов, travels, articles, public trips; инвалидация на `onSettled`, откат при
ошибке. Подтверждение `ConfirmDialog` с перечнем последствий и «мы получим
уведомление»; экран «Заблокированные» в настройках. Источник истины — бэк:
фильтры `blocking_service` расширяются на quest reviews, articles, trips, trip
chat. Отвергнуто: `select` в каждом хуке экрана; только инвалидация (контент
«моргает»).

**4. Модерация и 24 ч — бэк.** `UserReport` расширяется ссылкой на контент,
снимком текста и `due_at`; модератору — письмо/Telegram на каждую жалобу и
блок; cron просрочки; admin actions `remove_content`, `ban_user` (бан с
каскадным скрытием во всех публичных выборках), `dismiss`. Фильтр слов на бэке
для комментариев, сообщений, чата поездки (жёсткое — `422`, мягкое — скрыто до
модерации). Отвергнуто: премодерация всех комментариев (убивает диалог,
неприменима к личным сообщениям). Фронт показывает «рассмотрим в течение 24
часов»; гайд правится на «24 hours» после выката бэка.

**5. Приватность веб-контента — «в приложении не трекаем и говорим это».**
Убрать из native весь cookie-UI (`AccountMenu` guard `IS_WEB`), переписать
native `/cookies` в «приложение не использует cookies и не отслеживает»;
ссылки на metravel.by из карт — внутренним роутингом через существующий
резолвер; в Belkraj/Instagram WebView выключить общие и сторонние cookies;
на сайте — текст баннера «аналитика без рекламы и передачи третьим» и флаги GA4
без Signals/рекламной персонализации. App Privacy: Tracking = No.
Отвергнуто: ATT (противоречит решению `openspec/.../design.md:121`, Tracking=Yes,
запрос на каждой установке ради first-party аналитики); маркер app-контекста
для сайта (встроенного браузера с сайтом нет, ссылки уходят в Safari, нужен
nginx); удалить баннер с сайта (EU/PL требует согласия на аналитику).

## План (карточки на борде, спринт 24)

Порядок по блокирующей силе.

| # | Карточка | Area | Зависит от |
| --- | --- | --- | --- |
| #2132 | Согласие с условиями до регистрации и входа (`AuthTermsGate`, `TermsReacceptGate`, строгий `acceptTerms`) | front | owner-текст, #2128 |
| #2133 | Жалоба на каждый тип UGC (`ContentSafetyActions`, `guard-ugc-actions`) | front | #2129 |
| #2134 | Блокировка: мгновенное скрытие (`applyAuthorBlock`), подтверждение, экран «Заблокированные» | front | #2130 |
| #2135 | Приватность веб-контента в приложении (cookie-UI, внутренние ссылки, cookies WebView, баннер, GA) | front | owner: кабинеты GA/Метрики, Belkraj |
| #2136 | Гейт: чек-лист App Review 1.2/4.8/5.1.1(v)/5.1.2 в матрицу, IOS-кейс UGC, сцены в `scenes.json`, `ios-release` | front | — |
| #2137 | Видео сцен на физическом iPhone и iPad (app-review-director) | front | #2132–#2136, #2128–#2130, build 11 |
| #2138 | Reply и Notes, правка `IOS_APP_REVIEW_GUIDE.md` §7 | front | #2137, #2129 |
| #2128 | `terms_version` в регистрации и трёх соцвходах, `CURRENT_TERMS_VERSION`, `/me terms_accepted_current`, флаг обязательности | back | — |
| #2129 | Жалоба на контент (content ref), уведомления модератору, `due_at`/просрочка, admin actions, бан с каскадом | back | — |
| #2130 | Фильтры блока для quest reviews, articles, trips, trip chat | back | — |
| #2131 | Словарный фильтр для комментариев, сообщений, чата поездки | back | — |

Затем — четыре отдельных разрешения владельца: signed build 11, upload в
TestFlight, Reply + submit, storefront release.

## Решения владельца

1. Юридический текст Terms и Community Rules с «нулевой терпимостью» и сроком
   24 ч, id версии (снимает пометку «на юр-проверке», #436).
2. Регламент: кто и как разбирает жалобы ≤24 ч (канал уведомлений, дежурный).
3. Подтвердить в кабинетах: Google Signals и рекламная персонализация GA4
   выключены, Метрика не связана с Директом/ретаргетингом.
4. Belkraj-виджет с партнёрским id на iOS: оставить без cookies или убрать.
5. iPad: `supportsTablet: true`, ревьюер работает на iPad — iPad-приёмка входит
   в план, вопреки строке «iPadOS вне первого release» в `CLAUDE.md`.
6. Опционально: заменить стандартную EULA Apple в ASC на свою.

## Сцены для записи (физическое устройство, exact TestFlight build 11)

| Сцена | Что в кадре |
| --- | --- |
| `eula-before-auth` | Свежая установка → экран входа: кнопки email/Apple/Google/Facebook неактивны, тап по Apple ничего не делает → открыть «Условия», показать фразу о нулевой терпимости → вернуться, отметить галку → кнопки активны → вход демо-аккаунтом. То же на экране регистрации до создания аккаунта |
| `ugc-flag-content` | Чужой комментарий → «…» → «Пожаловаться» → причина → «Отправить» → «Жалоба отправлена, рассмотрим в течение 24 часов». Повторить на карточке путешествия и сообщении |
| `ugc-block-hides-content` | Каталог с путешествием автора X → «…» → «Заблокировать автора» → диалог с последствиями → подтверждение → карточка исчезает без перезагрузки; комментарий X на детальной тоже исчез; Настройки → «Заблокированные» → X в списке |
| `no-cookie-ui` | iPad landscape: меню аккаунта без пункта cookies; экран «Приватность» — «не отслеживаем» |

Регистрацию и вход на видео выполняет владелец (агенту ввод пароля запрещён).

## Черновик Reply (EN, НЕ отправлен)

```text
Thank you for the review of 1.0.5 (10).

Guideline 1.2: build [11] adds, on every platform:
- Terms of Use and Community Guidelines that state zero tolerance for objectionable content and abusive users. Users must check the agreement before any sign-in or registration method (email, Sign in with Apple, Google, Facebook) becomes active; the accepted version is stored with the account, and existing users re-accept before posting.
- A Report action on every type of user content: trips, comments, direct messages, trip chat, quest reviews, photos and profiles.
- Block user: the blocked author's content disappears from the blocker's feeds immediately, and every block and report notifies our moderation team.
- Automatic filtering of objectionable words in comments and messages, and pre-moderation of published trips and quest reviews.
- Moderation commitment: reports are reviewed within 24 hours; offending content is removed and the author's account is deactivated.
The attached screen recording from a physical [DEVICE] on build [11] shows the agreement before sign-in and registration, reporting content and blocking a user.

Guideline 5.1.2(i): MeTravel does not track users. The app contains no advertising SDKs and does not access the advertising identifier (NSPrivacyTracking = false). We removed all cookie prompts and cookie settings from the app, links to metravel.by now open native screens, and embedded third-party web views no longer keep cookies. Our website uses first-party analytics with opt-in consent only, without advertising features or sharing with data brokers, and its banner now states this.
```

## Черновик Notes (EN, НЕ сохранён в ASC)

```text
[existing core-feature and demo-account paragraphs, updated to build 11]

User-generated content (Guideline 1.2): the Terms of Use agreement (zero tolerance for objectionable content and abusive users) must be checked on the Sign in and Registration screens before any sign-in method is enabled. Every trip, comment, message, quest review, photo and profile has a "…" menu with Report and Block author. Blocking hides the author's content immediately; reports and blocks notify our moderators, who act within 24 hours. Blocked users are listed in Settings → Privacy → Blocked users.

Privacy (5.1.2): the app does not track users and contains no cookie prompts; App Privacy declares no tracking.

Review demonstration: [ATTACHMENT, DEVICE, BUILD 11, SCENE TIMECODES].
```
