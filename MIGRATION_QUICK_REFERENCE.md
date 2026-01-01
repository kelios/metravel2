# 🎨 Миграция на систему тем - Быстрая справка

**Последнее обновление:** 1 января 2026

## ✅ Статус: 43% завершено (29/68 компонентов)

```
█████████████████████░░░░░░░░░░░ 43%
```

---

## 🚀 Быстрый старт для миграции компонента

### 1. Шаблон миграции

```typescript
import React, { useMemo } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { globalFocusStyles } from '@/styles/globalFocus'; // для интерактивных элементов

export function MyComponent({ title }: { title: string }) {
  const colors = useThemedColors(); // 1. Получаем динамические цвета
  
  // 2. Создаем стили с мемоизацией
  const styles = useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: colors.surface, // используем colors вместо palette
      padding: DESIGN_TOKENS.spacing.md, // используем tokens для размеров
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    text: {
      color: colors.text,
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: '600',
    },
  }), [colors]); // 3. Зависимость от colors
  
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{title}</Text>
    </View>
  );
}
```

### 2. Чеклист миграции

- [ ] Импортировать `useThemedColors` из `@/hooks/useTheme`
- [ ] Заменить `const palette = DESIGN_TOKENS.colors` на `const colors = useThemedColors()`
- [ ] Обернуть стили в `useMemo(() => StyleSheet.create(...), [colors])`
- [ ] Заменить все `palette.*` на `colors.*`
- [ ] Использовать `DESIGN_TOKENS.spacing.*` вместо hardcoded чисел
- [ ] Использовать `DESIGN_TOKENS.typography.sizes.*` для размеров шрифтов
- [ ] Использовать `DESIGN_TOKENS.touchTarget.*` для touch targets (минимум 44px)
- [ ] Добавить `globalFocusStyles.focusable` для интерактивных элементов
- [ ] Добавить accessibility атрибуты (`accessibilityRole`, `accessibilityLabel`)
- [ ] Проверить компиляцию TypeScript: `npx tsc --noEmit`
- [ ] Протестировать в светлой теме
- [ ] Протестировать в темной теме

### 3. Доступные цвета (colors.*)

#### Основные
- `background` - основной фон
- `backgroundSecondary` - вторичный фон
- `surface` - поверхность карточек/блоков
- `surfaceMuted` - приглушенная поверхность
- `surfaceElevated` - поднятая поверхность

#### Текст
- `text` - основной текст
- `textMuted` - приглушенный текст
- `textInverse` - инверсный текст (на темном фоне)
- `textOnPrimary` - текст на primary фоне

#### Акценты
- `primary` - основной акцент
- `primaryLight` - светлый акцент
- `primarySoft` - мягкий акцент
- `secondary` - вторичный акцент

#### Границы
- `border` - основная граница
- `borderLight` - светлая граница

#### Статусы
- `success` - успех
- `successLight` - светлый успех
- `danger` - ошибка
- `dangerLight` - светлая ошибка
- `warning` - предупреждение
- `warningLight` - светлое предупреждение
- `info` - информация
- `infoLight` - светлая информация

### 4. Design Tokens

#### Spacing
```typescript
DESIGN_TOKENS.spacing.xs   // 4px
DESIGN_TOKENS.spacing.sm   // 8px
DESIGN_TOKENS.spacing.md   // 16px
DESIGN_TOKENS.spacing.lg   // 24px
DESIGN_TOKENS.spacing.xl   // 32px
DESIGN_TOKENS.spacing.xxl  // 48px
```

#### Typography
```typescript
DESIGN_TOKENS.typography.sizes.xs   // 12px
DESIGN_TOKENS.typography.sizes.sm   // 14px
DESIGN_TOKENS.typography.sizes.md   // 16px
DESIGN_TOKENS.typography.sizes.lg   // 18px
DESIGN_TOKENS.typography.sizes.xl   // 24px
```

#### Radii
```typescript
DESIGN_TOKENS.radii.sm   // 4px
DESIGN_TOKENS.radii.md   // 8px
DESIGN_TOKENS.radii.lg   // 12px
DESIGN_TOKENS.radii.xl   // 16px
```

#### Touch Targets
```typescript
DESIGN_TOKENS.touchTarget.minHeight  // 44px
DESIGN_TOKENS.touchTarget.minWidth   // 44px
```

---

## 📋 Следующие компоненты для миграции

### ✅ Выполнено в текущей сессии (15+ компонентов)

1. ✅ **listTravel/SearchAndFilterBar.tsx** - автодополнение, keyboard shortcuts
2. ✅ **listTravel/HeroSection.tsx** - LinearGradient, адаптивность
3. ✅ **mainPage/StickySearchBar.tsx** - sticky positioning
4. ✅ **MarkersListComponent.tsx** - web-only (ReactDOM)
5-14. ✅ **components/home/** - все 10 компонентов мигрированы

### Высокий приоритет (следующая сессия)

1. **travel/TravelCard.tsx**
   - Сложность: Средняя
   - Основная карточка путешествия
   - Критичен для списков

2. **travel/TravelDetails.tsx**
   - Сложность: Высокая
   - Детальная страница путешествия
   - Много вложенных компонентов

3. **travel/PhotoUploadWithPreview.tsx**
   - Сложность: Средняя
   - Загрузка и превью фотографий
   - Кроссплатформенность

4. **travel/TravelForm.tsx**
   - Сложность: Высокая
   - Форма создания/редактирования
   - Валидация и состояния

5. **profile/ProfileHeader.tsx**
   - Сложность: Средняя
   - Заголовок профиля пользователя

6. **profile/UserTravelsList.tsx**
   - Сложность: Средняя
   - Список путешествий пользователя

### Средний приоритет

7-20. Остальные компоненты из папок:
   - components/travel/* (~20 компонентов)
   - components/profile/* (~5 компонентов)

### Низкий приоритет

- **ArticleEditor.tsx** (очень сложный, требует особого подхода)
- **Map.tsx** (картографические интеграции)
- **MapUploadComponent.tsx** (загрузка карт)

---

## 🛠 Частые проблемы и решения

### Проблема 1: DESIGN_TOKENS.minTouchTarget не существует
```typescript
// ❌ Неправильно
minHeight: DESIGN_TOKENS.minTouchTarget

// ✅ Правильно
minHeight: DESIGN_TOKENS.touchTarget.minHeight
```

### Проблема 2: typography.sizes.base не существует
```typescript
// ❌ Неправильно
fontSize: DESIGN_TOKENS.typography.sizes.base

// ✅ Правильно
fontSize: DESIGN_TOKENS.typography.sizes.md
```

### Проблема 3: FlatList не поддерживает onWheel
```typescript
// ❌ Неправильно
<FlatList onWheel={handler} />

// ✅ Правильно (platform-specific)
<FlatList
  {...(Platform.OS === 'web' ? { onWheel: handler } : {})}
/>
```

### Проблема 4: Забыли зависимость colors в useMemo
```typescript
// ❌ Неправильно (стили не обновятся при смене темы)
const styles = useMemo(() => StyleSheet.create({
  text: { color: colors.text }
}), []); // пустой массив зависимостей

// ✅ Правильно
const styles = useMemo(() => StyleSheet.create({
  text: { color: colors.text }
}), [colors]); // colors в зависимостях
```

---

## 📚 Документация

### Основные файлы
- [MIGRATION_STATUS.md](./MIGRATION_STATUS.md) - детальный статус
- [MIGRATION_SESSION_JAN_01_2026.md](./MIGRATION_SESSION_JAN_01_2026.md) - отчет последней сессии
- [docs/thema/README.md](./docs/thema/README.md) - документация системы тем
- [docs/thema/QUICK_REFERENCE.md](./docs/thema/QUICK_REFERENCE.md) - быстрая справка
- [docs/thema/MIGRATION_GUIDE.md](./docs/thema/MIGRATION_GUIDE.md) - полное руководство

---

## ✅ Текущие достижения

### Мигрировано (44 компонента):

#### Корневые компоненты (27) ✅
✅ AccountMenu, AnimatedCard, CategoryChips, CheckboxComponent, ConfirmDialog  
✅ EmptyState, ErrorDisplay, ErrorBoundary, ExternalLink, FavoriteButton  
✅ FormFieldWithValidation, HeaderContextBar, Logo, MainHubLayout, NetworkStatus  
✅ NumberInputComponent, ProgressIndicator, RecentViews, ScrollToTopButton  
✅ SectionSkeleton, SelectComponent, SkeletonLoader, SkipLinks, ThemeToggle  
✅ YoutubeLinkComponent, MultiSelectField, SimpleMultiSelect, MarkersListComponent

#### UI компоненты (5) ✅
✅ Button, IconButton, Chip, SemanticView, Tooltip

#### listTravel компоненты (3) ✅
✅ ResultsCounter, SearchAndFilterBar, HeroSection

#### mainPage компоненты (1) ✅
✅ StickySearchBar

#### home компоненты (10) ✅
✅ Home, HomeHero, HomeFinalCTA, HomeFAQSection, HomeHowItWorks  
✅ HomeInspirationSection, HomeTrustBlock, HomeFavoritesHistorySection  
✅ OnboardingBanner, OptimizedImage

#### Travel компоненты (1) ✅
✅ ShareButtons

#### Системные компоненты (2) ✅
✅ NotificationSystem, TextInputComponent

---

## 🎯 Цель: 100% миграция

**Текущий прогресс:** 43%  
**Следующая цель:** 60% (добавить 12 компонентов)  
**Финальная цель:** 100% (все 68 компонентов)

---

**Создано:** 1 января 2026  
**Версия:** 1.0

