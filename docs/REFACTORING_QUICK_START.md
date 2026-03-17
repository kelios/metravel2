# Быстрый старт: Новые возможности страницы путешествия

## 🚀 Краткое руководство

### 1. Progressive Image Loading

```tsx
import { ProgressiveImage } from '@/components/common/ProgressiveImage'

// Вместо обычного Image используйте:
<ProgressiveImage
  source="image.jpg"
  width={800}
  height={600}
  priority={true} // для hero изображений
/>
```

### 2. Swipe Gestures

```tsx
import { useSimpleSwipe } from '@/hooks/useSwipeGesture'

const { panHandlers } = useSimpleSwipe(
  () => handlePrevious(),
  () => handleNext()
)

<View {...panHandlers}>
  <Slider />
</View>
```

### 3. Виртуализация списков

```tsx
import { useVirtualizedList } from '@/hooks/useVirtualizedList'

const { visibleItems, totalHeight, onScroll } = useVirtualizedList(
  items,
  { itemHeight: 120 }
)

// Рендерить только visibleItems вместо всего массива
```

### 4. Интерактивные кнопки

```tsx
import { InteractiveButton } from '@/components/common/InteractiveButton'

<InteractiveButton
  variant="primary"
  size="medium"
  onPress={handleSubmit}
  loading={isLoading}
  haptics="light"
>
  Сохранить
</InteractiveButton>
```

### 5. Haptic Feedback

```tsx
import { triggerHaptic } from '@/utils/travelDetailsUIUX'

// При успешном действии
await triggerHaptic('success')

// При ошибке
await triggerHaptic('error')

// Лёгкая вибрация
await triggerHaptic('light')
```

### 6. Fluid Typography

```tsx
import { getFluidTypography } from '@/utils/travelDetailsUIUX'

// Web: использует CSS clamp()
const fontSize = getFluidTypography(16, 20) // "clamp(16px, 1rem + 0.36vw, 20px)"

// Применение в стилях
titleStyle: {
  fontSize: Platform.OS === 'web'
    ? getFluidTypography(22, 28)
    : screenWidth < 768 ? 22 : 28
}
```

### 7. Focus Management

```tsx
import { useFocusManagement } from '@/hooks/useFocusManagement'

const { focusElement, focusNext, registerFocusable } = useFocusManagement({
  autoFocus: true,
  trapFocus: true // для модальных окон
})

// Регистрация элементов
useEffect(() => {
  registerFocusable('button-1', buttonRef)
}, [])

// Переключение фокуса клавиатурой
const handleKeyDown = (e) => {
  if (e.key === 'ArrowDown') focusNext()
}
```

### 8. Smooth Scrolling

```tsx
import { useSmoothScroll } from '@/hooks/useSmoothScroll'

const { scrollTo, scrollToSection } = useSmoothScroll(scrollViewRef, {
  duration: 400,
  springType: 'gentle'
})

// Плавная прокрутка к позиции
scrollTo(500, true)

// Прокрутка к секции
scrollToSection('comments', true)
```

### 9. Touch Targets

Все интерактивные элементы теперь автоматически имеют минимальный размер 44x44:

```tsx
import { getTouchTargetSize } from '@/utils/travelDetailsUIUX'

const { width, height, padding } = getTouchTargetSize(32)
// { width: 44, height: 44, padding: 6 }

// Применить к стилям
buttonStyle: {
  minWidth: width,
  minHeight: height,
  padding
}
```

### 10. Accessibility Announcements

```tsx
import { announceForAccessibility } from '@/hooks/useFocusManagement'

// Объявить для screen readers
announceForAccessibility('Путешествие сохранено', 'polite')

// Срочное объявление
announceForAccessibility('Ошибка сохранения', 'assertive')
```

## 📦 Установка зависимостей

Все новые компоненты и хуки уже доступны. Дополнительные зависимости не требуются.

## 🎨 Обновлённые стили

### Touch Targets
- Минимальный размер: 44x44px
- Увеличенный padding на мобильных

### Типографика
- Hero: 24-32px (fluid)
- H1: 22-24px (fluid)
- Body: 14-16px (fluid)

### Spacing
- Vertical rhythm на основе 24px baseline
- Consistent paragraph spacing: 18px
- Section spacing: 48px

## 🧪 Тестирование

```bash
# Запустить все тесты
npm run test:run

# Тесты UI/UX утилит
npm run test:run -- --testPathPattern="travelDetailsUIUX"

# E2E тесты производительности
npm run e2e -- web-vitals-travel-details.spec.ts
```

## 📊 Проверка метрик

```bash
# Lighthouse аудит
npm run build:web
npm run lighthouse:travel

# Локальный performance profiling
npm run web:prod
# Открыть DevTools > Performance
```

## ⚠️ Важные заметки

1. **Progressive Image**: Автоматически генерирует LQIP, но можно указать вручную
2. **Swipe Gestures**: Работают на мобильных и десктопе (с мышкой)
3. **Virtualization**: Лучше работает с фиксированной высотой элементов
4. **Haptics**: Автоматически отключается на устройствах без поддержки
5. **Focus Management**: Учитывает prefers-reduced-motion

## 🐛 Решение проблем

### Image не загружается
- Проверьте CORS headers
- Убедитесь что URL абсолютный
- Проверьте network tab в DevTools

### Swipe не работает
- Убедитесь что `panHandlers` применены к View
- Проверьте threshold (по умолчанию 50px)
- Используйте `debug: true` для логов

### Виртуализация лагает
- Уменьшите `overscan` (по умолчанию 3)
- Проверьте что `itemHeight` корректна
- Используйте `React.memo` для item компонентов

### Haptics не срабатывают
- Проверьте наличие expo-haptics
- Убедитесь что устройство поддерживает
- На Web работает только navigator.vibrate

## 🎯 Best Practices

1. **Всегда используйте ProgressiveImage** для изображений выше 200KB
2. **Добавляйте haptics** к важным действиям (сохранение, удаление)
3. **Виртуализируйте списки** длиннее 20 элементов
4. **Используйте InteractiveButton** вместо Pressable
5. **Тестируйте с screen reader** перед деплоем

## 📚 Дополнительно

Полная документация: `docs/TRAVEL_PAGE_REFACTORING.md`

## 🆘 Поддержка

При возникновении вопросов:
1. Проверьте документацию
2. Посмотрите примеры в тестах
3. Проверьте console на ошибки
4. Создайте issue с воспроизведением
