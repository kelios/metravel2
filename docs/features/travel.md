# Фича: travel

**Последняя актуализация:** 2026-04-17
**Ответственный:** team

## TL;DR

Создание, отображение и управление путешествиями: список с фильтрацией → деталь с картой/галереей/рейтингом/комментариями → wizard создания/редактирования → публикация и экспорт.

## Точки входа

| Путь | Назначение |
|------|-----------|
| `app/(tabs)/metravel.tsx` | Главный экран со списком |
| `app/(tabs)/travel/[id].tsx` | Детальная страница по ID |
| `app/(tabs)/travel/new.tsx` | Создание (wizard) |
| `app/(tabs)/travels/[param].tsx` | Поиск/фильтр по параметру |
| `app/(tabs)/travelsby.tsx` | Список путешествий автора |

## Ключевые компоненты

### Список (`components/listTravel/`)

| Файл | LOC | Роль |
|------|-----|------|
| `ListTravelBase.tsx` | 832 | Корень: фильтры, сортировка, пагинация |
| `TravelListItem.tsx` | 674 | Карточка в списке |
| `RightColumn.tsx` | 672 | Сайдбар деталей фильтров |
| `RecommendationsTabs.tsx` | 591 | Табы рекомендаций |
| `ModernFilters.tsx` | 574 | UI фильтров |
| `filters/` | — | Чекбоксы/радио/сортировка |
| `hooks/` | — | `useListTravelData`, `useListTravelFilters`, `useListTravelVisibility` |

### Детали (`components/travel/details/`)

| Файл | Роль |
|------|------|
| `TravelDetailsLazy.tsx` | Корень деталей, lazy-load |
| `TravelDetailsAccessibilityChrome.tsx` | A11y обёртка |
| `TravelDetailsErrorStates.tsx` | Ошибки |
| `sections/TravelDetailsContentSection.tsx` | Основной контент |
| `sections/TravelDetailsMapSection.tsx` | Блок карты |
| `sections/TravelRouteMapBlock.tsx` | Отрисовка маршрута |
| `sections/TravelPointsBlock.tsx` | POI блок |
| `sections/TravelWeatherBlock.tsx` | Погода |
| `sections/ExcursionsSection.tsx` | Экскурсии |
| `sections/LazyYouTubeSection.tsx` | YouTube embed |

### Wizard (`components/travel/`)

| Файл | LOC | Шаг |
|------|-----|-----|
| `UpsertTravel.tsx` | — | Корень wizard |
| `TravelWizardStepMedia.tsx` | 524 | Фото/видео |
| `TravelWizardStepRoute.tsx` | **1055** 🔴 | Маршрут GPX |
| `TravelWizardStepPublish.tsx` | **1232** 🔴 | Публикация |
| `TravelWizardStepDetails.tsx` | — | Описание, страны |
| `CompactSideBarTravel.tsx` | **1237** 🔴 | Сайдбар деталей |
| `UnifiedSlider.tsx` | 817 🟡 | Слайдер фото |

🔴 — >1000 LOC, приоритет распила. 🟡 — >800 LOC.

## Данные

### React Query

| Хук / функция | Файл | Назначение |
|---------------|------|-----------|
| `fetchTravels` | `api/travelListQueries.ts` | Список с фильтрами/сортировкой/пагинацией |
| `fetchTravelFacets` | `api/travelListQueries.ts` | Фасеты (страны, сложность, duration) |
| `fetchRandomTravels` | `api/travelListQueries.ts` | Случайный набор |
| `fetchTravel` | `api/travelDetailsQueries.ts` | Детали по ID |
| `fetchTravelBySlug` | `api/travelDetailsQueries.ts` | Fallback по slug (SEO) |
| `fetchMyTravels` | `api/travelUserQueries.ts` | Мои (draft/published) |
| `rateTravel` | `api/travelRating.ts` | Оценка |
| `deleteTravel` | `api/travelsMutations.ts` | Удаление |
| `markTravelAsFavorite` | `api/travelsFavorites.ts` | Избранное |
| `listTravelRouteFiles` | `api/travelRoutes.ts` | Файлы маршрута |
| `uploadTravelRouteFile` | `api/travelRoutes.ts` | Загрузка маршрута |

**QueryKey (паттерны):** `['travels','list',filters,sort,page]`, `['travels','facets',search]`, `['travel',id]`, `['travels','myTravels']`, `['travel',id,'rating']`.

### Zustand

| Store | Файл | Отвечает за |
|-------|------|-------------|
| `useTravelSectionsStore` | `stores/travelSectionsStore.ts` | Nonce для открытия секций |
| `favoritesStore` | `stores/favoritesStore.ts` | Кэш избранного + синк |
| `recommendationsStore` | `stores/recommendationsStore.ts` | Кэш рекомендаций |
| `viewHistoryStore` | `stores/viewHistoryStore.ts` | История просмотров |

## Hooks

| Хук | Назначение |
|-----|-----------|
| `useTravelDetails` | Состояние деталей (loading/data/error) |
| `useTravelDetailsLayout` | Layout (сайдбар, секции) |
| `useTravelDetailsMenu` | Меню действий |
| `useTravelDetailsNavigation` | Переход между деталями |
| `useTravelDetailsPerformance` | Профилирование |
| `useTravelDetailsScrollState` | Скролл |
| `useTravelDetailsTrace` | Отладочные трассы |
| `useTravelFilters` | Фильтры списка |
| `useTravelFormData` | Формы wizard/edit |
| `useTravelHeroState` | Hero (избранное, шеринг) |
| `useTravelPrefetch` | Prefetch соседних |
| `useTravelPreview` | Preview-модалка |
| `useTravelRating` | Рейтинг |
| `useTravelRouteFiles` | Файлы маршрута |
| `useTravelWizard` | Wizard (шаг, draft) |

## Utils

- `utils/travelFormUtils.ts`, `utils/travelFormNormalization.ts` — валидация и нормализация форм
- `utils/travelWizardValidation.ts` — валидация шагов
- `utils/travelSeo.ts` — SEO-теги
- `utils/travelMedia.ts`, `utils/travelPointMeta.ts` — медиа и POI
- `utils/travelDetailsSecure.ts` — защита приватных данных

## Тесты

- **Unit:** `__tests__/api/travels*.test.ts`, `__tests__/utils/travel*.test.ts`, `__tests__/hooks/useTravel*`
- **E2E (22 файла):** `e2e/travels.spec.ts`, `travel-full-flow.spec.ts`, `travel-crud.spec.ts`, `travel-detail-page.spec.ts`, `travel-details-perf-budget.spec.ts`, `seo-travel-detail.spec.ts`, и др.

## Внешние зависимости

- Endpoints: `/travels`, `/travels/{id}`, `/travels/{id}/rating`, `/travels/{id}/favorites`, `/travels/{id}/route-files`, `/travels/{id}/comments`, `/travels/facets`, `/travels/random`
- Env: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_CDN_URL`
- Хранилище: AsyncStorage (избранное, история), SecureStorage (токены)

## Известные боли

- **Распил** — 4 файла >800 LOC (см. ADR/план спринта)
- **Перформанс деталей** — бюджет в `e2e/travel-details-perf-budget.spec.ts`, планы в `docs/TRAVEL_PERFORMANCE_REFACTOR.md`
- **SEO** — статическая генерация через `travelSeo.ts`, fallback по slug на 404

## Связанные документы

- `docs/TRAVEL_DETAILS_REFACTORING.md`
- `docs/TRAVEL_PERFORMANCE_REFACTOR.md`
- `docs/features/map.md` — карта деталей завязана на map-фичу
