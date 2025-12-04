# Компоненты экспорта PDF

Эта директория содержит компоненты для генерации и экспорта PDF-книг путешествий.

## Архитектура

```
User Request
    ↓
BookSettingsModal (настройки экспорта)
    ↓
usePdfExport / useSingleTravelExport (хуки управления)
    ↓
BookHtmlExportService (сервис экспорта)
    ↓
TravelDataTransformer (трансформация данных)
    ↓
EnhancedPdfGenerator (генерация HTML)
    ↓
Компоненты страниц (рендеринг)
    ↓
HTML Preview / PDF Download
```

## Компоненты

### BookSettingsModal.tsx
**Назначение:** Модальное окно настроек экспорта

**Функции:**
- Настройка заголовка и подзаголовка книги
- Выбор типа обложки (auto, first-photo, gradient, custom)
- Выбор темы оформления (minimal, light, dark, travel-magazine, etc.)
- Сортировка путешествий (по дате, стране, алфавиту)
- Включение/выключение оглавления
- Включение/выключение галереи
- Включение/выключение карт
- Настройка чек-листов путешественника

**Интерфейс:**
```typescript
interface BookSettings {
  title: string;
  subtitle?: string;
  coverType: 'auto' | 'first-photo' | 'gradient' | 'custom';
  coverImage?: string;
  template: 'minimal' | 'light' | 'dark' | 'travel-magazine' | ...;
  sortOrder: 'date-desc' | 'date-asc' | 'country' | 'alphabetical';
  includeToc: boolean;
  includeGallery: boolean;
  includeMap: boolean;
  includeChecklists: boolean;
  checklistSections: ChecklistSection[];
}
```

**Использование:**
```tsx
<BookSettingsModal
  visible={isVisible}
  onClose={() => setIsVisible(false)}
  onSave={handleSave}
  onPreview={handlePreview}
  defaultSettings={settings}
  travelCount={travels.length}
  userName="Иван Иванов"
  mode="save"
/>
```

---

### BookCoverPageEnhanced.tsx
**Назначение:** Обложка книги путешествий

**Особенности:**
- Поддержка фонового изображения или градиента
- Статистика (количество путешествий, диапазон лет)
- Декоративные элементы (круги)
- Адаптивная типографика
- Логотип MeTravel

**Интерфейс:**
```typescript
interface BookCoverPageProps {
  title: string;
  subtitle?: string;
  userName?: string;
  travelCount: number;
  coverImage?: string;
  yearRange?: string;
}
```

**Пример:**
```tsx
<BookCoverPageEnhanced
  title="Мои путешествия"
  subtitle="Сборник впечатлений"
  userName="Иван Иванов"
  travelCount={15}
  coverImage="https://example.com/cover.jpg"
  yearRange="2020-2024"
/>
```

---

### BookTocPageEnhanced.tsx
**Назначение:** Оглавление книги с миниатюрами

**Особенности:**
- Миниатюры путешествий
- Номера страниц
- Двухколоночная раскладка
- Метаданные (страна, год)
- Декоративные элементы

**Интерфейс:**
```typescript
interface BookTocPageEnhancedProps {
  travels: Travel[];
  startPageNumber?: number;
}
```

**Пример:**
```tsx
<BookTocPageEnhanced
  travels={travels}
  startPageNumber={3}
/>
```

---

### TravelPageLayout.tsx
**Назначение:** Разворот путешествия (фото + текст)

**Особенности:**
- Двухстраничный разворот
- Левая страница: большое фото с overlay и заголовком
- Правая страница: текстовый контент
- QR-код для ссылки на путешествие
- Метаданные (страна, даты, длительность)
- Структурированный контент (описание, плюсы/минусы, рекомендации)

**Интерфейс:**
```typescript
interface TravelPageLayoutProps {
  travel: Travel;
  pageNumber: number;
  qrCode?: string;
}
```

**Пример:**
```tsx
<TravelPageLayout
  travel={travel}
  pageNumber={5}
  qrCode="data:image/png;base64,..."
/>
```

---

### PhotoGalleryPage.tsx
**Назначение:** Страница галереи фотографий

**Особенности:**
- Адаптивная сетка (2x2, 3x2, 3x3, 4xN)
- Номера на фотографиях
- Счетчик фотографий
- Скругленные углы, тени
- Оптимизация для печати

**Интерфейс:**
```typescript
interface PhotoGalleryPageProps {
  travelName: string;
  photos: Array<{ url: string; id?: number | string }>;
  pageNumber: number;
}
```

**Пример:**
```tsx
<PhotoGalleryPage
  travelName="Путешествие в Париж"
  photos={[
    { url: 'https://example.com/photo1.jpg', id: 1 },
    { url: 'https://example.com/photo2.jpg', id: 2 },
  ]}
  pageNumber={7}
/>
```

---

## Связанные файлы

### Сервисы
- `src/services/book/BookHtmlExportService.ts` - сервис экспорта HTML
- `src/services/pdf-export/generators/EnhancedPdfGenerator.ts` - генератор PDF
- `src/services/pdf-export/TravelDataTransformer.ts` - трансформация данных

### Хуки
- `src/hooks/usePdfExport.ts` - основной хук экспорта
- `components/travel/hooks/useSingleTravelExport.ts` - экспорт одного путешествия
- `components/listTravel/hooks/useListTravelExport.ts` - экспорт списка

### Темы
- `src/services/pdf-export/themes/PdfThemeConfig.ts` - конфигурация тем

### Парсеры и рендереры
- `src/services/pdf-export/parsers/ContentParser.ts` - парсинг контента
- `src/services/pdf-export/renderers/BlockRenderer.ts` - рендеринг блоков

---

## Типы

### Travel
```typescript
interface Travel {
  id: number | string;
  name: string;
  slug?: string;
  url?: string;
  description?: string | null;
  recommendation?: string | null;
  plus?: string | null;
  minus?: string | null;
  countryName?: string;
  cityName?: string;
  year?: string | number;
  monthName?: string;
  number_days?: number;
  travel_image_thumb_url?: string;
  travel_image_url?: string;
  gallery?: Array<{ url: string; id?: number | string }>;
  travelAddress?: Array<{
    id: string;
    address: string;
    coord: string;
    travelImageThumbUrl?: string;
    categoryName?: string;
  }>;
  userName?: string;
}
```

### TravelForBook
```typescript
interface TravelForBook {
  id: number | string;
  name: string;
  slug?: string;
  url?: string;
  description?: string | null;
  recommendation?: string | null;
  plus?: string | null;
  minus?: string | null;
  countryName?: string;
  cityName?: string;
  year?: string | number;
  monthName?: string;
  number_days?: number;
  travel_image_thumb_url?: string;
  travel_image_url?: string;
  gallery?: Array<{
    url: string;
    id?: number | string;
    updated_at?: string;
  }>;
  travelAddress?: Array<{
    id: string;
    address: string;
    coord: string;
    travelImageThumbUrl?: string;
    categoryName?: string;
  }>;
  youtube_link?: string;
  userName?: string;
}
```

---

## Использование

### Базовый экспорт
```typescript
import { usePdfExport } from '@/src/hooks/usePdfExport';

function MyComponent() {
  const { exportToPdf, isExporting, progress } = usePdfExport();

  const handleExport = async () => {
    const settings: BookSettings = {
      title: 'Мои путешествия',
      template: 'minimal',
      sortOrder: 'date-desc',
      includeToc: true,
      includeGallery: true,
      includeMap: true,
      includeChecklists: false,
      checklistSections: [],
    };

    await exportToPdf([1, 2, 3], settings);
  };

  return (
    <button onClick={handleExport} disabled={isExporting}>
      {isExporting ? `Экспорт... ${progress}%` : 'Экспортировать'}
    </button>
  );
}
```

### Предпросмотр
```typescript
import { openBookPreviewWindow } from '@/src/utils/openBookPreviewWindow';

function MyComponent() {
  const handlePreview = async () => {
    const html = await generateBookHtml(travels, settings);
    openBookPreviewWindow(html);
  };

  return <button onClick={handlePreview}>Предпросмотр</button>;
}
```

---

## Стилизация

### Темы оформления
Система поддерживает несколько тем оформления:
- **minimal** - минималистичная (по умолчанию)
- **light** - светлая
- **dark** - темная
- **travel-magazine** - журнальная вёрстка
- **classic** - классическая
- **modern** - современная
- **romantic** - романтическая
- **adventure** - приключенческая

### Цветовые схемы
Каждая тема имеет свою цветовую палитру:
- Основные цвета (текст, фон, поверхности)
- Акцентные цвета
- Границы и разделители
- Специальные блоки (info, warning, tip, danger)
- Цвета обложки

### Типографика
- Шрифты (заголовки, текст, моноширинный)
- Размеры заголовков (h1-h4)
- Размеры текста (body, small, caption)
- Межстрочные интервалы
- Отступы

---

## Оптимизация для печати

### Разрешение изображений
- Рекомендуется 300 DPI для печати
- Автоматическое масштабирование
- Оптимизация размера файла

### Цвета
- CMYK-friendly палитры
- Оптимизация контраста
- Режим "экономия чернил"
- Поддержка черно-белой печати

### Разметка
- Правильные page breaks
- Избегание обрезанных элементов
- Оптимизация отступов (bleed)
- Поддержка разных форматов (A4, Letter)

---

## Тестирование

### Unit-тесты
```bash
npm test -- components/export
```

### Интеграционные тесты
```bash
npm test -- __tests__/services/pdf-export
```

### Визуальное тестирование
```bash
npm run test:visual
```

---

## Разработка

### Добавление новой темы
1. Создать конфигурацию темы в `PdfThemeConfig.ts`
2. Добавить тему в `PDF_THEMES`
3. Обновить тип `PdfThemeName`
4. Добавить тесты

### Добавление нового типа страницы
1. Создать компонент в `components/export/`
2. Добавить интерфейс пропсов
3. Интегрировать в `EnhancedPdfGenerator`
4. Добавить тесты
5. Обновить документацию

### Добавление нового блока контента
1. Добавить тип блока в `ContentParser`
2. Добавить рендеринг в `BlockRenderer`
3. Добавить стили в темы
4. Добавить тесты

---

## Известные ограничения

1. **Экспорт только в браузере** - PDF генерируется только на web платформе
2. **Размер файла** - большое количество фото может увеличить размер PDF
3. **Производительность** - генерация может занять время для большого количества путешествий
4. **Карты** - требуется подключение к интернету для генерации карт

---

## Roadmap

### В разработке
- [ ] Реализация всех 8 тем оформления
- [ ] Рефакторинг EnhancedPdfGenerator
- [ ] Улучшение галерей (мозаика, коллаж, полароид)
- [ ] Интеграция Mapbox Static API

### Планируется
- [ ] Живой предпросмотр в BookSettingsModal
- [ ] Сохранение пользовательских настроек
- [ ] Кастомные шрифты (Google Fonts)
- [ ] Экспорт в другие форматы (EPUB, DOCX)
- [ ] Пакетный экспорт

---

## Поддержка

При возникновении проблем:
1. Проверьте консоль браузера на ошибки
2. Убедитесь, что все изображения доступны
3. Проверьте настройки экспорта
4. Обратитесь к документации API

---

**Последнее обновление:** 4 декабря 2025
