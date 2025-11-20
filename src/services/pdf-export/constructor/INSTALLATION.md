# Установка и настройка PDF Constructor

## Зависимости

Для работы конструктора требуются следующие библиотеки:

```bash
npm install jspdf pdf-lib
```

или

```bash
yarn add jspdf pdf-lib
```

## Настройка

### 1. Установка зависимостей

Добавьте в `package.json`:

```json
{
  "dependencies": {
    "jspdf": "^2.5.1",
    "pdf-lib": "^1.17.1"
  }
}
```

### 2. Импорт в проект

Конструктор готов к использованию. Все компоненты находятся в:
- `src/services/pdf-export/constructor/` - сервисы
- `components/export/` - UI компоненты
- `hooks/usePdfConstructor.ts` - React hook

### 3. Использование

#### Базовое использование

```tsx
import PdfConstructor from '@/components/export/PdfConstructor';
import type { Travel } from '@/src/types/types';

function MyComponent() {
  const [travel, setTravel] = useState<Travel | null>(null);

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

#### Использование через hook

```tsx
import { usePdfConstructor } from '@/hooks/usePdfConstructor';
import type { Travel } from '@/src/types/types';

function MyComponent() {
  const { importArticle, exportToPdf, document } = usePdfConstructor();
  const [travel, setTravel] = useState<Travel | null>(null);

  useEffect(() => {
    if (travel) {
      importArticle(travel, 'light');
    }
  }, [travel, importArticle]);

  const handleExport = async () => {
    const result = await exportToPdf({ dpi: 300 });
    // Скачиваем файл
    const url = URL.createObjectURL(result.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <button onClick={handleExport}>Экспорт PDF</button>
    </div>
  );
}
```

## Интеграция с существующим кодом

### Обновление ArticleExportModal

Модальное окно экспорта уже обновлено и включает кнопку "Открыть конструктор".

### Использование в компонентах статей

```tsx
import ArticleExportModal from '@/components/export/ArticleExportModal';
import type { Travel } from '@/src/types/types';

function ArticleComponent({ travel }: { travel: Travel }) {
  const [showExport, setShowExport] = useState(false);

  return (
    <>
      <button onClick={() => setShowExport(true)}>Экспорт PDF</button>
      <ArticleExportModal
        visible={showExport}
        onClose={() => setShowExport(false)}
        onExport={(settings) => {
          // Старый способ экспорта (если нужен)
        }}
      />
    </>
  );
}
```

## Решение проблем

### Ошибка: "jsPDF is not defined"

Убедитесь, что библиотека установлена:
```bash
npm install jspdf
```

### Ошибка: "Canvas API not available"

Конструктор работает только в браузере. Проверьте, что код выполняется на клиенте:
```tsx
if (Platform.OS !== 'web') {
  return <Text>Конструктор доступен только в веб-версии</Text>;
}
```

### Ошибка: "CORS policy"

Изображения должны быть доступны с текущего домена. Используйте прокси или загружайте изображения через сервер.

### Большой размер PDF

Настройте качество экспорта:
```tsx
await exportToPdf({
  dpi: 150, // Вместо 300
  imageFormat: 'webp', // Вместо png
  imageQuality: 0.8, // Вместо 0.95
});
```

## Производительность

### Оптимизация рендеринга

1. Используйте WebP вместо PNG для меньшего размера
2. Уменьшите DPI для быстрого экспорта (150 вместо 300)
3. Оптимизируйте изображения перед добавлением

### Кэширование

Документы автоматически сохраняются в localStorage. Используйте:
```tsx
const { saveDocument, loadDocument } = usePdfConstructor();

// Сохранение
saveDocument('my-document');

// Загрузка
const doc = loadDocument('my-document');
```

