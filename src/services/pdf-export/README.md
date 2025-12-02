# PDF Export Service - Документация

## Обзор

Новая архитектура экспорта в PDF построена на принципах:
- **Separation of Concerns**: Четкое разделение на слои
- **Single Responsibility**: Каждый класс отвечает за одну задачу
- **Dependency Injection**: Зависимости через интерфейсы
- **Testability**: Легко тестировать каждый компонент

## Архитектура

```
┌─────────────────────────────────────┐
│   usePdfExport (React Hook)        │  ← UI Layer
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│   PdfExportService                  │  ← Business Logic
│   - TravelDataTransformer           │
│   - ImageLoader                     │
│   - ProgressTracker                 │
│   - ErrorHandler                    │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│   Html2PdfRenderer                  │  ← Rendering
│   (implements IPdfRenderer)        │
└─────────────────────────────────────┘
```

## Использование

### Базовое использование

```typescript
import { usePdfExport } from '@/src/hooks/usePdfExport';
import type { Travel } from '@/src/types/types';
import type { BookSettings } from '@/components/export/BookSettingsModal';

function MyComponent() {
  const selectedTravels: Travel[] = [...];
  
  const {
    exportPdf,
    previewPdf,
    isGenerating,
    progress,
    error,
    currentStage,
  } = usePdfExport(selectedTravels);

  const handleExport = async () => {
    const settings: BookSettings = {
      title: 'Мои путешествия',
      // ... другие настройки
    };
    
    await exportPdf(settings);
  };

  return (
    <div>
      <button onClick={handleExport} disabled={isGenerating}>
        Экспортировать PDF
      </button>
      {isGenerating && <ProgressBar value={progress} />}
    </div>
  );
}
```

### Расширенная конфигурация

```typescript
const config = {
  maxRetries: 3,
  imageLoadTimeout: 10000,
  batchSize: 5,
  enableCache: true,
  cacheTTL: 3600000, // 1 час
};

const { exportPdf } = usePdfExport(selectedTravels, config);
```

## Компоненты

### PdfExportService

Основной сервис, который оркестрирует весь процесс экспорта.

**Методы:**
- `export(travels, settings, progressCallback?)` - Экспортирует в PDF
- `preview(travels, settings, progressCallback?)` - Создает превью
- `subscribeToProgress(callback)` - Подписка на прогресс

### TravelDataTransformer

Преобразует данные Travel → TravelForBook с валидацией.

**Методы:**
- `transform(travels)` - Преобразует массив путешествий
- `validate(travels)` - Валидирует данные

### ImageLoader

Загружает изображения с retry механизмом и batch обработкой.

**Методы:**
- `loadImage(url, retryCount?)` - Загружает одно изображение
- `loadImagesBatch(urls, batchSize?, onProgress?)` - Загружает батчами
- `loadImagesFromContainer(container, onProgress?)` - Загружает из DOM

### ErrorHandler

Обрабатывает и классифицирует ошибки.

**Методы:**
- `handle(error, context?)` - Обрабатывает ошибку
- `isRetryable(error)` - Проверяет, можно ли повторить
- `getRetryDelay(attempt)` - Вычисляет задержку для retry

### ProgressTracker

Отслеживает прогресс экспорта.

**Методы:**
- `subscribe(callback)` - Подписывается на обновления
- `update(stage, progress, message?)` - Обновляет прогресс
- `setStage(stage, progress, message?)` - Устанавливает этап

## Этапы экспорта

1. **VALIDATING** - Валидация данных (0-5%)
2. **TRANSFORMING** - Преобразование данных (5-10%)
3. **GENERATING_HTML** - Генерация HTML (10-30%)
4. **LOADING_IMAGES** - Загрузка изображений (30-70%)
5. **RENDERING** - Рендеринг PDF (70-95%)
6. **COMPLETE** - Завершено (100%)

## Обработка ошибок

Все ошибки оборачиваются в `ExportError` с типом:

- `VALIDATION_ERROR` - Ошибка валидации данных
- `TRANSFORMATION_ERROR` - Ошибка преобразования
- `HTML_GENERATION_ERROR` - Ошибка генерации HTML
- `IMAGE_LOAD_ERROR` - Ошибка загрузки изображений
- `RENDERING_ERROR` - Ошибка рендеринга
- `UNKNOWN_ERROR` - Неизвестная ошибка

## Миграция со старого кода

### Было:
```typescript
import { useListTravelExportEnhanced } from '@/components/listTravel/hooks/useListTravelExportEnhanced';

const { generatePDF, previewPDF, isGenerating, progress } = useListTravelExportEnhanced({ selected, userName });
```

### Стало:
```typescript
import { usePdfExport } from '@/src/hooks/usePdfExport';

const { exportPdf, previewPdf, isGenerating, progress } = usePdfExport(selected);
```

## Тестирование

Каждый компонент можно тестировать отдельно:

```typescript
import { TravelDataTransformer } from '@/src/services/pdf-export/TravelDataTransformer';

test('transforms travel data correctly', () => {
  const transformer = new TravelDataTransformer();
  const result = transformer.transform(mockTravels);
  expect(result).toMatchSnapshot();
});
```

## Расширяемость

### Добавление нового рендерера

```typescript
import { IPdfRenderer } from '@/src/renderers/pdf/IPdfRenderer';

class MyCustomRenderer implements IPdfRenderer {
  async render(html, options) { /* ... */ }
  async preview(html, options) { /* ... */ }
  isAvailable() { return true; }
  async initialize() { /* ... */ }
}

const service = new PdfExportService(new MyCustomRenderer());
```

### Кастомизация обработки ошибок

```typescript
class CustomErrorHandler extends ErrorHandler {
  getUserFriendlyMessage(type, error) {
    // Кастомная логика
  }
}
```

## Производительность

- **Параллельная загрузка**: Изображения загружаются батчами
- **Кэширование**: Загруженные изображения кэшируются
- **Retry**: Автоматические повторные попытки при ошибках
- **Оптимизация DOM**: Минимальные операции с DOM
- **Генерирует HTML-книгу по данным и настройкам**
- Поддерживает обложку, оглавление, страницы путешествий, галерею, чек-листы и финальную страницу
- Включает **страницу маршрута** с:
  - живой картой (скриншот Leaflet + Carto тайлы),
  - маркерами с номерами точек, совпадающими со списком,
  - крупными карточками точек (фото, заголовок, подзаголовок, категория, координаты)
- Добавляет **travel-цитаты** на обложку и финальную страницу из набора в `quotes/travelQuotes.ts`

## Лучшие практики

1. **Всегда проверяйте Platform.OS** перед использованием
2. **Обрабатывайте ошибки** через try/catch
3. **Показывайте прогресс** пользователю
4. **Очищайте ресурсы** (blob URLs, DOM элементы)
5. **Используйте конфигурацию** для настройки под ваши нужды

