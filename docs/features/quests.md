# Фича: quests

**Последняя актуализация:** 2026-08-27

**Ответственный домен:** frontend quests (агент `quest-expert`; контент —
`quest-editor`, гео — `quest-geo-verifier`, трение — `quest-friction-analyst`)

## Назначение документа

Карта frontend-границ фичи городских квестов: маршруты, слои, модель данных,
серверный/клиентский стейт, флоу прохождения, правила зачёта ответа, телеметрия,
кросс-платформенность и покрытие тестами. Это не отчёт о production-готовности:
доступность конкретных эндпоинтов (отзывы, оценка, near-location) подтверждается
runtime-доказательствами под задачу, а не наличием кода.

## TL;DR

- Квест — бесплатный пеший (или вело-) маршрут по точкам города: intro → N
  шагов с заданием и проверяемым ответом → финал с текстом и видео.
- Данные приходят одним бандлом `GET /api/quests/by-quest-id/{quest_id}/`;
  адаптация в `utils/questAdapters.ts` превращает `answer_pattern` в
  функцию-чекер, поэтому бандл кэшируется СЫРЫМ (функции не сериализуются).
- Прохождение работает у гостя (первые 2 точки), локально в AsyncStorage и на
  сервере (`/quest-progress/`); локальное и серверное состояние не выбирают
  победителя, а сливаются (`utils/questProgressMerge.ts`).
- Зачёт прохождения — не «дошёл до финала», а «отвечено ≥ ⌈2/3⌉ обязательных
  точек» (`utils/questCompletionPolicy.ts`, #1443).
- Оценка ответа живёт ровно в одном модуле (`utils/questAnswerEvaluation.ts`),
  что охраняется guard-скриптом; там же — пауза против перебора (#1428).
- Каталог `/quests`, лендинги городов и стран имеют SSG-слой и alias-роутинг
  (`utils/questCityAlias.js`, `utils/questCountryLanding.js`), проверяемый
  гейтом в `build-prod.sh`.
- Карта квеста — отдельный renderer от основной `/map`: web React Leaflet
  (`QuestFullMap.tsx`), native Leaflet-в-WebView (`QuestFullMap.native.tsx`).

## Точки входа

| Route / surface | Файл | Ответственность |
| --- | --- | --- |
| `/quests` | `app/(tabs)/quests/index.tsx` (19 LOC) → `screens/tabs/QuestsScreenRoute.tsx` → `screens/tabs/QuestsScreen.tsx` | каталог: города/фильтры/поиск, список ↔ карта, SEO-интро и FAQ |
| `/quests/map` | `app/(tabs)/quests/map.tsx` (314 LOC) | все квесты точками на общей `Map`/`Map.web`; статический сегмент, матчится раньше `[city]` |
| `/quests/scenario` | `app/(tabs)/quests/scenario.tsx` (9 LOC) → `screens/tabs/QuestScenarioScreen.tsx` (435 LOC) | DIY-лендинг «квест-бук для печати»; тоже статический сегмент перед `[city]` |
| `/quests/{city}` | `app/(tabs)/quests/[city]/index.tsx` (229 LOC) | лендинг города: сегмент — numeric `city_id` ИЛИ alias (`minsk`); неизвестный сегмент → `router.replace('/quests')` |
| `/quests/country/{country}` | `app/(tabs)/quests/country/[country]/index.tsx` | web-лендинг страны: валидный ISO alpha-2 из каталога → стабильный alias (`BY → belarus`, `PL → poland`); неизвестный alias → `/quests` |
| `/quests/{city}/{questId}` | `app/(tabs)/quests/[city]/[questId].tsx` (688 LOC) | деталь и прохождение: bundle, прогресс, гость/consent, SEO+JSON-LD, модалка отзывов |
| Промо на главной | `components/home/HomeQuestsPromoSection.tsx` | сразу после hero: 6 карточек (desktop) / 4 (mobile) через `useQuestsPreview(6)` + подарочный вход-блок → `/quests/scenario`; SSG-двойник — `injectHomeQuestsSection` в `scripts/generate-seo-pages.js` (crawlable `data-ssg-home-quests`) |
| Промо в travel-детали | `components/travel/details/sections/QuestForCitySection.tsx` (+ `Deferred*.tsx` / `Deferred*.web.tsx`) | «квест по этому городу» на странице путешествия |

Отдельного city-alias route на уровне Expo Router нет: alias — это тот же
сегмент `[city]`, разрешаемый `resolveQuestCitySegment(cityParam, quests)` по
списку квестов. Canonical лендинга — alias-вариант, если alias есть, иначе
`city_id`.

Country route — отдельный статический сегмент `country`, поэтому не конфликтует
с `[city]`. `buildQuestCountryLandingGroups()` сначала валидирует ISO-код и
группирует каталог по стране, затем применяет city alias merge внутри каждой
страны. Missing/invalid code не создаёт страницу; список активных стран не
хардкодится.

## Ключевые компоненты

```
<QuestByIdScreen>                    app/(tabs)/quests/[city]/[questId].tsx
 ├─ <InstantSEO> + JSON-LD + патч <head>
 ├─ <QuestConsentGate>               (авторизованный, согласие не выдано)
 └─ <QuestWizard>
     ├─ useQuestWizardProgress       (состояние прохождения + слияние)
     ├─ useQuestReminder / useQuestGeofence   (native-only, .web = no-op)
     ├─ <QuestHeaderPanel> | <QuestCompactSidebar>     questWizardShell
     ├─ <QuestGuestGate>             (гость исчерпал бесплатные точки)
     ├─ <QuestStepCard>              questWizardStepCard
     │   ├─ evaluateQuestAnswer / describeQuestAnswer
     │   ├─ recordQuestAnswerAttempt (очередь телеметрии)
     │   └─ <QuestPointNavigator>    (.native — компас; .web — null)
     ├─ <QuestDesktopMapPanel> → <QuestFullMap[.native]>
     ├─ <QuestExcursionsInline|Sidebar>   (одна секция «Экскурсии рядом»)
     ├─ {relatedTravelsSlot} = <TravelsForQuestSection>
     └─ <QuestFinalePanel>
         ├─ видео/постер (useQuestFinaleMedia)
         ├─ <QuestReviewSection>  (звёзды + текст, один POST /quest-reviews/)
         └─ <QuestPioneerBlock>   (только при засчитанном прохождении)
```

«Экскурсии рядом» на карточке шага — **ровно одна секция**. `QuestExcursionsInline`
держит под общим заголовком Belkraj-виджет и партнёрские офферы `AffiliateOffers`;
отдельной native-секции с тем же заголовком быть не должно — именно её задвоение
чинил #1452. Рисовать обвязку (разделитель + карточка + заголовок) можно только когда
есть что показать: гейт виджета живёт в `components/belkraj/belkrajAvailability.ts`
(`canRenderBelkrajWidget` — координаты, `NODE_ENV === 'production'` и страна из
allowlist), оттуда же его берут оба варианта `BelkrajWidget`, чтобы предикат не
разошёлся с поведением самого виджета. Если ни виджет, ни офферы не отдают контент,
секция возвращает `null`. На debug/dev-client сборке Belkraj закрыт гейтом — видны
только офферы, это ожидаемо.

**Belkraj — allowlist стран, а не только Беларусь.** Каталог партнёра (belkraj.by →
tripvenue) покрывает десятки стран — Польша, Литва, Чехия, Грузия, Турция, ОАЭ,
Италия и т.д.; полный перечень кодов — `SUPPORTED_BELKRAJ_COUNTRIES` в
`components/belkraj/belkrajAvailability.ts`. Для страны, которой в каталоге НЕТ, виджет
отвечает не пустым списком, а тихой подменой на белорусский город: квест по Лимасолу
(`limassol-lionheart`, `country_code=cy`) показывал минские экскурсии, Цюрих/Рейкьявик/
Мальдивы — тоже Минск (проверено на проде 2026-08-24). Из другого origin счётчик
результатов недоступен, поэтому «есть ли результат» решается ДО рендера по стране
первой точки — отсюда allowlist. Второй столп корректности — параметр `country` в URL:
tripvenue резолвит по ближайшему городу каталога и без верного кода промахивается даже
по поддержанной стране (Варшава без `country` → «Бобинка», с `country=PL` → «Варшава»),
поэтому в URL всегда уходит реальный код страны точки, а не BY. Явный `countryCode`
важнее координат; без него координатный фолбэк распознаёт только Беларусь. Allowlist
снят живой пробой и со временем дрейфует — метод пересборки описан в комментарии к
`SUPPORTED_BELKRAJ_COUNTRIES`. Автоконтроля дрейфа (CI-гарда) нет: выпадение страны из
каталога партнёра при коде, оставшемся в allowlist, снова даст подмену города без
сигнала в тестах — пере-проба ручная. У квестов в неподдержанной стране место виджета
на web занимают `AffiliateOffers`; на native офферы показываются как и раньше. Тот же
гейт стоит на travel-секции «Экскурсии» (`ExcursionsSection`) и на ссылке в
`buildTravelSectionLinks`.

Осознанный пробел покрытия: гейт `belkrajAvailability` доверяет явному `countryCode` и
координатно распознаёт только Беларусь — он НЕ тянет `getCountryCodeByCoords`/
`geoCountryOutlines`, чтобы не утащить их в бандл квестов (см. bundle-budget). Поэтому
мульти-страновой travel `countryCode` списком («ru, in») в Belkraj-секции скрыт, даже
если первая точка в стране каталога, а одиночный код с координатами вне этой страны
ушёл бы в URL как есть. У квестов `countryCode` всегда одиночный, их это не задевает;
соседний `AffiliateSection` (travel-only, где geo-таблица уже в бандле) резолвит
мульти-страновой случай через координаты первой точки — при желании ту же резолвцию
можно поднять на travel-консьюмер, не трогая общий гейт.

| Файл | LOC | Зона ответственности |
| --- | --- | --- |
| `screens/tabs/QuestsScreen.styles.ts` | 1287 | **>800, кандидат на распил** — стили каталога (список/карта/сайдбар/лендинг города) |
| `components/quests/printable/styles.ts` | 886 | **>800, кандидат на распил** — CSS печатной книги квеста |
| `components/quests/QuestWizard.tsx` | 813 | **>800, кандидат на распил** — оркестратор прохождения: шаги, финал, офлайн, печать, аналитика |
| `components/quests/QuestFullMap.native.tsx` | 783 | native-карта квеста: WebView + Leaflet, bridge, PNG-экспорт, GPX |
| `components/quests/questWizardStepCard.tsx` | 775 | карточка шага: ввод, вердикт, паузы, подсказка, пропуск, POI-инфо, зум фото |
| `components/quests/QuestFullMap.tsx` | 739 | web-карта квеста поверх `MapCanvas`, модалка навигации, экспорт GeoJSON/GPX |
| `components/quests/questWizardShell.tsx` | 720 | шапка/компакт-сайдбар: прогресс, полоса шагов, меню действий |
| `screens/tabs/QuestsScreen.tsx` | 710 | каталог: выбор города, «Рядом», поиск, kids/bike-фильтры, режим карты |
| `app/(tabs)/quests/[city]/[questId].tsx` | 688 | роут детали: bundle+прогресс+гость+consent, SEO/JSON-LD, слоты рейтинга и бейджа |
| `api/quests.ts` | 659 | типы `ApiQuest*`, все запросы каталога/бандла/прогресса/телеметрии, офлайн-фолбэки |
| `screens/tabs/QuestsContentPanel.tsx` | 602 | правая колонка каталога: поиск, список/`FlatList`, карта, SEO-интро |
| `utils/questAdapters.ts` | 544 | API → frontend: `adaptStep/adaptBundle/adaptMeta`, `buildAnswerChecker` |
| `components/quests/questWizardSections.tsx` | 538 | десктоп-панель карты, экскурсии, партнёрский блок, `QuestFinalePanel` |
| `hooks/useQuestsApi.ts` | 471 | `useQuestsList/Preview/Bundle/Reviews`, `useQuestProgressSync` |
| `screens/tabs/QuestScenarioScreen.tsx` | 435 | лендинг печатного сценария (`HowTo`/`ItemList` JSON-LD) |
| `screens/tabs/QuestCard.tsx` | 432 | карточка квеста каталога |
| `screens/tabs/QuestsScreen.helpers.ts` | 431 | каталог городов, фильтры kids/bike/nearby/map-area, geolocation |
| `components/quests/useQuestWizardProgress.ts` | 422 | вся модель прохождения: сид, слияние, пропуски, пороги, персист |
| `components/quests/QuestPrintable.tsx` | 354 | генерация печатной HTML-книги (web-only) |
| `screens/tabs/QuestsSeoIntroFaq.tsx` | 343 | SEO-интро и FAQ каталога (парная копия `utils/questContent.js`) |
| `components/quests/questNativeMapHtml.ts` | 340 | Leaflet-HTML для native-карты квеста |
| `components/quests/QuestPointNavigator.native.tsx` | 327 | компас/дистанция до точки (native) |
| `utils/questAnswerTelemetry.ts` | 292 | офлайн-очередь попыток ответа, батчи, бэкофф |
| `components/quests/QuestForCityCard.tsx` | 292 | карточка «квест по этому городу» |
| `utils/questProgressMerge.ts` | 289 | монотонное слияние снапшотов прогресса |
| `utils/questForLocation.ts` | 247 | клиентский подбор квестов по городу/стране/координатам |
| `components/quests/questNativeMapPng.ts` | 234 | снимок native-карты в PNG и шаринг |
| `components/quests/QuestReviewsModal.tsx` | 233 | читалка чужих отзывов |
| `components/quests/QuestReviewSection.tsx` | 223 | форма отзыва после прохождения |
| `components/quests/questOfflineMapExport.ts` | 222 | GPX/GeoJSON маршрута, «открыть в приложении» |
| `components/quests/questRouteGeometry.ts` | 215 | построение трека foot/bike, замыкание кольца |
| `components/quests/QuestConsentGate.tsx` | 163 | согласие `CONSENT_TYPES.QUEST_START` перед стартом |
| `components/quests/questStepDistance.ts` | 150 | длина перегона, признак «точка далеко», «закончить здесь» |
| `utils/questAnswerEvaluation.ts` | 131 | **единственная** точка оценки ответа + классификация паттерна |
| `components/quests/QuestGuestGate.tsx` | 110 | мягкий гейт гостя |
| `api/questBundleCache.ts` | 101 | чтение/запись офлайн-кэша бандла и списка |
| `utils/questAudience.ts` | 92 | теги `kids/teens/age-*`, `bike`/`velo`, `loop`/`circular` |
| `utils/questCityAlias.js` | 87 | alias городов; общий модуль для SSG-скриптов и роута |
| `utils/guestQuestProgress.ts` | 83 | гостевой прогресс в AsyncStorage, `GUEST_QUEST_FREE_STEPS = 2` |
| `stores/questFontScaleStore.ts` | 53 | zustand+persist: масштаб шрифта визарда (1 / 1.15 / 1.3) |
| `utils/questCompletionPolicy.ts` | 42 | порог зачёта ⌈2/3⌉ обязательных точек |

Порог guard-скрипта — 800 LOC (`npm run guard:file-complexity`); LOC сверять
перед работой, цифры выше — снимок на дату актуализации.

## Модель данных

### Что приходит с бэка (`api/quests.ts`)

- `ApiQuestMeta` — элемент каталога: `id` (numeric PK), `quest_id` (строковый
  слаг), `title`, `points`, `city_id`/`city_name`, `country_*`, `lat/lng`,
  `duration_min`, `difficulty`, `tags` (объект-словарь), `pet_friendly`,
  `cover_url`, `media` + снапшот рейтинга/прохождений (`rating_avg`,
  `rating_count`, `user_rating`, `completions_count`, `is_completed_by_me`,
  `first_completer`). `withQuestMetaDefaults` доставляет отсутствующие поля и
  индексирует `dominant_color` обложки (`indexMediaImage`, #1208).
- `ApiQuestBundle` — деталь: `steps` (массив ИЛИ JSON-строка), `intro` (шаг,
  JSON-строка или `null`), `finale {text, video_url, poster_url}`,
  `storage_key`, `city`, `cover_url`, `media` + необязательный рейтинг-снапшот.
  `tags` в деталь НЕ приходят.
- `ApiQuestStep` — `id`/`step_id`, `title`, `location`, `story`, `task`, `hint`,
  `answer_pattern` (`{type, value}` | строка | `null`; легаси —
  `answer_type`/`answer_value`), `lat/lng`, `maps_url`, `image_url`,
  `input_type`, `order`, `is_intro`, `geo_verify {enabled, radius_m}`,
  `poi_info {is_museum, opening_hours, ticket_price, website}`.
- `ApiQuestProgress` — `id`, `quest`, `user`, `current_index`, `unlocked_index`,
  `answers`, `attempts`, `hints`, `show_map`, `completed`, `skipped`,
  `early_finish`, `completed_at`.

Координаты приходят числом ИЛИ строкой; `coordNum` парсит и в DEV логирует
невалидное вместо тихого `NaN`.

### Что делает `questAdapters`

- `adaptBundle` парсит `steps`/`intro` из строки, **сортирует по `order`**
  (стабильно, без `order` — в конец), отделяет intro (`is_intro` или ключ
  `intro`), адаптирует шаги по одному — падение одного шага не роняет маршрут.
  Если intro нет ни явного, ни в шагах, синтезируется стартовый экран с
  `answer: () => true` и координатами города.
- `adaptStep` строит `answer` — функцию-чекер из `buildAnswerChecker(type,
  value)`, `answerDisplay` (человекочитаемый ответ для «страницы ведущего» в
  печати), `inputType` (`resolveStepInputType`), `poiInfo`, нормализует
  переводы строк из числовых HTML-сущностей (`normalizeQuestText`).
- `adaptMeta` превращает `tags`-объект в массив ключей и выводит `ageCategory`
  через `getQuestAgeCategory`.
- `normalizeQuestCountryCode` — без фолбэка по координатам: таблица контуров
  стран вынесена из слоя данных квестов (#1393), `country_code` непустой у всех
  139 квестов прода (замер 2026-08-10).
- Чекер несёт метаданные на самой функции: `_answerType`, `_isAny`,
  `_freeTextMinLength` — их читает `describeQuestAnswer`.

## Серверный стейт (React Query)

| Query / Mutation | Файл | Ключ | Примечания |
| --- | --- | --- | --- |
| `useQuestsList` | `hooks/useQuestsApi.ts` + `hooks/questsListQuery.ts` | `['quests']` | единственное определение запроса; `staleTime` 30 мин, `gcTime` 60 мин (`hooks/questsListCachePolicy.ts`) |
| `useQuestsPreview(limit)` | `hooks/useQuestsApi.ts` | `['quests','preview',limit]` | `initialData` — срез из `['quests']` с наследованием `dataUpdatedAt` |
| `useQuestRatingMeta` / `useQuestCompletionMeta` / `useQuestPioneerMeta` | `hooks/useQuest*Meta.ts` | `['quests']` (+ засев `['quest', id]`) | бандл не несёт rating/completions/first_completer — берутся из каталога |
| `useQuestReviews` | `hooks/useQuestsApi.ts` | `['quest', questId, 'reviews']` | `staleTime` 60 с |
| `useQuestReview` | `hooks/useQuestReview.ts` | `['questUserReview', userId, id]` | один `POST /quest-reviews/`; personal review изолирован по аккаунту, после успеха инвалидируются каталог/detail/публичная читалка |
| `useQuestForLocation` | `hooks/useQuestForLocation.ts` | `['quests-near-location', key]` | серверный score/distance; при `404` — клиентский фолбэк по `['quests']` |
| `useTravelsForQuest` | `hooks/useTravelsForQuest.ts` | `['travels-for-quest', term]` | обратная перелинковка квест → travel |

Ключ `queryKeys.questBundle(slug)` объявлен в `api/queryKeys.ts`, но **бандл
через React Query не ходит**: `useQuestBundle` — ручной `useState`+`useEffect`
поверх `fetchQuestByQuestId` с собственным `refetch` (см. «Долги»).

Единый ключ `['quests']` — сознательный контракт дедупликации: экран квестов,
промо главной, три мета-хука детали и лендинг города должны схлопываться в один
`GET /api/quests/`. Разные `staleTime` под этим ключом ломают дедупликацию.

## Клиентский стейт

| Owner | Где | Отвечает за |
| --- | --- | --- |
| `useQuestWizardProgress` | `components/quests/useQuestWizardProgress.ts` | `currentIndex`, `unlockedIndex`, `answers`, `attempts`, `hints`, `showMap`, `skipped`, `earlyFinish` + производные пороги |
| AsyncStorage (авториз.) | ключ = `{bundle.storage_key}__u{userId}` (`utils/questProgressStorage.ts`); пока `userId` не подтянулся — `__u:pending` | локальный снапшот прогресса, включая `skipped`/`earlyFinish`/`updatedAt`/`answeredAt`. Привязка к аккаунту (#1456): на общем устройстве запись предыдущего пользователя не находится и не сливается с прогрессом следующего. Записи под старым ключом без `__u` не мигрируются — владельца у них нет |
| AsyncStorage (гость) | `guestQuestProgress:v1:{questId}`, ключ визарда `guest_{storageKey}` | гостевой прогресс до логина |
| AsyncStorage (телеметрия) | `quest_attempts_queue_v1`, `quest_attempts_session_v1`, `quest_attempts_rejected_v1` | очередь попыток, ключ сессии прохождения и карантин отвергнутых событий (счётчик, статус, причины, последние 50 событий; читается `readQuestAttemptRejections()`) |
| AsyncStorage (каталог) | `STORAGE_SELECTED_CITY` | выбранный город каталога |
| Zustand | `stores/questFontScaleStore.ts` (persist) | масштаб шрифта визарда |
| Модульное состояние | `questWizardStepCard.tsx` (`stepCooldowns`), `questAnswerTelemetry.ts` | паузы между попытками и очередь доставки — переживают перемонтирование карточки |

`skipped` и `earlyFinish` остаются в локальном снапшоте для офлайн-работы и с
#1632 синхронизируются с серверными `skipped`/`early_finish` через
`toQuestProgressServerPayload`. Ответ старого сервера без этих полей читается
как пустой пропуск без падения.

## Офлайн и кэш

- `fetchQuestsList` / `fetchQuestsPreview` пишут сырой каталог в AsyncStorage
  (`quest-list:v1`, `QUEST_LIST_CACHE_VERSION = 1`) и читают его при сетевом
  фейле. Превью в кэш каталога НЕ пишет (это срез, он затёр бы полный список).
- Ключ каталога общий на устройство, а не на аккаунт, поэтому персональные поля
  (`is_completed_by_me`, `user_rating`) снимаются и при записи, и при чтении
  (`stripPersonalQuestFields`, #1793): иначе после выхода или смены аккаунта
  офлайн-каталог показывал чужие «Пройден». Общие поля (`rating_avg`,
  `rating_count`, `completions_count`, `first_completer`) в кэше остаются, и
  офлайн-ветка `fetchQuestsCompactCatalog` полагается на эту же гарантию.
- Бандл: `readCachedQuestBundle` сначала спрашивает единый `OfflineCatalog`
  (`services/offline/questOfflineAdapter.ts`, `schemaVersion: 1`), затем —
  легаси-конверт `quest-bundle:{questId}` c
  `QUEST_BUNDLE_CACHE_VERSION = 1`; успешная миграция в каталог удаляет легаси-
  ключ (односторонняя миграция, чтобы не осталось двух writable-источников).
- `writeCachedQuestBundle` **await-ится** в `fetchQuestByQuestId`: онлайн-ответ
  не должен проиграть гонку force-stop до коммита офлайн-снапшота.
- Кэшируется именно СЫРОЙ нормализованный бандл: `adaptBundle` производит
  функции-чекеры, которые не сериализуются, поэтому адаптация всегда на клиенте.
- «Скачать квест офлайн» в визарде: `fetchQuestByQuestId` → `saveQuestOffline({
  pinned: true, includePhotos: true })`; состояние берётся из
  `useOfflineCatalog()` по `type === 'quest' && pinned`.
- Список офлайн-ассетов квеста — обложка, картинка intro, картинки шагов,
  постер финала (`buildQuestAssetSources`).

## Пользовательские флоу

1. **Каталог `/quests`.** `useQuestsList` → `buildQuestCityCatalog` группирует
   по городам/странам. Фильтры: `ALL_QUESTS_ID`, `NEARBY_ID` (geolocation,
   `DEFAULT_NEARBY_RADIUS_KM`), `KIDS_FILTER_ID`, `BIKE_FILTER_ID`, свободный
   текстовый поиск (перекрывает город и «Рядом»), режим карты с фильтрацией по
   видимой области. Выбор города персистится.
2. **Лендинг города `/quests/{city}`.** Сегмент разрешается
   `resolveQuestCitySegment` (numeric `city_id` или alias); заголовок стека
   ставится по локализованному `city_name`, а не по сегменту URL; JSON-LD —
   `ItemList` + `BreadcrumbList`, позиции с непригодным сегментом отбрасываются
   через `buildQuestPath` (#1185). Неизвестный город → `replace('/quests')`.
3. **Деталь `/quests/{city}/{questId}`.** Загрузка идёт только при
   `useIsFocused()`. Ветки: loading → «не найден/ошибка» (`noindex, nofollow`) →
   гость (`QuestWizard guestMode`) → согласие (`QuestConsentGate`) → визард.
   На успешной ветке дополнительно императивно патчится `<head>` тремя
   отложенными проходами (0/120/400 мс) — на gate/loading/error ветках патч
   выключен, иначе он перетирал их `robots`/`canonical`.
4. **Прохождение.** intro (кнопка «Начать») → шаг: история, задание, фото,
   карта, подсказка, поле ответа. Верный ответ → `answers[stepId]`, обнуление
   `attempts` и `hints`, событие `quest_point_done`, переход дальше. Полоса
   шагов позволяет вернуться к любому шагу `≤ unlockedIndex` или отвеченному.
   Выходы вперёд: «пропустить шаг» (косметический), «пропустить далёкую точку»
   (`markStepSkipped`, снимает точку с гейта финала), «закончить здесь»
   (`finishEarly`), «пропустить залипший шаг» после ≥3 неверных попыток
   (#1430, тоже снимает с гейта). На каждой реальной точке есть структурная
   отметка «точка изменилась» (`QuestStepInaccuracyAction`, `POST
   /api/quest-steps/{pk}/inaccuracy-reports/`, #1579): один тап, адрес — числовой
   PK шага (`QuestStep.numericId`), поэтому на интро и на шагах без PK её нет.
   Повтор идемпотентен: ответ с `created: false` показывает «вы уже отмечали эту
   точку», а не второе спасибо. Отказ отправки не меняет состояние шага и не
   прерывает прохождение. Свободнотекстовая жалоба
   (`QuestInaccuracyReportModal`, #1480) остаётся отдельной и неизменной: там
   произвольное сообщение редакции, здесь — сигнал о самом объекте.
5. **Финал.** `questFinished` = есть хотя бы один ответ И (гейт маршрута закрыт
   ИЛИ `earlyFinish`). Панель финала показывает текст, видео/постер (или
   YouTube-фасад), при засчитанном прохождении — `QuestPioneerBlock` и форму
   отзыва; при незасчитанном — сколько точек не хватает.
6. **Отзывы.** `QuestReviewSection` хранит выбранные звёзды и текст локально и
   одним `POST /api/quest-reviews/` отправляет их только по кнопке; отдельного
   `/rate/` и сохранения по тапу нет (#1578). Форма доступна только после
   засчитанного `questCompleted`. `QuestReviewsModal` показывает чужие отзывы и
   открывается чипом рейтинга в шапке детали. «Спасибо за отзыв» показывается только за
   подтверждённое сервером сохранение, при ошибке — сообщение и форма с
   введённым (#1486). Успешное сохранение шлёт `quest_review_submit`
   (`utils/questReviewAnalytics.ts`) из `onSuccess` мутации — один раз на
   отправку и никогда при ошибке. Агрегированная оценка показывается только от
   трёх отзывов: порог `QUEST_RATING_MIN_REVIEWS` / `hasPublicQuestRating`
   (`api/questRating.ts`) применяется в обеих ветках карточки каталога и в чипе
   шапки детали; ниже порога чип детали остаётся входом в читалку и показывает
   количество отзывов вместо оценки. К отзыву можно приложить до трёх фото
   (`QuestReviewPhotoPicker`, предел `QUEST_REVIEW_PHOTO_LIMIT` = серверный):
   загрузка идёт ТОЛЬКО после подтверждённого сохранения отзыва и по одному
   файлу — `POST /api/upload` адресуется PK записи QuestReview, которого до
   создания отзыва не существует. Частичный успех не откатывает отзыв: не
   доехавшие файлы называются игроку поимённо, уже сохранённые повторно не
   грузятся. Каждая подтверждённая загрузка шлёт `quest_photo_upload`. Загрузка
   снимает `review.moderation`, поэтому игроку показывается, что фото появятся
   после проверки. В читалке фото показываются из поля `photos` списка отзывов —
   сервер отдаёт только промодерированные и не больше трёх, клиент ничего не
   фильтрует; отзыв без фото рендерится как прежде, без пустого слота (#1579).
7. **Печать.** `generatePrintableQuest` (web-only) собирает HTML-книгу: обложка,
   карта (SVG/canvas/Leaflet-датаурл), шаги с QR навигации, финал/диплом,
   «страница ведущего» с `answerDisplay`. Лендинг сценария — `/quests/scenario`.
8. **Офлайн-карта.** `exportQuestOfflineMap` / `openQuestOfflineMapInApp` —
   GPX/GeoJSON реального маршрута; пока `tags` не пришли (`routeMode ===
   undefined`), обе кнопки отвечают «загрузка карты», чтобы не построить пеший
   маршрут для велоквеста.

## Правила проверки ответа

- Типы `answer_pattern` (`utils/questAdapters.ts`): `any` (всегда true, шаг-
  пауза), `exact`, `exact_any` (JSON-массив вариантов), `range` (`{min,max}`),
  `approx` (`{target,tolerance}`), `any_text` (`{min_length}`), `any_number`,
  легаси `function` — **fail closed**: с 2026-08-17 такой шаг не принимает ответы
  и пишет предупреждение в консоль. Раньше значение исполнялось через `eval`, то
  есть бэкенд мог выполнить произвольный код в клиенте. Скрипты миграции больше
  не выпускают этот тип: при несериализуемом ответе они падают до заливки.
- Нормализация — обе стороны сравнения: lowercase, схлопывание пробелов,
  удаление пунктуации, `ё → е` (`normalize`). Вариант `exact_any`,
  схлопывающийся в пустую строку, выбрасывается при сборке чекера: иначе
  словарь с `"-"` принимал бы любой ввод (аудит прода 06.08.2026 — 161
  недостижимый вариант в 93 шагах).
- Оценка выполняется ТОЛЬКО в `utils/questAnswerEvaluation.ts`
  (`normalizeQuestAnswerInput` + `evaluateQuestAnswer`). Прямой вызов
  `step.answer(...)` вне этого модуля и `questAdapters.ts` запрещён
  `scripts/guard-quest-answer-eval.js` (`npm run guard:quest-answer-eval`).
- `describeQuestAnswer` отдаёт вью только то, что нужно для рендера:
  `isFreeText`, `freeTextMinLength`, `isAutoPass`, `isBruteForceable`. Правила
  проверки во вью не дублируются.
- **Пауза против перебора (#1428).** `BRUTE_FORCEABLE_ANSWER_TYPES = {range,
  exact, exact_any, approx}`. После неверной попытки — пауза
  `[3000, 5000, 8000, 12000, 15000] мс`, последняя ступень действует и дальше.
  Лестница считается по неверным попыткам ТЕКУЩЕГО сеанса, живёт в модульной
  `Map` (переживает перемонтирование карточки), сбрасывается только
  `clearQuestCooldowns(questNumericId)` при сбросе прогресса. `any_number`
  намеренно НЕ в наборе: там подбирать нечего, пауза наказывала бы за опечатку.
  Enter в поле идёт через тот же гейт, что и кнопка, и источник правды —
  карта пауз, а не React-state.
- **Порог зачёта (#1443).** `questCompletionThreshold(n) = ⌈2n/3⌉`.
  `questCompleted = questFinished && stepsMissingForCompletion === 0`. Ниже
  порога — `partiallyCompleted`: финал и прогресс есть, значка, «первопроходца»
  и `completed: true` на бэкенде нет. Порог считается от **обязательных** точек
  (шаги с `_isAny` не гейтят финал и не входят в знаменатель).
- Подсказка предлагается после первой неверной попытки (`hintSuggestedAfter =
  1`), приглашение пропустить шаг — после `SKIP_SUGGESTED_AFTER = 3`; на
  свободном ответе приглашение не показывается (отказ там означает «коротко»).

### Структурные роли точек (`point_role`)

`quest_steps.point_role` — `start | required | optional | final`. Роль видна
игроку подписью под заголовком точки (`questWizardStepCard.tsx`), суффиксом в
списке точек (`questWizardShell.tsx`), подписью на карте (`questMapPoints.ts`) и
в офлайн-экспорте, а `utils/questCountModel.ts` строит по ней знаменатель:
`progressTotal` = точки `required`, гейт финала = `required` + `final`. Значит
роль решает не только текст: точка `optional` не держит зачёт.

Правило классификации живёт в ОДНОМ месте — `scripts/lib/questPointRoles.js`, и
по нему работают все трое: заливщик новых квестов
(`migrate-quest-from-file.js`), разовый бэкфилл прода
(`npm run quest:backfill-point-roles -- --apply`) и гвардия
(`npm run quest:scan-point-roles`, exit 1 на расхождении). Ведёт авторский
заголовок: «(по желанию)» / «опционально» → `optional`; иконка привала
(`☕`, `✨`) или слово «привал» — только вместе со свободным ответом; последняя
точка маршрута → `final`, если она сама не объявлена необязательной. Тип ответа
единственным критерием быть не может: в квестах из статей (#1652) `any` стоял на
обязательных точках с плохими вопросами.

Историю стоит держать в голове при чтении старых данных: поле появилось позже
квестов, все старые строки лежали с `required`, и 05.09.2026 бэкфилл #1802
поправил 316 точек в 164 квестах (171 `optional`, 145 `final`). Семнадцать
квестов заканчиваются точкой «по желанию» и финала не имеют намеренно — выбирать
её за автора скрипт не должен.



## Телеметрия и тестовые данные

- Попытки ответа: `recordQuestAnswerAttempt` кладёт событие в AsyncStorage-
  очередь (`QUEUE_MAX_EVENTS = 500`, `FLUSH_BATCH_SIZE = 10`), доставка —
  `POST /api/quest-answer-attempts/bulk/` с `client_attempt_id` (повтор
  схлопывается сервером в `duplicates`). Флаш на переходе шага, на уходе с
  экрана и при финале, а на web ещё и на уходе со страницы
  (`visibilitychange`/`pagehide`: cleanup-эффект при закрытии вкладки не
  выполняется); бэкофф 2 с → 60 с. 4xx кроме 429 снимает с очереди РОВНО
  виновные события — ошибки DRF по списку приходят позиционно — и кладёт их в
  карантин `quest_attempts_rejected_v1`, а не выбрасывает молча (#1719).
  Батч целиком снимается только тогда, когда позиционных данных в ответе нет.
- **Приватность:** для `any_text`/`any` сырой ввод не покидает устройство —
  уходит только `answer_length` (второй эшелон к серверному правилу #1275).
- Ключ сессии общий для гостя и залогиненного: логин посреди квеста не рвёт
  прохождение на две сессии.
- Продуктовая аналитика (`queueAnalyticsEvent`): `quest_start`,
  `quest_step_view`, `quest_answer_submit`, `quest_hint`,
  `quest_point_done`, `quest_finish_early`, `quest_skip_stuck_step`,
  `quest_finish` (с `early`/`partial`/`passed_count`/`steps_count`),
  `quest_completion_credited`, `quest_guest_gate_view`,
  `quest_guest_gate_login_click`, `quest_guest_gate_register_click`,
  `quest_guest_progress_migrated`, `quest_attempt_batch_rejected` (#1719:
  `status`, `dropped`, `quest_id`, `platform`, имена полей-причин; на native
  аналитика намеренно no-op, поэтому там след даёт только карантин).
- **Пошаговая воронка (#1498).** `quest_step_view` (`quest_id`, `step_index`) —
  игрок открыл точку; `quest_answer_submit` (`+ is_correct`, `attempt_no`) — одна
  на каждое нажатие «Проверить»; `quest_hint` (`+ attempt_no`) — раскрытие
  подсказки. `attempt_no` в `quest_answer_submit` — номер текущей попытки,
  считая с 1; в `quest_hint` — сколько неверных попыток игрок сделал ДО
  раскрытия (0 = взял подсказку сразу). Схлопывание: просмотр и подсказка считаются один раз на точку за
  прохождение (возврат назад и повторное раскрытие аккордеона новых событий не
  дают), попытка — каждая, иначе не построить распределение провалов по
  `step_index`. `quest_step_view` уходит только когда карточка шага реально на
  экране: у гостя за лимитом бесплатных точек её подменяет собой гейт
  регистрации, и просмотр этой точке не засчитывается — иначе провал на гейте
  (`quest_guest_gate_view`) стал бы неотличим от провала на самом вопросе. Все три живут в `useQuestWizardAnalytics`; попытка приходит из
  карточки шага через `onAnswerAttempt` рядом с серверной очередью
  `recordQuestAnswerAttempt` — GA4 отвечает «на каком шаге сыплются попытки»,
  очередь «что игрок писал».
- `step_index` во всех событиях — индекс среди настоящих точек (`steps`), intro в
  него не входит. Intro больше не шлёт `quest_point_done`: он уходил со
  `step_index: -1` и завышал «пройдено точек на старт» ровно на один старт
  (#1498), поэтому исторические счётчики `quest_point_done` до 19.08.2026
  содержат по одному лишнему событию на каждый `quest_start`.
- Разбор трения: `npm run quest:insights` (`scripts/quest-answer-insights.js`),
  читает staff-агрегат `GET /api/quests/{id}/answer-stats/`; формула
  `rejected_per_solver + 2×hint_open_rate + 3×abandon_rate`. Staff-токен из
  `.secrets/metravel-task-board.env`, в вывод не попадает.
- Тестовые данные: e2e гоняются на мок-квестах (`e2e-minsk-quest`,
  `e2e-warsaw-quest`, `e2e-video-quest`, `e2e-reviews-quest`) через перехват
  роутов, продовых записей не создают. DEV-мока оценки квеста нет: рейтинг
  сохраняется только реальным `POST /api/quest-reviews/` (#1578).
  `QUEST_COMPLETION_MOCK = false` и на данные не влияет.
  Мока публичных отзывов больше нет: удалён в #1486 вместе с выдуманными
  авторами — при `404` и пустом ответе читалка честно пуста во всех окружениях.

## Кросс-платформенность

| Concern | Web | Android / iOS |
| --- | --- | --- |
| Карта квеста | `QuestFullMap.tsx` — React Leaflet поверх `MapCanvas` | `QuestFullMap.native.tsx` — Leaflet в `react-native-webview`, HTML из `questNativeMapHtml.ts` |
| Bridge карты | нет | `questMapBridge.ts`: `quest-map-png`, `quest-map-nav`, `quest-map-status`, `OPEN_URL` |
| Ленивая загрузка карты | `QuestFullMapLazy.tsx` = `React.lazy` | `QuestFullMapLazy.native.tsx` = прямой ре-экспорт (чанков нет) |
| Компас до точки | `QuestPointNavigator.web.tsx` — `null` (никаких sensor-API) | `QuestPointNavigator.native.tsx` — heading + дистанция |
| Геозоны | `useQuestGeofence.web.ts` — no-op | `useQuestGeofence.native.ts` → `services/questGeofencing`; регионы = неотвеченные шаги, старт при фокусе, стоп при финале/blur/unmount |
| Напоминания | `useQuestReminder.web.ts` — no-op | `useQuestReminder.native.ts` → локальное уведомление «продолжить квест» |
| Печать | `generatePrintableQuest` работает | ранний `return` при `Platform.OS !== 'web'` |
| Визард | грузится через `React.lazy` + `Suspense` | прямой импорт (`QuestWizardDirect`) |
| Экспорт карты | `downloadTextFileWeb` | `expo-file-system` + `expo-sharing` |
| Партнёрский блок | inline/сайдбар экскурсий, без affiliate-офферов | те же офферы внутри той же карточки «Экскурсии рядом» (`QuestExcursionsInline`), отдельной секции нет |

Поле `geo_verify {enabled, radius_m}` присутствует в типе `ApiQuestStep`, но в
коде фронтенда не читается: проверка «игрок на месте» на клиенте не реализована,
native-геозоны используют только координаты шага (см. «Открытые вопросы»).

## SEO и SSG

- Мета детали строит `buildQuestSeoMetadata` (`utils/questSeo.js`, CommonJS —
  общий модуль для приложения и сборочных скриптов): брендированный title с
  клампом длины и description с клампом до 160 закодированных символов.
- JSON-LD: деталь — `createQuestDetailStructuredData`; лендинги города и страны
  — `ItemList` + `BreadcrumbList`; каталог — `createQuestCatalogStructuredData`
  + FAQ; `/quests/scenario` — `HowTo`/`ItemList`.
- SSG: `scripts/generate-seo-pages.js` (лендинги городов/стран, промо-разметка,
  crawlable-перелинковка). Country SSG fail-closed требует Expo-шаблон
  `dist/<env>/quests/country/[country].html`, чтобы страница гидратировалась
  country route bundle, а не fallback-бандлом города. Production `sitemap.xml`
  генерирует и отдаёт Django; фронтовый `scripts/generate-sitemap.js` не входит
  в release-path.
- Статическая копия интро/FAQ каталога — `utils/questContent.js`; она обязана
  совпадать с RU-значениями ключей `quests:screens.tabs.QuestsSeoIntroFaq.*`,
  иначе краулер видит не то, что читает пользователь после гидрации.
- Гейт сборки: `node scripts/verify-static-quest-seo.js --dist "dist/$ENV" --api
  https://metravel.by` в `build-prod.sh` — падает до rsync. Городские HTML
  проверяются в `dist`, а alias-membership — в живом backend-owned
  `${API_BASE}/sitemap.xml`. Country HTML проверяется до deploy, но country
  sitemap membership включается только явным `--verify-country-sitemap` после
  согласованного релиза backend-задачи `#1606`; HTTP 200 и отсутствие 3xx тоже
  проверяет post-deploy.

## Внешние зависимости

- API: `/api/quests/` (пагинация, `page_size=100`, дочитывание до 20 страниц),
  `/api/quests/by-quest-id/{quest_id}/` (`LONG_TIMEOUT`, retry на 0/502/503/504),
  `/api/quests/by-city/{cityId}/`, `/api/quests/{id}/`,
  `/api/quests/near-location/`, `/api/quest-progress/` (+ `/quest/{questId}/`,
  `PATCH /{id}/`, `DELETE /{id}/`), `/api/quest-answer-attempts/bulk/`,
  `/api/quest-reviews/`,
  `/api/quests/quest{questId}/review/users/{userId}/`,
  `/api/quests/quest{questId}/reviews/`, `/api/quests/{id}/answer-stats/`
  (staff, только скрипт инсайтов).
- Роутинг маршрута квеста: `api/external/serverRouting.ts` → Valhalla-фолбэк
  (`questRouteGeometry.ts`), режимы `foot`/`bike`.
- Тайлы/атрибуция карты — общий контракт `config/mapWebTileContract.ts`.
- Контент квестов: `scripts/<city>-quest-data.js` + `migrate-<city>-quest.js`
  (идемпотентные миграции), `apply-quest-patches.js`, `sync-quest-to-prod.js`,
  `upload-quest-media*.js`, `generate-quest-finale-videos.js`,
  `audit-quest-coordinates.js`, `quest-geocheck.js`, `quest-poi-suggest.js`.

## Тесты

Покрыто (Jest):

- адаптеры и правила — `__tests__/utils/questAdapters*.test.ts`,
  `questAnswerEvaluation`, `questCompletionPolicy`, `questProgressMerge`,
  `questAudience`, `questForLocation(+Coverage)`, `questImagePrefetch`,
  `questSeo(.node)`, `questAnswerTelemetry`;
- API — `__tests__/api/quests.test.ts`, `questBundleCache`, `questRating`,
  `questReview`;
- хуки — `useQuestsApi`, `useQuestWizardProgress`, `useQuestProgressSync.offline`,
  `useQuestForLocation`;
- визард — `questStepCardAttemptGuards`, `questStepCardFarSkip`,
  `questFinalePartialCompletion`, `QuestWizard.guestGate`,
  `QuestWizard.offline`, `questWizardHelpers`, `questWizardTouchTargets`,
  `questWizardSections.belkraj`;
- карта/экспорт — `questMapBridge`, `questMapPoints`, `questRouteGeometry`,
  `questStepDistance`, `questNativeMapPng`, `questOfflineMapExport`,
  `QuestFullMap.native`, `QuestFullMapLazy`;
- каталог/карточки — `QuestCard`, `QuestsContentPanel`,
  `QuestsScreen.helpers`, `QuestForCityCard(.native-viewport)`,
  `QuestCompletionBadge`, `QuestGuestGate`, `QuestReviewSection`,
  `TravelsForQuestSection`, `guestQuestFlow`, `questLocationSelection`,
  `routes/quest-screen-title`;
- скрипты/гейты — `verify-static-quest-seo`, `scanQuestHintLeak`,
  `questAnswerInsights`, `questBundles`, `quest-finale-video-profile`,
  `helCityQuestAnswers`, `helJurataQuestAnswers`;
- store — `questFontScaleStore`; печать — `QuestPrintable`.

E2E (Playwright): `e2e/quests-list-detail.spec.ts` (каталог → деталь, далёкая
точка), `e2e/quest-video.spec.ts` (видео финала), `e2e/quest-reviews-reader.spec.ts`
(чип и читалка отзывов).

Не покрыто:

- web-`QuestFullMap.tsx` (native-аналог покрыт, web — нет);
- `screens/tabs/QuestsScreen.tsx` целиком (покрыты только helpers), `QuestsSidebar`,
  `QuestScenarioScreen`, `app/(tabs)/quests/map.tsx`, `app/(tabs)/quests/[city]/index.tsx`
  (alias-резолв покрыт только на уровне SSG-гейта);
- `QuestConsentGate`, `QuestReviewsModal`, `QuestPioneerBlock`,
  `useQuestGeofence.native`, `useQuestReminder.native`, `QuestPointNavigator.native`;
- `useQuestBundle` (обогащение тегами и фолбэк обложки) отдельного теста не имеет.

## Известные ловушки (механизм, а не симптом)

- **Alias лендинга адресует город, а не `city_id`** (`QUEST-ALIAS-001`). В
  каталоге один город может иметь несколько `city_id` (Гомель 19/92, Гродно
  11/91, Могилёв 14/93). Оба получают один alias, и генерация лендингов в цикле
  по городам молча затирала предыдущую запись. Контроль —
  `buildQuestCityLandingGroups()` + `verify-static-quest-seo.js`; дубли
  городов в справочнике остаются задачей бэкенда.
- **Подсказка выдаёт ответ** (`QUEST-HINT-LEAK-001`). Буквальный класс ловится
  `npm run quest:scan-hint-leak` (порог совпадения 3 символа, exit 1 при
  находке, умеет работать по локальному data-файлу до заливки). По умолчанию
  сканируются два поля ШАГА — `hint` и `location` (#1467, оба вычищены до нуля)
  — и текст ИНТРО квеста против ответов всех его шагов (#1488, `--scopes`);
  `--fields=` знает ещё `title`, `story` и `task` шага, у них есть известные
  находки на проде, поэтому в умолчание они не входят. Разобранный остаток по
  интро держит `--baseline=scripts/quest-hint-leak-baseline.json`; поля шага в
  baseline не попадают никогда. Текст финала — отдельная поверхность
  (`--scopes=finale`), в умолчание не входит: его читают после последнего шага. Семантический класс (подсказка-определение) не
  ловится ничем, кроме вычитки. Кросс-шаговый класс (ответ шага N стоит в
  тексте шага M, а печать и офлайн-экспорт показывают весь квест сразу) —
  признанное ограничение формата: печатная версия по замыслу несёт отдельную
  страницу ведущего с ключом ответов.
- **Эталон ответа устаревает вместе с объектом** (`QUEST-CONTENT-ROT-001`).
  Механика сверки исправна, устаревает контент: закрытый словарь на изменяемом
  признаке (цвет, вывеска) перестаёт совпадать с реальностью. 58 шагов базы
  построены на цвете, контура проверки не существует.
- **Снимок живого контента в репозитории откатывает прод**
  (`QUEST-CONTENT-SOURCE-DRIFT-001`, #1448). Источник правды по опубликованному
  контенту — прод; файл в репозитории, повторяющий его, протухает при следующей
  правке. Замер 08.2026: из 33 снимков `scripts/review/*.json` 30 разошлись с
  продом на 436 полей, включая подсказки, которые #1445/#1447 уже убрали как
  утечку ответа. Контроль — жизненный цикл, а не сверка: снимки живут в
  gitignored `scripts/.quest-review/`, `scripts/update-quest-content.js`
  отказывается применять git-tracked data-файл и архивирует применённый снимок в
  `scripts/.quest-review/applied/`, а `npm run guard:quest-review-snapshots`
  (входит в `check:fast`) падает, если снимок снова окажется под git. Источники
  создания новых квестов `scripts/*-quest-data.js` под это правило не попадают —
  они не снимки применённых правок.
- **pk финала резолвится по неуникальному тексту** (#1458). FK `quest -> finale`
  API не отдаёт. `scripts/update-quest-content.js` берёт pk из точного маппинга
  `questId -> finaleId` в `scripts/generate-quest-finale-videos.js` — того же,
  по которому заливаются финальные видео, — и сверяет текст записи с текущим
  финалом квеста: расхождение означает протухший маппинг и валит запуск, а не
  правит наугад. Перебор по тексту остался фолбэком для квестов вне маппинга;
  текст не ключ, поэтому диапазон сканируется целиком (граница считается от
  максимума маппинга, а не фиксированные 60 — за ними лежат 78 из 131
  известного финала), при двух и более совпадениях запуск падает, а не выбирает
  первое. Применённым финал считается только после совпавшего verify, а не по
  факту отправленного PATCH: раньше счётчик применённых рос до проверки, промах
  мимо квеста печатался в консоль при коде возврата 0 и снимок уезжал в архив.
  Ненайденная запись, оборванный не-404 ошибкой перебор и пустой текущий финал
  у квеста — тоже провал, а не пропуск: скрипт только обновляет существующие
  записи (сам финал создаётся вместе с квестом в `migrate-*`), поэтому писать
  правку некуда, и молчаливый пропуск терял бы её. Регрессия закрыта
  `__tests__/scripts/update-quest-content-finale.test.ts` — прогон настоящего
  CLI по локальному HTTP-стабу, без обращения к проду.
- **`tags` нет в детальном API.** `routeMode` до их прихода равен `undefined`, и
  это НЕ ошибка, а гейт: карта и экспорты паузятся, чтобы велоквест не построил
  пеший маршрут. Пустой набор тегов (`[]`) — тоже завершённая классификация;
  отбрасывание `[]` оставляло обычные квесты в вечном скелете карты.
- **Эхо собственного сейва.** `initialProgress` пересоздаётся в роуте на каждый
  `setProgress`, поэтому load-эффект визарда защищён `backendSeededKey` +
  отпечатком `stateFingerprint`; без них курсор и ответы откатывались к
  серверным значениям («тап по ответу иногда игнорируется»).
- **Строку прогресса создаёт первое действие, а не открытие экрана (#1803).**
  При маунте экран читает прогресс `fetchQuestProgress` (GET, `null` на 404) и
  строку не создаёт; `fetchOrCreateProgress` остался только на пути отправки
  снапшота и на миграции гостевого прогресса. Гейт отправки — предикат
  `hasQuestProgressStarted` (`utils/questProgressMerge.ts`): ответ (включая
  `intro` от «Начать квест»), попытка, открытая подсказка, пропуск, досрочный
  финиш, зачёт или уход с нулевого шага. `showMap` в признак НЕ входит — карта
  включена по умолчанию. До правки каждый просмотр оставлял пустую запись: 8 из
  48 строк прода были просмотрами, и воронка стартов завышалась на 17 %.
- **Отложенный прогресс не выбрасывается до успешного ответа.** Раньше
  `pendingDataRef` обнулялся до запроса, и при офлайне на сервере оставался
  только intro. Теперь неуспех оставляет данные в очереди с бэкоффом
  2 с → 60 с, плюс флаш на возврате сети/приложения и на размонтировании.
- **Слияние вместо победителя.** `mergeQuestProgress` монотонен: `answers` —
  объединение (коллизия одного шага решается `answeredAt`), `attempts` — max,
  `hints` — ИЛИ, `unlockedIndex` — max, `currentIndex`/`showMap` —
  last-writer-wins. Единственная немонотонная операция — сброс, он чистит и
  локальные времена, иначе старые ответы «воскресали» бы.
- **`completed` наружу монотонен (#1451).** `skipped`/`earlyFinish` с #1632
  синхронизируются через серверные поля #1454, но легаси-запись или старый клиент
  всё ещё могут их не содержать. Визард помнит уже подтверждённое прохождение
  (сервер или прежняя сессия устройства) и никогда не отдаёт наружу
  `completed: false` поверх него — иначе игрок молча терял бы «Пройден» и
  единицу `completions_count`. Показ финала это НЕ включает: форсить прежнего
  финишера в финальный экран нельзя (#1431).
- **Гостевой гейт мягкий и повторяемый.** Одноразовый флаг снятия гейта давал
  гостю пройти весь квест без регистрации (завершения в аналитике без
  пользователя). Сейчас гейт всплывает на каждой неотвеченной точке сверх
  лимита, а «вернуться к пройденному» ведёт к `lastAnsweredIndex`, а не к
  `unlockedIndex` (последний указывает на следующую, ещё не отвеченную точку).
- **Битый сегмент маршрута.** `/quests/undefined/undefined` давал реальные 404 в
  проде: строка `"undefined"` — валидный с виду сегмент. `isUsableRouteSegment`
  отбивает такой id до сети (`assertUsableQuestId`), а `buildQuestPath`
  возвращает `null` и запрещает рисовать ссылку (#1185).
- **QA-прохождение крадёт первопроходца.** Удаление `quest_progress` бейдж
  первопроходца не снимает (#1434) — тестовое прохождение на проде нужно
  планировать с этим.
- **Слой данных квестов в стартовом графе.** `hooks/questsListCachePolicy.ts` и
  `hooks/questsListQuery.ts` намеренно листовые: импорт констант из
  `useQuestsApi` тянул `questAdapters` → таблицу контуров стран (#1393), и она
  ехала тегом `<script>` почти на всех маршрутах.

## Открытые вопросы и долги

- `components/quests/QuestWizard.tsx` (813), `printable/styles.ts` (886) и
  `QuestsScreen.styles.ts` (1287) выше порога guard-скрипта — план распила не
  зафиксирован.
- `useQuestBundle` не переведён на React Query: ключ `queryKeys.questBundle`
  объявлен и не используется, дедупликации и общего инвалидационного контракта у
  детали нет.
- Backend принимает `POST /api/quest-reviews/` от любого авторизованного
  пользователя и пока не проверяет `QuestProgress.completed=True`. Frontend
  показывает форму только при засчитанном прохождении (#1578), но серверный
  eligibility-gate остаётся backend-долгом и нужен до использования рейтинга
  как доверенного сигнала сортировки.
- `completions_count` считает текущие строки `QuestProgress(completed=True)`, а
  сброс прогресса удаляет строку. Это не lifetime-число прохождений: для
  сортировки «чаще проходят» нужен неизменяемый серверный факт первого
  завершения пользователя.
- UGC после финиша закрыт частично (#1486): фото игрока (до 3), модерация
  отзывов и структурная отметка «точка требует проверки» с порогом ≥2 требуют
  backend-полей и вынесены в `area=back`; контракт — в
  `openspec/changes/extend-quest-review-ugc/design.md` §5.
- `geo_verify` приходит в API и не используется фронтендом: задумывалась ли
  клиентская проверка присутствия на точке — не установлено.
- `scripts/quest-answer-insights.js` не фильтрует тестовые/QA-прохождения:
  влияние собственных прогонов на метрику трения не измерено.
- Семантические утечки подсказок и цветовые эталоны (`QUEST-CONTENT-ROT-001`)
  не имеют автоматического контроля; сплошная сверка 58 цветовых шагов не
  проводилась.
- Карта квеста дублирует с основной `/map` часть логики маркеров, resize и
  экранирования HTML (см. «Технический долг» в `docs/features/map.md`).
- Точное число опубликованных квестов в документе не фиксируется: последний
  замер в коде — 139 квестов / 1160 шагов (комментарии `api/quests.ts`,
  `questAdapters.ts`, `docs/PROBLEM_MEMORY.md`, август 2026).

## Связанные документы

- [`docs/PROBLEM_MEMORY.md`](../PROBLEM_MEMORY.md) — `QUEST-ALIAS-001`,
  `QUEST-HINT-LEAK-001`, `QUEST-CONTENT-ROT-001`,
  `QUEST-CONTENT-SOURCE-DRIFT-001`, `BUILD-CATALOG-001`, `ROUTE-BUNDLE-001`
- [`docs/QUEST_ANSWER_INSIGHTS.md`](../QUEST_ANSWER_INSIGHTS.md) — цикл
  «телеметрия → правка контента»
- [`docs/QUEST_CONTENT_PLAN.md`](../QUEST_CONTENT_PLAN.md),
  [`docs/QUEST_DEMAND_LOG.md`](../QUEST_DEMAND_LOG.md) — контентный план и спрос
- [`docs/features/map.md`](./map.md), [`docs/features/offline.md`](./offline.md),
  [`docs/features/travel.md`](./travel.md)
- [`docs/RULES.md`](../RULES.md), [`docs/TESTING.md`](../TESTING.md)
