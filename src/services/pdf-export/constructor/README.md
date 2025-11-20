# PDF Constructor - Документация

## Обзор

Система визуального конструктора PDF для создания документов из статей. Вместо прямой конвертации HTML → PDF используется подход: **Конструктор → Изображение → PDF**.

## Архитектура

```
┌─────────────────────────────────────┐
│   PdfConstructor (UI Component)    │  ← UI Layer
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│   ArticleConstructorService         │  ← Business Logic
│   - PdfDocumentBuilder              │
│   - PageImageRenderer               │
│   - PdfAssembler                   │
│   - ArticleImporter                │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│   Canvas API → PNG/WebP            │  ← Rendering
│   jsPDF/pdf-lib → PDF              │  ← Assembly
└─────────────────────────────────────┘
```

## Основные компоненты

### 1. PdfDocumentBuilder
Билдер для создания и управления PDF документом:
- Создание/удаление страниц
- Добавление/удаление/обновление блоков
- Управление темой
- Сохранение/загрузка документа

### 2. PageImageRenderer
Рендерер страниц в изображения:
- Рендеринг страницы в Canvas
- Конвертация в PNG/WebP
- Поддержка всех типов блоков
- Высокое качество (300 DPI)

### 3. PdfAssembler
Сборщик PDF из изображений:
- Сборка PDF из отрендеренных страниц
- Поддержка jsPDF и pdf-lib
- Оптимизация размера

### 4. ArticleImporter
Импортер статьи в конструктор:
- Парсинг Travel в PdfDocument
- Автоматическое создание страниц
- Преобразование секций в блоки

### 5. ThemeManager
Менеджер тем:
- Встроенные темы (Simple, Light, Dark, Magazine, Travel Book)
- Регистрация пользовательских тем
- Применение тем к документу

## Типы блоков

- `heading-h1`, `heading-h2`, `heading-h3` - Заголовки
- `paragraph` - Абзац текста
- `image` - Одно изображение
- `image-with-caption` - Изображение с подписью
- `image-gallery` - Галерея (1-4 фото)
- `map` - Карта маршрута
- `tip-block`, `important-block`, `warning-block` - Спецблоки
- `quote` - Цитата
- `checklist` - Чек-лист
- `table` - Таблица
- `divider` - Разделитель
- `spacer` - Пустое пространство
- `cover` - Обложка
- `toc` - Оглавление
- `author-block` - Об авторе
- `recommendations-block` - Рекомендации

## Использование

### Базовое использование

```typescript
import { ArticleConstructorService } from '@/src/services/pdf-export/constructor/ArticleConstructorService';
import type { Travel } from '@/src/types/types';

// Создаем сервис
const service = new ArticleConstructorService();

// Импортируем статью
const document = service.importArticle(travel, 'light');

// Экспортируем в PDF
const result = await service.exportToPdf(
  { dpi: 300, imageFormat: 'png' },
  (progress, message) => {
    console.log(`${progress}%: ${message}`);
  }
);

// Скачиваем файл
const url = URL.createObjectURL(result.blob);
const link = document.createElement('a');
link.href = url;
link.download = result.filename;
link.click();
```

### Использование в React компоненте

```tsx
import PdfConstructor from '@/components/export/PdfConstructor';

function MyComponent() {
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

## Настройка экспорта

```typescript
const config = {
  dpi: 300,              // Разрешение для печати
  imageFormat: 'png',    // Формат изображения: 'png' | 'webp' | 'jpeg'
  imageQuality: 0.95,    // Качество (для JPEG/WebP)
  optimizeImages: true,  // Оптимизация изображений
  compressPdf: true,      // Сжатие PDF
};
```

## Темы

### Встроенные темы

1. **Simple** - Минималистичная тема
2. **Light** - Светлая тема (по умолчанию)
3. **Dark** - Темная тема
4. **Magazine** - Журнальная тема
5. **Travel Book** - Тема для путеводителей

### Создание своей темы

```typescript
import type { PdfTheme } from '@/src/types/pdf-constructor';
import { themeManager } from '@/src/services/pdf-export/constructor/themes/ThemeManager';

const customTheme: PdfTheme = {
  id: 'custom',
  name: 'Custom Theme',
  colors: { /* ... */ },
  typography: { /* ... */ },
  spacing: { /* ... */ },
  blocks: { /* ... */ },
};

themeManager.registerTheme(customTheme);
```

## API

### ArticleConstructorService

#### Методы

- `createDocument(title, format)` - Создает новый документ
- `importArticle(travel, themeId)` - Импортирует статью
- `getDocument()` - Получает текущий документ
- `updateDocument(updates)` - Обновляет документ
- `exportToPdf(config, onProgress)` - Экспортирует в PDF
- `previewPage(pageId)` - Предпросмотр страницы
- `saveDocument(key)` - Сохраняет в localStorage
- `loadDocument(key)` - Загружает из localStorage

### PdfDocumentBuilder

#### Методы

- `addPage(page?)` - Добавляет страницу
- `removePage(pageId)` - Удаляет страницу
- `duplicatePage(pageId)` - Дублирует страницу
- `addBlock(pageId, block)` - Добавляет блок
- `updateBlock(pageId, blockId, updates)` - Обновляет блок
- `removeBlock(pageId, blockId)` - Удаляет блок
- `moveBlock(pageId, blockId, newIndex)` - Перемещает блок
- `setTheme(theme)` - Устанавливает тему
- `getDocument()` - Получает документ
- `loadDocument(document)` - Загружает документ

## Производительность

- Рендеринг страницы: ~100-500ms (зависит от сложности)
- Экспорт 10 страниц: ~2-5 секунд
- Размер PDF: ~1-5 MB на страницу (зависит от изображений)

## Ограничения

1. Работает только в браузере (Canvas API)
2. Требует jsPDF или pdf-lib для сборки PDF
3. Большие изображения могут замедлить рендеринг

## Будущие улучшения

- [ ] Drag & Drop для перестановки блоков
- [ ] Inline редактирование текста
- [ ] Поддержка шаблонов
- [ ] Экспорт в другие форматы (EPUB, HTML)
- [ ] Коллаборативное редактирование
- [ ] История изменений (undo/redo)

