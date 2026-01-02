# Руководство по использованию SwipeablePanel

## Описание

`SwipeablePanel` — это компонент-обертка, добавляющий функциональность swipe-to-close для мобильных панелей. Использует `react-native-gesture-handler` и `react-native-reanimated` для создания плавных анимаций.

## Использование

```tsx
import SwipeablePanel from '@/components/MapPage/SwipeablePanel';

function MyComponent() {
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  return (
    <SwipeablePanel
      isOpen={isPanelOpen}
      onClose={() => setIsPanelOpen(false)}
      swipeDirection="right"
      threshold={80}
      style={styles.panel}
    >
      <View>
        {/* Ваш контент панели */}
      </View>
    </SwipeablePanel>
  );
}
```

## Props

### isOpen: boolean
**Обязательный**. Определяет, открыта ли панель. При изменении значения на `true` панель анимируется в исходное положение.

### onClose: () => void
**Обязательный**. Callback-функция, вызываемая при закрытии панели через свайп.

### swipeDirection: 'left' | 'right'
**Опциональный**. По умолчанию: `'right'`.
Направление свайпа для закрытия панели:
- `'right'` — свайп вправо (для левой панели)
- `'left'` — свайп влево (для правой панели)

### threshold: number
**Опциональный**. По умолчанию: `100`.
Минимальное расстояние свайпа (в пикселях) для срабатывания закрытия панели.

### style: ViewStyle | ViewStyle[]
**Опциональный**. Стили для контейнера панели. Можно передать массив стилей.

## Примеры использования

### Пример 1: Левая панель (свайп вправо)
```tsx
<SwipeablePanel
  isOpen={leftPanelVisible}
  onClose={() => setLeftPanelVisible(false)}
  swipeDirection="right"
  threshold={80}
  style={styles.leftPanel}
>
  <MenuContent />
</SwipeablePanel>
```

### Пример 2: Правая панель (свайп влево)
```tsx
<SwipeablePanel
  isOpen={rightPanelVisible}
  onClose={() => setRightPanelVisible(false)}
  swipeDirection="left"
  threshold={100}
  style={styles.rightPanel}
>
  <FilterContent />
</SwipeablePanel>
```

### Пример 3: Условное использование для мобильных
```tsx
{isMobile ? (
  <SwipeablePanel
    isOpen={panelVisible}
    onClose={() => setPanelVisible(false)}
    swipeDirection="right"
    threshold={80}
    style={[
      styles.panel,
      panelVisible ? styles.panelOpen : styles.panelClosed
    ]}
  >
    <PanelContent />
  </SwipeablePanel>
) : (
  <View style={styles.panel}>
    <PanelContent />
  </View>
)}
```

## Особенности реализации

### Анимация
Компонент использует `react-native-reanimated` для создания плавных анимаций:
- Spring анимация с параметрами `damping: 20, stiffness: 90`
- Автоматический возврат панели на место при недостаточном свайпе
- Закрытие панели при превышении порога или высокой скорости свайпа (>500)

### Производительность
- Вычисления выполняются на UI thread через `useAnimatedStyle`
- Минимальное количество ре-рендеров благодаря `React.memo`
- Оптимизированные callback-функции через `useCallback`

### Жесты
- Свайп работает только в заданном направлении
- Поддержка быстрого свайпа (velocity > 500) для немедленного закрытия
- Плавное перетаскивание с визуальной обратной связью

## Требования

- `react-native-gesture-handler` ~2.20.2
- `react-native-reanimated` ~3.16.1

## Доступность

Компонент не добавляет дополнительных accessibility атрибутов, так как они должны быть заданы для дочерних элементов. Убедитесь, что:
- У панели есть `accessibilityLabel`
- Есть альтернативный способ закрытия (кнопка) для пользователей screen readers
- Overlay имеет правильные ARIA атрибуты

## Известные ограничения

1. Работает только на одной панели одновременно
2. Не поддерживает вложенные SwipeablePanel
3. На web может требовать дополнительной настройки gesture handler

## Советы по использованию

1. **Порог**: Используйте 60-100px для оптимального UX
2. **Направление**: Для левых панелей используйте `'right'`, для правых — `'left'`
3. **Стили**: Добавляйте трансформации только через `style`, не через внутренние компоненты
4. **Overlay**: Комбинируйте с Pressable overlay для лучшего UX

## Отладка

Если свайп не работает:
1. Проверьте, что `react-native-gesture-handler` правильно настроен
2. Убедитесь, что `isOpen` prop обновляется корректно
3. Проверьте, что нет конфликтующих gesture handlers в дочерних элементах
4. На Android проверьте, что включен `enableExperimentalWebImplementation` (если используете web)

