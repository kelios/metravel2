# Текущая архитектура EnhancedPdfGenerator

## 📐 Общая структура

```
EnhancedPdfGenerator
├── Инициализация (constructor)
│   ├── ContentParser - парсинг контента
│   ├── BlockRenderer - рендеринг блоков
│   └── Theme Config - конфигурация темы
│
├── Генерация документа (generate)
│   ├── Сортировка путешествий
│   ├── Выбор обложки
│   ├── Генерация QR-кодов
│   ├── Построение метаданных
│   └── Сборка страниц
│
├── Рендеринг страниц
│   ├── renderCoverPage - обложка
│   ├── renderTocPage - оглавление
│   ├── renderTravelPhotoPage - страница с фото
│   ├── renderTravelContentPage - страница с контентом
│   ├── renderGalleryPage - галерея фотографий
│   ├── renderMapPage - карта маршрута
│   ├── renderChecklistPage - чек-листы
│   └── renderFinalPage - финальная страница
│
├── Вспомогательные методы
│   ├── Сортировка и фильтрация
│   ├── Нормализация данных
│   ├── Построение URL изображений
│   ├── Форматирование текста
│   └── Генерация SVG/иконок
│
└── HTML Builder
    └── buildHtmlDocument - сборка финального HTML
```

## 🏗️ Ключевые компоненты

### 1. EnhancedPdfGenerator (2111 строк)

**Основной класс, отвечающий за:**
- Генерацию полного HTML-документа для PDF
- Управление темами оформления
- Рендеринг всех типов страниц
- Обработку изображений и данных

**Основные зависимости:**
```typescript
import QRCode from 'qrcode';
import { getThemeConfig, type PdfThemeName } from '../themes/PdfThemeConfig';
import { ContentParser } from '../parsers/ContentParser';
import { BlockRenderer } from '../renderers/BlockRenderer';
import { generateLeafletRouteSnapshot } from '@/src/utils/mapImageGenerator';
import { pickRandomQuote } from '../quotes/travelQuotes';
```

### 2. ContentParser (810 строк)

**Отвечает за:**
- Парсинг HTML/Markdown в структурированные блоки
- Распознавание специальных блоков (советы, предупреждения)
- Нормализацию текста и пробелов
- Извлечение изображений, списков, таблиц

**Типы блоков:**
- `heading` - заголовки (h1-h6)
- `paragraph` - параграфы
- `list` - списки (упорядоченные/неупорядоченные)
- `quote` - цитаты
- `image` - изображения
- `image-gallery` - галереи изображений
- `info-block` / `warning-block` / `tip-block` / `danger-block` - специальные блоки
- `code` - код
- `separator` - разделители
- `table` - таблицы

### 3. BlockRenderer (527 строк)

**Отвечает за:**
- Рендеринг структурированных блоков в HTML
- Применение стилей темы
- Генерацию безопасных URL изображений
- Экранирование HTML

**Методы рендеринга:**
```typescript
renderBlock(block: ParsedContentBlock): string
renderHeading(block: HeadingBlock): string
renderParagraph(block: ParagraphBlock): string
renderList(block: ListBlock): string
renderQuote(block: QuoteBlock): string
renderImage(block: ImageBlock): string
renderImageGallery(block: ImageGalleryBlock): string
renderInfoBlock(block: InfoBlock): string
renderCode(block: CodeBlock): string
renderSeparator(): string
renderTable(block: TableBlock): string
```

### 4. PdfThemeConfig (934+ строк)

**Определяет темы оформления:**

#### Доступные темы:
1. **minimal** - Минималистичная (чистая, простая)
2. **light** - Светлая (воздух, мягкие цвета)
3. **dark** - Темная (элегантная)
4. **travel-magazine** - Журнальная вёрстка
5. **classic** - Классическая (традиционная типографика)
6. **modern** - Современная (геометрические формы)
7. **romantic** - Романтическая (пастельные цвета)
8. **adventure** - Приключенческая (динамичная)

#### Структура темы:
```typescript
interface PdfThemeConfig {
  name: PdfThemeName;
  displayName: string;
  description: string;
  colors: {
    text, textSecondary, textMuted,
    background, surface, surfaceAlt,
    accent, accentStrong, accentSoft, accentLight,
    border, borderLight,
    infoBlock, warningBlock, tipBlock, dangerBlock,
    cover
  };
  typography: {
    headingFont, bodyFont, monoFont,
    h1, h2, h3, h4,
    body, small, caption
  };
  spacing: {
    pagePadding, sectionSpacing, blockSpacing, elementSpacing,
    contentMaxWidth, columnGap
  };
  blocks: {
    borderRadius, shadow, borderWidth
  };
}
```

## 🔄 Поток данных

```
BookSettings + Travel[] 
    ↓
EnhancedPdfGenerator.generate()
    ↓
1. Сортировка путешествий (sortTravels)
    ↓
2. Выбор изображения обложки (resolveCoverImage)
    ↓
3. Генерация QR-кодов (generateQRCodes)
    ↓
4. Построение метаданных (buildTravelMeta)
    ↓
5. Рендеринг страниц:
   - renderCoverPage
   - renderTocPage (опционально)
   - Для каждого путешествия:
     * renderTravelPhotoPage
     * renderTravelContentPage
     * renderGalleryPage (опционально)
     * renderMapPage (опционально)
   - renderChecklistPage (опционально)
   - renderFinalPage
    ↓
6. Сборка HTML (buildHtmlDocument)
    ↓
HTML String (готов для печати/PDF)
```

## 📦 Интеграция с системой

### Вызов из приложения:

```typescript
// usePdfExport (React Hook)
  ↓
// BookHtmlExportService.generateTravelsHtml
  ↓
// EnhancedPdfGenerator.generate
  ↓
// Html2PdfRenderer.render (браузерная печать)
```

### Используется в:
- `src/services/book/BookHtmlExportService.ts` - основной сервис экспорта
- `src/hooks/usePdfExport.ts` - React хук
- `src/hooks/useSingleTravelExport.ts` - экспорт одного путешествия
- `src/hooks/useListTravelExport.ts` - экспорт списка путешествий

## 📊 Статистика кода

| Компонент | Строк кода | Методов | Зависимостей |
|-----------|-----------|---------|--------------|
| EnhancedPdfGenerator | 2111 | 30+ | 5 |
| ContentParser | 810 | 15+ | 0 |
| BlockRenderer | 527 | 12+ | 1 |
| PdfThemeConfig | 934+ | 0 | 0 |
| **Итого** | **4382+** | **57+** | **6** |

## 🎨 Основные возможности

### 1. Генерация страниц
- ✅ Обложка с градиентом/изображением
- ✅ Оглавление с миниатюрами
- ✅ Страницы путешествий (фото + контент)
- ✅ Галерея фотографий (несколько layout'ов)
- ✅ Карта маршрута (Leaflet snapshot)
- ✅ Чек-листы путешественника
- ✅ Финальная страница

### 2. Обработка контента
- ✅ Парсинг HTML/Markdown
- ✅ Специальные блоки (советы, предупреждения)
- ✅ Изображения с fallback
- ✅ Списки, таблицы, цитаты

### 3. Темы оформления
- ✅ 8 готовых тем
- ✅ Полная кастомизация цветов
- ✅ Настройка типографики
- ✅ Отступы и сетка

### 4. Обработка изображений
- ✅ Проксирование через weserv.nl
- ✅ Fallback для локальных URL
- ✅ Обработка data:// и blob:// URL
- ✅ Crossorigin для печати

### 5. Дополнительно
- ✅ QR-коды для каждого путешествия
- ✅ Цитаты о путешествиях
- ✅ Нумерация страниц
- ✅ Page-break оптимизация для печати

## 🔍 Краевые случаи

Система обрабатывает:
- ✅ Путешествия без фотографий
- ✅ Путешествия без карты
- ✅ Очень длинный текст
- ✅ Длинные заголовки
- ✅ Пустые описания/рекомендации
- ✅ Отсутствие галереи
- ✅ Некорректные координаты

## 📝 Форматы данных

### Travel (входные данные):
```typescript
interface TravelForBook {
  id: number;
  name: string;
  countryName?: string;
  year?: string;
  number_days?: number;
  travel_image_url?: string;
  travel_image_thumb_url?: string;
  description?: string;
  recommendation?: string;
  plus?: string;
  minus?: string;
  gallery?: Array<{ url: string } | string>;
  travelAddress?: TravelAddress[];
  slug?: string;
  url?: string;
  userName?: string;
}
```

### BookSettings (настройки):
```typescript
interface BookSettings {
  title: string;
  subtitle?: string;
  coverType: 'auto' | 'first-photo' | 'custom' | 'gradient';
  coverImage?: string;
  template: PdfThemeName;
  sortOrder: 'date-desc' | 'date-asc' | 'country' | 'alphabetical';
  includeToc: boolean;
  includeGallery: boolean;
  includeMap: boolean;
  includeChecklists: boolean;
  checklistSections: Array<'clothing' | 'food' | 'electronics' | 'documents' | 'medicine'>;
  galleryLayout: 'grid' | 'masonry' | 'polaroid' | 'collage' | 'slideshow';
  galleryColumns?: number;
  showCaptions: boolean;
  captionPosition: 'top' | 'bottom' | 'overlay' | 'none';
  gallerySpacing: 'compact' | 'normal' | 'spacious';
  showCoordinatesOnMapPage?: boolean;
}
```

## 🔗 Связанные файлы

- `src/services/pdf-export/README.md` - общая документация PDF экспорта
- `src/services/pdf-export/README_ENHANCED.md` - документация улучшенного генератора
- `__tests__/README_PDF_TESTS.md` - документация по тестам
- `src/services/book/BookHtmlExportService.ts` - сервис экспорта книги
- `src/types/pdf-export.ts` - типы для PDF экспорта
- `src/types/pdf-gallery.ts` - типы для галереи

