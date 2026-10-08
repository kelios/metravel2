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

## Готовность Reply и Notes на 08.10.2026 (#2138)

Разрешённая локальная подготовка уточнена; **Reply не отправлен, Notes не
сохранены в ASC, submit не выполнен**. #2128–#2136 имеют статус `done` на
борде, включая #2129 с backend SLA24hours и email-уведомлением
администратору сайта. Это подтверждение завершённых исходников/прежней
приёмки, а не доказательство того, что они включены в ещё не подтверждённую
сборку11.

Ниже таблицы «Факты» и архитектурный разбор сохраняют состояние03.10.2026;
их строки «нет» не описывают текущий код. Для результата исправлений см.
карточки #2128–#2136. Исходный отказ относится к1.0.5(10); **11 — целевой
номер нового кандидата, не подтверждённый загруженный build**.

| Поле отправляемого пакета | Состояние / источник |
|---|---|
| Версия, build и source SHA кандидата | Не подтверждены; нужны фактическая ASC build record и exact IPA audit, а не HEAD/source-only QA |
| Видео и manifest кандидата | #2137 todo; принятых новых видео и сцен с таймкодами нет. Старые материалы build9 не переименовывать в11 |
| Физический iPhone, OS и дата записи | Заполняются из manifest #2137; согласие, жалоба и блок на физическом устройстве обязательны |
| iPad, OS и способ записи | Физический при подключённом iPad, иначе явно названный simulator; не выдавать simulator за физическое устройство или TestFlight binary |
| Полное покрытие и privacy просмотр | Требуются все обязательные сцены/attestations `scenes.json`, проверка manifest и полный просмотр итогового видео; четыре новые сцены не заменяют прежние required |
| Tracking=No в App Privacy | Требуется свежая read-only ASC-проверка; закрытая #2135 не меняла ASC и не доказывает текущее значение |
| Вложение / доступный URL | Файл/хэш из manifest и ASC attachment либо проверенная signed-out ссылка; локальный путь не подходит |
| Внешние действия | Reply, сохранение Notes, submit, signed build и upload — отдельные текущие команды владельца по решению03.10; готовность документов не разрешает их автоматически |

Все `[UPPER_CASE]` поля в черновиках заменяются только подтверждёнными
данными этого кандидата. Черновики не копируются в ASC до закрытия полей.
Demo credentials остаются в защищённых полях ASC и не добавляются в этот
документ, Reply или видео. Notes — не больше4000символов после подстановки;
остаточный лимит проверяется на полном тексте, а не только новом UGC-абзаце.

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

## Факты по пунктам 1.2 (исторический срез 03.10.2026)

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

## Факты по 5.1.2(i) (исторический срез 03.10.2026)

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

## Архитектурное решение (план 03.10.2026)

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

Затем — отдельные текущие команды владельца на signed build11, upload в
TestFlight, отправку Reply, сохранение Notes, submit и storefront release.
Разрешение одной стадии не разрешает следующую.

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

## Дополнительные сцены отказа 25.09 для записи нового кандидата

Это дополнение к полному каталогу required-сцен и attestations
`.codex/skills/metravel-app-review-evidence/scenes.json`, не отдельный
четырёхсценный пакет. Физический iPhone снимается на exact TestFlight
кандидате; 11 пока только целевой build. Для iPad действует решение
владельца #2137: физический при подключённом устройстве, иначе iPad Air
11-inch (M3), iPadOS 26 в simulator с отдельной фактической identity
приложения и явной пометкой simulator, без утверждения об установке
подписанного TestFlight IPA.

| Сцена | Что в кадре |
| --- | --- |
| `eula-before-auth` | Свежая установка → экран входа: кнопки email/Apple/Google/Facebook неактивны, тап по Apple ничего не делает → открыть «Условия», показать фразу о нулевой терпимости → вернуться, отметить галку → кнопки активны → вход демо-аккаунтом. То же на экране регистрации до создания аккаунта |
| `ugc-flag-content` | Чужой контент → «…» → «Пожаловаться» → причина → «Отправить» → подтверждение рассмотрения в течение 24 часов. Покрыть каждый тип из `scenes.json`: карточку путешествия, комментарий, личное сообщение, сообщение чата поездки, отзыв квеста и фото; профиль проверяется в `ugc-report` |
| `ugc-block-hides-content` | Каталог с путешествием автора X → «…» → «Заблокировать автора» → диалог с последствиями → подтверждение → карточка исчезает без перезагрузки; комментарий X на детальной тоже исчез; Настройки → «Заблокированные» → X в списке |
| `no-cookie-ui` | iPad landscape: меню аккаунта без пункта cookies; экран «Приватность» — «не отслеживаем» |

Регистрацию и вход на видео выполняет владелец (агенту ввод пароля запрещён).

## Черновик Reply (EN, НЕ отправлен; требует exact-candidate evidence)

```text
Thank you for the review of 1.0.5 (10).

The revised candidate is [CANDIDATE_VERSION] ([CANDIDATE_BUILD]).

Guideline 1.2:
- Terms of Use and Community Guidelines state zero tolerance for objectionable content and abusive users. Users must agree before email registration or any sign-in method (email, Sign in with Apple, Google, Facebook) becomes available. Existing users re-accept the current terms before posting.
- Users can report content from its safety menu, including travel articles, comments, direct messages, trip chat, quest reviews, photos and profiles.
- Blocking an author immediately removes that author's content from the blocking user's feeds. Blocked users can be managed in Settings.
- Objectionable-word filtering applies to comments, direct messages and trip chat; travel articles and quest reviews are pre-moderated.
- Every report and block sends an email notification to the website administrator. The administrator reviews reports within 24 hours and can remove offending content and ban abusive users.

Evidence for this candidate:
[IPHONE_VIDEO_ATTACHMENT_OR_URL] — physical [IPHONE_MODEL], [IPHONE_OS], recorded [IPHONE_RECORDING_DATE], [CANDIDATE_VERSION] ([CANDIDATE_BUILD]).
Terms before registration/sign-in: [EULA_TIMECODE].
Content report and confirmation: [REPORT_TIMECODE].
Block confirmation, immediate content removal and blocked-users list: [BLOCK_TIMECODE].
[IPAD_VIDEO_ATTACHMENT_OR_URL] — [IPAD_MODEL], [IPAD_OS], [IPAD_PHYSICAL_OR_SIMULATOR], recorded [IPAD_RECORDING_DATE], candidate [IPAD_CANDIDATE_IDENTITY]. No cookie menu or prompts: [PRIVACY_TIMECODE].

Guideline 5.1.2(i): MeTravel does not track users. The revised app has no cookie prompts or cookie-settings entry. Supported links to our travel articles open native app screens. Belkraj and Instagram content is offered as a link to the external browser instead of an embedded widget that loads their third-party scripts inside the app. Website analytics require opt-in consent; advertising signals and advertising personalization are disabled in the website code. The exact candidate's privacy manifest declares NSPrivacyTracking=false, its Info.plist does not declare NSUserTrackingUsageDescription, and its App Privacy record declares Tracking=No.
```

Последний абзац про exact manifest/App Privacy отправляется только после
соответствующих attestations и свежего ASC чтения. Для iPad-simulator:
`IPAD_PHYSICAL_OR_SIMULATOR` явно называет simulator, а
`IPAD_CANDIDATE_IDENTITY` содержит фактические version/build/source его
приложения; simulator не считается установкой подписанного TestFlight IPA.

## Черновик Notes (EN, НЕ сохранён в ASC; полный текст, без credentials)

```text
Candidate: [CANDIDATE_VERSION] ([CANDIDATE_BUILD]).

MeTravel is a travel community with travel articles, maps, walking quests and personal trip plans. Guests can browse public content. Sign-in enables personal content and community actions. The review account is supplied in the protected Demo Account fields. Please use a disposable account for the in-app account-deletion demonstration; do not delete the permanent review account.

User-generated content (1.2): Terms of Use and Community Guidelines state zero tolerance for objectionable content and abusive users. Agreement is required before registration or email/Apple/Google/Facebook sign-in becomes available. Content safety menus provide reporting and author blocking. Blocking immediately hides that author's content from the blocking user's feeds; the blocked-users list is in Settings. Every report and block emails the website administrator, who reviews reports within 24 hours and can remove offending content and ban abusive users. Comments, direct messages and trip chat are filtered; travel articles and quest reviews are pre-moderated.

Privacy (5.1.2): the app does not track users and has no cookie prompts or cookie-settings entry. Belkraj and Instagram links open in the external browser. App Privacy declares Tracking=No, confirmed for this candidate.

Review evidence: [IPHONE_VIDEO_ATTACHMENT_OR_URL], physical [IPHONE_MODEL], [IPHONE_OS], [IPHONE_RECORDING_DATE], candidate [CANDIDATE_VERSION] ([CANDIDATE_BUILD]). Terms [EULA_TIMECODE]; report [REPORT_TIMECODE]; block and immediate hiding [BLOCK_TIMECODE].
iPad evidence: [IPAD_VIDEO_ATTACHMENT_OR_URL], [IPAD_MODEL], [IPAD_OS], [IPAD_PHYSICAL_OR_SIMULATOR], [IPAD_RECORDING_DATE], candidate [IPAD_CANDIDATE_IDENTITY]; privacy [PRIVACY_TIMECODE].
```

Notes заменяют прежний placeholder «existing paragraphs» полным черновиком;
перед сохранением оператор сверяет существующие ASC Notes, сохраняет их
непересекающиеся важные инструкции и проверяет полный итоговый лимит4000.
Ни один placeholder или обещание непроверенного candidate не публикуется.
