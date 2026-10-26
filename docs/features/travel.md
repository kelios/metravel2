# Фича: travel

**Последняя актуализация:** 2026-09-06 (сверены владельцы стейта; остальные
разделы правились позже заявленной даты — точная история в `git log -- <файл>`)

**Ответственный домен:** frontend travel

**Канонический обзор проекта:** [Архитектура и функциональность Metravel](../ARCHITECTURE.md)

## Назначение документа

Этот файл описывает текущие frontend-маршруты и ownership списка, публичной
детали и create/edit wizard. Он не подтверждает production readiness backend
операций. Publish/moderation, comments, rating, favorites, route files и upload
flows остаются backend-dependent и требуют runtime evidence для конкретной
задачи.

## TL;DR

Travel-домен состоит из трёх разных поверхностей:

1. list/search — `components/listTravel/`;
2. public detail — route `/travels/:param` и `components/travel/details/`;
3. create/edit wizard — routes `/travel/new`, `/travel/:id` и
   `components/travel/upsert/`.

`/travels/:param` — публичная деталь по slug/id. `/travel/:id` — редактирование,
а не detail route. Это различие обязательно сохранять в ссылках, SEO и тестах.

## Статус по поверхностям

| Поверхность | Реализация в репозитории | Что требует отдельной проверки |
| --- | --- | --- |
| Public catalog/search | pagination, filters, sorting, responsive cards | list/facets API, empty/error/stale states |
| User-owned list | auth-aware drafts/published filters | реальный user-scoped backend payload |
| Public detail | id/slug load, hero, content, map, deferred sections, SEO | API/media/comments/rating runtime и performance |
| Create/edit wizard | six steps, autosave, draft recovery, preview, publish step | upsert/upload/moderation contract и auth/access |
| Route files | list/upload/delete/download adapters | backend endpoint and multipart/download evidence |
| Embedded map | React Leaflet web / Leaflet-in-WebView native | browser and device point/card parity |

Наличие UI, adapter или mock/test path не означает, что соответствующий backend
contract развёрнут и готов на production.

## Маршруты и ownership

| Route | Route-файл | Feature owner | Назначение |
| --- | --- | --- | --- |
| `/search` | `app/(tabs)/search.tsx` | `components/listTravel/ListTravelRoute.tsx` | публичный поиск/каталог с filters и SEO |
| `/metravel` | `app/(tabs)/metravel.tsx`, `metravel.native.tsx` | `components/listTravel/ListTravelBase.tsx` | список текущего пользователя, включая auth-aware states |
| `/travelsby` | `app/(tabs)/travelsby.tsx` | `components/listTravel/ListTravelRoute.tsx` | публичный discovery/catalog surface |
| `/travels/:param` | `app/(tabs)/travels/[param].tsx` | `components/travel/details/TravelDetailsContainer.tsx` | публичная detail page по ID или slug |
| `/travel/new` | `app/(tabs)/travel/new.tsx` | `components/travel/upsert/UpsertTravelRoute.tsx` | создание travel через wizard |
| `/travel/:id` | `app/(tabs)/travel/[id].tsx` | `components/travel/upsert/UpsertTravelRoute.tsx` | загрузка и редактирование существующего travel |

Route-файлы остаются тонкими: hydration/SEO/back handling и передача управления
feature-компоненту. Data flow и business state принадлежат hooks/API слоям.

### Предпросмотр авторского черновика на web

Команда «Открыть путешествие» открывает новую вкладку с экспортированной
оболочкой `/travel/new?previewTravel=<positive numeric id>`. Адрес остаётся
`/travel/new` до первого commit React: SSR и первый клиентский render показывают
один и тот же spinner. `LazyUpsertTravelRoute.web.tsx` после commit и готовности
проверки cookie-сессии выполняет `router.replace('/travels/<id>')`, не монтируя
мастер. Ранний `history.replaceState` в HTML нарушает этот контракт (#2695).

На исходном `/travel/new` публичный hero-preloader не запускается и не создаёт
pending/target globals. Авторские детали читает существующий API-клиент с
HttpOnly cookie; анонимный GET закрытого черновика по-прежнему возвращает 404.
Публичный preload сохраняет `credentials: 'omit'`; запоздавший async-скрипт
отказывается от чтения, если его исходный target уже отличается от маршрута.
Неверный preview id оставляет обычный create flow; edit и native bridge не
используют. Регрессии: реальная SSR/hydrate-пара spinner, eligibility preload и
`e2e/travel-draft-owner-preview.spec.ts` с настоящей cookie-сессией и UI popup.

## Travel SEO metadata

Публичная деталь использует сохранённый `meta_description`, если после перевода
в обычный текст и очистки пробелов он содержит не менее 80 символов. Общий helper
`utils/seoText.js:getStoredTravelSeoDescription` ограничивает HTML-экранированное
значение бюджетом 160 символов; корректное значение в бюджете не меняется.
Здесь нет эвристик удаления эпиграфа, приветствия или маршрутной строки из тела.
Пустое, некорректное или короткое значение сохраняет прежний body/context
fallback. Пока данные статьи не загружены, клиент оставляет SSG-описание на месте.
SSG размещает три description-тега до ранних head-скриптов и помечает их
происхождение. Существующий critical-head owner сохраняет непустое значение
с этой меткой даже при совпадении с generic-prefix эвристикой; отмеченное пустое значение
и непомеченные placeholders сохраняют прежний fallback. Charset остаётся первым.

Поле проходит через `scripts/lib/travelDetail.js` и capture/replay SSG;
`generate-seo-pages.js` и travel head viewmodel используют один helper для
description/OG/Twitter. Текущая detail-мета авторитетна: пустое значение не
заменяется старой метой из списка. Article JSON-LD SSG получает уже выбранное
описание; FAQ и клиентские body-derived structured data сохраняют своих владельцев.
Название, canonical, URL и тело статьи этот выбор не меняет. Editorial content
не переводится клиентом; app-owned i18n keys не добавляются.

Регрессии: `__tests__/utils/seoText.test.ts`, `__tests__/scripts/generate-seo-pages.test.ts`,
`__tests__/scripts/seo-inputs-capture.test.ts`,
`__tests__/components/travel/travelDetailsContainerViewModel.test.ts` и
`__tests__/app/html.head-fallback.test.ts` (настоящий critical-script и порядок парсинга).
Для metadata-only редакторской задачи достаточно разрешённого изменения поля
`meta_description`; правка лида/тела не требуется. Поле в API не подтверждает
свежесть статики: после записи нужен штатный выкат и сверка raw HTML с гидрацией.
Google может выбрать собственный сниппет; #2700 подтверждает переданную мету,
а #2658 отдельно ведёт редактуру и 28-дневный замер CTR.

## List/search architecture

| Owner | Ответственность |
| --- | --- |
| `components/listTravel/ListTravelBase.tsx` | screen-level list orchestration, auth/list mode, responsive layout |
| `components/listTravel/ListTravelRoute.tsx` | стабильный route-facing export |
| `components/listTravel/hooks/useListTravelData.ts` | paginated list queries и mutations wiring |
| `components/listTravel/hooks/useListTravelFilters.ts` | filter/query parameters |
| `components/listTravel/hooks/useListTravelInitialFilter.ts` | route/query initial state |
| `components/listTravel/hooks/useListTravelExport.ts` | list export surface |
| `components/listTravel/RenderTravelItem.tsx`, `TravelListItem.tsx` | card rendering/actions |
| `api/travelListQueries.ts` | public list, facets, random/near-location adapters |
| `api/travelUserQueries.ts` | user-scoped travels, drafts/published status filtering |

List mode определяется route/path context. Public list по умолчанию фильтрует
publish/moderation, а user-owned запросы могут включать drafts только при
подтверждённом auth path.

### Первый кадр desktop-фильтров (#2765)

На web от 1440 px первые две группы открыты уже при появлении боковой
панели. `ListTravelBase` передаёт известную ширину через `SidebarFilters`
в `ModernFilters`: собственный hydration-safe snapshot дочернего компонента
не должен повторно создавать узкий кадр. При настоящем SSR без известной
ширины сохраняется безопасный нулевой snapshot.

Design evidence: нормативные состояния этой панели — загрузка пустого
справочника, готовые строки, ручное сворачивание и мобильный overlay.
В загрузке раскрытая группа содержит нейтральный каркас с геометрией
`filterOption` (44 px и обычный межстрочный отступ). Пока число строк
неизвестно, каркас занимает как минимум высоту viewport: следующие заголовки
монтируются после ответа на итоговых местах. Они не должны заранее существовать
в обрезанной области: перенос таких узлов в viewport Chrome считает сдвигом
даже при коротком ответе справочника. Готовые данные при обновлении
не заменяются каркасом. На 390/1280 и native начальные группы свёрнуты.

Постоянный контроль: Jest `ModernFilters` проверяет известную ширину
родителя при нулевом snapshot, загрузку и сохранение ручного выбора;
`e2e/search-filter-first-frame.spec.ts` — первый кадр `/search` и CLS ≤0,01.
Production-приёмка: 390 → 1280 → 1440, первый и готовый кадр,
console/network и отсутствие `filter-scrollview` среди источников сдвига.

## Public detail architecture

| Owner | Ответственность |
| --- | --- |
| `components/travel/details/TravelDetailsContainer.tsx` | critical/deferred shell composition, SEO, history, error/loading states |
| `hooks/travel-details/index.ts` | агрегирует data/layout/navigation/performance/menu/scroll hooks |
| `hooks/useTravelDetails.ts` | route param, id/slug query, preload/stale-data integration |
| `api/travelDetailsQueries.ts` | detail by id/slug, resolver/fallback/cache policy |
| `TravelDetailsCriticalShell.tsx`, `TravelDetailsHero.tsx` | first-screen hero/content shell |
| `TravelDetailsDeferredRuntimeSlot*`, `TravelDetailsDeferred*` | map, points, comments и другие тяжёлые sections |
| `sections/TravelDetailsMapSection.tsx`, `TravelRouteMapBlock*` | embedded map/route line composition |
| `components/MapPage/TravelMap.web.tsx`, `TravelMap.native.tsx` | platform renderers встроенной travel-карты |

Секция «Экскурсии» (`sections/ExcursionsSection.tsx`) и пункт навигации `excursions`
из `components/travel/sectionLinks.ts` гейтятся ОДНИМ предикатом
`canRenderBelkrajWidget(travel.travelAddress, travel.countryCode)`
(`components/belkraj/belkrajAvailability.ts`: координаты первой точки + production +
страна из allowlist `SUPPORTED_BELKRAJ_COUNTRIES`). Секция показывается для любой
страны каталога партнёра (не только BY), а реальный `countryCode` уходит в URL
виджета — без верного кода tripvenue промахивается городом даже по поддержанной
стране. Подробнее про allowlist и подмену города — `docs/features/quests.md`.

### Belkraj на Android и iPhone

На Android `BelkrajWidget.android.tsx` показывает сами экскурсии: фото слева
(104 dp), название, описание и рейтинг справа, ниже — ссылка на весь каталог
этого места. Источник — тот же `buildBelkrajWidgetUrl` с координатами первой
точки, реальной страной и постоянным партнёрским id. `belkrajNativeData.native.ts`
получает HTML без credentials и извлекает только поля карточек; HTML, GTM,
скрипты и iframe не исполняются. Изображения ограничены HTTPS-фотографиями
экскурсий на известных доменах партнёра. Нажатия открывают конкретную экскурсию
или каталог через `openExternalUrl`.

Парсер расположен в `.native.ts`; Android подключает его нейтральным импортом,
а web и iPhone выбирают свои варианты виджета без этого парсера. Проверка состава
web-бандла следует платформенному разрешению и всем локальным value-рёбрам,
включая динамические: явный импорт native-файла из web не скрывает `htmlparser2`
от контроля. Type-only импорты не являются runtime-рёбрами.

Design evidence: вертикальные строки соответствуют mobile-layout партнёра;
компонент использует `ImageCardMedia` с contain/blur, тему приложения и свободную
высоту текста. Загрузка показывает skeleton, ошибка/пустой или изменившийся
документ — сообщение с повтором; дедлайн 15 секунд включает чтение ответа.
Смена точки и выход отменяют запрос, карточки предыдущего места не остаются.
Проверка на Android: travel и шаг квеста, BY/PL, светлая/тёмная тема, крупный
шрифт, ошибка/повтор и переход на выбранную экскурсию (`AND-USB-31`).

На iPhone сохраняется `BelkrajWidget.native.tsx`: ссылка «Экскурсии рядом с этим
местом» открывает в браузере ту же подборку с координатами/страной, которую
показывает web. Это не главная страница Belkraj. Решение #2135 сохраняет
сторонний документ и его трекеры за пределами iPhone-приложения.

Инвариант: **на web и Android** пункт меню существует ровно
там, где секция рендерится. Разъезд даёт либо пустую карточку-призрак с одним
заголовком, либо живую ссылку в никуда — оба состояния уже ловились (#1452). Регресс
закрыт с обеих сторон: `__tests__/components/travel/sectionLinks.test.ts` (сторона
ссылки) и `__tests__/components/travel/ExcursionsSection.gate.test.tsx` (сторона
секции) — иначе замена условия в одном месте прошла бы зелёной.

Известное исключение: сам пункт навигации ограничен `platform === "web" || "android"`
(`sectionLinks.ts`), тогда как секцию `TravelDetailsMapSection` рендерит на всех
платформах. На iOS секция видна, а пункта в списке секций нет — дореформенное
поведение, к гейту Belkraj отношения не имеет; трогать его нужно отдельной задачей.

Detail data может загружаться по numeric ID или slug. Web direct-load path также
учитывает preload из `app/+html.tsx`; SPA navigation не должна ждать stale preload
другого travel. Recoverable public errors могут читать stale payload, поэтому
runtime-проверка должна различать свежий backend response и stale fallback.

### Hero/media contract

- Web hero/slider media сохраняет стабильную геометрию `70vh`.
- Main image, blurred surround и slider chrome появляются как единый первый
  визуальный state после готовности runtime; interaction-gated activation не
  используется.
- Изменения slider/details/media обязаны проходить обе стороны bilateral
  contract: `npm run verify:slider` и `npm run verify:slider-perf`, с запуском
  через общий quality-gate lock по `docs/RULES.md`.

## Create/edit wizard architecture

| Owner | Ответственность |
| --- | --- |
| `components/travel/upsert/UpsertTravelRoute.tsx` | focus gate и form error boundary |
| `components/travel/UpsertTravel.tsx` | SEO wrapper и controller/view composition |
| `components/travel/upsert/useUpsertTravelController.ts` | auth/access, form data, filters, draft recovery, wizard state |
| `components/travel/upsert/UpsertTravelView.tsx` | loading/error/access states и wizard chrome |
| `components/travel/upsert/WizardStepRouter.tsx` | выбор одного из шести step components |
| `hooks/useTravelFormData.ts` | load/save/upsert, marker/media state и autosave contract |
| `hooks/useTravelWizard.ts` | step navigation, validation и publish transition |
| `hooks/useDraftRecovery.ts` | local draft persistence/recovery |

Шаги wizard:

1. `TravelWizardStepBasic.tsx`;
2. `TravelWizardStepRoute.tsx`;
3. `TravelWizardStepMedia.tsx`;
4. `TravelWizardStepDetails.tsx`;
5. `TravelWizardStepExtras.tsx`;
6. `TravelWizardStepPublish.tsx`.

### Вход в авторство из статьи (#2677)

Общее приглашение рядом с гостевым CTA сохранения открывает `/travel/new` с
ограниченным контекстом `source_travel_id`, `country`, `place`; все переходы через
регистрацию и вход сохраняют этот адрес. Автор исходной статьи приглашения не видит.
Нормативные состояния и responsive-макет:
`docs/design/travel-article-share-trip-2677.md`.

Имя места (город, затем первая именованная точка) становится редактируемым `name`;
страна точно сопоставляется существующему каталогу и редактируется на первом шаге
этого сценария. Исходные текст, фото и координаты не копируются. Контекст не
расширяет backend payload и не подменяет источник аналитического провайдера.
Одноразовое предзаполнение входит в чистую baseline до autosave; восстановленный
черновик, редактирование существующей поездки и пользовательский ввод имеют
приоритет. Обычные входы в мастер сохраняют прежнее поведение.

### Media upload contract

- Desktop web сохраняет drag-and-drop как дополнительный способ загрузки
  обложки и фотографий галереи; выбор через системный file picker остаётся
  доступным по нажатию.
- Mobile web и Android используют touch-first действия в одинаковом порядке:
  `Выбрать из галереи`, затем `Сделать фото`. На мобильных поверхностях не
  показываются desktop-инструкции про перетаскивание файлов и большая dropzone.
- Mobile web camera action использует системный image input с
  `capture="environment"`; Android использует `expo-image-picker` и штатные
  media-library/camera permissions. Отмена picker не считается ошибкой.
- Нормативные состояния: idle, selecting/cancelled, uploading/progress,
  success, permission denied, validation/upload error, existing image/remove.
  Подписи, ошибки и accessibility labels локализуются в RU/BE/UK/PL/EN.
- Upload data contract не зависит от платформы: реальный файл отправляется в
  текущий multipart `uploadImage` flow с `file`, `collection` и `id`; preview
  или mock не подменяет серверную загрузку после появления travel/point id.

Create flow синхронизирует выданный backend ID в route params после первого
успешного save. Draft recovery не заменяет server save и не является
подтверждением publish/moderation.

### Media upload contract

- Desktop web сохраняет drag-and-drop и выбор файлов для обложки и галереи.
- Mobile web и Android используют touch-first действия в одном порядке:
  «Выбрать из галереи», затем «Сделать фото»; drag-and-drop copy и большая
  desktop dropzone на этих поверхностях не показываются.
- Mobile web gallery input использует `accept="image/*"`, camera input —
  `accept="image/*"` и `capture="environment"`; Android использует
  `expo-image-picker` с gallery/camera permission paths.
- Нормативные состояния: idle, selecting/cancelled, uploading/progress,
  success, permission denied, validation/upload error и existing image/remove.
- Multipart upload contract не меняется: `file`, `collection`, `id`; gallery
  maxImages, delete и reorder сохраняют существующие API shapes.

## Data/API ownership

Server state хранится в React Query и использует централизованные query keys.
Zustand/context остаются для client/UI state.

| Module | Endpoint family / role |
| --- | --- |
| `api/travelListQueries.ts` | `GET /api/travels/`, `/facets/`, `/random/`, `/near-location/` |
| `api/travelUserQueries.ts` | `GET /api/travels/` с user/status `where` contract |
| `api/travelDetailsQueries.ts` | `/api/travels/{id}/`, `/by-slug/{slug}/`, `/resolve-slug/{slug}/` |
| `api/misc.ts`, `api/miscOptimized.ts` | `GET /api/getFiltersTravel/` — семь массивов `{ id: number, name: string }` плюс `sortings`; страны отдельно из `/countriesforsearch/` или `/countries/` как `{ country_id: number, title_ru: string }` |
| `api/misc.ts` | `PUT /api/travels/upsert/` |
| `api/travelsMutations.ts` | `DELETE /api/travels/{id}/` |
| `api/travelsFavorites.ts` | mark/unmark favorite actions |
| `api/travelRating.ts` | travel rating POST и user-rating lookup |
| `api/comments.ts` | `/api/travel-comments/` tree/CRUD/like/reply |
| `api/travelRoutes.ts` | `/api/travels/{id}/routes/` list/upload/delete/download |
| `api/instagramPublish.ts` | optional Instagram publish integration |

### Social publish UI contract

Шаг 6 wizard использует одну карточку публикации для owner/admin и не смешивает
две разные операции:

- Instagram action публикует подготовленную галерею и caption в подключённый
  Instagram Business account;
- Facebook action публикует link-post на зафиксированную сервером Metravel Page:
  текст поста плюс canonical URL сохранённой статьи `/travels/{slug}`; preview
  берётся из Open Graph страницы, а Page ID не редактируется и не передаётся
  клиентом.

Normative states для обеих actions на desktop web, mobile web, Android и iPhone:
`idle`, `connecting`,
`publishing`, `published`, `already_published`, `not_connected`, `error`.
Используются существующие `Button`/Feather primitives; видимые подписи и
accessibility labels локализуются в RU/BE/UK/PL/EN. Facebook action остаётся
скрытой до появления подтверждённого backend capability, чтобы UI не предлагал
неработающую публикацию. Токены Meta, app secret и целевой Page ID принадлежат
backend-конфигурации и никогда не попадают в frontend bundle или request body.

`getFiltersTravel` не содержит `countries` или `year`: `countries` объединяются
клиентом только после отдельной runtime-валидации country endpoint, а `year`
остаётся пользовательским selection/input state. Невалидный обязательный массив
или item не считается пустым успешным справочником и должен попасть в query
error/retry path; кэшировать можно только последнюю валидную структуру.

### Backend-dependent границы

- `publish`, `moderation` и `enforce_moderation_validation` должны проверяться
  реальным upsert response, а не только состоянием формы;
- point/media upload завершается только после server IDs и upload response;
- comments/rating/favorites требуют auth/error/empty evidence;
- route file preview/upload/download зависит от server multipart/parser contract;
- stale public cache обеспечивает degraded read, но не подтверждает свежесть API;
- optional external/Instagram/Telegram integrations не считаются готовыми без
  configuration и runtime evidence.

Frontend не должен маскировать отсутствующий backend contract permissive mock
fallback. Backend blockers оформляются как `area=back` задачи.

## Client state

| Owner | Роль |
| --- | --- |
| React Query | lists, detail, facets, ratings, route files и server mutations |
| `hooks/useFavoritesData.ts` | favorites cache/sync (React Query, #994) |
| `hooks/useRecommendedTravels.ts` | recommendations cache (React Query, #994) |
| `hooks/useViewHistory.ts` | история просмотров (React Query, #994) |
| `stores/travelSectionsStore.ts` | commands для detail sections |
| `stores/travelStatusStore.ts` | `visited/planned/wishlist` и calendar state |
| wizard hooks/component state | текущий step, draft/autosave, local form/media state |

## Route points и map contract

- Detail point cards и `/map` используют общий point/place content/action model
  там, где это возможно.
- Клик по point card или изображению фокусит и поднимает marker, но не открывает
  popup автоматически; popup открывает явный marker tap.
- Web embedded map использует React Leaflet; native embedded map — Leaflet в
  WebView. Это отдельные adapters от основной `/map`, поэтому parity проверяется
  отдельно.
- Координаты доступны для copy, internal detail/article links остаются internal,
  external navigation проходит через centralized link helpers.
- Navigation set: Google Maps, Apple Maps, Organic Maps, Waze, Яндекс Карты,
  Яндекс Навигатор, OpenStreetMap.
- Travel status виден текстом: `Был здесь`, `Хочу поехать`, `Планирую`.

Канонические UI-правила находятся в [docs/RULES.md](../RULES.md), map ownership —
в [map feature map](./map.md).

## Проверки по scope

Ближайшие test surfaces:

- list: `__tests__/components/listTravel/`,
  `__tests__/api/fetchTravels.userScoped.test.ts`;
- detail: `__tests__/components/travel/TravelDetails*`,
  `__tests__/hooks/useTravelDetails*`, `__tests__/api/travels*.test.ts`;
- wizard: `__tests__/components/travel/TravelWizard*`,
  `__tests__/components/travel/UpsertTravel*`;
- map/route points: `__tests__/components/travel/TravelDetailsMapSection.test.tsx`,
  `__tests__/components/travel/TravelRouteMapBlock.test.tsx`,
  `__tests__/components/travel/TravelMap.native.test.tsx`;
- browser: `e2e/travel-detail-page.spec.ts`,
  `e2e/travel-full-flow.spec.ts`, `e2e/travel-crud.spec.ts`,
  `e2e/travel-wizard.spec.ts`, `e2e/travel-route-line.spec.ts`.

Минимальный выбор проверки:

- docs-only изменение: structural Markdown/link/path check;
- list/detail/wizard logic: ближайшие targeted Jest tests +
  `npm run check:fast`;
- visible web flow в `testing`: browser screenshot + console/network check;
- route-point native behavior в `testing`: локальная Android build/install и device flow;
- travel hero/slider/media: `npm run verify:slider` и
  `npm run verify:slider-perf` через общий quality-gate lock;
- medium/cross-cutting change: code-level checks до review;
  `npm run check:preflight` после review в `testing` и operation gate.

## Технический долг

- Актуальные oversized hotspots и порядок extraction живут в
  complexity guard и MCP task board, а не дублируются моментальными LOC в этом
  файле.
- `ListTravelBase`, recommendations, slider/publish/point-list modules требуют
  постепенного behavior-preserving split по ownership, а не переписывания всего
  travel flow.
- Embedded travel map и основная map-фича повторяют часть marker/WebView/resize
  logic; shared DTO/escaping нужно расширять без слияния platform renderers.
- Jest coverage всё ещё исключает часть map/editor/media surfaces; coverage gap
  не следует путать с отсутствием targeted tests.
- Backend-dependent publish/moderation/media/comments/rating/route-file paths
  должны закрываться adapter tests и реальным API evidence.

## Performance contract

- [Travel details performance contract](../TRAVEL_PERFORMANCE_REFACTOR.md)
  фиксирует текущие hero/loading/bundle gates без исторического iteration log.
- Любые Lighthouse цифры считаются актуальными только для указанной даты,
  production build или real URL.

## Связанные документы

- [Архитектура и функциональность](../ARCHITECTURE.md)
- [Project rules](../RULES.md)
- [Testing guide](../TESTING.md)
- [Map feature map](./map.md)
- [Calendar feature map](./calendar.md)
