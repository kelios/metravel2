---
description: Правила для компонентов с фото (ImageCardMedia / UnifiedTravelCard)
---

# Компоненты с фото: правила и шаблон

Этот документ описывает единый подход к компонентам, которые показывают **фото/изображение**.

## Базовый принцип

- Если компонент — это **карточка** (кликабельный контейнер с оверлеями, текстом, бейджами):
  - Используй `UnifiedTravelCard`.
- Если нужен только **медиа-блок** (изображение внутри любого layout):
  - Используй `ImageCardMedia`.

## Когда использовать `UnifiedTravelCard`

Используй `UnifiedTravelCard`, если:

- есть кликабельность (`onPress`)
- есть оверлеи (кнопки в углах, чекбоксы выбора, бейджи)
- нужен единый контейнер с одинаковой геометрией на web/native

Минимально необходимые пропсы:

- `title`
- `imageUrl` (может быть `null`)
- `onPress`

Рекомендуемые пропсы:

- `testID` (обязательно для карточек, используемых в тестах)
- `containerOverlaySlot` / `leftTopSlot` / `rightTopSlot` / `contentSlot`
- `mediaProps.placeholderBlurhash` для LQIP

## Когда использовать `ImageCardMedia`

Используй `ImageCardMedia`, если:

- изображение — часть layout, но **не** является карточкой
- нужно управлять `fit`/placeholder отдельно

Обязательные параметры:

- `src`
- `alt` (на web)

Рекомендуемые параметры:

- `loading` и `priority` (на web)
- `placeholderBlurhash`

## Плейсхолдер/стаб изображения

Требования:

- Если `imageUrl` отсутствует или невалидный — показываем плейсхолдер (stub).
- Для тестов stub должен иметь `testID="image-stub"` (реализовано в `UnifiedTravelCard`).

## `testID` правила

- Карточка:
  - Передавай `testID` в `UnifiedTravelCard`.
  - На web для клика по карточке в тестах используй отдельный контейнер `testID` только если это действительно нужно.
- Если есть selectable-режим (чекбокс/оверлей выбора):
  - Интерактивный элемент выбора должен иметь `testID="selection-checkbox"`.
- Метаданные, которые проверяются тестами:
  - Блок просмотров должен иметь `testID="views-meta"`.

## Web vs Native: кликабельность и доступность

- На web избегай вложенности интерактивных элементов (button внутри button / link внутри button).
- Если карточка на web должна быть «как View», используй `UnifiedTravelCard` с:
  - `webAsView={true}`
  - `webPressableProps={...}`

Клавиатура (web):

- Для интерактивных элементов обеспечь обработку `Enter` и `Space`.

## LCP/производительность (web)

- Для первой карточки в списке допускается повышенный приоритет:
  - `mediaProps.priority="high"`
  - `mediaProps.loading="eager"`
- Избегай `preload`, если компонент может не смонтироваться сразу — лучше `prefetch`, чтобы не ловить warning “preloaded but not used”.

## Шаблон (карточка с фото)

- Используй `UnifiedTravelCard`.
- Оверлеи клади в `rightTopSlot`/`leftTopSlot` или `containerOverlaySlot`.
- В `mediaProps` передавай LQIP.

## Чеклист перед merge

- [ ] Компонент использует `UnifiedTravelCard` или `ImageCardMedia`
- [ ] Нет вложенных интерактивных элементов на web
- [ ] Есть нужные `testID` (если компонент покрыт тестами)
- [ ] `npm test` зелёный
