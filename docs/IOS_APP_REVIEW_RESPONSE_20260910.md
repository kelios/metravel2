# Ответ Apple на запрос от 10.09.2026 — MeTravel 1.0.5 (9)

Рабочий пакет [#1890](https://metravel.by/board#task-1890), обновлён 12.09.2026.
**Не готов к отправке:** физическое видео и проверка demo ещё выполняются в
[#1889](https://metravel.by/board#task-1889); неподтверждённые пункты перечислены
ниже. Черновик не является отправленным ответом или результатом приёмки.

## Проверенная идентичность и состояние

| Поле | Подтверждение |
| --- | --- |
| Приложение | MeTravel, `by.metravel.app`, universal iPhone/iPad |
| Кандидат | `1.0.5 (9)` — непосредственно выбран в App Store Connect 12.09.2026 |
| Исходник кандидата по #1424 | `8ae84cb56b578013a0fa1c3ec75c8d5524982c1a`, входит в `origin/main`; происхождение установленного экземпляра проверяется отдельно |
| Отправка | `2caaff34-ee6a-4546-b599-a27d056195dd`, отправлена 09.09.2026 |
| Текущее состояние | «Отклонено», «Нерешенные проблемы», `2.1.0 Performance: App Completeness` |
| Сообщение Apple | Одно, от 10.09.2026: `Guideline 2.1 — Information Needed — New App Submission` |
| Распространение | Общедоступное, 175 доступных стран/регионов; цена и выручка 0,00 во всех 175 строках диалога «Текущая цена» 12.09.2026 |
| Дополнительные платформы | Распространение iOS-приложения на Mac и Apple Vision Pro выключено в ASC 12.09.2026 |
| App Privacy | Live ASC 12.09.2026: опубликованы 10 типов, каждый linked to identity; это сверка формы, не доказательство полноты классификации телеметрии и партнёрских WebView |
| Отправленный ответ | Нет: в переписке пока только сообщение Apple |

[Исходная переписка App Review](https://appstoreconnect.apple.com/apps/6801264369/distribution/reviewsubmissions/details/2caaff34-ee6a-4546-b599-a27d056195dd).
Apple просит шесть ответов **в Reply и в Notes**. Профилактический перечень
типичных проблем в письме не доказывает наличие этих дефектов в MeTravel.

## Матрица шести вопросов

| № | Что должно быть в Reply и Notes | Доказательство | Готовность |
| --- | --- | --- | --- |
| 1 | Физическое видео от запуска до результатов обычных действий; регистрация, вход, удаление отдельного аккаунта, UGC report/block | #1889; version/build, device, OS, дата, файл и таймкоды | В работе; файла для Apple ещё нет |
| 2 | Назначение, аудитория, самостоятельная польза | Исходник кандидата; карточка #1424; раздел 2 ниже | Текст подготовлен; показанные сценарии связываются с #1889 |
| 3 | Первый запуск, доступ к функциям, рабочий reviewer demo | Защищённые поля ASC + физический вход в #1889 | Штатный login API принял данные 12.09, HTTP 200; физический вход ещё проверяется |
| 4 | Реально включённые внешние сервисы, включая backend | Инвентарь ниже; точный исходник, бинарник и узкое чтение SMTP/S3 настроек | Провайдеры перечислены; режим Meta описан без неподтверждённого обещания отсутствия событий |
| 5 | Функциональные и контентные различия по регионам | ASC 175 стран; исходник; ответ владельца 12.09 | Собственных ограничений MeTravel не заявлено; ассортимент и доступность поставщиков могут различаться |
| 6 | Применимость регулируемых услуг и права на сторонние материалы | #1420, Terms/Privacy, атрибуция; ответ владельца 12.09 | Права на указанные партнёрские предложения подтверждены владельцем; реквизиты договоров не выдумываются |

## 1. Физическое видео

Итоговый файл пока отсутствует. В отправляемый текст должны попасть имя
прикреплённого файла либо доступная Apple ссылка, устройство, версия ОС, дата,
`1.0.5 (9)` и реальные таймкоды. Плановые отметки времени не выдаются за запись.

Первая read-only проверка 12.09.2026 обнаружила на доступном iPhone 13 mini приложение
`by.metravel.app` версии `1.0.5 (9)` и iOS `26.5`. Это ещё не подтверждение
происхождения из TestFlight или полного прохождения сценариев. Согласно
[Apple security releases](https://support.apple.com/en-us/100100), актуальная
стабильная iOS/iPadOS на дату проверки — `26.6.2` от 08.09.2026. Поэтому запись
на `26.5` нельзя назвать выполненной на последней ОС, как требует письмо.

После разблокировки устройств повторная прямая проверка обнаружила iPad mini 6
на **iPadOS 26.6.2**; прежние 18.7.8/unavailable были устаревшим списком
спаренных устройств. Оба устройства доступны и разблокированы. После включения
Developer Mode по запросу ошибка 10005 исчезла, прямая проверка iPad подтвердила
установленный `1.0.5 (9)`. Автоматические касания пока ограничены профилем подписи
вспомогательного XCUITest runner; это не ошибка подписи кандидата MeTravel.
На iPhone сохраняется iOS 26.5.
Письмо Apple требует **physical device**, а не именно iPhone. Основное видео
можно снять на iPad с актуальной ОС после разрешения device gate и подтверждения
точного установленного кандидата; iPhone используется для отдельной проверки
совместимости. Обновление iPhone не является условием записи на iPad.

Порядок записи: холодный запуск → гостевой каталог/статья/карта/квест →
регистрация отдельного тестового аккаунта и вход → избранное/планирование →
пользовательский контент и жалоба/блокировка тестового автора → удаление только
одноразового аккаунта → наблюдаемый выход и невозможность повторного входа.
Постоянный reviewer demo сохраняется. Пароли, уведомления и личные данные
владельца в запись не попадают.

Старый FAIL Universal Links из #1423 от 08.09 сохраняется как история. Его
уточняет физический PASS #1414 от 09.09 на том же build 9 после исправления
AASA: cold 5/5, warm 5/5, negative 2/2. Эти результаты не доказывают остальные
сценарии и не заменяют новое видео.

Apple допускает demo video как review attachment:
[App Store review attachments](https://developer.apple.com/documentation/appstoreconnectapi/app-store-review-attachments).
Предпочтительный способ передачи выбирается после проверки файла и
подтверждения возможностей ASC; публичная загрузка не требуется автоматически.

## 2. Purpose and target audience — черновик Reply

MeTravel is a free travel discovery and planning app for independent travellers
who want practical trip ideas and self-guided city walks. It brings travel
articles, photographs and places on a map together with city quests, saved
favourites and trip planning. Its main content focuses on Belarus and nearby
travel destinations, with additional destinations contributed by authors.

Users can explore travel ideas as guests, open an article and its mapped
places, discover a city quest, and create an account to save and organise their
plans. The app is intended for the general public, rather than the employees
or customers of a particular organisation. MeTravel is not a tour operator or
a booking provider; any partner offers lead to the external provider.

## 3. Setup and access — черновик Reply

No special hardware, sample files or subscription is needed for the main
travel browsing features. Connect the device to the internet and launch
MeTravel. Browse the travel catalogue, open a travel article and its map, or
open the city quest catalogue. Content is supplied by the live MeTravel service.

For account features, open the profile area and sign in with the reviewer
account supplied in the protected App Review Information fields. Please keep
that account for review. To inspect account deletion, use a separate disposable
account: open Settings, select Delete account in the account section, and
complete the confirmation. Our demonstration uses a separate account for this
purpose. The authenticated public-author profile provides the reporting and
blocking menu; the demonstration identifies the test author used for this check.

Редакторская пометка: последние две фразы про выполненную демонстрацию допустимы
к отправке только после видео #1889. До проверки не заявлять, что reviewer demo
работает. Не копировать demo-логин или пароль в этот документ, борд и видео.

Промежуточное подтверждение 12.09.2026, 10:13:52 UTC: штатный production
`POST /api/user/login/` принял переданные владельцем данные постоянного reviewer
аккаунта — HTTP 200, получен token, email в ответе совпал. Значения token и
credentials в evidence не сохранены. Это API-проверка доступа; физический вход
и доступность функций в кандидате остаются частью #1889. Удаление или
пересоздание постоянного reviewer не требуется. Обезличенный результат:
`.codex-temp/app-review-2026-09-12/reviewer-login-api.sanitized.json`.

## 4. External services — рабочий инвентарь

Инвентарь заполняется по исходнику `8ae84cb56` и эффективной конфигурации
кандидата. Для каждой строки нужны provider, назначение, категории передаваемых
данных, включённость и источник. Серверная интеграция проверяется отдельно;
отсутствие SDK в приложении не доказывает её отсутствие на backend.

Все frontend-ссылки `path:line` в таблице относятся к `8ae84cb56`, а backend —
к read-only `origin/master` на дату разбора; backend-исходник не является снимком
его действующей production-конфигурации.

Проверка скачанного IPA build 9 от 12.09 подтвердила 10 типов и `tracking=false`
в первичном privacy manifest, но также обнаружила 28 SDK manifests: у
FBSDKCoreKit/LoginKit/ShareKit заявлены `tracking=true` и tracking domain, у
Google Sign-In — 8 типов. Сверх первичных 10 SDK заявляют `CrashData`,
`OtherDataTypes`, `OtherUsageData`, `PhoneNumber` и `ProductInteraction`.
Декларации не доказывают runtime tracking или нарушение; сопоставление с
эффективными режимами SDK, WebView и опубликованной ASC формой остаётся открытым.
Источник — `.codex-temp/app-review-2026-09-12/artifact/identity-config.json`.
Для сверки деклараций приложения и SDK используются
[Apple Privacy manifest files](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)
и [TN3182](https://developer.apple.com/documentation/technotes/tn3182-adding-privacy-tracking-keys-to-your-privacy-manifest).
Скомпилированные feature flags зафиксированы без значений секретов в
`.codex-temp/app-review-2026-09-12/artifact/static-flags-evidence.md`.

Уточнение по Meta SDK 18.1.0: нативная инициализация выполняется независимо от
скрытой Facebook-кнопки и может запрашивать конфигурацию SDK. Встроенные
`AutoLogAppEvents=false` и `AdvertiserIDCollection=false` подтверждены; явных
вызовов Meta event/purchase logging в коде приложения не найдено. Однако
серверное `auto_log_app_events_enabled` имеет приоритет перед локальным false,
поэтому без его значения нельзя обещать полное отсутствие автоматических событий.
Версионный источник —
[Meta Settings+AutoLogAppEvents](https://github.com/facebook/facebook-ios-sdk/blob/v18.1.0/FBSDKCoreKit/FBSDKCoreKit/Settings%2BAutoLogAppEvents.swift#L15);
воспроизводимый разбор —
`.codex-temp/app-review-2026-09-12/facebook-privacy-evidence.md`.
Это уточнение допустимых формулировок, а не установленное нарушение или
самостоятельное основание требовать новую сборку.

12.09.2026 в 09:59:31 UTC выполнен запрос конфигурации тем же способом, что у
SDK 18.1.0: ответы HTTP 200, `auto_log_app_events_enabled` отсутствует,
`auto_log_app_events_default=true`. В этой ситуации SDK выбирает явный локальный
false раньше серверного default. Это подтверждает отключённое обычное
автологирование на новой установке при текущей конфигурации; оно не доказывает
исторические настройки обновлённой установки, payload/retention или отсутствие
любых сетевых запросов Meta. Значения и время сохранены без идентификаторов и
секретов в `.codex-temp/app-review-2026-09-12/meta-config-read.sanitized.json`.

| Сервис | Назначение и данные | Доказательство / граница |
| --- | --- | --- |
| MeTravel API | Аккаунт/email-вход, статьи, фото, квесты, планы, жалобы и блокировки; аккаунтные данные, выбранный контент, координаты маршрута | `api/auth.ts:31,145`, `api/user.ts:26,238`, `api/misc.ts:238`; runtime-кандидат проверяется в #1889 |
| Apple / Google | Настроенные способы входа наряду с email; provider identity/token, имя/email передаются MeTravel | `components/auth/AppleSignInButton.native.tsx:92`, `GoogleSignInButton.native.tsx:48,123`; в exact IPA Google config непустая и availability gate проходит; успешный вход ещё проверяется |
| Facebook SDK | Native SDK присутствует с AutoInit=true, но Facebook login UI в build 9 скрыт | Exact Hermes v98: `isFacebookNativeLoginEnabled` сравнивает пустую строку с `true` и возвращает false; linked SDK не означает доступную кнопку входа или отсутствие SDK-сетевой активности |
| Amazon S3 | Загруженные фото/медиа и резервные копии базы, содержащие аккаунтные и контентные данные | Реальная инвентаризация `docs/features/images.md:127` от 30.07 и успешный backup `docs/DB_BACKUP.md:3,7,11` от 31.08; узкое чтение действующих настроек 12.09 подтвердило `eu-north-1` |
| Leaflet / OpenStreetMap | Локальная карта в native WebView, тайлы через MeTravel proxy; область/масштаб карты | `components/MapPage/Map.ios.tsx:3,16`, `config/mapWebTileContract.ts:6`; это не встроенная Google Maps/Apple MapKit карта |
| Nominatim / BigDataCloud | Поиск адресов и обратное геокодирование; запрос, координаты и язык | `api/external/nominatim.ts:34`, `api/geoQueries.ts:123,147,209`; возможны прямые обращения к поставщику |
| OpenRouteService / Valhalla / OSRM | Расчёт маршрута через MeTravel и предусмотренные fallback-пути; точки и транспортный профиль | `api/external/serverRouting.ts:35`, `components/MapPage/useRouting.ts:564`, backend `routing/services.py:104,117`; ORS key и реальный выбранный fallback — конфигурация/runtime |
| Open-Meteo | Прогноз и высоты; координаты места/маршрута | `components/home/hooks/useWeatherWidgetModel.ts:92`, `components/map-core/useElevation.ts:203` |
| Опциональные слои карты | Esri, OpenTopoMap, WaymarkedTrails, Overpass, польские лесные сервисы; viewport/POI-запросы. OpenWeatherMap key присутствует в exact IPA | `config/mapWebLayers.ts:220,234,249,433,446,570,626`, `components/MapPage/Map/nativeWeatherTempLabelsScript.ts:122`; compiled key не доказывает действующий тариф, лицензию или успешный запрос |
| Expo / APNs | Push token и платформа связываются с аккаунтом; доставка уведомлений | `hooks/usePushNotifications.native.ts:137`, `services/notifications.ts:169`, `api/auth.ts:648`; наличие кода не доказывает доставку |
| Собственная телеметрия квестов | В MeTravel идут идентификатор сессии, шаг, результат, время/попытки/подсказки и локаль; свободный текст исключён, закрытые ответы могут передаваться | `utils/questAnswerTelemetry.ts:88,201,363`, `api/quests.ts:867,898`; native GA4/Яндекс отключены в `utils/analytics.ts:147`, но это не отсутствие всей телеметрии |
| Belkraj / Tripvenue | Native WebView экскурсий для поддержанных направлений; координаты первой точки, страна и партнёрский контекст | `components/belkraj/BelkrajWidget.native.tsx:38,94,109`, `belkrajAvailability.ts:104`; production-путь не зависит от Travelpayouts marker; downstream cookies/analytics не проверены |
| Travelpayouts / Tripster / Ostrovok | Внешние партнёрские предложения отелей/экскурсий; направление и партнёрский контекст | `components/affiliate/affiliateConfig.ts:119,124,161,177,229`; в exact IPA marker и оба templates непустые, config gate включён; активность и права на программы не выводятся из наличия URL |
| Gmail SMTP / Telegram | Сервисные письма: адрес получателя и сообщение; необязательное связывание Telegram-аккаунта и выбранные социальные контакты | Узкое read-only чтение действующих настроек backend 12.09: `smtp.gmail.com`; frontend `api/telegramLink.ts:3,18`. Это конфигурация отправителя, а не доказательство доставки письма |
| Sentry / AI / платежи | В просмотренных исходниках не найден включённый вызов Sentry/AI или собственный платёжный путь; внешние коммерческие ссылки присутствуют | `services/performanceMonitoring.ts:19,28`, `api/misc.ts:62,845`, `package.json:257`; это не runtime-проверка и не доказательство отсутствия серверных AI/служебных задач либо платёжных форм у партнёров |

Английская основа пункта 4 (после уточнения условных строк):

MeTravel uses its own API for accounts, travel content, trip plans, quests and
user-safety actions. The candidate includes email sign-in and configured Apple
and Google integrations. Facebook sign-in is disabled in build 9, although its
native SDK remains included; its effective SDK behaviour is being reconciled.
Maps use bundled Leaflet with OpenStreetMap tiles through our
tile proxy; address lookup uses Nominatim and a BigDataCloud fallback. Routing
uses our routing API, with OpenRouteService and the transport-specific fallback
services listed in the accompanying service inventory. Open-Meteo supplies
weather forecasts and elevation information. Optional map layers use their
respective attributed providers.

The candidate source implements Expo push registration and an APNs notification
path; successful registration and delivery still require confirmation. The app
sends quest-attempt telemetry to MeTravel; its native analytics
utility does not send Google Analytics or Yandex Metrica events. Travel pages
can show Belkraj/Tripvenue excursion content and configured hotel/tour affiliate
links. These services receive the destination or route context needed for the
selected feature. Booking and payment handling belong to the external provider;
the MeTravel account and trip-planning flows do not request payment-card details.

Полный список с Amazon S3 и Gmail SMTP включён в общий компактный текст ниже.
Перед отправкой проверить сценарии
партнёрского WebView: отсутствие собственного платёжного кода не доказывает
отсутствие формы оплаты у поставщика внутри WebView. Неподтверждённые
утверждения о работающем входе и доставке push не добавлять.

## 5. Regions — подтверждённые факты

The App Store record is configured for free public distribution in 175
countries and regions. The app interface supports Russian, Belarusian,
Ukrainian, Polish and English; travel articles and quests are editorial and
user-authored content and are not automatically translated when the interface
language changes. Content coverage therefore varies by destination and author.

Partner excursion content is destination-dependent: the Belkraj/Tripvenue
section is shown only for countries supported by that provider's catalogue.
Hotel and tour links also depend on the destination and provider catalogue.
These are differences in available travel content and partner offers, not a
promise of the same inventory in every country. Third-party services may also
be subject to their own availability restrictions.

Механизм подтверждён исходником: `components/belkraj/belkrajAvailability.ts`
содержит явный список стран и `canRenderBelkrajWidget`; неизвестная или
неподдержанная страна скрывает виджет. `components/affiliate/affiliateConfig.ts`
выбирает страновые URL либо нейтральную главную страницу партнёра. Поэтому
фраза «одинаковый контент во всех регионах» заведомо неверна.

12.09.2026 владелец ответил «нет» на вопрос о дополнительных сервисах и
собственных ограничениях MeTravel по странам. Это подтверждает отсутствие
заявленных владельцем ограничений MeTravel, но не обещает одинаковую сетевую
доступность сторонних поставщиков во всех странах. Провайдеров хранилища и почты
ответ не называет; отдельно выполненное узкое чтение настроек подтвердило
Gmail SMTP и регион S3, как зафиксировано в разделе 4.

The owner confirms that MeTravel does not impose additional country-specific
feature restrictions. Destination coverage, partner inventory and third-party
service availability can vary.

## 6. Rights and regulated services — подтверждённая основа

#1420 хранит подтверждение владельца от 13.08.2026 о правах на фотографии
статей, квестов и будущих Store screenshots; 17–18.08 подтверждены сохранённые
Content Rights в ASC и расширенная лицензия UGC Terms на техническую обработку.
Повторно собирать эти же подтверждения без изменения фактов не требуется.

12.09.2026 live ASC повторно показывает сохранённое «Да, у этого приложения
есть необходимые права на сторонний контент», стандартную EULA Apple,
категории «Путешествия / Социальные сети» и рейтинг 13+ в сводке.

Английская основа пункта 6:

MeTravel provides travel information, self-guided city quests and trip-planning
tools. It does not provide medical, financial or gambling services. Hotel and
excursion offers refer users to the external provider; MeTravel does not
process the booking or payment. Travel photographs and review screenshots are
owned by MeTravel or used with permission, as confirmed by the owner. Authors
retain the rights to their uploads and grant the limited operational licence
described in our Terms. Map and other third-party content retain their provider
attributions. Our Terms and Privacy Policy are available at
https://metravel.by/terms and https://metravel.by/privacy.

12.09.2026 владелец ответил «да» на прямой вопрос о разрешении показывать в
мобильном MeTravel Belkraj/Tripvenue и предложения Tripster/Ostrovok через
Travelpayouts. Это новое подтверждение прав владельцем; конкретные договоры
или версии условий в ответе не названы, поэтому их реквизиты не придумываются.

The owner confirms permission to display Belkraj/Tripvenue offers and
Tripster/Ostrovok offers through Travelpayouts in the mobile app.

Нельзя выводить из галочки Content Rights активность партнёрских программ,
право на любой новый материал или отсутствие регулируемых функций. Финальный
английский ответ должен назвать реально используемый сторонний контент,
сослаться на Terms/Privacy и атрибуцию поставщиков, а также использовать только
подтверждённое описание услуг MeTravel.

## Общий черновик Reply и Notes — не отправлять с временными полями

Ниже один компактный текст для обоих полей. Квадратные скобки — только
незавершённые результаты физического QA и видео #1889. После подстановки
проверенных значений перечитать 6/6 пунктов,
проверить длину по текущему полю ASC и использовать один и тот же файл видео.
Live ASC 12.09 показал лимит Notes 4000 символов (474 занято, 3526 осталось);
после замены временных полей длину нужно пересчитать. Поле необязательного
вложения доступно: разрешённый и проверенный private review attachment может
заменить публичную видеоссылку.
Учётные данные никогда не подставляются: они остаются в защищённых полях ASC.

```text
MeTravel 1.0.5 (build 9) — response to the 10 September 2026 information request.

1. Physical-device demonstration
Video: [VIDEO_ATTACHMENT_OR_ACCESSIBLE_LINK]. Recorded on [PHYSICAL_DEVICE_MODEL],
[VERIFIED_CURRENT_STABLE_IOS_OR_IPADOS], [RECORDING_DATE], using the verified TestFlight
candidate 1.0.5 (9). Timecodes: [LAUNCH; GUEST BROWSING; REGISTRATION AND SIGN-IN;
TRAVEL/MAP/QUEST; FAVOURITES/PLANNING; REPORT/BLOCK; DISPOSABLE ACCOUNT DELETION].
The deletion account is separate from the permanent reviewer account.
[VERIFIED_PAID_FEATURE_RESULT: show any actual paid flow, or confirm its absence.]
Compatibility checks: [IPHONE_AND_IPAD_MODELS_OS_AND_VERIFIED_RESULTS].

2. Purpose and audience
MeTravel is a free travel app for independent travellers. It combines articles,
photographs, mapped places, city quests, favourites and trip plans. Its public
catalogue focuses on Belarus and nearby destinations, with more added by authors.

3. Setup and reviewer access
Connect to the internet and browse articles, maps and quests as a guest; no
subscription or special hardware is needed. For account features, open Profile
and use the credentials in the protected App Review Information fields.
Reviewer sign-in was verified on [DEMO_VERIFICATION_DATE_AND_RESULT].
To test deletion, use a disposable account, open Settings > Delete account and
confirm. Keep the permanent reviewer account. Reporting and blocking are in
the public-author profile menu after sign-in; the video uses a test author.

4. External services and data
MeTravel's API handles accounts, travel content, quests, trip plans and user-safety
actions, including quest-attempt/session events. Apple/Google sign-in exchanges
identity tokens and account details. Amazon S3 stores uploaded media and database
backups; Gmail SMTP is configured for account emails (recipient address and message).
Expo/APNs use device tokens for notifications;
optional Telegram linking associates the selected Telegram account.
Leaflet/OpenStreetMap provide maps; Nominatim/BigDataCloud geocode addresses;
OpenRouteService, Valhalla and OSRM calculate routes. Open-Meteo provides weather
and elevation. Optional layers use Esri, OpenTopoMap, WaymarkedTrails, Overpass,
Polish forestry services and OpenWeatherMap. These requests use map areas,
coordinates, destinations or search queries required by the selected feature.
Belkraj/Tripvenue, Travelpayouts, Tripster and Ostrovok provide destination-based
partner offers via WebView or external links, receiving destination/partner context.
Meta SDK 18.1.0 remains included although Facebook sign-in is disabled. Its
shipped auto-event and advertising-ID flags are false; our code implements no
Meta event/purchase logging. Native initialization can request SDK configuration.
MeTravel's account and trip-planning flows do not request payment-card details;
partner booking/payment handling belongs to the external provider.

5. Countries and regions
ASC is configured for free public distribution in 175 countries and regions.
The interface supports RU/BE/UK/PL/EN. Articles and quests retain the author's
language; changing the interface language does not translate that content.
Destination coverage and partner offers vary by catalogue.
The owner confirms no additional country-specific feature restrictions imposed
by MeTravel. Third-party service availability can vary.

6. Services and content rights
MeTravel provides travel information and planning, not medical, financial or
gambling services. The owner confirmed rights to the travel photographs and
review screenshot materials. Authors retain their uploads' rights and grant the
limited operational licence in our Terms. Third-party materials retain their
provider attribution. The owner also confirms permission to display
Belkraj/Tripvenue offers and Tripster/Ostrovok offers through Travelpayouts in
the mobile app.
Terms: https://metravel.by/terms
Privacy Policy: https://metravel.by/privacy
```

## Что ещё нужно для готовности

1. #1889: точное происхождение установленного бинарника, запись всех действий
   с результатами и таймкодами, iPad-проверка,
   свежий demo-вход, проверка файла на отсутствие секретов.
2. Effective config build 9, S3 и Gmail SMTP подтверждены указанными выше
   источниками. Описание Meta ограничено проверенными фактами инициализации и
   локальных flags; не обещает безусловное отсутствие событий.
   Сопоставить основной и SDK privacy manifests с эффективными режимами SDK,
   телеметрией, WebView и ASC формой; совпадение первых 10 типов не закрывает
   этот вопрос.
3. Владелец 12.09 подтвердил партнёрские права и отсутствие дополнительных
   сервисов/собственных страновых ограничений; повторно эти вопросы не задавать.
4. Полный Reply и Notes: 6/6 ответов, проверка длины и согласованности,
   `npm run ios:store:guard`, `npm run audit:prompts`, независимая проверка текста.
5. После готовности конкретного пакета — решение по #1891 и операторский шаг
   #1892. Ответ, повторный submit и выпуск в storefront учитываются отдельно;
   состояние «Отклонено» не меняется от создания этого документа.
6. В локальном `IOS_STORE_LISTING.md` подготовлено удаление обещания Facebook
   из Description RU/UK/PL/EN-US; live ASC всех четырёх локалей ещё содержит
   это обещание (построчно сверено 12.09, изменения не сохранялись).
   Перед отправкой сверить и сохранить четыре точные замены в ASC отдельным
   разрешённым операторским действием. Локали UI приложения не затронуты.
