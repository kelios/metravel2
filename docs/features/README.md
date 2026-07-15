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
- [x] [user](./user.md) — профиль, collections, calendar statuses, author stats
- [x] [calendar](./calendar.md) — календарь travel-статусов и day details
- [x] [social-trips-gamification-roadmap](./social-trips-gamification-roadmap.md) — текущая карта совместных поездок, trust/privacy и геймификации; runtime остаётся backend-dependent
- [ ] quests — мастер квестов, печать
- [ ] article — редактор статей
- [ ] export — PDF/print pipeline
