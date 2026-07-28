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

Централизация renderer недостаточна без единого source contract:

- если backend прислал `media.variants`, feature использует канонический variant
  URL без дополнительного `v/q/fit/dpr`;
- если manifest отсутствует, proxy URL строится только shared helper'ом по
  опубликованному backend contract, а не локальными ladders в component;
- unsupported transform не может молча считаться preview, если фактически вернул
  original;
- blur и sharp для одного slot не должны создавать две загрузки одного identity;
- на native sharp загружается первым, затем blur монтируется с тем же `source`,
  `recyclingKey` и `memory-disk` cache policy, чтобы два transformed target не
  стартовали параллельные cold-cache запросы;
- browser/device performance evidence проверяет URL cardinality и bytes, а не
  только факт использования `ImageCardMedia`.

Соблюдение: ESLint-правило + `npm run check:image-architecture` в CI и pre-commit.

## Последствия

### Положительные

- LCP/media optimizations применяются в одной точке и проверяются по
  `docs/TRAVEL_PERFORMANCE_REFACTOR.md`.
- Единая стратегия skeleton/placeholder.
- ИИ получает однозначное правило.

### Отрицательные / риски

- Добавление нового флага `expo-image` требует расширения API `ImageCardMedia`.
- Import guard не доказывает соблюдение source/proxy contract; его нужно
  дополнять manifest/URL/network regression controls из `MEDIA-001`.

## Связанные

- `components/ui/ImageCardMedia.tsx`
- `components/ui/UnifiedTravelCard.tsx`
- `scripts/check-image-architecture.js`
- `docs/RULES.md`, `docs/TRAVEL_PERFORMANCE_REFACTOR.md`
- `docs/PROBLEM_MEMORY.md` (`MEDIA-001`)
