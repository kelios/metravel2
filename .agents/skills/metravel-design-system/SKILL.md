---
name: metravel-design-system
description: "Дизайн-система: собрать/задокументировать токены и каталог UI-компонентов, вычистить хардкод-цвета, дубли и дрейф. Триггеры: «дизайн-система», «собери токены», «проверь хардкод цвета»."
---

# metravel-design-system

Регламент работы с дизайн-системой как единым контрактом: документировать токены и
компоненты, ловить и чинить отклонения от них. Дизайн-систему здесь **не переизобретают** —
консолидируют и охраняют. Источники правды — файлы ниже, канонический из них — `docs/DESIGN_SYSTEM.md`.

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
3. Сохрани/обнови `docs/DESIGN_SYSTEM.md` (каталог + гайд по использованию). Не переписывай
   его в issue-журнал: здесь только справочник токенов, компонентов и контрактов.

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

## Проверка по platform impact (обязательное правило)

Shared/common responsive UI проверяется на desktop web и mobile web (~390px, `isMobile`). Общий файл или компонент сам по себе не создаёт Android/iPhone device gate.

- **Native device validation только для platform-specific scope.** Android-specific поведение, конфигурацию или runtime проверяй на Android; iOS-specific — на требуемом simulator/physical iPhone/TestFlight layer. Parity остаётся архитектурным инвариантом, а не требованием прогонять common/shared задачу на всех устройствах.
- **Evidence по shared/common UI:** desktop web + mobile web screenshots. Native screenshots нужны только для затронутой Android- или iOS-specific поверхности.
- **Запрещены web-only визуальные ветвления в мобильном вьюпорте:** serif-шрифты и hover-only элементы — только desktop (`!isMobile`); контент-элементы (чипы, бейджи, кнопки) не скрывать через `Platform.OS === 'web'`, если на устройстве они видны.
- **Темизация:** для тематических поверхностей только `useThemedColors()` — `DESIGN_TOKENS.colors.*` на native это статичный светлый fallback, на web — живые CSS-переменные.
- **Попапы/карточки точек на картах** — один общий компонент на всех страницах и платформах (различия — только добавочный функционал), компактный, вся информация видна без обрезания по X и Y.
