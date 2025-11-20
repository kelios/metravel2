# Быстрый старт - PDF Constructor

## Установка зависимостей

```bash
npm install jspdf pdf-lib
```

## Базовое использование

### 1. Импорт компонента

```tsx
import PdfConstructor from '@/components/export/PdfConstructor';
```

### 2. Использование в компоненте

```tsx
function MyComponent() {
  const [travel, setTravel] = useState(null);

  return (
    <PdfConstructor
      travelData={travel}
      onExport={(blob, filename) => {
        console.log('Exported:', filename);
      }}
    />
  );
}
```

### 3. Через модальное окно экспорта

```tsx
import ArticleExportModal from '@/components/export/ArticleExportModal';

<ArticleExportModal
  visible={showExport}
  onClose={() => setShowExport(false)}
  onExport={(settings) => {
    // Старый способ экспорта
  }}
/>
// Кнопка "Открыть конструктор" уже встроена
```

## Примеры

### Импорт статьи

```tsx
import { usePdfConstructor } from '@/hooks/usePdfConstructor';

const { importArticle } = usePdfConstructor();
importArticle(travel, 'light');
```

### Экспорт PDF

```tsx
const { exportToPdf } = usePdfConstructor();

const result = await exportToPdf({
  dpi: 300,
  imageFormat: 'png',
});

// Скачивание
const url = URL.createObjectURL(result.blob);
const link = document.createElement('a');
link.href = url;
link.download = result.filename;
link.click();
URL.revokeObjectURL(url);
```

### Сохранение/загрузка

```tsx
const { saveDocument, loadDocument } = usePdfConstructor();

// Сохранение
saveDocument('my-document');

// Загрузка
const doc = loadDocument('my-document');
```

## Настройки экспорта

```typescript
{
  dpi: 300,              // 300 для печати, 150 для экрана
  imageFormat: 'png',    // 'png' | 'webp' | 'jpeg'
  imageQuality: 0.95,    // 0-1 для JPEG/WebP
  optimizeImages: true,
  compressPdf: true,
}
```

## Темы

Доступные темы:
- `simple` - Минималистичная
- `light` - Светлая (по умолчанию)
- `dark` - Темная
- `magazine` - Журнальная
- `travel-book` - Для путеводителей

## Типы блоков

- Заголовки: `heading-h1`, `heading-h2`, `heading-h3`
- Текст: `paragraph`
- Изображения: `image`, `image-with-caption`, `image-gallery`
- Карта: `map`
- Спецблоки: `tip-block`, `important-block`, `warning-block`
- Другое: `quote`, `checklist`, `table`, `divider`, `spacer`

## Решение проблем

### Ошибка: "jsPDF is not defined"
```bash
npm install jspdf
```

### Ошибка: "Canvas API not available"
Убедитесь, что код выполняется в браузере:
```tsx
if (Platform.OS !== 'web') {
  return <Text>Только для веб</Text>;
}
```

### Большой размер PDF
Уменьшите качество:
```tsx
await exportToPdf({
  dpi: 150,
  imageFormat: 'webp',
  imageQuality: 0.8,
});
```

## Дополнительная документация

- `README.md` - Полная документация
- `ARCHITECTURE.md` - Архитектура системы
- `INSTALLATION.md` - Детальная установка
- `SUMMARY.md` - Итоговая информация

