# ТЗ: переработка Skeleton/Loading UI (Web + iOS + Android)

## 1) Контекст

Сейчас skeleton’ы реализованы разными способами и местами не совпадают по геометрии с реальным контентом. На Web это приводит к высокому **CLS (Cumulative Layout Shift)** и ухудшению LCP/INP. На native избыточные анимации и/или большое количество placeholder-элементов может ухудшать плавность скролла и отклик.

Документ фиксирует целевую архитектуру skeleton-системы, правила производительности и тестовые/CI-гейты, чтобы изменения были проверяемыми и «всё было зелёное» в CI.

## 2) Цели

- Убрать layout jumps при замене skeleton → контент (Web + Native).
- Снизить CLS на ключевых Web-страницах до целевых значений.
- Обеспечить единый подход и единые токены размеров для skeleton и реального UI.
- Сделать поведение загрузки предсказуемым (без мерцаний, без двойного рендера).
- Добавить тесты и автоматические гейты (unit + e2e + perf), совместимые с текущими `yarn` скриптами.

## 3) Область работ (scope)

### 3.1 Платформы

- Web (React Native Web / Expo)
- iOS (Expo / RN)
- Android (Expo / RN)

### 3.2 Ключевые экраны (минимальный набор)

- Список путешествий (travels list)
- Детали путешествия (travel details)

Дальше расширяем на остальные страницы/секции (главная, рекомендации, профайл и т.п.) по мере миграции.

## 4) Проектные вводные (из документации репозитория)

- Роутинг/страницы: `app/` (Expo Router)
- UI компоненты: `components/`
- Бизнес-логика/сервисы: `src/`
- Утилиты: `utils/`
- Тесты: `__tests__/`

Гигиена:

- Предпочитать dev-only logging через `src/utils/logger.ts`.
- Держать web console чистой в production.

## 5) Текущее состояние (по репозиторию)

## 5.3 Статус выполнения по этому ТЗ (что уже сделано / что осталось)

- **Сделано**
  - Единый источник правды для размеров карточек/изображений списка путешествий (используются централизованные константы из `components/listTravel/utils/listTravelConstants.ts`).
  - Приведена геометрия skeleton-карточки к реальной карточке на ключевом экране списка (фиксированная высота image container, корректные отступы/структура в `components/SkeletonLoader.tsx`).
  - Убрано одновременное отображение skeleton и реального списка (exclusivity `initialLoading` на экране списка путешествий).
  - Anti-flicker: добавлена задержка показа skeleton на экране списка (через `RightColumn.tsx`).
  - Web reduced motion: shimmer отключается при `prefers-reduced-motion` (в базовом `SkeletonLoader`).
  - Native reduced motion: shimmer отключается/становится статическим placeholder (в `components/listTravel/ListTravelSkeleton.tsx` через `AccessibilityInfo.isReduceMotionEnabled()`).
  - Ограничено количество skeleton-карточек для производительности (cap для web/mobile в `components/listTravel/ListTravelSkeleton.tsx` и в логике списка).
  - Удалён неиспользуемый параллельный skeleton-подход (`components/listTravel/TravelContent.tsx`) и связанный тест.
  - Обновлены/добавлены unit-тесты по parity/эксклюзивности/модели (в т.ч. `__tests__/components/SkeletonLoader.test.tsx`).
  - Добавлен/усилен web e2e сценарий перехода skeleton → content без сильных layout shifts (`e2e/skeleton-transition.spec.ts`).
  - Исправлены падения тестов, возникшие при рефакторингах (например, `AuthorCard` fallback и моки для `HeaderContextBar`).

- **Осталось (follow-up / расширение после базового scope)**
  - Расширить единые building blocks (`SkeletonBlock`, `SkeletonTextLines`, и т.п.) на остальные экраны вне минимального набора (главная/рекомендации/профиль и т.д.).
  - Добавить детерминированный CLS gate (автоматический замер CLS) для ключевых страниц, если инфраструктура позволит (сейчас покрыто e2e проверками стабильности размеров).
  - Провести/зафиксировать native smoke-check (ручной чек-лист) на реальных симуляторах/устройствах для регресса прокрутки.

### 5.1 Skeleton-компоненты, найденные в коде

- `components/SkeletonLoader.tsx`
  - `SkeletonLoader`
  - `TravelCardSkeleton`, `TravelCardReserveSkeleton`
  - `TravelListSkeleton` (на web строит сетку по колонкам)
- `components/listTravel/ListTravelSkeleton.tsx` (крупный skeleton-экран для страницы листинга)
- `components/travel/TravelDetailSkeletons.tsx` + `components/travel/details/TravelDetailsContainer.tsx`

### 5.2 Текущие тесты

- `__tests__/components/SkeletonLoader.test.tsx` содержит базовые проверки рендера и часть проверок стабильности размеров.

## 6) Проблемы (root causes)

- **Несовпадение геометрии** skeleton и контента (высоты, ширины слотов, отступы, правила грид-сетки).
- **Два параллельных подхода** к skeleton (общий `SkeletonLoader` и отдельный `ListTravelSkeleton`), что усложняет гарантию идентичного layout.
- **Анимации/объём DOM/Views**: на web множество shimmer-элементов увеличивает стоимость отрисовки; на native анимации могут ухудшать scroll.
- **Изображения**: если место под медиа не зарезервировано стабильно, контент после загрузки вызывает shift.

## 7) Целевая архитектура

### 7.1 Принципы (обязательные)

- Skeleton — это **геометрическая модель** будущего UI: layout box должен совпадать.
- Skeleton не должен приводить к **layout-affecting изменениям** при замене на контент.
- Изображения/медиа — всегда **reserved space** (фиксированная высота или aspect ratio + ограничения).
- Удалить/минимизировать тяжёлые анимации на длинных списках.
- Учитывать reduced motion:
  - Web: `prefers-reduced-motion`
  - Native: системные настройки

### 7.2 Single Source of Truth для размеров

Ввести/расширить централизованные токены размеров для:

- Карточек (высота изображения, высоты текстовых линий, общий размер карточки на web при необходимости).
- Слота в гриде (min/max width, flexBasis и т.п.).
- Элементов страницы (sidebar width, search bar height, padding/gap по брейкпоинтам).

Требование: **те же токены** должны использоваться и в skeleton, и в реальном UI.

### 7.3 Библиотека building blocks

Сформировать набор переиспользуемых блоков:

- `SkeletonBlock` (прямоугольник)
- `SkeletonTextLines` (несколько линий текста)
- `SkeletonImage` (строгий reserved space для изображения)
- `SkeletonCardSlot` (контейнер слота — единый для skeleton и контента)

На их основе собрать:

- `TravelCardSkeleton`
- `ListPageSkeleton` (sidebar + search + grid)
- `TravelDetailsSkeleton`

## 8) Правила отображения (anti-flicker)

- Skeleton показываем только при `initialLoading`.
- `refresh` / `loadMore` не должны перестраивать всю страницу.
- Ввести минимальное время показа skeleton (например, 150–250ms) для предотвращения мигания при мгновенных ответах.

## 9) Performance требования

### 9.1 Web

- Ограничить количество skeleton карточек на странице (примерно):
  - Desktop: 9–12
  - Mobile: 4–6
- Shimmer через CSS предпочтительнее JS-анимаций.
- Поддержать `prefers-reduced-motion` (отключать shimmer).

### 9.2 Native

- Избегать бесконечных loop-анимаций на большом количестве элементов.
- Для длинных списков допускать статический skeleton (без shimmer) либо малое количество элементов.

## 10) Тестирование

### 10.1 Unit / Component tests (Jest + RTL)

Добавить тесты на **parity размеров**:

- `TravelCardSkeleton` vs реальная карточка:
  - высота image container
  - borderRadius
  - основные отступы
- `Grid slot sizing` (Web):
  - `minWidth/maxWidth/flexBasis` совпадает у skeleton и контента
- `initialLoading` exclusivity:
  - skeleton и контент не рендерятся одновременно
- reduced motion:
  - shimmer отключён / заменён на статический placeholder

### 10.2 Web E2E (Playwright)

Запуск: `yarn e2e`

Факт по текущему проекту:

- `playwright.config.ts` поднимает webServer автоматически через Expo: `CI=1 npx expo start -c --web`.

Сценарии:

- Travels list initial load (с контролируемой задержкой ответа)
- Transition skeleton → content
- Travel details initial load

### 10.3 Web perf gates

Для ключевых страниц фиксируем минимальные гейты:

- CLS <= 0.10

Далее (после стабилизации моков и окружения) добавляем:

- LCP <= 2.5s
- INP <= 200ms

Важно: метрики должны сниматься в детерминированном окружении (фикс viewport, контролируемая сеть/моки), иначе тесты будут флейкать.

### 10.4 Native smoke

Минимум:

- проверка отсутствия визуальных прыжков на симуляторе/эмуляторе (ручная + чек-лист)

Для CI:

- nightly/релизные сборки через EAS профили.

## 11) CI / «всё зелёное» (Yarn)

Опираемся на текущие скрипты `package.json`:

- Unit (CI): `yarn test:ci`
- Coverage: `yarn test:coverage`
- Web E2E: `yarn e2e`
- Web build export: `yarn build:web`
- Utility: `yarn check-deps`
- EAS builds:
  - iOS: `yarn ios:build:preview` / `yarn ios:build:prod`
  - Android: `yarn android:build:preview` / `yarn android:build:prod`
  - All: `yarn build:all:preview` / `yarn build:all:prod`

Рекомендуемая матрица:

- PR gate:
  - `yarn check-deps`
  - `yarn test:ci`
  - `yarn e2e`
- Nightly / release gate:
  - `yarn test:coverage`
  - `yarn build:web`
  - `yarn build:all:preview` (nightly) / `yarn build:all:prod` (release)

## 12) План внедрения (по этапам)

1) Инвентаризация страниц и их skeleton-стейтов, фиксация токенов размеров.
2) Внедрение building blocks и миграция Travels list (главный источник CLS).
3) Миграция Travel details.
4) Подключение unit parity tests и web perf gates (CLS → затем LCP/INP).
5) Расширение на остальные страницы.

## 13) Критерии готовности

- Skeleton и контент используют единые токены размеров.
- На Web ключевые страницы проходят CLS gate.
- `yarn test:ci` и `yarn e2e` стабильно зелёные.
- На native нет визуальных прыжков и ухудшения скролла на листинге.
