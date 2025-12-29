---
description: План рефакторинга: единый универсальный медиа-слой и карточки с изображениями
---

# Цель

Свести все карточки/плитки/элементы списка с изображениями к **единому переиспользуемому медиа-слою** (далее `ImageCardMedia`) и минимальному набору обёрток под доменные сценарии (например `TravelCard*`).

Ожидаемый эффект:
- единое визуальное поведение (blur-bg + overlay + contain/cover)
- меньше дублей кода (особенно web/native различий)
- проще поддержка LCP/lazy/preload
- меньше регрессов при изменениях дизайна

# UI contract (зафиксировано)

- **Медиа-слой (везде)**: `ImageCardMedia`
- **Шаблон карточки (Travel cards)**: `UnifiedTravelCard`

#- **Высота изображения (фиксированная)**:
  - mobile: `180px`
  - web/desktop: `200px`
- **LCP (web)**: оптимизируем только **первую карточку списка**, остальные — lazy.

## Export/selectable (важно)

- В режиме экспорта (выбор карточек, `selectable=true`) не показываем кнопку избранного (лайк) в правом верхнем углу.
  Иначе она пересекается с чекбоксом выбора.

# Прогресс (чеклист)

- [x] Milestone 0 — зафиксировать UI contract (contain + blur, высоты 180/200, LCP только первая карточка на web)
- [x] Milestone 1 — создать `components/ui/ImageCardMedia.tsx`
- [x] Milestone 2 — миграция `TabTravelCard` на `ImageCardMedia`
- [x] Milestone 3 — миграция `TravelCardCompact` на `ImageCardMedia` (высота 180/200)
- [x] Milestone 4 — миграция `TravelListItem` на `ImageCardMedia` (удалены `WebImageOptimized`/`NativeImageOptimized`)
- [x] Миграция `AuthorCard` (аватар автора) на `ImageCardMedia`
- [x] Миграция `PointList` / `PointCard` (изображение точки) на `ImageCardMedia`
- [x] Миграция `CompactSideBarTravel` (аватар) на `ImageCardMedia`
- [x] Миграция `CustomImageRenderer` (картинки в HTML) на `ImageCardMedia`
- [x] Milestone 5 — LCP унификация (удалены неиспользуемые `LCPOptimizedTravelCard`/`OptimizedLCPImage`)
- [x] Milestone 6 — уборка legacy (удалён `components/OptimizedImage.tsx` (legacy), оставлен `components/ui/OptimizedImage.tsx`)
- [x] Унификация внешнего вида: добавлен `components/ui/UnifiedTravelCard.tsx`
- [x] `TabTravelCard` и `TravelCardCompact` переведены на `UnifiedTravelCard`
- [x] Миграция `components/travel/NavigationArrows.tsx` на `ImageCardMedia` (и `prefetchImage`)
- [x] Миграция `components/travel/Slider.tsx` на `ImageCardMedia` (с сохранением API `imageProps`)
- [x] Миграция `components/travel/details/TravelDetailsContainer.tsx` (герой-изображение на native + превью YouTube) на `ImageCardMedia`
- [x] Миграция `app/(tabs)/about.tsx` (превью YouTube на native) на `ImageCardMedia`
- [x] Фикс источников thumbnail в `components/travel/TravelTmlRound.tsx` (поддержка camelCase `travelImageThumbUrl*` для секций "Популярные"/"Рядом")

## Тесты

- [x] `npm run test` после Milestone 2–4
- [x] `npm run test` после миграции `AuthorCard` и `PointList`
- [x] `npm run test` после миграции `CompactSideBarTravel` и `CustomImageRenderer`
- [x] `npm run test` после удаления LCP/legacy файлов
- [x] `npm run test` после добавления `UnifiedTravelCard` и миграции `TabTravelCard`/`TravelCardCompact`
- [x] `npm run test` после миграции `NavigationArrows`/`Slider`/`TravelDetailsContainer`/`about.tsx` и фикса `TravelTmlRound`
- [x] `UnifiedTravelCard`: добавлен `heroTitleOverlay` (единый hero-оверлей без дублей в фичах)
- [x] `TravelListItem`/`TabTravelCard`: hero-оверлей больше не дублируется, используется через `UnifiedTravelCard`
- [x] Export: в `selectable=true` скрываем лайк, чтобы элементы не наезжали

# Правило для дальнейшей разработки (важно)

Если в проекте нужно добавить **любой новый компонент/карточку с изображением**, используем:

- `metravel2/components/ui/ImageCardMedia.tsx` — для медиа-слоя (contain + blur, loading/priority)

и **не создаём** новые компоненты вида `*Optimized*Image*`, `*CardImage*`, `*WebImage*`, `*NativeImage*` и т.п.

Исключения допускаются только если:

- требуется принципиально другой рендеринг (например чистый DOM/CSS вне RN), или
- есть измеримая причина по производительности/доступности, и изменение согласовано (с обновлением этого документа).

# Текущее состояние (обнаруженные дубли)

## Travel / карточки
- `UnifiedTravelCard` — единый шаблон карточки с изображением.
- `ImageCardMedia` — единый медиа-слой.

Ожидаемо остаются доменные обёртки (для действий/мета/навигации), но они не должны содержать свой собственный шаблон hero-оверлея.

## Базовые изображения
- `metravel2/components/ui/OptimizedImage.tsx`
  - expo-image + blur background + placeholder blurhash + loading indicator + web props (`loading`, `fetchpriority`, `alt`)

Примечание:

- legacy `metravel2/components/OptimizedImage.tsx` удалён.
- отдельный `OptimizedLCPImage` удалён (LCP-режим включается через пропсы `ImageCardMedia`/`UnifiedTravelCard` на первой карточке web).

## Вне Travel
- `metravel2/components/MapPage/PopupContentComponent.tsx`
  - web DOM `<img>` + CSS blur через `::before`
  - не является прямой целью унификации RN-компонентов, но паттерн аналогичный

# Принципы целевой архитектуры

## 1) Не «один мегакомпонент на всё», а один медиа-компонент + тонкие обёртки

- `ImageCardMedia` отвечает только за визуал изображения и loading:
  - `src`/`source`
  - `fit`: `contain`
  - blur background
  - overlay
  - placeholder/skeleton
  - web: `loading`, `fetchpriority`, optional `prefetch`

- Доменные карточки (`TravelListItem`, `TabTravelCard`, `TravelCardCompact`) отвечают за:
  - layout (высоты/отступы)
  - тексты/мета
  - действия (favorite/share/edit/delete)
  - навигацию

## 2) Один “source of truth” для картинок

За основу берём **`metravel2/components/ui/OptimizedImage.tsx`** (expo-image), потому что он:
- уже универсален
- учитывает web props
- содержит placeholder/loader

Второй `components/OptimizedImage.tsx` считаем legacy и постепенно выводим из использования.

# Что именно создаём/меняем

## Новый компонент: `components/ui/ImageCardMedia.tsx`

Единый медиа-слой для карточек.

### Предлагаемый контракт пропсов (черновик)
- `src?: string | null` (или `source?: { uri: string } | number`)
- `alt?: string`
- `height?: number` (или `style` контейнера)
- `borderRadius?: number`
- `fit?: 'contain' | 'cover'` (по умолчанию: `contain` для Travel карточек)
- `blurBackground?: boolean` (по умолчанию: `true`)
- `blurRadius?: number` (default: 14–18)
- `overlayColor?: string` (default: `'rgba(255,255,255,0.12)'`)
- `placeholderBlurhash?: string`
- `priority?: 'low' | 'normal' | 'high'` (внутрь `OptimizedImage`)
- `loading?: 'lazy' | 'eager'` (web)
- `prefetch?: boolean` (web, только если `priority==='high'`)
- `testID?: string`

### Внутренняя реализация
- использовать `components/ui/OptimizedImage.tsx`
- для blur-bg использовать `blurBackground` в `OptimizedImage`
- не хранить бизнес-логику (никаких роутов, favorite и т.д.)

## Приведение карточек к единому медиа-слою

### 1) `TravelListItem.tsx`
- убрать внутренние `WebImageOptimized` / `NativeImageOptimized`
- заменить на `ImageCardMedia`
- сохранить текущие константы высот (`TRAVEL_CARD_IMAGE_HEIGHT`, etc.)

### 2) `TabTravelCard.tsx`
- заменить блок с двумя `ExpoImage` и overlay на `ImageCardMedia`
- сохранить gradient и badge поверх

### 3) `TravelCardCompact.tsx`
- заменить `react-native Image` на `ImageCardMedia` (привести поведение к общему стилю)
- сохранить gradient / favorite / views

### 4) LCP
Цель: не держать отдельные сущности, если можно включать режим через пропсы.

- Вариант 1 (предпочтительно):
  - оптимизировать только **первую карточку списка на web** через `ImageCardMedia`:
    - `priority="high"`
    - `loading="eager"`
    - `prefetch` (а не `preload`, чтобы снизить риск warning “preloaded but not used”)
  - заменить `LCPOptimizedTravelCard` на обычную карточку + режимы выше
  - отдельные LCP-компоненты не используем; режим включается через пропсы.

# Таблица «что на что меняем» (первая волна)

| Сейчас | Будет | Комментарий |
|---|---|---|
| `listTravel/TravelListItem.tsx` (`WebImageOptimized`, `NativeImageOptimized`) | `ui/ImageCardMedia.tsx` | выносим дубли в единое место |
| `listTravel/TabTravelCard.tsx` (двойной `ExpoImage`) | `ui/ImageCardMedia.tsx` | оставляем gradient/badge поверх |
| `TravelCardCompact.tsx` (`Image`) | `ui/ImageCardMedia.tsx` | унифицируем рендер и кэш |
| `listTravel/LCPOptimizedTravelCard.tsx` | `TravelListItem`/`TravelCard` + `ImageCardMedia priority='high'` | убираем отдельную ветку карточек |
| `components/OptimizedImage.tsx` | удалено | legacy удалён, используем `components/ui/OptimizedImage.tsx` |

# Пошаговый план рефакторинга (milestones)

Статус: milestones ниже выполнены. Раздел оставлен как исторический план/чеклист.

## Milestone 0 — фиксация целевого поведения (обязательное решение до кода)
Решить и зафиксировать:
- `fit` по умолчанию: `contain` или `cover`?
- единая высота изображения для travel карточек (например 180/200) или разные пресеты?
- LCP: оптимизируем только первую карточку на web или ещё hero/главную?

**Выход**: короткий “UI contract” в начале этого документа (обновить значения по факту решения).

## Milestone 1 — создать `ImageCardMedia`
- добавить `components/ui/ImageCardMedia.tsx`
- использовать `components/ui/OptimizedImage.tsx` как базу
- реализовать:
  - blur background + overlay
  - fit contain/cover
  - placeholder
  - web loading/priority

**Критерии готовности**:
- компонент можно вставить в любую карточку без доп. логики
- не ломает типы

## Milestone 2 — миграция `TabTravelCard`
- заменить изображение на `ImageCardMedia`

**Критерии готовности**:
- визуально без изменений
- badge и gradient работают

## Milestone 3 — миграция `TravelCardCompact`
- заменить изображение на `ImageCardMedia`

**Критерии готовности**:
- нет layout shifts
- favorite и views поверх работают

## Milestone 4 — миграция `TravelListItem`
- заменить изображение на `ImageCardMedia`
- удалить `WebImageOptimized`/`NativeImageOptimized` из файла

**Критерии готовности**:
- не ухудшили скролл
- изображения грузятся на web и native
- нет мерцания/скачков размера

## Milestone 5 — LCP унификация
- заменить `LCPOptimizedTravelCard` на общую карточку в LCP-режиме
- решить судьбу `OptimizedLCPImage`

**Критерии готовности**:
- web LCP для первой карточки не ухудшился
- нет warning “preloaded but not used”

## Milestone 6 — уборка legacy
- найти и мигрировать оставшихся потребителей `components/OptimizedImage.tsx`
- при необходимости:
  - переименовать legacy компонент (если нельзя удалить сразу)
  - добавить lint/grep правило для запрета новых импортов

# Риски и регресс-чек

## Риски
- различия web/native (IntersectionObserver, `<img>` vs `expo-image`)
- изменение fit (contain vs cover) может менять композицию карточек
- preload/prefetch может вызвать warnings или лишнюю сеть

## Регресс-чек (ручной)
- ListTravel: grid/list, mobile/desktop/web
- Recommendations tabs (TabTravelCard)
- Home (TravelCardCompact)
- Favorite button overlays/hover actions
- First card LCP на web

# Как работать с задачей безопасно

- Мигрировать **по одному компоненту за раз**.
- После каждого milestone запускать тесты и/или быстрый ручной прогон.
- Не менять дизайн одновременно с рефакторингом.

# Done criteria (когда можно считать перенос завершённым)

- [x] В проекте не осталось импортов `components/OptimizedImage.tsx` (кроме случаев, где явно принято решение оставить legacy).
- [x] Все карточки/компоненты с фото используют `ImageCardMedia` (напрямую или через `UnifiedTravelCard`).
- [x] Для компонентов с фото соблюдены правила из `docs/image-components.md`.
- [ ] Пройден регресс-чек из этого документа.
- [x] `npm test` зелёный.
- [x] Hero-оверлей не дублируется в фич-компонентах (используем `UnifiedTravelCard.heroTitleOverlay`).
- [x] В export/selectable режиме нет пересечений UI-элементов (лайк скрыт, остаётся чекбокс).

# Cleanup (удаление демо/legacy файлов)

Следующие файлы являются демо/legacy и не используются в приложении (на момент последнего прогона), а также исключены из TS-компиляции через `tsconfig.json`:

- `metravel2/components/ui/ModernTravelCard.tsx`
- `metravel2/components/ui/examples/ModernListTravel.tsx`

Их можно удалить, чтобы не держать мёртвый код.

# Что ещё нужно сделать (чтобы «везде один компонент» реально выполнялось)

## A) Завершить миграцию оставшихся прямых использований `expo-image`

Цель: **в прикладных компонентах** не импортировать `expo-image` напрямую.
`expo-image` должен использоваться только в низкоуровневом слое (`components/ui/OptimizedImage.tsx`) и/или внутри `ImageCardMedia`.

Остаток (по grep на момент последнего прогона):

- [x] `metravel2/components/MapPage/AddressListItem.tsx`
- [x] `metravel2/components/MapPage/Map.android.tsx`
- [x] `metravel2/components/MapPage/Map.ios.tsx`
- [x] `metravel2/components/travel/NavigationArrows.tsx`
- [x] `metravel2/components/travel/Slider.tsx`
- [x] `metravel2/components/travel/details/TravelDetailsContainer.tsx`
- [x] `metravel2/app/(tabs)/about.tsx`

Принцип замены:

- если это «просто картинка» внутри layout — заменить на `ImageCardMedia`
- если это «карточка» (кликабельная, оверлеи, действия) — заменить на `UnifiedTravelCard`

## B) Завершить миграцию оставшихся прямых использований `OptimizedImage` в фичах

Цель: `OptimizedImage` не импортируется напрямую из фич-компонентов; вместо него — `ImageCardMedia`.

- [x] Проверить, что `components/travel/ImageGalleryComponent.web.tsx` использует `ImageCardMedia`.
- [x] Проверить, что `components/travel/ImageGalleryComponent.ios.tsx` использует `ImageCardMedia`.

## C) Закрепить запрет на новые legacy-импорты

- [x] Добавить простой «guard» (grep/lint/CI check) чтобы запрещать:
  - новые импорты `expo-image` в `components/**` (кроме `components/ui/OptimizedImage.tsx`)
  - новые импорты `components/ui/OptimizedImage` вне `components/ui/ImageCardMedia.tsx`

## D) Зафиксировать архитектурное правило

- [x] Во всех PR: любые новые UI с фото должны соответствовать `docs/image-components.md`.

