# Архитектура и функциональность Metravel

Актуально на: 2026-06-22.

Этот документ описывает архитектуру локального репозитория `metravel2`, основные
слои приложения, пользовательский функционал, frontend-модули и интеграцию с
backend API.

Важная граница: в этом репозитории находится Expo / React Native / React Native
Web приложение. Исходного кода backend-сервера здесь нет. Поэтому разделы про
backend описывают не внутреннюю серверную реализацию, а API-контракты, клиентские
модули, нормализацию DTO, mock/fallback-логику и ожидания фронта.

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
| Framework | Expo SDK 56, Expo Router, React 19, React Native 0.85 |
| Web | React Native Web, Metro web bundler, static export в `dist/prod` |
| Native | Expo iOS/Android сборки через EAS |
| Язык | TypeScript strict mode, alias `@/*` на корень репозитория |
| Server state | `@tanstack/react-query` |
| Client state | Zustand stores + React contexts |
| Карты | Leaflet/OpenStreetMap на web; Leaflet внутри `react-native-webview` для основной native-карты |
| Rich text | `react-native-render-html`, Quill editor на web |
| Медиа | `expo-image`, upload helpers, CDN/media URL normalization |
| Auth storage | `expo-secure-store` через `utils/secureStorage.ts`; AsyncStorage для несекретного состояния |
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
ThemedPaperProvider
  -> AuthProvider или fallback AuthContext
    -> FavoritesProvider или fallback FavoritesContext
      -> QueryClientProvider
        -> route subtree
```

На native провайдеры монтируются напрямую. На web есть механизм deferred runtime,
но travel details держит auth/favorites providers mounted, чтобы не перемонтировать
весь route subtree и не проигрывать skeleton повторно.

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
| `/trips/:tripId` | `app/(tabs)/trips/[tripId].tsx` | Детальная страница публичной поездки |
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

Минимальный Node baseline: `>=20.19.4`.

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
