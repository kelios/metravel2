---
name: metravel-design-system
description: >-
  Дизайн-система MeTravel: собрать/задокументировать токены (цвета, тема, spacing,
  типографика) и каталог UI-компонентов, проверить консистентность — хардкод-цвета,
  устаревшие импорты, фиксированные ширины, дубли компонентов мимо UnifiedTravelCard/
  ImageCardMedia — и подчистить дрейф. Триггеры: «дизайн-система», «собери токены»,
  «каталог компонентов», «проверь хардкод цвета», «привести стили к токенам»,
  «задокументируй дизайн-систему».
---

# metravel-design-system

Регламент работы с дизайн-системой как единым контрактом: документировать токены и
компоненты, ловить и чинить отклонения от них. Дизайн-систему здесь **не переизобретают** —
консолидируют и охраняют. Источники правды — файлы ниже + `docs/DESIGN_HANDOFF_2026-06-02.md`.

## Источники правды (где живут токены)

- `constants/designSystem.ts` — `DESIGN_TOKENS` (цвета, тени, градиенты), центральный.
- `constants/modernMattePalette.ts` — палитра light/dark (`MODERN_MATTE_PALETTE[_DARK]`).
- `constants/layout.ts` — `METRICS`: `spacing` (xs4/s8/m16/l24/xl32/xxl40/xxxl48),
  `breakpoints`, `borderRadius`, `elevation`, `gridColumns`, `animation`, `containers`.
- `components/ui/Typography.tsx` — `<Heading>` + `HEADING_CONFIG` (fluid размеры).
- `hooks/useTheme.ts` — `ThemeProvider`, `useThemedColors()`, web CSS-vars `var(--color-*)`,
  `data-theme` на `<html>`.
- `constants/theme.ts` — legacy `COLORS`/`SPACING` (миграционный, новый код не плодить здесь).

Каталог компонентов: `components/ui/` (Button, Chip, ImageCardMedia, UnifiedTravelCard,
AnimatedCard, Typography, IconButton, EmptyState, SkeletonLoader, Toggle, SelectionGroup,
FloatingActionButton, CollapsibleBlock, …), `components/layout/` (ResponsiveContainer,
ResponsiveStack, CustomHeader, BottomDock, Footer, ConsentBanner, …).

## Режимы

### A. Документировать / каталог
1. Собери токены из файлов выше в сводку: палитра (light/dark, роль каждого цвета), spacing,
   радиусы, типографика (уровни Heading, размеры), elevation/тени.
2. Каталог UI-компонентов `components/ui/`: имя → назначение → ключевые пропсы → когда
   использовать. Отметь «канонические» (ImageCardMedia, UnifiedTravelCard) и их инварианты
   (фото contain+blur, фото-доминанта).
3. Сохрани/обнови `docs/DESIGN_SYSTEM.md` (каталог + гайд по использованию). Не дублируй
   историю `DESIGN_HANDOFF` — там issue-журнал, здесь — справочник токенов/компонентов.

### B. Аудит консистентности и чистка
1. **Устаревшие импорты:** `node scripts/verify-design-system.js` — ловит
   `@/constants/designTokens`, `@/styles/modernRedesign`, `@/constants/airyColors`, старый
   `Colors`. Должно импортироваться из `@/constants/designSystem`.
2. **Хардкод-цвета:** `node scripts/fix-hardcoded-colors.js --dry-run` — `#fff`/`#000`/hex
   мимо токенов; применяй точечно (`--file=…`), проверяя каждую замену по смыслу роли.
3. **Фиксированные пиксельные ширины**, ломающие mobile; **дубли карточек** мимо
   `UnifiedTravelCard`; **прямой `expo-image`** мимо `ImageCardMedia` (гард
   `npm run check:image-architecture`).
4. Нарушения гардов → делегируй `guard-enforcer`. Архитектурные дубли механизмов →
   `/review-architecture`.
5. **Чини** подтверждённое, прогоняй lint/typecheck/Jest затронутого; UI-видимые правки —
   верифицируй в браузере (mobile 390 + desktop 1280) сам.

## Правила

- Токен — контракт: новые цвета добавляются в `designSystem.ts`/палитру, а не хардкодом в
  компонент. Тема обязательна (light+dark) через `useThemedColors`.
- Не плодить legacy (`constants/theme.ts`) — новый код на `DESIGN_TOKENS`/`METRICS`.
- Дизайн-систему не расширять «на вкус» без запроса — этот скилл консолидирует и охраняет.
- Конкретный экран — это `/metravel-screen-redesign`; сквозной визуал-аудит — `/metravel-design-audit`.
