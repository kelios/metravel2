# Улучшения рендеринга PDF

## Проблема

При экспорте путешествий в PDF наблюдалось расхождение между превью и сохраненным файлом:
- В превью отображались тени, размытие фона, фильтры изображений
- При сохранении в PDF эти эффекты исчезали из-за правил `@media print`
- Блоки и изображения смещались, верстка "ехала"

## Решение

### 1. Синхронизация стилей превью и печати

**Изменено в:** `src/services/pdf-export/generators/EnhancedPdfGenerator.ts`

#### Убраны box-shadow из превью
```typescript
.pdf-page {
  box-shadow: none;  // Было: ${this.theme.blocks.shadow}
}
```

#### Упрощены правила @media print
Удалены агрессивные `!important` правила, которые убирали эффекты:

**Было:**
```css
@media print {
  .pdf-page * {
    box-shadow: none !important;
    text-shadow: none !important;
  }
  .cover-bg-blur {
    display: none !important;
  }
  .cover-page img {
    filter: none !important;
  }
}
```

**Стало:**
```css
@media print {
  /* Только необходимые правила для корректной печати */
  .pdf-page {
    page-break-after: always;
    box-shadow: none;
    margin: 0;
  }
  img {
    image-rendering: -webkit-optimize-contrast;
    image-rendering: crisp-edges;
  }
}
```

### 2. Улучшение качества изображений

#### Увеличено разрешение для печати
```typescript
// Было: w=1600
// Стало: w=2400 (для 300 DPI печати)
return `https://images.weserv.nl/?url=${delimiter}&w=2400&q=90&il&fit=inside`;
```

**Параметры weserv.nl:**
- `w=2400` — ширина 2400px (достаточно для A4 при 300 DPI)
- `q=90` — качество JPEG 90% (баланс между качеством и размером)
- `il` — прогрессивная загрузка (interlaced)
- `fit=inside` — вписывание без обрезки

#### Оптимизация рендеринга изображений
```css
img {
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
}
```

### 3. Улучшение качества текста

#### Добавлено сглаживание шрифтов
```css
body {
  text-rendering: optimizeLegibility;
  font-feature-settings: "kern" 1;
  font-kerning: normal;
}

h1, h2, h3, h4 {
  text-rendering: optimizeLegibility;
  font-feature-settings: "kern" 1;
}

p {
  text-rendering: optimizeLegibility;
}
```

**Эффект:**
- `optimizeLegibility` — улучшенная читаемость
- `font-feature-settings: "kern"` — кернинг (оптимальные расстояния между буквами)
- `font-kerning: normal` — стандартный кернинг

## Результат

### ✅ Превью = Печать
Теперь то, что вы видите в превью, полностью соответствует сохраненному PDF

### ✅ Высокое качество изображений
- Разрешение 2400px вместо 1600px
- Качество JPEG 90%
- Оптимизированный рендеринг для четкости

### ✅ Качественная типографика
- Улучшенное сглаживание шрифтов
- Правильный кернинг
- Оптимизация для читаемости

### ✅ Стабильная верстка
- Блоки не смещаются при печати
- Отступы одинаковые в превью и PDF
- Разрывы страниц работают корректно

## Технические детали

### Разрешение для печати

Для качественной печати на A4 (210×297 мм) при 300 DPI требуется:
- Ширина: 210mm × 300dpi / 25.4 = 2480px
- Высота: 297mm × 300dpi / 25.4 = 3508px

Используем 2400px по ширине — это оптимальный баланс между качеством и размером файла.

### CSS свойства для качества

| Свойство | Значение | Эффект |
|----------|----------|--------|
| `text-rendering` | `optimizeLegibility` | Улучшенная читаемость |
| `font-feature-settings` | `"kern" 1` | Кернинг включен |
| `image-rendering` | `crisp-edges` | Четкие края изображений |
| `-webkit-print-color-adjust` | `exact` | Точные цвета при печати |
| `print-color-adjust` | `exact` | Точные цвета при печати |

## Тестирование

Запустите тесты для проверки:

```bash
npm run test:run -- EnhancedPdfGenerator
```

Все тесты должны проходить успешно ✅

## Дальнейшие улучшения

Возможные направления для будущих улучшений:

1. **WebP с fallback** — использовать WebP для меньшего размера
2. **Lazy loading** — отложенная загрузка изображений в превью
3. **Адаптивное качество** — разное качество для превью и печати
4. **Кэширование** — кэширование обработанных изображений
