---
description: Нормализация фильтров для Travel Wizard (шаг 5)
---

# Зачем это нужно

В Travel Wizard (создание/редактирование путешествия) шаг 5 использует `MultiSelectField` (внутри `SimpleMultiSelect`).

`SimpleMultiSelect` ожидает, что `data` — это массив объектов, и что у каждого элемента есть поля:

- для большинства фильтров: `id` и `name`
- для стран: `country_id` и `title_ru`

Если вместо этого в UI попадают строки, `[]`, или объекты с другими ключами, то селекты визуально становятся "пустыми" (в модалке будет "Ничего не найдено").

Проблема особенно проявляется при создании нового путешествия и быстром переходе на шаг 5: `filters` может быть частично загружен или иметь другой shape.

# Где происходит нормализация

## 1) UpsertTravel

`components/travel/UpsertTravel.tsx` отвечает за загрузку фильтров через API (`fetchFilters`) и приводит данные к ожидаемому виду.

Ключевые принципы:

- API может возвращать категории в разных полях (`categories`, `categoriesTravel`, `travelCategories`).
- Нормализация превращает любые входные форматы в список объектов `{ id: string; name: string }`.
- Для устойчивости добавлены fallback-значения через `initFilters()` и в error-path.

## 2) FiltersUpsertComponent (UI-щит)

`components/travel/FiltersUpsertComponent.tsx` делает дополнительную защиту на уровне UI:

- Резолвит массивы по нескольким возможным ключам (например `categories`/`categoriesTravel`/`travelCategories`).
- Нормализует каждый список в корректный формат для `MultiSelectField`.

Это гарантирует, что даже если `filters` пришёл неидеальным из-за гонки/частичной загрузки, шаг 5 не окажется пустым.

# Контракт MultiSelectField

`components/MultiSelectField.tsx` принимает:

- `items`: массив объектов
- `labelField`: имя поля для отображаемого текста
- `valueField`: имя поля для значения

На шаге 5 используются следующие контракты:

- Категории/транспорт/сложность/компаньоны/ночлег/месяц:
  - `labelField = "name"`
  - `valueField = "id"`
- Страны:
  - `labelField = "title_ru"`
  - `valueField = "country_id"`

# Регрессионные тесты

Добавлены тесты:

- `__tests__/components/travel/FiltersUpsertComponent.filtersNormalization.test.tsx`

Они проверяют, что компонент передаёт в `MultiSelectField` непустые `items` правильной формы, включая кейсы с альтернативными ключами.
