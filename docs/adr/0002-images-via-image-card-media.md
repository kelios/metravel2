# 0002. Изображения в фичах только через `ImageCardMedia`

- **Статус:** Accepted
- **Дата:** 2026-04-17
- **Авторы:** team

## Контекст

`expo-image` — основной компонент изображений. Но в фичевых компонентах прямой импорт `expo-image` плох:

- Нельзя централизованно добавить lazy-loading, skeleton, fallback, error-handling.
- Сложно менять стратегию кэширования или CDN-трансформаций.
- Web и native имеют разные оптимальные флаги (`cachePolicy`, `priority`, `contentFit`).
- При аудите производительности (Lighthouse, LCP) нужна одна точка для изменений.

## Решение

Фичевые компоненты используют только `components/ui/ImageCardMedia.tsx`. `expo-image` импортируется исключительно внутри `components/ui/` (и немногих изолированных исключений — см. allowlist в `scripts/check-image-architecture.js`).

Соблюдение: ESLint-правило + `npm run check:image-architecture` в CI и pre-commit.

## Последствия

### Положительные

- LCP-оптимизации (`scripts/lighthouse-travel-score.js`, `UNLOAD_POLICY_FIX.md`) применяются в одной точке.
- Единая стратегия skeleton/placeholder.
- ИИ получает однозначное правило.

### Отрицательные / риски

- Добавление нового флага `expo-image` требует расширения API `ImageCardMedia`.

## Связанные

- `components/ui/ImageCardMedia.tsx`
- `components/ui/UnifiedTravelCard.tsx`
- `scripts/check-image-architecture.js`
- `docs/UNLOAD_POLICY_FIX.md`, `docs/SLIDER_LOADING_OPTIMIZATION.md`
