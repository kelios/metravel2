# 🚀 Руководство по завершению миграции на систему тем

## ✅ Что уже работает

### 1. Полная инфраструктура тем
- ✅ `ThemeProvider` интегрирован в приложение
- ✅ `useTheme()` - управление темой
- ✅ `useThemedColors()` - получение динамических цветов
- ✅ Сохранение настроек в localStorage/AsyncStorage
- ✅ Автоматическая синхронизация с системной темой

### 2. UI переключателя
- ✅ Компонент `ThemeToggle` создан и добавлен в `AccountMenu`
- ✅ Поддержка 3 режимов: светлая, темная, авто
- ✅ Адаптивный дизайн для всех устройств

### 3. Мигрированные компоненты
- ✅ `ConfirmDialog.tsx` - диалоги подтверждения
- ✅ `BottomDock.tsx` - нижняя панель навигации

## 🔄 Компоненты требующие миграции

### ✅ Завершено (6 компонентов)

#### Навигация
- ✅ **CustomHeader.tsx** - шапка приложения
- ✅ **FooterDesktop.tsx** - футер на десктопной версии  
- ✅ **BottomDock.tsx** - нижняя панель навигации

#### Контент
- ✅ **TravelCardCompact.tsx** - компактные карточки путешествий

#### Формы
- ✅ **TextInputComponent.tsx** - текстовые поля ввода

#### Диалоги
- ✅ **ConfirmDialog.tsx** - диалоги подтверждения

---

### Высокий приоритет (критично для UX)

#### 1. SearchAutocomplete.tsx ⭐ СЛЕДУЮЩИЙ
**Где используется:** Автокомплит поиска по всему сайту

**Файл:** `components/SearchAutocomplete.tsx`

**Как мигрировать:**
```typescript
// В начале компонента
const colors = useThemedColors();

// Заменить все palette.* на colors.*
// Например:
backgroundColor: palette.surface → backgroundColor: colors.surface
color: palette.text → color: colors.text
borderColor: palette.border → borderColor: colors.border
```

#### 2. WelcomeBanner.tsx
**Где используется:** Приветственный баннер на главной странице

**Файл:** `components/WelcomeBanner.tsx`

#### 3. CollapsibleBlock.tsx
**Где используется:** Сворачиваемые блоки контента

**Файл:** `components/CollapsibleBlock.tsx`

### Средний приоритет (важно)

#### 4. Фильтры и панели
- `components/FiltersPanelCollapsible.tsx`
- `components/mainPage/StickySearchBar.tsx`
- `components/listTravel/SearchAndFilterBar.tsx`

#### 5. Служебные компоненты
- `components/ErrorDisplay.tsx`
- `components/ProgressIndicator.tsx`
- `components/HeaderContextBar.tsx`

#### 6. Остальные формы
- `components/FormFieldWithValidation.tsx`
- `components/SelectComponent.tsx`
- `components/CheckboxComponent.tsx`

### Низкий приоритет (постепенно)

#### 6. Специализированные компоненты
- `components/travel/**/*.tsx`
- `components/quests/**/*.tsx`
- `components/gamification/**/*.tsx`

## 📖 Универсальный шаблон миграции

### Шаг 1: Добавить импорты

```typescript
import { useThemedColors } from '@/hooks/useTheme';
import { useMemo } from 'react';
```

### Шаг 2: Использовать хук в компоненте

```typescript
export function MyComponent() {
  const colors = useThemedColors();
  
  // Если стили статичные (вне компонента), переместить их внутрь
  const styles = useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    text: {
      color: colors.text,
    },
    button: {
      backgroundColor: colors.primary,
    }
  }), [colors]);
  
  return <View style={styles.container}>...</View>;
}
```

### Шаг 3: Если есть вложенные компоненты

Если внутри есть компоненты типа `Item`, `Card` и т.д., которые используют `styles`:

**Вариант A:** Переместить их внутрь основного компонента:

```typescript
export function MyComponent() {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  // Вложенный компонент внутри
  const Item = memo(function Item({ label }: { label: string }) {
    return <Text style={styles.itemText}>{label}</Text>;
  });
  
  return <View>{/* использовать Item */}</View>;
}
```

**Вариант B:** Передать colors как пропс:

```typescript
const Item = memo(function Item({ 
  label, 
  colors 
}: { 
  label: string; 
  colors: ReturnType<typeof useThemedColors> 
}) {
  const styles = useMemo(() => StyleSheet.create({
    text: { color: colors.text }
  }), [colors]);
  
  return <Text style={styles.text}>{label}</Text>;
});

export function MyComponent() {
  const colors = useThemedColors();
  return <Item label="Test" colors={colors} />;
}
```

### Шаг 4: Заменить цвета

**Найти и заменить:**

| Старое | Новое |
|--------|-------|
| `DESIGN_TOKENS.colors.surface` | `colors.surface` |
| `DESIGN_TOKENS.colors.text` | `colors.text` |
| `DESIGN_TOKENS.colors.primary` | `colors.primary` |
| `DESIGN_TOKENS.colors.border` | `colors.border` |
| `DESIGN_TOKENS.colors.background` | `colors.background` |
| `palette.surface` | `colors.surface` |
| `palette.text` | `colors.text` |

### Шаг 5: Проверить

```bash
# Запустить приложение
npm run web

# Открыть компонент в обеих темах
# Переключить тему и убедиться, что цвета меняются
```

## 🔍 Как найти компоненты для миграции

### Поиск по коду:

```bash
# Найти компоненты с DESIGN_TOKENS.colors
grep -r "DESIGN_TOKENS.colors" components/

# Найти компоненты с palette
grep -r "const palette = DESIGN_TOKENS.colors" components/

# Найти компоненты без useThemedColors
grep -L "useThemedColors" components/**/*.tsx
```

### Приоритизация:

1. Начните с компонентов, которые видны постоянно (Header, Footer, Menu)
2. Затем модальные окна и диалоги
3. Потом карточки и списки
4. И наконец специализированные компоненты

## 🐛 Частые проблемы и решения

### Проблема 1: "Cannot find name 'styles'"

**Причина:** Вложенный компонент не имеет доступа к styles

**Решение:** Переместить компонент внутрь основного или передать styles/colors как пропс

### Проблема 2: "Variable 'styles' used before being assigned"

**Причина:** Попытка использовать styles до их создания

**Решение:** Убедиться, что `useMemo` вызывается перед использованием styles

### Проблема 3: Тема не переключается

**Причина:** Компонент использует статичные стили вне useMemo

**Решение:** Обернуть создание стилей в useMemo с зависимостью от colors

## 📊 Отслеживание прогресса

Обновляйте файл `docs/thema/THEME_IMPLEMENTATION_PROGRESS.md` после миграции каждого компонента:

```markdown
**Мигрированные компоненты:**
1. ✅ ConfirmDialog.tsx
2. ✅ BottomDock.tsx
3. ✅ FooterDesktop.tsx  ← Добавить после миграции
```

## 🎯 Цель

**100% компонентов** должны использовать динамические цвета через `useThemedColors()` для полной поддержки переключения тем без перезагрузки приложения.

---

**Создано:** 31 декабря 2025  
**Статус:** Активное руководство

