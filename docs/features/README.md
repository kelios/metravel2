# Feature maps

Карты фич — плотные документы вида "одна страница на всю фичу". Цель: чтобы любой разработчик (или ИИ-агент) понял фичу целиком за 5 минут без обхода 50 файлов.

## Формат

Каждая фича — один файл `docs/features/<feature>.md`. Шаблон — `docs/features/TEMPLATE.md`.

## Когда писать и обновлять

- При появлении новой фичи — сразу.
- При крупном рефакторинге — актуализация обязательна.
- Раз в квартал — ревизия: убрать мёртвое, дописать новое.

Если документ разошёлся с кодом — код правда, документ баг.

## Список фич

- [x] [travel](./travel.md) — список, детали, wizard, экспорт
- [x] [map](./map.md) — карта, попапы, роутинг
- [x] [places](./places.md) — каталог отдельных точек, фильтры, карта, связь с путешествиями
- [x] [auth](./auth.md) — вход и регистрация, матрица «провайдер × поверхность»
- [x] [user](./user.md) — профиль, collections, calendar statuses, author stats
- [x] [calendar](./calendar.md) — календарь travel-статусов и day details
- [x] [offline](./offline.md) — offline shell, управляемые content packages и Android cold-start access
- [x] [social-trips-gamification-roadmap](./social-trips-gamification-roadmap.md) — текущая карта совместных поездок, trust/privacy и геймификации; runtime остаётся backend-dependent
- [x] [quests](./quests.md) — список, лендинг города, прохождение, ответы, офлайн, печать
- [x] [article](./article.md) — rich-text тело, редактор, санитизация, SSG-подача
- [x] [export](./export.md) — PDF-книга, печать квеста, выгрузка маршрута
- [x] [achievements](./achievements.md) — значки, ранги, XP, peer- и редкие награды, прогрессия
- [x] [trips](./trips.md) — совместные поездки, заявки, планировщик маршрута
- [x] [images](./images.md) — пайплайн картинок: загрузка, варианты, `/media-resize`, storage-политика

## Нормативы отдельных экранов

Точечные документы «как экран обязан себя вести»: их пишут под конкретную
задачу, и они переживают её как источник истины по этому поведению.

- [article-image-text-wrap-mock](./article-image-text-wrap-mock.md) — обтекание
  картинки текстом в теле статьи
- [trips-plan-description-editor-mock](./trips-plan-description-editor-mock.md) —
  редактор описания поездки
- [trips-route-point-search-mock](./trips-route-point-search-mock.md) — поиск
  места в форме точки маршрута (#1782)
