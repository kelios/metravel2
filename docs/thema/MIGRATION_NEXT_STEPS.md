# 🚀 Быстрый старт: Продолжение миграции компонентов

## Текущий статус

✅ **Мигрировано:** 6 компонентов высокого приоритета  
🔄 **В процессе:** Миграция оставшихся компонентов  
📍 **Следующий шаг:** Мигрировать компоненты из списка ниже

## Список компонентов для миграции

### Высокий приоритет (критично для UX)

```
✅ ConfirmDialog.tsx
✅ BottomDock.tsx
✅ FooterDesktop.tsx
✅ CustomHeader.tsx
✅ TravelCardCompact.tsx
✅ TextInputComponent.tsx
🔄 SearchAutocomplete.tsx
🔄 FormFieldWithValidation.tsx
🔄 ProgressIndicator.tsx
🔄 CollapsibleBlock.tsx
🔄 FiltersPanelCollapsible.tsx
🔄 WelcomeBanner.tsx
🔄 MainHubLayout.tsx
🔄 ErrorDisplay.tsx
🔄 HeaderContextBar.tsx
```

## Как мигрировать компонент

### Шаг 1: Найти компонент
```bash
# Поиск компонентов с palette
grep -r "const palette = DESIGN_TOKENS.colors" components/
```

### Шаг 2: Применить паттерн миграции

```typescript
// ДО
import { DESIGN_TOKENS } from '@/constants/designSystem';
const palette = DESIGN_TOKENS.colors;

export default function MyComponent() {
  return <View style={styles.container}>...</View>;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.surface,
    color: palette.text,
  }
});

// ПОСЛЕ
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useMemo } from 'react';

export default function MyComponent() {
  const colors = useThemedColors();
  
  const styles = useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: colors.surface,
      color: colors.text,
    }
  }), [colors]);
  
  return <View style={styles.container}>...</View>;
}
```

### Шаг 3: Проверить ошибки
```bash
# Проверка TypeScript
npx tsc --noEmit

# Проверка конкретного файла
npx tsc --noEmit | grep "MyComponent"
```

### Шаг 4: Тестирование
1. Запустить приложение
2. Переключить тему light → dark
3. Проверить визуальное отображение
4. Убедиться в отсутствии артефактов

## Контрольный список

Для каждого компонента:

- [ ] Добавлен импорт `useThemedColors`
- [ ] Добавлен импорт `useMemo` (если используется)
- [ ] Удалена строка `const palette = DESIGN_TOKENS.colors`
- [ ] Добавлен `const colors = useThemedColors()` в компоненте
- [ ] Стили перенесены внутрь компонента с `useMemo`
- [ ] Все `palette.*` заменены на `colors.*`
- [ ] Удалены старые статические стили (если были вне компонента)
- [ ] Проверка TypeScript без ошибок
- [ ] Визуальная проверка в обеих темах

## Особые случаи

### Компоненты с вложенными компонентами
Если компонент содержит вложенные компоненты, которые используют `styles`:
```typescript
function ParentComponent() {
  const colors = useThemedColors();
  const styles = useMemo(() => StyleSheet.create({...}), [colors]);
  
  // Вложенный компонент должен быть внутри родителя
  const ChildComponent = memo(function ChildComponent() {
    return <View style={styles.child}>...</View>;
  });
  
  return <ChildComponent />;
}
```

### Компоненты с условными стилями
```typescript
// Используйте colors напрямую в JSX
<Feather 
  name="icon" 
  color={isActive ? colors.primary : colors.textMuted} 
/>
```

### Компоненты с Platform.select
```typescript
const styles = useMemo(() => StyleSheet.create({
  container: {
    ...Platform.select({
      web: {
        backgroundColor: colors.surface,
        boxShadow: DESIGN_TOKENS.shadows.card,
      },
      default: {
        backgroundColor: colors.surface,
        ...DESIGN_TOKENS.shadowsNative.light,
      }
    })
  }
}), [colors]);
```

## Полезные команды

```bash
# Найти все компоненты с palette
grep -r "const palette = DESIGN_TOKENS.colors" components/ | wc -l

# Найти использование palette в конкретном файле
grep "palette\." components/MyComponent.tsx

# Проверить, что palette больше не используется
grep -r "const palette = DESIGN_TOKENS.colors" components/MyComponent.tsx
```

## Приоритизация

Мигрируйте в следующем порядке:

1. **Навигация и layout** (Header, Footer, Dock) ✅ Выполнено
2. **Основной контент** (Cards, Lists) ⏳ В процессе
3. **Формы** (Inputs, Selects, Buttons) ⏳ Частично
4. **Модальные окна** (Dialogs, Modals) ✅ Выполнено
5. **Служебные компоненты** (Errors, Loading) 🔄 Ожидание

## Следующий компонент для миграции

**Рекомендация:** `SearchAutocomplete.tsx`

**Причина:** Используется в поиске, высокая видимость, средняя сложность

```bash
# Открыть файл
code components/SearchAutocomplete.tsx
```

---

**Вопросы?** См. `THEME_IMPLEMENTATION_PROGRESS.md` для деталей реализации

