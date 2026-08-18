# Фича: quests

**Последняя актуализация:** 2026-08-17

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
- Каталог `/quests` и лендинги городов имеют SSG-слой и alias-роутинг
  (`utils/questCityAlias.js`), проверяемый гейтом в `build-prod.sh`.
- Карта квеста — отдельный renderer от основной `/map`: web React Leaflet
  (`QuestFullMap.tsx`), native Leaflet-в-WebView (`QuestFullMap.native.tsx`).

## Точки входа

| Route / surface | Файл | Ответственность |
| --- | --- | --- |
| `/quests` | `app/(tabs)/quests/index.tsx` (19 LOC) → `screens/tabs/QuestsScreenRoute.tsx` → `screens/tabs/QuestsScreen.tsx` | каталог: города/фильтры/поиск, список ↔ карта, SEO-интро и FAQ |
| `/quests/map` | `app/(tabs)/quests/map.tsx` (314 LOC) | все квесты точками на общей `Map`/`Map.web`; статический сегмент, матчится раньше `[city]` |
| `/quests/scenario` | `app/(tabs)/quests/scenario.tsx` (9 LOC) → `screens/tabs/QuestScenarioScreen.tsx` (435 LOC) | DIY-лендинг «квест-бук для печати»; тоже статический сегмент перед `[city]` |
| `/quests/{city}` | `app/(tabs)/quests/[city]/index.tsx` (229 LOC) | лендинг города: сегмент — numeric `city_id` ИЛИ alias (`minsk`); неизвестный сегмент → `router.replace('/quests')` |
| `/quests/{city}/{questId}` | `app/(tabs)/quests/[city]/[questId].tsx` (688 LOC) | деталь и прохождение: bundle, прогресс, гость/consent, SEO+JSON-LD, модалка отзывов |
| Промо на главной | `components/home/HomeQuestsPromoSection.tsx` | две карточки через `useQuestsPreview(limit)` |
| Промо в travel-детали | `components/travel/details/sections/QuestForCitySection.tsx` (+ `Deferred*.tsx` / `Deferred*.web.tsx`) | «квест по этому городу» на странице путешествия |

Alias-роутов на уровне Expo Router нет: alias — это тот же сегмент `[city]`,
разрешаемый `resolveQuestCitySegment(cityParam, quests)` по списку квестов.
Canonical лендинга — alias-вариант, если alias есть, иначе `city_id`.

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
         ├─ <QuestReviewSection>  (звёзды + текст, useQuestRatingMutation)
         └─ <QuestPioneerBlock>   (только при засчитанном прохождении)
```

«Экскурсии рядом» на карточке шага — **ровно одна секция**. `QuestExcursionsInline`
держит под общим заголовком Belkraj-виджет и партнёрские офферы `AffiliateOffers`;
отдельной native-секции с тем же заголовком быть не должно — именно её задвоение
чинил #1452. Рисовать обвязку (разделитель + карточка + заголовок) можно только когда
есть что показать: гейт виджета живёт в `components/belkraj/belkrajAvailability.ts`
(`canRenderBelkrajWidget` — координаты, `NODE_ENV === 'production'` и страна), оттуда
же его берут оба варианта `BelkrajWidget`, чтобы предикат не разошёлся с поведением
самого виджета. Если ни виджет, ни офферы не отдают контент, секция возвращает `null`.
На debug/dev-client сборке Belkraj закрыт гейтом — видны только офферы, это ожидаемо.

**Belkraj — только Беларусь.** Каталог партнёра покрывает BY, а на координаты вне
страны его виджет отвечает не пустым списком, а подменой города: квест по Лимасолу
(`limassol-lionheart`, `country_code=cy`) показывал минские экскурсии с подписью
«Минск, Кипр», без параметра `country` — гомельские (#1461). Поэтому гейт режет по
стране: явный `countryCode` важнее координат, иначе страна берётся по первой точке
через `getCountryCodeByCoords`. Внутри Беларуси координаты партнёр резолвит верно —
витебский квест отдаёт витебские экскурсии, — так что городской точности гейт не
требует. У не-BY квестов место виджета на web занимают `AffiliateOffers`; на native
офферы показываются как и раньше. Тот же гейт стоит на travel-секции «Экскурсии»
(`ExcursionsSection`) и на ссылке в `buildTravelSectionLinks`.

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
  `answers`, `attempts`, `hints`, `show_map`, `completed`, `completed_at`.

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
| `useQuestRatingMutation` | `hooks/useQuestRating.ts` | `['quest', id, 'rating']` | оптимистично правит `['quest', id]` и `['quests']`, откат при ошибке, инвалидация `onSettled` |
| `useQuestReview` | `hooks/useQuestReview.ts` | `['questUserReview', id]` | `setQueryData` + инвалидация после `POST /quest-reviews/` |
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
| AsyncStorage (телеметрия) | `quest_attempts_queue_v1`, `quest_attempts_session_v1` | очередь попыток и ключ сессии прохождения |
| AsyncStorage (каталог) | `STORAGE_SELECTED_CITY` | выбранный город каталога |
| Zustand | `stores/questFontScaleStore.ts` (persist) | масштаб шрифта визарда |
| Модульное состояние | `questWizardStepCard.tsx` (`stepCooldowns`), `questAnswerTelemetry.ts` | паузы между попытками и очередь доставки — переживают перемонтирование карточки |

`skipped` и `earlyFinish` полей на бэкенде НЕ имеют и живут только на клиенте
(`toQuestProgressServerPayload` их не отправляет).

## Офлайн и кэш

- `fetchQuestsList` / `fetchQuestsPreview` пишут сырой каталог в AsyncStorage
  (`quest-list:v1`, `QUEST_LIST_CACHE_VERSION = 1`) и читают его при сетевом
  фейле. Превью в кэш каталога НЕ пишет (это срез, он затёр бы полный список).
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
   (#1430, тоже снимает с гейта).
5. **Финал.** `questFinished` = есть хотя бы один ответ И (гейт маршрута закрыт
   ИЛИ `earlyFinish`). Панель финала показывает текст, видео/постер (или
   YouTube-фасад), при засчитанном прохождении — `QuestPioneerBlock` и форму
   отзыва; при незасчитанном — сколько точек не хватает.
6. **Отзывы.** `QuestReviewSection` (звёзды → `useQuestRatingMutation`, текст →
   `useQuestReview`) и `QuestReviewsModal` (чужие отзывы, открывается чипом
   рейтинга в шапке детали).
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

## Телеметрия и тестовые данные

- Попытки ответа: `recordQuestAnswerAttempt` кладёт событие в AsyncStorage-
  очередь (`QUEUE_MAX_EVENTS = 500`, `FLUSH_BATCH_SIZE = 10`), доставка —
  `POST /api/quest-answer-attempts/bulk/` с `client_attempt_id` (повтор
  схлопывается сервером в `duplicates`). Флаш на переходе шага, на уходе с
  экрана и при финале; бэкофф 2 с → 60 с; 4xx кроме 429 дропает батч, чтобы он
  не заткнул очередь навсегда.
- **Приватность:** для `any_text`/`any` сырой ввод не покидает устройство —
  уходит только `answer_length` (второй эшелон к серверному правилу #1275).
- Ключ сессии общий для гостя и залогиненного: логин посреди квеста не рвёт
  прохождение на две сессии.
- Продуктовая аналитика (`queueAnalyticsEvent`): `quest_start`,
  `quest_point_done`, `quest_finish_early`, `quest_skip_stuck_step`,
  `quest_finish` (с `early`/`partial`/`passed_count`/`steps_count`),
  `quest_completion_credited`, `quest_guest_gate_view`,
  `quest_guest_gate_login_click`, `quest_guest_gate_register_click`,
  `quest_guest_progress_migrated`.
- Разбор трения: `npm run quest:insights` (`scripts/quest-answer-insights.js`),
  читает staff-агрегат `GET /api/quests/{id}/answer-stats/`; формула
  `rejected_per_solver + 2×hint_open_rate + 3×abandon_rate`. Staff-токен из
  `.secrets/metravel-task-board.env`, в вывод не попадает.
- Тестовые данные: e2e гоняются на мок-квестах (`e2e-minsk-quest`,
  `e2e-warsaw-quest`, `e2e-video-quest`, `e2e-reviews-quest`) через перехват
  роутов, продовых записей не создают. DEV-моки в коде: `QUEST_RATING_MOCK =
  true` (оценка держится в памяти в `__DEV__`), мок публичных отзывов при `404`
  только в `__DEV__` — на проде честно пусто. `QUEST_COMPLETION_MOCK = false`.

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
- JSON-LD: деталь — `createQuestDetailStructuredData`; лендинг города —
  `ItemList` + `BreadcrumbList`; каталог — `createQuestCatalogStructuredData` +
  FAQ; `/quests/scenario` — `HowTo`/`ItemList`.
- SSG: `scripts/generate-seo-pages.js` (лендинги городов, промо-разметка,
  crawlable-перелинковка) и `scripts/generate-sitemap.js` (`/quests`,
  `/quests/scenario`, лендинги городов с alias-canonical, детали квестов).
- Статическая копия интро/FAQ каталога — `utils/questContent.js`; она обязана
  совпадать с RU-значениями ключей `quests:screens.tabs.QuestsSeoIntroFaq.*`,
  иначе краулер видит не то, что читает пользователь после гидрации.
- Гейт сборки: `node scripts/verify-static-quest-seo.js --dist "dist/$ENV" --api
  https://metravel.by` в `build-prod.sh` — падает до rsync.

## Внешние зависимости

- API: `/api/quests/` (пагинация, `page_size=100`, дочитывание до 20 страниц),
  `/api/quests/by-quest-id/{quest_id}/` (`LONG_TIMEOUT`, retry на 0/502/503/504),
  `/api/quests/by-city/{cityId}/`, `/api/quests/{id}/`,
  `/api/quests/near-location/`, `/api/quest-progress/` (+ `/quest/{questId}/`,
  `PATCH /{id}/`, `DELETE /{id}/`), `/api/quest-answer-attempts/bulk/`,
  `/api/quests/{id}/rate/`, `/api/quest-reviews/`,
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
  `mergeQuestCityLandingsByAlias()` + `verify-static-quest-seo.js`; дубли
  городов в справочнике остаются задачей бэкенда.
- **Подсказка выдаёт ответ** (`QUEST-HINT-LEAK-001`). Буквальный класс ловится
  `npm run quest:scan-hint-leak` (порог совпадения 3 символа, exit 1 при
  находке, умеет работать по локальному data-файлу до заливки). Семантический
  класс (подсказка-определение) не ловится ничем, кроме вычитки.
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
- **Отложенный прогресс не выбрасывается до успешного ответа.** Раньше
  `pendingDataRef` обнулялся до запроса, и при офлайне на сервере оставался
  только intro. Теперь неуспех оставляет данные в очереди с бэкоффом
  2 с → 60 с, плюс флаш на возврате сети/приложения и на размонтировании.
- **Слияние вместо победителя.** `mergeQuestProgress` монотонен: `answers` —
  объединение (коллизия одного шага решается `answeredAt`), `attempts` — max,
  `hints` — ИЛИ, `unlockedIndex` — max, `currentIndex`/`showMap` —
  last-writer-wins. Единственная немонотонная операция — сброс, он чистит и
  локальные времена, иначе старые ответы «воскресали» бы.
- **`completed` наружу монотонен (#1451).** Официальный пропуск точки и «Завершить
  квест здесь» (`skipped`/`earlyFinish`) на бэкенде не хранятся, поэтому второе
  устройство пересчитывает засчитанное прохождение как незаконченное. Визард
  помнит уже подтверждённое прохождение (сервер или прежняя сессия устройства) и
  никогда не отдаёт наружу `completed: false` поверх него — иначе игрок молча
  терял бы «Пройден» и единицу `completions_count`. Показ финала это НЕ
  включает: форсить прежнего финишера в финальный экран нельзя (#1431). Полное
  устранение расхождения требует серверных полей — #1454.
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
- `fetchQuestReviews` и `api/questReview.ts` описаны как контракт ожидаемого
  эндпоинта — реализован ли `GET /api/quests/quest{id}/reviews/` и
  `POST /api/quest-reviews/` на проде, по коду не установить.
- `QUEST_RATING_MOCK = true` держит DEV-оценку в памяти; статус реального
  `POST /api/quests/{id}/rate/` на проде из репозитория не проверяется.
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
