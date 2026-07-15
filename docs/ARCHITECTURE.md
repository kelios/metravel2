# Архитектура и функциональность Metravel

Актуально на: 2026-07-15.

Этот документ описывает архитектуру локального репозитория `metravel2`, основные
слои приложения, пользовательский функционал, frontend-модули и интеграцию с
backend API.

Важная граница: в этом репозитории находится Expo / React Native / React Native
Web приложение. Исходного кода backend-сервера здесь нет. Поэтому разделы про
backend описывают не внутреннюю серверную реализацию, а API-контракты, клиентские
модули, нормализацию DTO, mock/fallback-логику и ожидания фронта.

## Статус И Границы Документа

Документ объединяет три представления проекта:

- фактическую архитектуру frontend/app из текущего `main`;
- карту реализованной пользовательской функциональности;
- результаты статического, quality и frontend-security аудита от 2026-07-14 с
  приоритетами дальнейших работ.

Срез сделан по общему рабочему дереву с параллельными изменениями в i18n, map,
travel, profile, quests, scripts и tests. Аудит не присваивает эти изменения
одной задаче: выводы и Done-решения опираются на фактическое состояние дерева в
момент конкретной проверки и на evidence в task board.

Что подтверждено этим аудитом:

- структура и связи frontend-модулей;
- наличие route/component/hook/API/store/test реализаций;
- TypeScript, ESLint, governance, design и image guards;
- production API contract matrix для backend-dependent frontend adapters (#919);
- статический security-pass по auth redirects, token storage, rich text,
  external URLs, WebView и tracked secret-like files;
- dependency audit уровня high/critical и reachability triage остатка;
- Android debug artifact/install/smoke для удаления native analytics secret (#921);
- полный Jest baseline: 827 suites, 6 634 tests, 0 failures;
- production-style UI audit 202 состояний; найденные hydration/a11y регрессии
  вынесены в #938 и #939, поэтому сам факт аудита не означает browser-ready.

Что этим аудитом не подтверждено:

- deployment новой HttpOnly-cookie frontend реализации в production;
- Lighthouse и fresh production performance baseline;
- закрытие browser hydration/a11y регрессий #938/#939;
- iOS device readiness;
- production headers, CSP, server paths и runtime health.

Наличие frontend-кода и unit-тестов ниже не означает автоматически, что связанный
backend endpoint задеплоен и проверен в production. Для таких областей статус
прямо помечен как `backend-dependent` или `partial`.

## Репозиторий В Цифрах

| Область | Текущий срез |
| --- | ---: |
| Route/app files | 68 |
| Components | 887 |
| Hooks | 128 |
| API modules | 63 |
| Services | 76 |
| Utils | 176 |
| Stores / contexts | 12 / 6 |
| Product-code LOC в `app/components/screens/hooks/services/api/stores/context/utils` | 284 541 |
| Jest files / suites в полном прогоне | 829 / 827 |
| Playwright spec files | 99 |
| Repository scripts | 420 |

LOC — механический line count, не оценка качества. Он показывает масштаб
поддержки и объясняет, почему изменения в map, travel, PDF и root runtime должны
делаться поэтапно, а не через большой rewrite.

## Карта Проекта

| Область | Что это | Основные файлы |
| --- | --- | --- |
| Runtime приложения | Expo Router приложение для web, iOS и Android | `entry.js`, `app/_layout.tsx`, `app/(tabs)/_layout.tsx` |
| Frontend UI | React Native компоненты, web-варианты, фичевые блоки | `components/`, `screens/` |
| Доступ к данным | API-клиенты, query keys, нормализация ответов | `api/`, `utils/resolveApiBaseUrl.ts` |
| Server state | TanStack Query cache и мутации | `api/queryClient.ts`, `utils/reactQueryConfig.ts`, `hooks/*Api.ts` |
| Client state | Auth, избранное, история, карта, статусы поездок, маршруты | `stores/`, `context/` |
| Общая логика | Валидация, SEO, external links, медиа, карты, экспорт | `utils/`, `services/` |
| Дизайн-система | Токены, цвета, layout-константы, CSS-переменные | `constants/designSystem.ts`, `app/global.css` |
| Проверки | Jest, Playwright, governance guards, selective checks | `__tests__/`, `e2e/`, `scripts/` |
| Native shell | Сгенерированные iOS/Android проекты и EAS-конфиг | `ios/`, `android/`, `app.json`, `eas.json` |
| Документация | Правила, workflow, feature maps, release/testing docs | `docs/` |

## Технологический Стек

| Слой | Технологии |
| --- | --- |
| Framework | Expo SDK 57, Expo Router 57, React 19.2, React Native 0.86 |
| Web | React Native Web, Metro web bundler, static export в `dist/prod` |
| Native | Expo iOS/Android сборки через EAS |
| Язык | TypeScript 6 strict mode, alias `@/*` на корень репозитория |
| Server state | `@tanstack/react-query` |
| Client state | Zustand stores + React contexts |
| Локализация | i18next, react-i18next, expo-localization, Intl |
| Карты | Leaflet/OpenStreetMap на web; Leaflet внутри `react-native-webview` для основной native-карты |
| Rich text | `react-native-render-html`, Quill editor на web |
| Медиа | `expo-image`, upload helpers, CDN/media URL normalization |
| Auth storage | Native: `expo-secure-store`; web source: backend-managed HttpOnly cookie без JS token; deployed production ещё требует обновления и reload identity contract (#923/#937) |
| Тесты | Jest/JSDOM, Jest Expo preset, Playwright Chromium |
| Build/deploy | `npm run build:web:prod`, `build-prod.sh`, EAS scripts |

## Запуск Приложения

```text
entry.js
  -> web/native polyfills и startup guards
  -> expo-router entry
  -> app/+html.tsx для web document shell
  -> app/_layout.tsx
  -> AppProviders
  -> app/(tabs)/_layout.tsx
  -> экран из app/(tabs)/*
```

### `entry.js`

`entry.js` выполняется до загрузки React-модулей. В нем находятся ранние runtime
патчи:

- защита web от повторной регистрации `Object.defineProperty(..., "default")`;
- polyfills для старых Safari: `structuredClone`, `Object.hasOwn`, `.at()`,
  `.findLast()`;
- native-only инициализация `react-native-gesture-handler`;
- worklet/timestamp shims;
- узкие console-фильтры для известных шумных startup-сообщений.

### `app/+html.tsx`

Web document shell отвечает за pre-hydration поведение:

- fallback title/description/OG для важных публичных маршрутов;
- inline analytics wiring для GA/Yandex при наличии env vars;
- critical CSS и root visibility gate;
- storage hardening для Safari private / blocked-storage режимов;
- legacy redirect для старых query-param маршрутов;
- production preload bootstrap для travel hero на страницах `/travels/*`.

### `app/_layout.tsx`

Корневой layout держит app-wide runtime:

- подключает `app/global.css` на web и применяет web style patches;
- ставит chunk-load recovery для устаревших route chunks после deploy;
- создает mounted React Query client через `createOptimizedQueryClient`;
- прокидывает QueryClient в non-hook код через `setActiveQueryClient`;
- оборачивает приложение в `ThemeProvider`, `ErrorBoundary`, `AppProviders`;
- управляет native splash/font readiness и native status bar;
- решает, когда показывать global footer/dock/header chrome;
- откладывает часть web chrome на performance-sensitive travel routes.

### `components/layout/AppProviders*`

Provider tree:

```text
LocaleProvider
  -> ThemedPaperProvider
    -> AuthProvider или fallback AuthContext
      -> FavoritesProvider или fallback FavoritesContext
        -> QueryClientProvider
          -> route subtree
```

На native провайдеры монтируются напрямую. На web есть механизм deferred runtime,
но travel details держит auth/favorites providers mounted, чтобы не перемонтировать
весь route subtree и не проигрывать skeleton повторно.

### Локализация

`i18next` и `react-i18next` управляют интерфейсными переводами, а
`expo-localization` даёт системную локаль на native с безопасным Intl fallback.
Первый web-render детерминирован: static SSR использует default locale, клиент
гидратирует локаль из уже отданного `<html lang>`, а сохранённое или системное
предпочтение применяется `LocaleProvider` только после hydration. Это не даёт
добавлению второго языка создать расхождение server/client markup.
`i18n/config.ts` хранит registry языка (BCP 47 tag, HTML lang,
OpenGraph locale, direction и язык геокодера), `LocaleProvider` синхронизирует
активный язык и versioned AsyncStorage preference, а `i18n/format.ts` централизует
Intl-форматирование.

Русские ресурсы в `i18n/locales/ru/` — канонический key contract. Доменные
namespace разделяют travel, map, profile, achievements, quests, trips, legal, SEO
и shared UI. Ключи типизированы через `types/i18next.d.ts`; неизвестный ключ не
должен попадать пользователю и заменяется контролируемым fallback.

Для текущего одноязычного production web русский baseline компилируется в места
использования ключей, а лёгкие `i18n/*.web.ts(x)` сохраняют interpolation, plural
rules и locale lifecycle без доставки всего каталога на каждую страницу. Native и
тестовый runtime по-прежнему инициализируют полный i18next. При появлении второго
production-языка compile-time web-режим заменяется вместе с locale URL/hreflang
архитектурой, а не расширяется ещё одним eager-каталогом.

Граница локализации проходит между app-owned UI copy и данными. Переводятся
подписи, accessibility text, validation, toast/error, empty states, legal/SEO/PDF
UI и отображаемые справочники. Не переводятся пользовательские/редакторские тексты
из API, quest/travel/article prose, комментарии, названия мест, search aliases и
стабильные backend codes. Такие значения показываются как пришли с сервера, а
будущая серверная локализация требует отдельного content-locale/API-контракта.

## Маршруты И Экраны

Expo Router строит маршруты по файлам в `app/`. `app/(tabs)/_layout.tsx`
отключает стандартный tab bar и рендерит кастомный header/dock. Большинство
экранов адресуемы, но скрыты из визуального tab bar.

| Route | Файл | Назначение |
| --- | --- | --- |
| `/` | `app/(tabs)/index.tsx` | Главная, SEO shell, discovery entry points |
| `/search` | `app/(tabs)/search.tsx` | Поиск и фильтрованный список путешествий |
| `/metravel` | `app/(tabs)/metravel.tsx` | Каталог/лента путешествий |
| `/travels/:param` | `app/(tabs)/travels/[param].tsx` | Детальная страница путешествия по slug/id |
| `/travelsby` | `app/(tabs)/travelsby.tsx` | Авторский/user-scoped список путешествий |
| `/travel/new` | `app/(tabs)/travel/new.tsx` | Wizard создания путешествия |
| `/travel/:id` | `app/(tabs)/travel/[id].tsx` | Wizard редактирования/upsert |
| `/map` | `app/(tabs)/map.tsx`, `map.web.tsx` | Интерактивная карта, фильтры, radius/route search |
| `/places` | `app/(tabs)/places.tsx` | Каталог отдельных точек из map travel points |
| `/articles` | `app/(tabs)/articles.tsx` | Список статей |
| `/article/:id` | `app/(tabs)/article/[id].*.tsx` | Статья/редактор с platform variants |
| `/quests` | `app/(tabs)/quests/index.tsx` | Каталог квестов |
| `/quests/map` | `app/(tabs)/quests/map.tsx` | Карта квестов |
| `/quests/:city/:questId` | `app/(tabs)/quests/[city]/[questId].tsx` | Детали квеста и wizard прохождения |
| `/trips` | `app/(tabs)/trips/index.tsx` | Каталог публичных совместных поездок |
| `/trips/my` | `app/(tabs)/trips/my.tsx` | Мои заявки/состояние social trips |
| `/trips/:id` | `app/(tabs)/trips/[id].tsx` | Детальная страница публичной поездки |
| `/trips/community` | `app/(tabs)/trips/community.tsx` | Каталог community routes |
| `/trips/plan` | `app/(tabs)/trips/plan/index.tsx` | Мои planned trips |
| `/trips/plan/create` | `app/(tabs)/trips/plan/create.tsx` | Создание planned trip |
| `/trips/plan/:id` | `app/(tabs)/trips/plan/[id].tsx` | Route builder, RSVP, chat, report |
| `/profile` | `app/(tabs)/profile.tsx` | Профиль текущего пользователя |
| `/user/:id` | `app/(tabs)/user/[id].tsx` | Публичный профиль пользователя |
| `/favorites` | `app/(tabs)/favorites.tsx` | Избранные путешествия |
| `/history` | `app/(tabs)/history.tsx` | История просмотров |
| `/calendar` | `app/(tabs)/calendar.tsx` | Персональный календарь статусов поездок |
| `/userpoints` | `app/(tabs)/userpoints.tsx` | Импортированные/saved points и KML workflows |
| `/messages` | `app/(tabs)/messages.tsx` | Личные сообщения |
| `/subscriptions` | `app/(tabs)/subscriptions.tsx` | Подписки и подписчики |
| `/settings` | `app/(tabs)/settings.tsx` | Настройки профиля, темы, Strava, данных |
| `/privacy-settings` | `app/privacy-settings.tsx` | Privacy matrix |
| `/security-journal` | `app/security-journal.tsx` | Журнал безопасности |
| `/login`, `/registration`, `/set-password` | `app/(tabs)/*` | Auth flows |
| `/about`, `/contact`, legal routes | `app/(tabs)/about.tsx`, `app/contact.tsx`, legal pages | Статические/product/legal страницы |
| `/roulette` | `app/(tabs)/roulette.tsx` | Случайная идея путешествия |
| fallback | `app/[...missing].tsx`, `app/error.tsx` | Missing/error screens |

## Ответственность Слоев

### `app/` - слой маршрутов

Route-файлы должны оставаться тонкими. Они выбирают SEO metadata, auth gates,
skeleton/error state и корневой feature component. Сложный UI должен жить в
`components/` или `screens/`; бизнес-логика и data-flow - в `hooks/`, `api/`,
`stores/`, `utils/`.

### `screens/` - слой композиции экранов

`screens/tabs/*` содержит крупные композиционные модули для карты, places,
quests и user points. Этот слой связывает несколько feature-компонентов, но не
должен превращаться в транспортный API-слой.

### `components/ui/` - переиспользуемые примитивы

Перед созданием нового UI сначала проверяй `components/ui`:

- `Button`, `IconButton`, `Chip`, inputs, toggles, selection controls;
- media primitives, включая `ImageCardMedia`;
- skeletons, empty/error states, pagination, rating, modals;
- web helpers для contained media и blur backdrops.

Правило проекта: сначала переиспользовать существующие примитивы, потом
добавлять новый компонент, если переиспользование не подходит.

### Фичевые папки компонентов

Крупные фичевые папки:

- `components/home/` - секции главной/discovery.
- `components/listTravel/` - список путешествий, фильтры, карточки,
  пагинация, search UX.
- `components/travel/` - детали путешествия, upsert wizard, галерея, route
  points, hero, slider, status/favorite actions.
- `components/MapPage/` - map shell, Leaflet web map, native WebView map,
  фильтры, route builder, markers, popups, mobile/desktop layouts.
- `components/places/` - UI каталога places.
- `components/article/` - список/деталь/редактор статей, web Quill surface,
  native editor fallback.
- `components/quests/` - quest detail, wizard, maps, printable/offline helpers,
  rating/review/finale UI.
- `components/trips/` - public trips catalog, заявки, planned trips, route
  builder, RSVP, participant communication.
- `components/profile/`, `components/settings/`, `components/subscriptions/`,
  `components/messages/` - account/social surfaces.
- `components/UserPoints/` - imported points, KML/KMZ import/export, map,
  bulk operations.
- `components/export/` - PDF/book settings и theme selectors.
- `components/seo/` - runtime SEO helpers.

### `hooks/` - слой focused behavior

Hooks изолируют поведение фич от route/components:

- API hooks: `useQuestsApi`, `usePlannedTripsApi`, `usePublicTripsApi`,
  `useMessages`, `useAchievementsApi`;
- travel hooks: `useTravelDetails`, `useTravelWizard`, `useTravelFormData`,
  `useTravelRouteFiles`, `useTravelRating`;
- map hooks в `hooks/map/`: `useMapDataController`, `useMapFilters`,
  `useMapTravels`, `useRouteController`;
- account hooks: `useUserProfile`, `useSubscriptionsData`,
  `usePrivacySettings`, `useSecurityJournal`;
- platform/runtime hooks: `useResponsive`, `useTheme`, `useAndroidBackHandler`,
  `usePushNotifications.*`, `useBiometricAuth`.

Hook должен иметь одну понятную ответственность и стабильный public contract.

### `api/` - слой интеграции с backend

`api/` - backend-facing слой frontend-приложения. Он не содержит серверный код.

Ключевые модули:

- `api/apiConfig.ts` и `utils/resolveApiBaseUrl.ts` резолвят base API URL.
  Значение из env нормализуется до suffix `/api`; local web/E2E может ходить
  через same-origin `/api`.
- `api/client.ts` - authenticated client. Он добавляет `Authorization: Token`,
  CSRF headers, timeouts, token refresh, локальный rate limiter, upload/download
  helpers и auth invalidation при невосстановимых token errors.
- `api/queryKeys.ts` - единый список React Query keys. Новые server-state
  запросы должны использовать существующие ключи или добавлять typed key сюда.
- `api/queryClient.ts` создает shared QueryClient.
- `api/parsers/*`, `api/travelsNormalize.ts` и feature-specific mappers
  нормализуют разные backend shapes.

Доменные API-модули:

| Module | Ответственность |
| --- | --- |
| `api/auth.ts` | login/logout/registration/password reset/Google auth/push token |
| `api/user.ts` | profile, avatar, favorites/history/recommendations, travel statuses, subscriptions |
| `api/travelListQueries.ts` | travel list, facets, random travels |
| `api/travelDetailsQueries.ts` | travel details by id/slug, direct API preload, slug fallback |
| `api/travelUserQueries.ts` | authored travels пользователя |
| `api/travelsFavorites.ts`, `api/travelsMutations.ts` | favorite и delete mutations |
| `api/travelRoutes.ts` | route-file list/upload/delete/download |
| `api/travelRating.ts`, `api/articleRating.ts` | рейтинги |
| `api/comments.ts` | travel comments and threads |
| `api/map.ts` | map travels, near-route search, popular/month travels, map filters |
| `api/places.ts` | places catalog из map travel points |
| `api/articles.ts` | article list/detail, id/slug fallback |
| `api/quests.ts`, `api/questRating.ts`, `api/questReview.ts` | quest catalog/bundle/progress/reviews/ratings |
| `api/plannedTrips.ts` | planned trips, route builder, RSVP, invitations, suggestions, reports |
| `api/publicTrips.ts` | public trip catalog, applications, notifications |
| `api/tripChat.ts`, `api/tripTelegramGroup.ts`, `api/telegramLink.ts` | trip communication и Telegram |
| `api/messages.ts` | direct messages с lightweight auth fetch helper |
| `api/userPoints.ts` | imported points, KML/KMZ import/export, route calculation, recommendations |
| `api/achievements.ts`, `api/gamification.ts` | badges, rare awards, progression, character path |
| `api/privacy.ts`, `api/userSafety.ts`, `api/contactRequests.ts` | privacy, data ownership, reports/blocks/contact access |
| `api/strava.ts` | Strava integration |
| `api/misc.ts`, `api/miscOptimized.ts` | uploads, filters, countries, feedback, AI chat |
| `api/external/*` | Nominatim, Overpass, ORS, OSRM, Valhalla, BigDataCloud external calls |

### `stores/` и `context/` - client state

React Query отвечает за server state. Zustand/context отвечают за локальное UI
состояние и persisted client state.

| Store/context | Ответственность |
| --- | --- |
| `stores/authStore.ts` + `context/AuthContext.tsx` | auth readiness, login/logout, profile bootstrap, auth invalidation |
| `stores/favoritesStore.ts` + `context/FavoritesContext.tsx` | favorites cache and sync |
| `stores/viewHistoryStore.ts` | local/server view history |
| `stores/recommendationsStore.ts` | recommendation cache |
| `stores/travelStatusStore.ts` | `visited/planned/wishlist` state и calendar dates |
| `stores/mapPanelStore.ts` | состояние map panel |
| `stores/routeStore.ts` | route builder state |
| `stores/listViewStore.ts` | density/view preferences списка |
| `stores/searchHistoryStore.ts` | search history |
| `stores/travelSectionsStore.ts` | commands для секций travel details |
| `stores/bottomSheetStore.ts` | bottom-sheet state |
| `context/FiltersProvider.tsx` | контекст travel filters |
| `context/MapFiltersContext.tsx` | контекст map filters |

### `utils/` - общие helpers

Важные зоны:

- `utils/externalLinks.ts` - обязательная точка внешней навигации. Direct
  `window.open(...)` в feature code и direct `Linking.openURL(...)` вне этой
  утилиты запрещены governance.
- `utils/seo.ts`, `utils/travelSeo.ts`, `utils/discoverySeo.ts`,
  `utils/jsonLd.ts` - canonical URLs, OG images, JSON-LD, page SEO.
- `utils/mediaUrl.ts`, `utils/imageOptimization.ts`, `utils/imageProxy.ts`,
  `utils/imageSrcSet.ts`, `utils/richTextImageLayout.ts` - media normalization.
- `utils/routeFileParser.ts`, `utils/routeExport/*`, `utils/routingHelpers.ts`
  - GPX/KML/navigator export и route parsing.
- `utils/mapWebLayers.ts`, `utils/mapWebOverlays/*`, `utils/overpass/*` -
  map overlays и external geodata.
- `utils/secureStorage.ts`, `utils/storage.ts`, `utils/storageBatch.ts` -
  persistence wrappers.
- `utils/reactQueryConfig.ts` - React Query defaults и static web prefetch.
- `utils/runtimeConfigDiagnostics.ts` - dev runtime env diagnostics.

## Потоки Данных

### Серверный state

```text
Screen/component
  -> feature hook или useQuery/useMutation
  -> queryKeys entry
  -> api/* module
  -> apiClient или fetchWithTimeout
  -> backend API at EXPO_PUBLIC_API_URL normalized to /api
  -> DTO normalization / parser
  -> React Query cache
  -> UI render
```

React Query defaults в `utils/reactQueryConfig.ts`:

- `networkMode: "offlineFirst"`;
- `staleTime` 5 минут и `gcTime` 10 минут по умолчанию;
- retry выключен для типичных timeout/network/fetch failures, чтобы не
  растягивать loading и не ухудшать LCP;
- retry выключен для 4xx;
- refetch on reconnect;
- optional idle static prefetch для filters/countries на web.

### Auth flow

```text
Login form
  -> authStore.login()
  -> api/auth.ts loginApi()
  -> secure token storage
  -> authStore state update
  -> apiClient adds Authorization: Token <token>
  -> refresh flow on recoverable auth failures
```

Токены и секреты нельзя выводить. `.env.e2e` используется только для local/e2e
auth automation и не должен попадать в логи, screenshots или commits.

### Client state

```text
User action
  -> component handler
  -> Zustand store action или context action
  -> AsyncStorage / SecureStore if needed
  -> subscribed components rerender
```

Примеры:

- favorites/history/recommendations bootstrap: с сервера для signed-in users,
  из local storage для гостей;
- travel statuses питают календарь и controls на detail pages;
- map route/filter/panel stores выносят тяжелое map UI поведение из route files.

### Upload/download flow

`api/client.ts` поддерживает:

- JSON requests через `get/post/put/patch/delete`;
- downloads с parsing filename;
- multipart uploads с native XHR progress, где это доступно;
- upload retry для transient `502/503/504`;
- CSRF header injection для unsafe methods.

Travel wizard, avatar upload, user-points import, route-file upload, article
media и PDF/book flows зависят от этой инфраструктуры или feature-specific
wrappers вокруг нее.

## Карта Контрактов Backend API

Backend ожидается как DRF-like API под `/api`. Многие модули поддерживают
несколько response envelopes: bare arrays, `{ results, count }`, `{ data, total }`
или feature-specific DTO.

### Auth and account

- `POST /api/user/login/`
- `POST /api/user/logout/`
- `POST /api/user/registration/`
- `POST /api/user/confirm-registration/`
- `POST /api/user/reset-password-link/`
- `POST /api/user/set-password-after-reset/`
- `POST /api/user/sendpassword/`
- `POST /api/user/google-login/`
- `POST /api/user/push-token/`
- `GET /api/user/{id}/profile/`
- `PUT /api/user/{id}/profile/update/`
- `PUT /api/user/{id}/profile/avatar-upload/`
- `DELETE /api/user/delete-account/`

### Travels and map

- `GET /api/travels/`
- `GET /api/travels/facets/`
- `GET /api/travels/random/`
- `GET /api/travels/of-month/`
- `GET /api/travels/popular/`
- `GET /api/travels/{id}/`
- `GET /api/travels/{id}/near/`
- `GET /api/travels/search_travels_for_map/`
- `POST /api/travels/near-route/`
- `PUT /api/travels/upsert/`
- `DELETE /api/travels/{id}/`
- `PATCH /api/travels/{id}/mark-as-favorite/`
- `PATCH /api/travels/{id}/unmark-as-favorite/`
- route-file endpoints через `api/travelRoutes.ts`;
- comments через `/api/travel-comments/`;
- travel rating через endpoints из `api/travelRating.ts`.

### Articles

- `GET /api/articles`
- `GET /api/articles/{id}`
- slug fallback использует list queries, когда direct ID lookup невозможен;
- article ratings идут через `api/articleRating.ts`;
- article editor media и Instagram publish используют article/editor helpers и
  `api/instagramPublish.ts`.

### Profile, social, privacy

- favorite/history/recommended travels пользователя;
- user travel statuses для `visited/planned/wishlist`;
- subscriptions и subscribers;
- privacy settings, data export, data deletion, consent revoke;
- security journal;
- contact access requests;
- report/block user flows.

### Quests

- quest list/cities/bundles;
- quest by city или `quest_id`;
- quest progress CRUD;
- quest rating и reviews;
- часть review поведения имеет deterministic mock fallback до готовности backend
  endpoint.

### Trips and community

Есть две связанные, но разные API-зоны:

- `api/plannedTrips.ts` - private/user-planned trips, route builder, route
  templates, RSVP, invitations, suggestions, reports. Может падать в mocks через
  `EXPO_PUBLIC_TRIPS_MOCK=true` или dev-only unavailable-backend handling.
- `api/publicTrips.ts` - public catalog "Поехали со мной", trip applications,
  decisions/cancelation, notifications. Также сохраняет mock fallback для dev
  или недоступных endpoints.

### Messaging and communication

- direct message threads/messages через `api/messages.ts`;
- trip chat через `api/tripChat.ts`;
- Telegram link/group creation/invite flows через `api/telegramLink.ts` и
  `api/tripTelegramGroup.ts`;
- messaging использует lightweight fetch helper, чтобы undeployed messaging
  endpoints не разлогинивали пользователя.

### User points and external geo

- `/api/user-points/*` для import/list/create/update/delete/purge/bulk
  operations, route calculation, routes, recommendations, stats, KML export;
- KML/KMZ import использует dynamic `jszip`;
- external services обернуты в `api/external/*` и `utils/overpass/*`.

## Статус Функциональных Областей

Легенда:

- `implemented` — frontend path существует и покрыт тестами;
- `backend-dependent` — frontend готов, но production-ready требует runtime
  evidence реального API;
- `partial` — часть пользовательского flow намеренно заглушена, отключена или
  работает только в dev/mock режиме;
- `needs runtime verification` — статический аудит не заменяет browser/device
  проверку.

| Область | Frontend | Runtime / product status | Что остаётся |
| --- | --- | --- | --- |
| Home, travel catalog, search | implemented | основной real-API flow | production browser smoke и актуальный performance baseline |
| Travel details | implemented | основной real-API flow | сохранить bilateral slider/perf gate; проверить свежую production build |
| Travel creation/editing | implemented | real API, upload и draft flows | browser + Android/iOS verification сложных upload/route сценариев |
| Map and places | implemented | web Leaflet; native Leaflet в WebView | уменьшить дублирование, проверить device parity и offline/overlay behavior |
| Articles | implemented | list/detail/editor paths существуют | production API/media verification; feature maps требуют актуализации |
| Auth, profile, subscriptions, settings | implemented | source мигрирован на HttpOnly-cookie; production ещё отдаёт legacy JS-token frontend | задеплоить FE, подтвердить reload identity contract #937 и закрыть #923 |
| Favorites, history, calendar | implemented | local + server sync | dedupe bug в `viewHistoryStore` исправлен; сохранять regression coverage |
| User points | implemented | backend-dependent | проверить import/export/route endpoints на production payloads |
| Quests | implemented | backend-dependent | завершить текущую route-geometry/offline-map работу и device/browser verification |
| Achievements/gamification | implemented adapters/UI | production matrix проверена; mock flags development-only | сохранять typed unavailable/auth states и e2e evidence по mutations |
| Planned/public/social trips | implemented adapters/UI | production matrix проверена; dev fixtures отделены production guards | расширять create/apply/RSVP/chat/report e2e без fake-success fallbacks |
| Telegram/contact/trust/safety | implemented UI/adapters | partial/backend-dependent | production endpoints, privacy/security evidence, disabled-state UX |
| Messages | implemented | backend-dependent | production thread/message/unread verification |
| PDF/book export | implemented | export работает; monetization partial | checkout отсутствует, premium gate намеренно выключен |
| SEO and analytics | implemented | web providers wired; native secret-bearing path отключён и отсутствует в проверенном APK | выбранный будущий native analytics channel должен сохранять consent contract |
| iOS/Android shell | implemented | Android debug APK установлен и smoke-проверен; iOS не проверен | отдельный iOS simulator/device pass |

## Карта Frontend Функциональности

### Home and discovery

Главная (`components/home/`) дает входы в поиск путешествий, популярный/случайный
контент, категории, FAQ и продуктовые объяснения. SEO metadata делится между
fallback в `app/+html.tsx` для первого paint и runtime `LazyInstantSEO`.

### Travel catalog and search

Основные файлы: `components/listTravel/`, `api/travelListQueries.ts`,
`hooks/useTravelFilters.ts`, routes `/search`, `/metravel`, `/travelsby`.

Функциональность:

- paginated travel listing;
- search query и URL-filter support;
- фильтры: countries, categories, transport, companions, complexity, month,
  overnight stays, address category, year;
- facet counts из `/travels/facets/`;
- sort handling;
- user-scoped author lists с draft handling при auth;
- карточки со стабильной геометрией image, author/views rules,
  favorites/history hooks;
- responsive desktop/mobile layouts.

### Travel details

Основные файлы: `app/(tabs)/travels/[param].tsx`,
`components/travel/details/`, `hooks/useTravelDetails*`,
`api/travelDetailsQueries.ts`.

Функциональность:

- загрузка по ID или slug, direct API preload и slug fallback;
- hero/gallery media, web `70vh` media contract, blur backdrop rules;
- rich travel description и sanitized rich text;
- route map, route points, nearby travels, weather/excursions/YouTube sections;
- favorite, share, rating, comments, travel status calendar actions;
- SEO title/canonical/OG/JSON-LD;
- performance-specific lazy loading и tracing hooks.

### Travel creation and editing

Основные файлы: `app/(tabs)/travel/new.tsx`,
`app/(tabs)/travel/[id].tsx`, `components/travel/upsert/`,
`components/travel/TravelWizard*`, `hooks/useTravelWizard.ts`,
`hooks/useTravelFormData.ts`.

Функциональность:

- multi-step upsert wizard;
- media upload и main/gallery image handling;
- создание/редактирование route points;
- route-file upload и preview;
- EXIF GPS extraction для photo route points на web;
- validation через travel form/wizard utilities;
- draft recovery и autosave;
- publish step и moderation/publish fields;
- deferred point-photo upload после назначения backend point IDs.

### Map and places

Основные файлы: `screens/tabs/MapScreen.tsx`, `components/MapPage/`,
`hooks/map/*`, `api/map.ts`, `api/places.ts`, `utils/map*`,
`config/mapWebLayers.ts`.

Функциональность:

- Leaflet map на web;
- Leaflet map внутри `react-native-webview` для основной native map;
- travel markers и clustering;
- desktop side panel и mobile bottom-sheet/card behavior;
- radius mode, route mode, "search this area";
- route building с ORS/OSRM/Valhalla-style helpers и fallbacks;
- external geocoding/reverse geocoding;
- map overlay layers из OSM/Overpass/WFS/weather config;
- travel list panel и marker popups;
- `/places` catalog из normalized map travel points.

### Articles and editor

Основные файлы: `components/article/`, `api/articles.ts`,
`app/(tabs)/articles.tsx`, `app/(tabs)/article/[id].*.tsx`.

Функциональность:

- article list с pagination и publish/moderation filtering;
- article detail by id/slug fallback;
- safe HTML rendering и rich-text sanitization;
- web Quill editor;
- platform-specific editor variants;
- article rating;
- Instagram rich-text embed handling по правилам проекта;
- article media/editor helper modules.

### Auth, profile, settings

Основные файлы: `context/AuthContext.tsx`, `stores/authStore.ts`,
`api/auth.ts`, `api/user.ts`, `components/auth/`, `components/profile/`,
`components/settings/`.

Функциональность:

- login/logout/registration/account confirmation/password reset;
- Google auth;
- auth bootstrap из secure storage;
- просмотр и редактирование профиля;
- avatar upload;
- public user profile;
- subscriptions/subscribers;
- profile completeness и quick actions;
- data ownership controls;
- privacy settings;
- security journal;
- biometric auth на native-capable platforms;
- Strava settings.

### Favorites, history, calendar

Основные файлы: `FavoritesContext`, `favoritesStore`, `viewHistoryStore`,
`travelStatusStore`, routes `/favorites`, `/history`, `/calendar`,
`components/calendar/MiniCalendar.tsx`, `components/travel/TravelStatusButton.tsx`.

Функциональность:

- authenticated server-backed favorites/history, где backend доступен;
- local fallback для guests/offline state;
- clear favorites/history actions;
- `visited/planned/wishlist` travel status model;
- planned-date calendar grid;
- profile quick links и personal status summary.

### User points

Основные файлы: `api/userPoints.ts`, `screens/tabs/UserPointsScreen.tsx`,
`components/UserPoints/`, `components/UserPoints/useUserPoints*`, route
`/userpoints`.

Функциональность:

- import points из KML/KMZ и document picker assets;
- dedupe/merge/skip policies;
- list/grid/map display;
- manual point creation;
- bulk actions;
- route calculation;
- route/recommendation endpoints;
- KML export download;
- stats endpoint integration.

### Quests

Основные файлы: `api/quests.ts`, `hooks/useQuestsApi.ts`,
`components/quests/`, `screens/tabs/QuestsScreen*`, routes `/quests/*`.

Функциональность:

- quest catalog и city map;
- quest detail с intro, steps, finale;
- progress sync для authenticated users;
- answer/hint/attempt state;
- ratings, reviews, completion badges, pioneer metadata;
- quest geofencing/reminders через platform-specific hooks;
- printable/offline map helpers;
- related travels for a quest.

### Social trips and planning

Основные файлы: `api/publicTrips.ts`, `api/plannedTrips.ts`,
`hooks/usePublicTripsApi.ts`, `hooks/usePlannedTripsApi.ts`,
`components/trips/`, routes `/trips/*`.

Функциональность:

- public trip catalog и detail;
- application submission, cancelation, organizer decisions, notifications;
- "my planned trips";
- planned trip creation;
- route builder с route summary;
- route export;
- RSVP и participant lists;
- participant suggestions и organizer decisions;
- post-trip report form;
- trip chat;
- Telegram group integration;
- affiliate block и trip analytics events.

### Messages and contact access

Основные файлы: `api/messages.ts`, `hooks/useMessages.ts`,
`components/messages/`, `api/contactRequests.ts`, profile contact UI.

Функциональность:

- direct message threads;
- paginated messages;
- unread counts and mark-read;
- available users / start thread by user;
- contact access requests and decisions.

### Achievements and gamification

Основные файлы: `api/achievements.ts`, `api/gamification.ts`,
`hooks/useAchievementsApi.ts`, `hooks/useGamification.ts`,
`components/achievements/`.

Функциональность:

- badge catalog;
- my/public achievements;
- peer badges for users/travels;
- rare awards and admin grant flows;
- place-first badges;
- progression lines and character path selection;
- share-card generation.

### Export and PDF/book

Основные файлы: `components/export/`, `hooks/usePdfExport*`,
`services/pdf-export/`, `services/book/BookHtmlExportService.ts`, route
`/export`.

Функциональность:

- выбор путешествий пользователя для export;
- book settings modal;
- templates/themes, включая free/premium theme gating;
- HTML book generation;
- print/PDF preview on web;
- route/map/gallery/checklist sections в generated output;
- image loading/retry и print-readiness handling.

### SEO, analytics, legal/static pages

SEO logic централизована в `utils/seo.ts`, `utils/travelSeo.ts`,
`components/seo/LazyInstantSEO`, `app/+html.tsx`.

Функциональность:

- canonical URLs;
- OG/Twitter image URLs;
- page-level runtime SEO;
- JSON-LD helpers;
- production static route export и SEO post-processing;
- analytics event queue и trip metrics;
- static legal pages, contact/about pages.

### Эволюция SEO rendering: переход с полного SSG

**Текущее решение (2026-07-14):** сохранять production web в режиме полного
static export и не включать экспериментальный SSR/RSC. Это остаётся каноническим
и rollback-safe способом отдавать поисковым роботам готовый HTML, пока Expo Router
не предоставляет проверенный production-grade hybrid rendering.

У Expo уже есть два направления развития:

- [Expo Router server rendering](https://docs.expo.dev/router/web/server-rendering/)
  умеет request-time HTML, data loaders и server-side metadata, но имеет статус
  alpha; обычный SSR пока не позволяет смешивать static и server routes в одном
  проекте, а caching/invalidation остаётся ответственностью server/CDN;
- [React Server Components](https://docs.expo.dev/guides/server-components/)
  в preview поддерживают выбор `static`/`dynamic` на уровне route и обещают более
  автоматический caching, но остаются beta/experimental; production deployment и
  полноценный HTML output пока не рекомендуются.

Архитектурный пересмотр запускается при каждом обновлении Expo SDK/Expo Router и
сразу после объявления Expo о production-ready server/hybrid rendering. Начинать
миграцию можно только когда одновременно выполнены все условия:

1. API и deployment path больше не помечены `alpha`, `beta`, `experimental` или
   `unstable`, либо Expo явно рекомендует их для production.
2. Решение поддерживает hybrid/per-route rendering или эквивалентный механизм,
   который не вынуждает переводить всё приложение на request-time SSR.
3. Для динамических страниц доступны готовый initial HTML, deterministic metadata,
   корректные HTTP status/redirects и поддержка canonical, OG/Twitter и JSON-LD.
4. Есть документированный production adapter для используемой инфраструктуры и
   проверяемая cache invalidation по URL/path/tag либо эквивалентный SWR-механизм;
   обновление одной сущности не требует полного rebuild сайта.
5. Stable-версии зависимостей проходят `CI=1 npx expo install --check` и
   `npx expo-doctor@latest`; canary/pre-release пакеты в production запрещены.
6. Preprod spike на representative routes (`travel`, `quest`, `article`) подтверждает
   raw HTML до hydration, metadata/schema/status contracts, отсутствие duplicate
   data fetch и hydration mismatch, browser flows, performance budget и rollback.

Если хотя бы одно условие не выполнено, полный SSG сохраняется. После прохождения
gate сначала создаётся Task Contract на ограниченный preprod migration slice,
затем выполняются архитектурный review и release checks. Текущий static pipeline
остаётся rollback-механизмом до успешной production-проверки нового пути.

## Платформенные Различия

| Возможность | Web | iOS/Android |
| --- | --- | --- |
| Routing | Expo Router web static routes | Expo Router native navigation |
| Main map | Leaflet + React Leaflet | Leaflet inside `react-native-webview` |
| Header/dock | Custom web chrome + responsive dock/footer | Native footer/dock и native status bar |
| Storage | local/session storage hardening + AsyncStorage abstractions | SecureStore для секретов, AsyncStorage для несекретного |
| Uploads | `File`, `Blob`, drag/drop helpers | document/image picker assets, XHR upload progress |
| Push notifications | web hook/fallback | `expo-notifications` native setup |
| Biometrics | web placeholder | `expo-local-authentication` |
| PDF/book preview | web-only print/HTML flow | export controls могут существовать, preview web-gated |
| Route chunks | async web route chunks и chunk-load recovery | asyncRoutes disabled by default in native config |

Platform-specific файлы используют suffixes `.web.tsx`, `.native.tsx`,
`.ios.tsx`, `.android.tsx`. TypeScript `moduleSuffixes` и Metro resolver
поддерживают этот паттерн.

## Сборка И Деплой

### Development

```bash
npm install
npm run start
npm run web
npm run ios
npm run android
```

Минимальный Node baseline: `>=22.13.1`.

### Web production build

```bash
npm run build:web:prod
```

Production web output: `dist/prod`. Build pipeline также выполняет web
post-processing и SEO validation scripts.

### Production deploy

См. `docs/RELEASE.md`.

Обычный deploy с машины, где работает `rsync`:

```bash
./build-prod.sh prod
```

Build без deploy:

```bash
DEPLOY=0 ./build-prod.sh prod
```

Production deploy требует явной команды пользователя. Нельзя менять production
server paths или SSL paths без проверки существования на целевом host.

### Native builds

`app.json` задает bundle IDs, permissions, universal/app links, plugins и Expo
Router async-route behavior. `eas.json` задает development, preview и production
build profiles.

Common scripts:

```bash
npm run ios:prebuild
npm run ios:build:prod
npm run ios:submit:latest
npm run android:prebuild
npm run android:build:prod
npm run android:submit:latest
```

## Поверхность Проверок

Запускай самый узкий надежный check, который покрывает changed scope.

| Scope | Check |
| --- | --- |
| Docs-only | перечитать структуру измененного Markdown |
| Малый завершенный блок кода | `npm run check:fast` |
| Среднее изменение / перед PR handoff | `npm run check:preflight` |
| Full code quality gate | `npm run lint` и `npm run test:run` |
| External links | `npm run guard:external-links` или `npm run governance:verify` |
| UI change | targeted checks + browser preview + screenshot + console check |
| E2E affected area | `npm run check:e2e:changed` или selected Playwright spec |
| Production web readiness | `npm run build:web:prod` |
| Performance | только production build или real `https://metravel.by` Lighthouse |

Ключевые scripts:

- `npm run check:fast`
- `npm run check:preflight`
- `npm run check:changed:dry`
- `npm run check:e2e:changed:dry`
- `npm run governance:verify`
- `npm run typecheck`
- `npm run build:web:prod`
- `npm run guard:bundle-budget`
- `npm run guard:eager-web`

## Результаты Аудита 2026-07-14

### Validation snapshot

| Проверка | Результат | Вывод |
| --- | --- | --- |
| `npm run typecheck` | pass | production TypeScript scope компилируется |
| `npm run lint` | pass на проверенном baseline | guards прошли, warning budget равен нулю |
| `npm run check:fast` | требуется rerun | все предшествующие шаги прошли; ESLint нашёл `no-undef` в `utils/questSeo.js`, декларация CommonJS globals добавлена после прогона |
| External-link guards | pass | direct `Linking.openURL` / `window.open` вне chokepoint не найден |
| React Query key guard | pass | query keys централизованы в `api/queryKeys.ts` |
| `npm run design:verify` | pass | deprecated design-system usage не найдено в 1 072 файлах |
| `npm run check:image-architecture` | pass | shared image/card architecture соблюдена |
| `npm run guard:file-complexity` | warning | 25 файлов превышают 800 LOC |
| `npm run test:run` | pass | 827 suites и 6 634 tests прошли, failures: 0 |
| `npm run audit:high` | pass | high/critical: 0; moderate: 4; low: 1 |
| Production-style UI audit | partial / fail | 202 состояния, 0 navigation/screenshot errors, 35 hydration errors и 3 residual serious axe violations |
| Android debug device gate | pass | APK собран локально, установлен и smoke-проверен на USB-устройстве |
| Skipped-test scan | pass | `.skip`, `xit`, `xtest` не найдены |

Полный Jest baseline зелёный. После последнего изменения `utils/questSeo.js`
нужен повторный общий `check:fast`; он оставлен владельцу атомарного release gate,
чтобы не пересекать shared quality lock. Production build, Lighthouse и iOS
device pass в этом review scope не запускались и не должны считаться пройденными.
Selective Playwright preflight воспроизвёл map defect #940, а UI-аудит оставил
открытыми hydration #938 и остаток accessibility #939.

### P0 — security и release blockers

#### SEC-01. Tracked environment backup содержит credential-like values

Статус: frontend hygiene реализована в #920 — `.env.backup-qa` удалён из текущего
index, `.env*`/`.secrets/**` закрыты deny-by-default, secret-safe guard и
regression tests проходят. Тикет остаётся в `testing` до отдельного чистого
commit; ротация уже раскрытых значений и решение по history cleanup остаются
owner-задачей #918.

Ранее отслеживавшийся `.env.backup-qa` содержал непустые значения для
`EXPO_PUBLIC_GOOGLE_API_SECRET`, `EXPO_PUBLIC_ORS_API_KEY`,
`EXPO_PUBLIC_OWM_API_KEY` и других runtime variables. Значения в этот документ и
логи аудита не копировались.

Риск:

- credential может быть доступен всем, кто имеет доступ к git history;
- удаление только текущего файла не отзывает уже раскрытое значение;
- `EXPO_PUBLIC_*` попадает в клиентский bundle и не может считаться секретом.

Нужно:

1. Считать значения скомпрометированными до подтверждённой ротации у провайдеров.
2. Отключить/ротировать GA Measurement Protocol secret, ORS/OWM keys и проверить
   ограничения quota/domain/package там, где public client key допустим.
3. Удалить backup из tracked tree и согласованно очистить git history, если
   репозиторий уже распространялся.
4. Переписать `.gitignore` на deny-by-default для `.env*` с отдельным разрешением
   только placeholder examples.
5. Проверить CI artifacts, build outputs и логи на те же имена переменных.

Done gate: старые credentials отозваны; tracked secret scan показывает только
placeholders/examples; production/local config продолжает проходить
`config:diagnostics` без вывода значений.

#### SEC-02. Native analytics публикует GA Measurement Protocol secret

Статус: исправлено, #921 переведён в Done. Native Measurement Protocol path
отключён; свежий debug APK собран локально, установлен на Android device и
проверен по распакованному artifact: имя переменной, старый endpoint и фактическое
secret value отсутствуют. App process после launch остаётся жив, crash/fatal и
secret markers в logcat не найдены. Ротация старого credential остаётся в #918.

До исправления `utils/analytics.ts` читал `EXPO_PUBLIC_GOOGLE_API_SECRET` и для
native отправлял его в query string `google-analytics.com/mp/collect`. Такой
контракт был небезопасен: любой `EXPO_PUBLIC_*` доступен в bundle установленного
приложения.

Нужно:

- немедленно ротировать текущий secret;
- до исправления не включать native Measurement Protocol path;
- заменить его на официальный client analytics SDK без API secret либо на
  backend proxy с consent, allowlisted event schema и rate limiting;
- не передавать секреты в URL/query params.

Done gate: frontend/native bundle не содержит API secret; native events доходят
до тестового analytics property через утверждённый канал; consent regression
tests остаются зелёными.

#### SEC-03. Post-auth open redirect через protocol-relative path

Статус: исправлено и принято в #922. Login/registration используют единый
normalizer; protocol-relative, encoded, backslash, control-character и scheme
варианты закрыты regression tests.

`LoginForm`, `RegistrationForm` и `utils/authNavigation.ts` считают любой
`redirect`, начинающийся с `/`, внутренним. Значение `//attacker.example`
проходит эту проверку, а Expo Router классифицирует его как external URL и
вызывает `Linking.openURL`. Это даёт удалённый post-login/post-registration
redirect по специально сформированной ссылке.

Нужно:

- использовать один `normalizeInternalReturnPath` для login, registration и
  builders;
- отклонять `//`, backslash, control characters, schemes и encoded variants;
- не дублировать собственные `startsWith('/')` проверки в формах.

Done gate: unit/integration tests покрывают `//host`, `/%2f%2fhost`, backslash,
control characters и валидный внутренний path; auth flow остаётся внутри app.

#### SEC-04. Web token storage использует обратимый static XOR в `localStorage`

Статус: frontend source в #923 переведён на ambient HttpOnly-cookie credentials,
не читает/не записывает web token из JavaScript и имеет unit/e2e regression
coverage. Тикет не Done: deployed production frontend всё ещё пишет
`localStorage:secure_userToken`, а reload identity должен быть подтверждён
backend-контрактом #937. Без deployment/runtime evidence локальный код не считается
закрытием finding.

До миграции `utils/secureStorage.ts` хранил `userToken` и `refreshToken` в
persistent `localStorage`, шифруя их фиксированным ключом из того же bundle. Это
была обфускация, а не защита: любой выполняемый в origin скрипт мог прочитать
storage и восстановить token.

Нужно:

- целевой вариант: перейти на backend-managed `HttpOnly`, `Secure`, `SameSite`
  session/refresh cookie и короткоживущий access flow;
- если backend migration не готова, отдельно зафиксировать временную web-модель,
  не называть XOR secure encryption и минимизировать lifetime/persistence;
- native SecureStore оставить, но production fallback на AsyncStorage должен
  fail closed или быть явно запрещён конфигурационным guard.

Done gate: threat-model и API contract утверждены; XSS не даёт прочитать refresh
credential из JavaScript; logout/revocation/multi-tab/private-mode flows
проверены. Backend часть — отдельная `area=back` задача, frontend migration —
зависимая `area=front` задача.

Положительные security controls, которые нужно сохранить:

- rich text проходит `sanitizeRichText` или дополнительный
  `guardServerSafeHtml`;
- JSON-LD сериализуется через `stringifyJsonLd` с escaping `<`, `>`, `&`;
- external URL открываются через `utils/externalLinks.ts` и
  `getSafeExternalUrl`;
- WebView map/quest payloads сериализуются через safe JSON/escaping;
- targeted XSS, URL и governance tests прошли в полном Jest run;
- high/critical production dependency advisories не найдены.

### P1 — функциональные дефекты и незавершённые product contracts

#### QUAL-01. Закрыто: history dedupe сохранял старые данные

`__tests__/stores/viewHistoryStore.test.ts` ожидает, что повторный просмотр того
же `id+type` обновит title и станет самым свежим. `mergeHistoryItems` заменяет
элемент при `viewedAt >= existing.viewedAt`. При одинаковом `Date.now()` новый
элемент добавляется первым, затем старый элемент с тем же timestamp перезаписывает
его. В результате UI может показывать устаревшие title/image/url metadata.

Исправлено: tie-breaker теперь сохраняет первый элемент входного массива при
равном `viewedAt`, поэтому более старый элемент не перезаписывает свежие metadata.
Targeted test и полный `npm run test:run` проходят.

#### FUNC-01. Social/trips/gamification UI опережает подтверждённый backend rollout

Статус: production contract matrix #919 завершена. В #925 исправлен public
place-badges URL, mock flags сведены в development-only resolver, production
diagnostics отклоняют известные mock flags, а auth/unavailable/network states в
затронутых adapters не нормализуются в fake empty success. Общий Jest gate
проходит; browser release gate текущего дерева остаётся красным из-за #938–#940.

В `api/` остаётся 77 ссылок на mock/fallback behavior. Основные зоны:

- `plannedTrips`, `publicTrips`, `tripChat`, `telegramLink`,
  `tripTelegramGroup`, `contactRequests`;
- `userSafety`, `participantRating`;
- `achievements`, `gamification`, share-card flows.

Большинство mock fallbacks ограничены `__DEV__` или явными
`EXPO_PUBLIC_*_MOCK` flags; production обычно fail-fast либо показывает
disabled/unavailable state. Это безопаснее fake success, но означает, что наличие
UI ещё не доказывает готовность продукта.

Нужно:

1. Для каждой зоны получить production API evidence по happy path, auth errors,
   empty state и mutation failure.
2. Держать mocks в отдельных dev fixtures/adapters, а не внутри больших
   production API modules.
3. После rollout удалить временные fallback branches и flags.
4. Не включать mock flags в production config и добавить diagnostics guard.

#### FUNC-02. Premium PDF monetization не завершена

`services/pdf-export/entitlement/PdfEntitlementSource.ts` выключает premium gate и
считает всех пользователей premium. `hooks/usePdfPremium.ts` только пишет
analytics event; реального checkout/unlock path нет.

Нужно принять продуктово-техническое решение:

- либо реализовать checkout, receipt/entitlement verification, restore purchase,
  cancel/refund и server-authoritative `is_premium`;
- либо убрать paywall UI и оставить PDF themes бесплатными без ложного unlock
  affordance.

До появления реального unlock path включать `EXPO_PUBLIC_PDF_PREMIUM_GATE=true`
нельзя.

#### FUNC-03. Production-style browser audit нашёл hydration regression

UI-аудит 202 состояний без navigation/screenshot failures воспроизвёл 35 React
page errors: 23 раза #419 (server не завершил Suspense boundary) и 12 раз #418
(server/client HTML mismatch). Ошибки затрагивают guest и auth маршруты на разных
viewport; это не cosmetic console noise, потому что React заменяет затронутое
дерево client render. Полный fresh-build fix вынесен в #938.

#### FUNC-04. Shared UI surfaces имеют critical/serious a11y violations

Первый прогон нашёл 19 axe violations на 19 состояниях: `aria-required-children`
в account menus, `duplicate-id-active` на trips redirect, безымянные Leaflet
markers в user points и contrast failures на profile/export/travel/metravel.
После remediation-аудита 16 нарушений устранены; остаются 3 serious
`duplicate-id-active` на `trip-plan-redirect` в desktop/tablet/mobile. Полное
закрытие с evidence вынесено в #939. Два transient 502 `getFiltersTravel` не
воспроизвелись повторным production probe: endpoint вернул 200 и ожидаемые
filter dictionaries, поэтому отдельный backend bug не создан.

#### FUNC-05. Mobile map panel теряет переход к фильтрам

Selective preflight дважды воспроизвёл падение
`e2e/map-page.spec.ts:1259`: после открытия compact mobile map panel действия
list/empty state не переводят sheet в `filters-block-main`. Snapshot показывает
возврат к map/place overlay вместо filters state. Поведенческий fix и три
последовательных Playwright pass вынесены в #940 и связаны с map split #926.

### P2 — архитектурный и типовой долг

#### ARCH-01. 25 файлов превышают порог 800 LOC

Это не автоматическое требование распилить каждый файл. Приоритет — файлы, где
одновременно смешаны orchestration, data mapping, platform bridge, UI и styles.
Полный текущий список приведён ниже.

| LOC | Файл |
| ---: | --- |
| 1 558 | `components/MapPage/Map.ios.tsx` |
| 1 202 | `screens/tabs/QuestsScreen.styles.ts` |
| 1 175 | `api/plannedTrips.ts` |
| 1 096 | `components/quests/QuestFullMap.native.tsx` |
| 1 071 | `components/MapPage/Map/PlacePopupCard/index.tsx` |
| 1 063 | `hooks/useMapScreenController.ts` |
| 1 049 | `components/MapPage/Map.web.tsx` |
| 990 | `app/(tabs)/profile.tsx` |
| 988 | `components/places/PlaceListCard.tsx` |
| 952 | `components/quests/QuestFullMap.tsx` |
| 949 | `components/mainPage/StickySearchBar.tsx` |
| 936 | `components/screens/profile/profileCountries.ts` |
| 909 | `screens/tabs/PlacesScreen.tsx` |
| 882 | `api/achievements.ts` |
| 882 | `components/trips/planning/RouteBuilder.tsx` |
| 870 | `api/client.ts` |
| 868 | `components/travel/UnifiedSlider.tsx` |
| 851 | `app/(tabs)/trips/plan/[id].tsx` |
| 836 | `components/UserPoints/PointsListGrid.tsx` |
| 835 | `components/article/ArticleEditor.web.tsx` |
| 831 | `components/listTravel/ListTravelBase.tsx` |
| 831 | `components/travel/PointList.styles.ts` |
| 829 | `components/travel/TravelWizardStepPublish.tsx` |
| 814 | `components/listTravel/RecommendationsTabs.tsx` |
| 807 | `components/screens/profile/ProfileCountriesTab.tsx` |

Рекомендуемый порядок behavior-neutral extraction:

1. map platform bridge (`Map.ios`, `Map.web`, `useMapScreenController`);
2. planned trips и achievements API adapters/mocks/DTO;
3. profile/places/quest screen orchestration;
4. reusable point/place card и list/travel composition;
5. styles/data dictionaries — только если это улучшает ownership и поиск, а не
   ради LOC.

Каждый split должен идти отдельным маленьким блоком с сохранением hook order и
public props contracts.

#### ARCH-02. Map engine реализован несколькими крупными параллельными путями

Web использует React Leaflet, основная native-карта — Leaflet внутри WebView;
отдельные quest/travel maps повторяют HTML/JS bridge, marker, resize, popup и
navigation logic. Это повышает риск различий web/iOS/Android и XSS/escaping
регрессий в string-built HTML.

Нужно:

- вынести platform-neutral DTO, coordinate validation, marker/popup model,
  navigation messages и escaping в общие typed modules;
- держать web React Leaflet renderer и native WebView renderer раздельными;
- не объединять движки в один god-component;
- задокументировать единственный mobile point/place UX contract и проверять его
  browser + Android + iOS evidence.

#### ARCH-03. API transport и доменные adapters снова приближаются к god-modules

Текущие hotspots: `api/plannedTrips.ts` 1 175 LOC, `api/achievements.ts` 882,
`api/client.ts` 870, `api/map.ts` 764, `api/travelDetailsQueries.ts` 737.
Смешиваются DTO definitions, parsers, mocks, cache policy, request transport и
feature mutations.

Нужно:

- оставить `api/client.ts` только transport/auth/retry concern;
- вынести DTO и normalizers по доменам;
- вынести dev mocks в отдельные modules;
- запретить components импортировать raw DTO;
- продолжать использовать централизованные `queryKeys`.

#### TYPE-01. Strict typecheck зелёный, но debt скрыт casts/suppressions

Статический scan production scope нашёл:

- 2 635 `as any` в 485 файлах;
- 71 `@ts-ignore` / `@ts-expect-error`;
- 31 ESLint disable markers.

Большая часть suppressions объясняет React Native Web props/CSS, но количество
`as any` слишком велико для эффективного strict mode. Самые плотные зоны —
styles, map Leaflet refs/bridges, travel forms/cards и responsive UI.

Нужно:

- создать typed web-prop helpers вместо повторяющихся `@ts-ignore`;
- типизировать Leaflet/WebView bridge DTO и refs;
- разделить View/Text/Image style contracts;
- снижать baseline по затронутым файлам, не делать массовый cast rewrite.

`tsconfig.json` также исключает `__tests__`, `e2e` и отдельные legacy/example
surfaces. Нужен отдельный non-emitting typecheck для test/e2e contracts либо
явно документированные причины исключений.

Реализация baseline после аудита:

- `npm run guard:type-debt` сканирует production scope через TypeScript AST и
  сравнивает бюджеты по каждому домену и файлу с
  `scripts/type-debt-baseline.json`; рост блокирует `check:fast`, `lint` и CI lint;
- текущий AST-baseline: 2 693 `as any`, 53 `@ts-ignore`, 3
  `@ts-expect-error`, 31 `eslint-disable`; typed RN-Web props и Leaflet control
  bridge уже убрали часть suppression/cast debt без изменения runtime;
- `npm run typecheck:e2e` компилирует все `e2e/**/*.ts` через отдельный
  `tsconfig.e2e.json`, не включая тесты в production bundle/typecheck;
- `npm run guard:type-debt:update` не является обычным repair-командой: baseline
  обновляется только после явного review причины нового suppression/cast.

#### TEST-01. Tests многочисленны, но coverage policy исключает высокорисковые зоны

`jest.config.js` исключает из coverage весь `components/MapPage/`, Map upload,
ArticleEditor, gallery и export settings. При этом unit/integration tests для
этих зон существуют. Это создаёт ложный сигнал: количество тестов велико, но
реальное покрытие ключевых branches не измеряется.

Первый incremental slice после аудита: `BookSettingsModal` удалён из глобальных
coverage exclusions, stale-путь старого `ArticleEditor.web.tsx` также удалён, а
`npm run test:coverage:export-settings` воспроизводит branch/function/line
метрики export-settings. Оставшиеся исключения и причины удержания перечислены в
`docs/TESTING.md#high-risk-coverage-slices`; их нельзя снимать без meaningful
branch tests и browser/device evidence для WebView/media flows.

Нужно:

- снять coverage baseline по доменам;
- уменьшать exclusions после каждого behavior-neutral split;
- не ставить единый высокий процент на весь legacy repo;
- для map/WebView/travel media сохранять browser/device evidence, которое не
  заменяется Jest coverage.

#### TEST-02. Закрыто: global lint baseline снижен до нуля

`package.json` теперь запускает ESLint с `--max-warnings=0`; полный lint проходит
без warning и selective checks не ослаблены. Evidence и итоговый Done gate ведёт
#932.

### P3 — поддерживаемость tooling и документации

#### TOOL-01. Root runtime/build слой сложен и держится на custom patches

Текущие размеры: `entry.js` 341 LOC, `app/+html.tsx` 579,
`app/_layout.tsx` 574, `metro.config.js` 495 с `@ts-nocheck`. `postinstall`
запускает несколько project patches, плюс используются `metro-stubs/` и
`patch-package`.

Это load-bearing инфраструктура для Safari, RN Web, bundle weight, dev proxy и
deploy compatibility. Её не нужно переписывать без воспроизведённой проблемы.
Нужно:

- закрепить invariants узкими tests/ADR;
- для каждого patch хранить причину, upstream version и критерий удаления;
- после обновления Expo/RN отдельно проверять, какие patches/stubs больше не
  нужны;
- не добавлять новые startup responsibilities в `entry.js`/`+html` без owner и
  regression test.

#### DOC-01. Feature maps частично устарели

`docs/features/map.md` всё ещё описывает native `react-native-maps`, хотя текущая
основная реализация использует Leaflet в WebView. `docs/features/travel.md`
содержит старые LOC и смешивает detail/wizard route naming. Исторические
architecture/performance audits также не должны восприниматься как текущий
baseline.

`docs/ARCHITECTURE.md` остаётся каноническим обзором; feature maps нужно обновлять
по одному домену при ближайшей работе в нём и убрать из них моментальные LOC,
если они не обновляются автоматически.

#### DEP-01. High/critical advisories отсутствуют, moderate backlog остаётся

После совместимых lockfile updates `npm run audit:high` сохраняет high/critical
на нуле; полный production-dependency audit оставляет 4 moderate и 1 low:

- четыре moderate — один advisory `uuid@7.0.3`, доступный только через
  `@expo/config-plugins -> xcode -> uuid`; это build/tooling path, не app runtime,
  а безопасное исправление зависит от Expo/Xcode upstream;
- один low — прямой `quill@2.0.3` HTML-export XSS без опубликованной patched
  version. Проект не вызывает уязвимый `getSemanticHTML`; входной/выходной rich
  text остаётся за `sanitize-html`/server-safe guards, закреплён 40 XSS/sanitizer
  tests. Критерий удаления acceptance: обновить Quill сразу после patched release
  и повторить editor/sanitizer/browser gates.

`yarn install --frozen-lockfile --ignore-scripts`, project postinstall,
dependency check и audit проходят. Решения и upstream criteria ведутся в #935;
blanket `--force` upgrade/ignore запрещён.

## Архитектурные Решения: Keep / Change / Rework

### Keep

- Expo Router file-based routing с тонкими route wrappers и feature composition;
- разделение server state (React Query) и local/client state (Zustand/context);
- `api/queryKeys.ts` как единый query-key registry;
- `ImageCardMedia` / `OptimizedImage` и image architecture guard;
- design tokens и shared UI primitives;
- centralized external-link chokepoint;
- rich-text sanitizer, server-safe guard и safe JSON-LD serializer;
- quality-gate lock и selective check runners;
- web Leaflet и native WebView renderers как разные технические adapters.

### Change

- credential/analytics/auth redirect/token storage contracts;
- history dedupe semantics и full-test baseline;
- production readiness status для backend-dependent social/gamification flows;
- test coverage/typecheck/lint baselines;
- feature documentation freshness.

### Rework Incrementally

- oversized map/platform bridge modules;
- oversized API domains и embedded dev mocks;
- profile/places/quest/travel screen orchestration;
- repeated map/point/place DTO and bridge logic.

Big-bang rewrite приложения, замена Expo Router, объединение всех stores или
создание единого cross-platform map god-component не рекомендуются.

## Приоритетный План Работ

### P0 — до следующего production release

1. #918: owner должен rotate/revoke credentials и решить coordinated history
   cleanup; frontend deny-by-default часть #920 готова, но ждёт отдельного commit.
2. #921 Done: GA Measurement Protocol secret удалён из native artifact/path.
3. #922 Done: auth open redirect закрыт regression tests.
4. #923/#937: задеплоить HttpOnly-cookie frontend и подтвердить reload identity;
   production legacy localStorage остаётся release blocker.

### P1 — вернуть подтверждённую функциональную готовность

1. #919 Done: production API contract matrix выполнена.
2. #925: сохранить development-only mocks и typed production errors, закрыть
   финальные Jest/browser gates.
3. Принять решение по PDF monetization и не включать gate без checkout.
4. #938/#939: устранить hydration и accessibility regressions из полного
   browser audit.

### P2 — снизить стоимость изменений

1. Поэтапно разделить map platform bridge и shared point/place model.
2. Разделить planned trips/achievements/client API modules на transport, DTO,
   normalizer, mocks и mutations.
3. Снижать `as any` и TypeScript suppressions в каждом touched domain.
4. Снять coverage baseline и постепенно сократить exclusions.
5. #932: удерживать global lint warning allowance на нуле.

### P3 — сделать платформу предсказуемее

1. Актуализировать feature maps по фактическим движкам/routes.
2. Инвентаризировать Metro stubs, postinstall fixes и patch-package после
   следующего Expo/RN upgrade.
3. #935: поддерживать классификацию остатка 4 moderate/1 low и обновить
   uuid/Quill при выполнении upstream version criteria.
4. Обновить fresh production bundle/Lighthouse baseline и performance backlog.
5. На каждом Expo SDK/Router upgrade повторно проверить SEO rendering adoption
   gate; при выполнении всех условий запустить preprod migration slice.

## Done Gates Для Следующих Задач

| Тип работы | Минимальный Done gate |
| --- | --- |
| Security finding | exploit regression test + secret-safe logs + relevant frontend/backend contract evidence |
| History/store bug | targeted Jest + full `npm run test:run` |
| API/mock cleanup | adapter tests + real API happy/error/empty evidence; no production mock flag |
| Component split | `check:fast`, `guard:file-complexity:changed`, targeted tests, browser evidence для visible UI |
| Map/native split | map Jest + Playwright web + local Android device + iOS simulator/device evidence |
| Travel hero/media | `verify:slider` и `verify:slider-perf` через общий lock |
| Coverage/type cleanup | typecheck + domain tests; suppressions/baseline не растут |
| Root build/runtime | production web build + bundle guards + relevant startup/SEO tests |
| Docs-only update | structural Markdown review и проверка ссылок/команд |

## Архитектурные Правила

Эти правила закреплены в `docs/RULES.md`, тестах и governance scripts:

- Работать на `main` по умолчанию, если пользователь явно не сказал иначе.
- Сначала переиспользовать существующие components, hooks, services, utilities.
- Держать route files тонкими, feature logic - в feature folders/hooks.
- Использовать `DESIGN_TOKENS` и `app/global.css`; не хардкодить hex colors
  в UI.
- Для production UI icons предпочитать `@expo/vector-icons/Feather`.
- Не использовать emoji как production UI icons.
- Media placeholders должны быть нейтральными: без icons, текста, emoji, со
  стабильной геометрией.
- Внешняя навигация только через `utils/externalLinks.ts`; direct
  `window.open(...)` в feature code и direct `Linking.openURL(...)` вне
  chokepoint запрещены.
- Не возвращать service-worker runtime/static caching и UX "clear cache".
- Не маскировать UI readiness длинными таймерами; исправлять root cause.
- Для web travel hero/media сохранять immediate hero/slider/blur-backdrop
  contract из `docs/RULES.md`.
- Не выводить секреты из `.env*`, `.env.e2e`, `.secrets`, EAS, SSH или server
  configs.

## Карта Документации

Используй этот обзор вместе с документами:

- `docs/README.md` - quick start и API reference.
- `docs/RULES.md` - обязательные правила проекта.
- `docs/CODEX.md` - Codex workflow, skills, triage, validation matrix.
- `docs/DEVELOPMENT.md` - local setup и development workflow.
- `docs/TESTING.md` - Jest, Playwright, governance, quality gates.
- `docs/RELEASE.md` - release and deploy flow.
- `docs/features/travel.md` - travel list/detail/wizard feature map.
- `docs/features/map.md` - map feature map.
- `docs/features/places.md` - places catalog feature map.
- `docs/features/user.md` - profile, collections, calendar statuses.
- `docs/features/calendar.md` - travel status calendar.
- `docs/features/social-trips-*.md` - social trips, gamification, metrics.
- `docs/adr/*` - architecture decisions.
