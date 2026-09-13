# Ответ Apple на запрос от 10.09.2026 — MeTravel 1.0.5 (9)

Рабочий пакет [#1890](https://metravel.by/board#task-1890), обновлён 12.09.2026.
**Отправлено 12.09.2026:** Reply с 6/6 ответами и вложением видео ушёл в переписку
App Review в 23:12, Notes и вложение сохранены в App Review Information, объект
1.0.5 (9) повторно отправлен в 23:31 — ASC показывает «Ожидание проверки»
(журнал операции — #1892). Одобрение Apple не заявляется. Все сцены сняты и смонтированы в
[#1889](https://metravel.by/board#task-1889) — `review-demonstration-final.mp4`,
375,3 с, SHA-256 `3fc2c03f…1b7b`, privacy playback PASS после исправления;
решения по Reply/Notes и повторному submit остаются в #1891. App Privacy обновлена и опубликована
12.09 в 12:29 UTC: 12 типов и уточнённые аналитические цели. Первичный manifest
build 9 остаётся прежним; исправление исходника не меняет установленный кандидат.
Черновик не является отправленным
ответом или результатом приёмки.

## Проверенная идентичность и состояние

| Поле | Подтверждение |
| --- | --- |
| Приложение | MeTravel, `by.metravel.app`, universal iPhone/iPad |
| Кандидат | `1.0.5 (9)` — непосредственно выбран в App Store Connect 12.09.2026 |
| Физический iPad | 12.09.2026: TestFlight на iPad mini 6 показывает MeTravel `1.0.5 (9)` и «Открыть»; iPadOS `26.6.2` подтверждена прямой проверкой устройства |
| Исходник кандидата по #1424 | `8ae84cb56b578013a0fa1c3ec75c8d5524982c1a`, входит в `origin/main`; TestFlight `1.0.5 (9)` с кнопкой «Открыть» подтверждён на обоих физических устройствах |
| Отправка | `2caaff34-ee6a-4546-b599-a27d056195dd`, отправлена 09.09.2026 |
| Текущее состояние | «Отклонено», «Нерешенные проблемы», `2.1.0 Performance: App Completeness` |
| Сообщение Apple | Одно, от 10.09.2026: `Guideline 2.1 — Information Needed — New App Submission` |
| Распространение | Общедоступное, 175 доступных стран/регионов; цена и выручка 0,00 во всех 175 строках диалога «Текущая цена» 12.09.2026 |
| Платные продукты ASC | 12.09.2026: страницы встроенных покупок, групп автоматически продляемых подписок и подписок без продления показывают начальное создание первого продукта; созданных продуктов/групп нет |
| Дополнительные платформы | Распространение iOS-приложения на Mac и Apple Vision Pro выключено в ASC 12.09.2026 |
| App Privacy | Live ASC обновлена 12.09 в 12:29 UTC: 12 linked типов, уточнённые цели Analytics, Tracking=false; публикация и чтение после reload подтверждены. Исходник исправлен в #1894. В установленном build 9 остаётся первичный manifest с 10 типами |
| Отправленный ответ | Нет: в переписке пока только сообщение Apple |

[Исходная переписка App Review](https://appstoreconnect.apple.com/apps/6801264369/distribution/reviewsubmissions/details/2caaff34-ee6a-4546-b599-a27d056195dd).
Apple просит шесть ответов **в Reply и в Notes**. Профилактический перечень
типичных проблем в письме не доказывает наличие этих дефектов в MeTravel.

## Матрица шести вопросов

| № | Что должно быть в Reply и Notes | Доказательство | Готовность |
| --- | --- | --- | --- |
| 1 | Физическое видео от запуска до результатов обычных действий; регистрация, вход, удаление отдельного аккаунта, UGC report/block | #1889; version/build, device, OS, дата, файл и таймкоды | Сохранены четыре главы, включая reviewer-вход, Settings, сессию после перезапуска, избранное и личный план/календарь. Регистрация/report/block/delete и проверка итогового монтажа остаются открыты |
| 2 | Назначение, аудитория, самостоятельная польза | Исходник кандидата; карточка #1424; раздел 2 ниже | Текст подготовлен; показанные сценарии связываются с #1889 |
| 3 | Первый запуск, доступ к функциям, рабочий reviewer demo | Защищённые поля ASC + физический вход в #1889 | Login API: HTTP 200; владелец затем вошла на физическом iPad, наблюдён авторизованный аккаунт редакции |
| 4 | Реально включённые внешние сервисы, включая backend | Инвентарь ниже; точный исходник, бинарник и узкое чтение SMTP/S3 настроек | Провайдеры перечислены; режим Meta описан без неподтверждённого обещания отсутствия событий |
| 5 | Функциональные и контентные различия по регионам | ASC 175 стран; исходник; ответ владельца 12.09 | Собственных ограничений MeTravel не заявлено; ассортимент и доступность поставщиков могут различаться |
| 6 | Применимость регулируемых услуг и права на сторонние материалы | #1420, Terms/Privacy, атрибуция; ответ владельца 12.09 | Права на указанные партнёрские предложения подтверждены владельцем; реквизиты договоров не выдумываются |

## 1. Физическое видео

Итоговый файл 12.09.2026 23:00: `.codex-temp/app-review-2026-09-12/device/final/review-demonstration-final.mp4`,
375,33 с, 896×1500, H.264/yuv420p, без аудио, SHA-256
`3fc2c03fb4c61bf3d51400c9990ef909389eb9cc44582bea02552d537aeb1b7b`. Состав: проверенный
partial (главы ниже) плюс сцены register/ugc-report/ugc-block/account-delete из
`device/director/`; маски AutoFill и статус-бара, вырезы кадров раннера помечены
титрами «EDIT/SOURCE CUT»; манифест `final/manifest.json` — PASS по
`scene-manifest-check.mjs`; покадровый privacy review — PASS после исправления
утечки имени раннера (первый экспорт сохранён как `-v1`). Не вошли: состояние
«Blocked» в UI и неудачный повторный вход после удаления (решение владельца),
iPhone-запись владельца (личные данные в каждом кадре).

Сохранены четыре исходные главы, вошедшие в partial:

| Локальный файл в `.codex-temp/app-review-2026-09-12/device/` | Длительность | Подтверждённое содержание / ограничение |
| --- | --- | --- |
| `ipad-guest-demonstration.mp4` | 151,56 с | TestFlight, запуск, каталог, статья, карта, квест |
| `ipad-reviewer-login-private.mp4` | 213,19 с | Владелец вошла в reviewer на iPad; ввод в начале и прочие приватные сегменты требуют проверки перед передачей |
| `iphone-owner-main-scenario-private.mp4` | 206,73 с | Владелец прошла основные сценарии на iPhone; использован её личный аккаунт, есть Messages. Это не доказательство reviewer-входа и не готовое вложение |
| `ipad-authenticated-settings-plan.mp4` | 432,53 с | Settings/build 9, видимый вход в удаление без нажатия, сессия после холодного запуска, добавление/снятие избранного, личный план «Рысы» на 19.09 и карточка календаря |

Гостевая глава:
`.codex-temp/app-review-2026-09-12/device/ipad-guest-demonstration.mp4`,
151,56 секунды, 1488×2266, H.264, без звуковой дорожки. Она показывает TestFlight
`1.0.5 (9)`, запуск, каталог, статью, карту с загруженными тайлами и квест.
Независимая выборочная проверка кадров каждые 5 секунд подтверждает эти переходы;
в выбранных кадрах секретов и личных уведомлений не обнаружено. Полный playback
и итоговый монтаж ещё не завершены; это не готовое полное демо.

Позднее сохранён `device/review-demonstration-partial.mp4`: 181,5 секунды,
без аудио, только iPad; интервалы ввода credentials и весь iPhone-материал
исключены. Монтаж явно помечает сокращения и неполноту. Полное декодирование
и визуальная выборка раз в секунду прошли; непрерывный просмотр и недостающие
сценарии ещё нужны. Точный SHA, таймкоды и границы проверки — в журнале устройства.

В четвёртой главе reviewer остался активен после terminate/activate. Новый
favorite добавлен и снят, прежнее избранное сохранено. Личный план «Рысы»
(`travel 738`) на 19.09.2026 оставлен reviewer для проверки Apple: он виден в
«Я планирую (1)», календаре и открывает маршрут. Форма организации публичной
поездки только просмотрена; её обязательное согласие не принималось и поездка
не публиковалась. Это подтверждение личного планирования, не создания
публичного события. Точные файлы, SHA и исходные отметки — в
[журнале устройства](IOS_APP_REVIEW_DEVICE_EVIDENCE_20260912.md).

В отправляемый текст должны попасть имя
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
установленный `1.0.5 (9)`. Подпись вспомогательного XCUITest runner затем
подготовлена по разрешению владельца; после повторной разблокировки его запуск
на iPad прошёл с exit 0. Живой TestFlight показывает MeTravel `1.0.5 (9)` и
«Открыть»; гостевой Home загружает маршруты и квесты, меню содержит Login/Register.
Источник: `.codex-temp/app-review-2026-09-12/device/ipad-testflight-provenance.json`
и журнал #1889. Это подтверждение установленного кандидата и первых действий,
а не завершённого видео или сценариев аккаунта.
На iPhone сохраняется iOS 26.5.
Письмо Apple требует **physical device**, а не именно iPhone. Основное видео
снимается на iPad с актуальной ОС и подтверждённым TestFlight-кандидатом;
iPhone используется для отдельной проверки
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
к отправке только после видео #1889. Физический reviewer-вход подтверждён ниже;
сценарии жалобы/блокировки и удаления ещё не завершены.
Учётные данные не копировать в этот документ или борд;
пароль не раскрывать в видео. Владелец отдельно разрешила запись своего входа
в форме приложения; этот локальный материал требует проверки перед передачей.

Промежуточное подтверждение 12.09.2026, 10:13:52 UTC: штатный production
`POST /api/user/login/` принял переданные владельцем данные постоянного reviewer
аккаунта — HTTP 200, получен token, email в ответе совпал. Значения token и
credentials в evidence не сохранены. Это API-проверка доступа; физический вход
и доступность функций в кандидате остаются частью #1889. Удаление или
пересоздание постоянного reviewer не требуется. Обезличенный результат:
`.codex-temp/app-review-2026-09-12/reviewer-login-api.sanitized.json`.

Последующая физическая проверка: владелец вручную вошла в reviewer на iPad mini 6
с TestFlight `1.0.5 (9)`; вместо формы входа наблюдён авторизованный аккаунт
редакции. Вход попал в локальную запись
`device/ipad-reviewer-login-private.mp4` (213,19 секунды, без аудио).
Это **private source**, не разрешённое к отправке вложение: ввод и клавиатура
ещё требуют просмотра/скрытия секретного фрагмента. Позднейшие действия в
Settings, сохранение сессии после перезапуска и избранное по этой записи не
засчитываются. На iPhone отдельно подтверждён TestFlight `1.0.5 (9)`;
по прямому запросу владельца записан выполняемый ею основной сценарий, файл
сохранён. Позднее отдельная iPad-глава подтвердила Settings, сохранение сессии,
избранное и личный план/календарь, как указано в разделе 1.

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

### Корректировка для следующего кандидата — #1895 (13.09.2026)

Коммит `e17db1872` снимает Meta SDK с iPhone-сборки целиком (вариант A из #1895):
`package.json` → `expo.autolinking.ios.exclude = ["react-native-fbsdk-next"]`
исключает из iOS-autolinking и RN-под, и Expo-модуль `ExpoAdapterFBSDKNext` с
`FacebookAppDelegate`; `ios/Podfile.lock` и `project.pbxproj` регенерированы
обычным `pod install` (ушли FBSDKCoreKit/Basics/LoginKit/ShareKit/
GamingServicesKit и FBAEMKit); `ios/metravel/Info.plist` без `Facebook*`-ключей,
схемы `fb…` и `LSApplicationQueriesSchemes`; `FacebookSignInButton.ios.tsx` —
заглушка без импорта JS SDK. Android и web не изменены. Build 9 остаётся как
есть; в следующем подписанном кандидате SDK-манифестов Meta с `tracking=true`
не будет, и расхождение с app-owned манифестом и формой App Privacy исчезает.

Гейты: `npm run ios:release:guard` — `IOS_META_SDK_LINKED` при любом возврате
SDK (autolinking, lock/pbxproj, Info.plist, заглушка); `npm run ios:artifact:audit`
— `IOS_ARTIFACT_META_SDK` (FBSDK*/FBAEMKit в архиве, `Facebook*` в compiled
Info.plist, FBSDK-символы в бинарнике) и `IOS_ARTIFACT_SDK_TRACKING` (любой
bundled `PrivacyInfo.xcprivacy` с `NSPrivacyTracking=true` или tracking domains).
Локальная проба 13.09.2026: Release-сборка под iOS-симулятор (Xcode 26.6,
iPhone 17 Pro) собралась, в `.app` 0 FBSDK/FBAEM-записей, 0 Facebook-ключей,
0 FBSDK-символов в бинарнике, 0 manifest с tracking (32 SDK-манифеста
проверены); аудит `.app` даёт только ожидаемый для неподписанной
симуляторной сборки `IOS_ARTIFACT_PROVISIONING`; приложение запускается и
держит главный экран. Подписанный IPA следующего кандидата проверяется тем же
`ios:artifact:audit` после сборки.

| Сервис | Назначение и данные | Доказательство / граница |
| --- | --- | --- |
| MeTravel API | Аккаунт/email-вход, статьи, фото, квесты, планы, жалобы и блокировки; аккаунтные данные, выбранный контент, координаты маршрута | `api/auth.ts:31,145`, `api/user.ts:26,238`, `api/misc.ts:238`; runtime-кандидат проверяется в #1889 |
| Apple / Google | Настроенные способы входа наряду с email; provider identity/token, имя/email передаются MeTravel | `components/auth/AppleSignInButton.native.tsx:92`, `GoogleSignInButton.native.tsx:48,123`; в exact IPA Google config непустая и availability gate проходит; успешный вход ещё проверяется |
| Facebook SDK | Build 9: native SDK присутствует с AutoInit=true, Facebook login UI скрыт. Следующий кандидат (#1895, коммит `e17db1872`): Meta SDK исключён из iOS-сборки целиком — без фреймворков, Facebook-ключей Info.plist и tracking-manifest | Build 9 — exact Hermes v98: `isFacebookNativeLoginEnabled` сравнивает пустую строку с `true` и возвращает false; linked SDK не означает доступную кнопку входа или отсутствие SDK-сетевой активности. Следующий кандидат — см. «Корректировка для следующего кандидата» выше |
| Amazon S3 | Загруженные фото/медиа и резервные копии базы, содержащие аккаунтные и контентные данные | Реальная инвентаризация `docs/features/images.md:127` от 30.07 и успешный backup `docs/DB_BACKUP.md:3,7,11` от 31.08; узкое чтение действующих настроек 12.09 подтвердило `eu-north-1` |
| Leaflet / OpenStreetMap | Локальная карта в native WebView, тайлы через MeTravel proxy; область/масштаб карты | `components/MapPage/Map.ios.tsx:3,16`, `config/mapWebTileContract.ts:6`; это не встроенная Google Maps/Apple MapKit карта |
| Nominatim / BigDataCloud | Поиск адресов и обратное геокодирование; запрос, координаты и язык | `api/external/nominatim.ts:34`, `api/geoQueries.ts:123,147,209`; возможны прямые обращения к поставщику |
| OpenRouteService / Valhalla / OSRM | Расчёт маршрута через MeTravel и предусмотренные fallback-пути; точки и транспортный профиль | `api/external/serverRouting.ts:35`, `components/MapPage/useRouting.ts:564`, backend `routing/services.py:104,117`; ORS key и реальный выбранный fallback — конфигурация/runtime |
| Open-Meteo | Прогноз и высоты; координаты места/маршрута | `components/home/hooks/useWeatherWidgetModel.ts:92`, `components/map-core/useElevation.ts:203` |
| Опциональные слои карты | Esri, OpenTopoMap, WaymarkedTrails, Overpass, польские лесные сервисы; viewport/POI-запросы. OpenWeatherMap key присутствует в exact IPA | `config/mapWebLayers.ts:220,234,249,433,446,570,626`, `components/MapPage/Map/nativeWeatherTempLabelsScript.ts:122`; compiled key не доказывает действующий тариф, лицензию или успешный запрос |
| Expo / APNs | Push token и платформа связываются с аккаунтом; доставка уведомлений | `hooks/usePushNotifications.native.ts:137`, `services/notifications.ts:169`, `api/auth.ts:648`; наличие кода не доказывает доставку |
| Instagram / YouTube | Медиа в статьях: Instagram загружается в native WebView при приближении к видимой области, YouTube — после нажатия; до загрузки/при ошибке возможна карточка-ссылка | Exact candidate: `components/travel/stableContent/useRenderConfig.native.tsx:199`, `components/iframe/InstagramEmbed.native.tsx:241`, `components/travel/details/sections/LazyYouTubeSection.native.tsx:74`; allowlist `utils/articleEditorSanitize.ts:65` |
| Собственная телеметрия квестов | В MeTravel идут идентификатор сессии, шаг, результат, время/попытки/подсказки и локаль; свободный текст исключён, закрытые ответы могут передаваться | `utils/questAnswerTelemetry.ts:88,201,363`, `api/quests.ts:867,898`; native GA4/Яндекс отключены в `utils/analytics.ts:147`, но это не отсутствие всей телеметрии |
| Belkraj / Tripvenue | Native WebView экскурсий для поддержанных направлений; координаты первой точки, страна и партнёрский контекст | `components/belkraj/BelkrajWidget.native.tsx:38,94,109`, `belkrajAvailability.ts:104`; production-путь не зависит от Travelpayouts marker; downstream cookies/analytics не проверены |
| Travelpayouts / Tripster / Ostrovok | Внешние партнёрские предложения отелей/экскурсий; направление и партнёрский контекст | `components/affiliate/affiliateConfig.ts:119,124,161,177,229`; в exact IPA marker и оба templates непустые, config gate включён; активность и права на программы не выводятся из наличия URL |
| Gmail SMTP / Telegram | Сервисные письма: адрес получателя и сообщение; необязательное связывание Telegram-аккаунта и выбранные социальные контакты | Узкое read-only чтение действующих настроек backend 12.09: `smtp.gmail.com`; frontend `api/telegramLink.ts:3,18`. Это конфигурация отправителя, а не доказательство доставки письма |
| Sentry / AI / платежи | В просмотренных исходниках не найден включённый вызов Sentry/AI или собственный платёжный путь; внешние коммерческие ссылки присутствуют | `services/performanceMonitoring.ts:19,28`, `api/misc.ts:62,845`, `package.json:257`; это не runtime-проверка и не доказательство отсутствия серверных AI/служебных задач либо платёжных форм у партнёров |

### Подтверждённая корректировка App Privacy и первого manifest

**Текущее состояние — 12.09.2026, 12:29 UTC:** после команды владельца
«сейчас доделай задачи» четыре подготовленные правки опубликованы в ASC.
Product Interaction — Analytics; Gameplay Content, User ID и Device ID —
App Functionality + Analytics. Во всех четырёх диалогах сохранены Linked=true
и Tracking=false. Остальные восемь типов сохранены. После публикации страница
перезагружена и все 12 типов, их цели и связь с пользователем перечитаны;
предупреждения о незавершённой настройке нет. Исторический разбор ниже описывает
состояние до публикации. Это завершение формы #1420, не изменение IPA или submit.

Это отдельный результат проверки фактов, а не утверждение о причине письма
Apple. В точном кандидате native-квест отправляет попытки и сохраняет прогресс:
`components/quests/questWizardStepCard.tsx:429`,
`utils/questAnswerTelemetry.ts:205,213,363`, `api/quests.ts:898`.
В backend `origin/master` `QuestAnswerAttempt` и `QuestProgress` сохраняются
раздельно: `quests/models.py:353,474`; закрытые ответы участвуют в статистике
`quests/services/answer_telemetry.py:247,284`. Свободный текст в телеметрию
попыток не передаётся. Native-заглушка GA4/Яндекс этот путь не отключает.

Узкая production-проверка 12.09 выполнила только два `EXISTS` в read-only
транзакции: за последние 24 часа существуют сохранённые события `platform=ios`
и существуют такие события с привязкой к пользователю. Оба результата `true`.
Строки событий, ответы, идентификаторы и количества не читались. Evidence:
`.codex-temp/app-review-2026-09-12/quest-privacy-read.sanitized.json`.

По [Apple App privacy details](https://developer.apple.com/app-store/app-privacy-details/)
взаимодействия с функциями относятся к Product Interaction, сохранённое
прохождение — к Gameplay Content; анализ поведения имеет цель Analytics.
Дополнительно `getQuestAttemptSessionKey` в точном source
`utils/questAnswerTelemetry.ts:88–122` создаёт UUID и сохраняет его глобально в
AsyncStorage под `quest_attempts_session_v1`; `session_key` отправляется вместе
с попытками гостей и авторизованных пользователей. Это устойчивый идентификатор
установки, а не только текущего аккаунта. Apple относит device-level identifiers
к Device ID, поэтому его существующей строке также нужна цель Analytics.
Первичный manifest должен описывать собственный сбор приложения согласно
[Apple TN3184](https://developer.apple.com/documentation/technotes/tn3184-adding-data-collection-details-to-your-privacy-manifest).

Подготовлена минимальная source-корректировка и точный delta для формы ASC:

| Тип | Linked | Tracking | Назначения после корректировки |
| --- | --- | --- | --- |
| Product Interaction — новый | Да | Нет | Analytics |
| Gameplay Content — новый | Да | Нет | App Functionality, Analytics |
| User ID — существующий | Да | Нет | App Functionality, Analytics |
| Device ID — существующий | Да | Нет | App Functionality, Analytics |

Остальные восемь первичных типов не меняются. В source
`ios/metravel/PrivacyInfo.xcprivacy` теперь 12 типов; guard синхронизирован со
строгой проверкой категорий и целей. Независимый code-only review пройден:
`plutil`, статический release guard без live AASA, lint изменённых guard/tests
и targeted config Jest 58/58 — PASS после добавления Analytics к Device ID.
Это проверка исходников, не нового IPA.
Новый сбор данных этим изменением не включается — описывается существующий.

**Граница кандидата:** загруженный build 9 по-прежнему содержит старый manifest,
а опубликованная форма ASC ещё не исправлена. Apple позволяет менять ответы
App Privacy без выпуска обновления, но это не переписывает manifest уже
подписанного IPA. Для включения source-правки нужен отдельно разрешённый новый
signed build и upload с новым номером, затем проверка точного артефакта и
соответствующий QA. Записи build 9 сохраняют доказательство показанного
поведения, но их нельзя переименовать в видео новой сборки. До этого пакет
не получает окончательный privacy/candidate PASS.

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

## Общий текст Reply и Notes — отправлен 12.09.2026 (Reply 23:12, Notes сохранены, resubmit 23:31)

Ниже один компактный текст для обоих полей. Квадратные скобки — только
незавершённые результаты физического QA и видео #1889. После подстановки
проверенных значений перечитать 6/6 пунктов,
проверить длину по текущему полю ASC и использовать один и тот же файл видео.
Live ASC 12.09 показал лимит Notes 4000 символов (474 занято, 3526 осталось);
после замены временных полей длину нужно пересчитать. Поле необязательного
вложения доступно: разрешённый и проверенный private review attachment может
заменить публичную видеоссылку.
Учётные данные никогда не подставляются: они остаются в защищённых полях ASC.
Этот текст привязан к проверенному build 9 и пока не описывает новую сборку.
После выбора следующего кандидата нужно заново сверить номер, конфигурацию,
demo-доступ и соответствие видео именно ему; прежнюю запись нельзя просто
переименовать. История build 9 сохраняется отдельно.

```text
MeTravel 1.0.5 (9) — response to the 10 September 2026 information request.

1. Physical-device demonstration
Video: review-demonstration-final.mp4 (attached), recorded 12 September 2026 on
iPad mini 6, iPadOS 26.6.2, verified TestFlight 1.0.5 (9).
Timecodes: 00:04 cold launch; 00:10 guest browse (catalogue, article, map with
tiles, quest); 01:08 sign-in with the reviewer demo account; 01:17 settings with
version/build; 01:39 session survives relaunch; 01:50 favourites and a personal
trip plan in the calendar; 03:04 registration of a disposable account (e-mail
activation step cut) and sign-in; 04:41 report an author, confirmation shown;
05:08 block an author; 05:32 delete the disposable account, confirmation and
return to the sign-in screen.
iPhone compatibility verified separately on a physical iPhone 13 mini (build 9).
No in-app purchases or subscriptions are configured; partner bookings are separate.

2. Purpose and audience
MeTravel is a free app for independent travellers: articles, photos, mapped
places, city quests, favourites and trip plans. Its author-contributed catalogue
focuses on Belarus and nearby destinations.

3. Setup and reviewer access
With internet access, browse articles, maps and quests as a guest. No special
hardware is needed. For account features, open Profile and use the protected
App Review Information credentials. Reviewer sign-in succeeded on the physical
iPad on 12 September 2026. Delete only a disposable account via Settings >
Delete account > confirm; keep the permanent reviewer account. After sign-in,
report/block is in the public-author profile menu. The video uses a test author.

4. External services and data
Our API handles accounts, content, plans and user safety. Quest progress/attempts
support functionality and analytics, linked to persistent installation IDs and
signed-in user IDs. Apple/Google sign-in exchanges tokens and account details.
Amazon S3 stores media/database backups; Gmail SMTP is configured for account
emails (recipient address and message).
Expo/APNs support opt-in push notifications using device tokens.
Optional Telegram linking associates a Telegram account.
Articles embed Instagram/YouTube in web views. Leaflet/OpenStreetMap provide
maps; Nominatim/BigDataCloud geocode; OpenRouteService/Valhalla/OSRM route;
Open-Meteo supplies weather/elevation. Optional layers use Esri, OpenTopoMap,
WaymarkedTrails, Overpass, Polish forestry services and OpenWeatherMap.
Requests use map areas, coordinates, destinations or feature search queries.
Belkraj/Tripvenue, Travelpayouts, Tripster and Ostrovok provide destination-based
offers via WebView/external links, receiving destination/partner context.
Meta SDK 18.1.0 is included; Facebook sign-in is disabled. Shipped auto-event and
advertising-ID flags are false; our code has no Meta event/purchase logging.
Native initialization can request SDK configuration.
Account/trip-planning flows do not request payment-card details; external
providers handle partner bookings/payments.

5. Countries and regions
Free distribution is configured for 175 countries/regions. UI languages: RU/BE/UK/PL/EN.
Articles/quests are mainly Russian; changing the UI does not translate them.
Destinations and offers vary by catalogue. The owner confirms no additional
MeTravel country-specific feature restrictions. Third-party availability varies.

6. Services and content rights
MeTravel provides travel information/planning, not medical, financial or gambling
services. The owner confirms rights to travel photos/review screenshots. Authors
retain upload rights and grant the limited operational licence in our Terms.
Third-party materials retain attribution. The owner confirms permission for
mobile Belkraj/Tripvenue offers and Tripster/Ostrovok offers via Travelpayouts.
Terms: https://metravel.by/terms
Privacy Policy: https://metravel.by/privacy
```

## Что ещё нужно для готовности

1. #1889: TestFlight-происхождение на обоих устройствах, гостевая глава,
   reviewer-вход, Settings, сессия после перезапуска, избранное и личный
   план/календарь на iPad подтверждены. Остались регистрация/report/block/delete,
   проверка совместимости по записанному iPhone-сценарию и итоговой записи с таймкодами
   и проверкой отсутствия секретов. Private-input канал iPad не принят;
   штатный вход владельца дал доступ для продолжения QA. Для двух
   одноразовых аккаунтов согласие с Terms ещё не завершено;
   до этого регистрация/UGC/удаление не считаются пройденными.
2. Effective config build 9, S3 и Gmail SMTP подтверждены указанными выше
   источниками. Описание Meta ограничено проверенными фактами инициализации и
   локальных flags; не обещает безусловное отсутствие событий.
   Подтверждённый пропуск первого manifest и App Privacy разобран в разделе 4:
   source-правка отревьюена, ASC обновлена 12.09 в 12:29 UTC; build 9 прежний.
   Чтобы включить исправленный manifest в IPA, нужны новый кандидат и
   разрешённые build/upload. Apple отдельно не требовала новую сборку в письме;
   форму App Privacy допускается обновлять без app update. Это не устраняет границы
   оценки сторонних SDK/WebView, перечисленные в инвентаре.
3. Владелец 12.09 подтвердил партнёрские права и отсутствие дополнительных
   сервисов/собственных страновых ограничений; повторно эти вопросы не задавать.
4. Полный Reply и Notes: 6/6 ответов, проверка длины и согласованности,
   `npm run ios:store:guard`, `npm run audit:prompts`, независимая проверка текста.
5. После готовности конкретного пакета — решение по #1891 и операторский шаг
   #1892. Ответ, повторный submit и выпуск в storefront учитываются отдельно;
   состояние «Отклонено» не меняется от создания этого документа.
6. Обещание Facebook-входа удалено из Description RU/UK/PL/EN-US в ASC
   12.09.2026 после команды владельца продолжить задачи. Каждая точная замена
   сохранена; английская, польская и украинская формы перечитаны после Save,
   русская — также после перезагрузки страницы. Остальной текст сохранён.
   Локали UI приложения не затронуты; предложение о языке авторского контента
   в `IOS_STORE_LISTING.md` не публиковалось этой правкой.
