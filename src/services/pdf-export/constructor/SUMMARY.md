# PDF Constructor - Итоговая документация

## Что было сделано

Полностью переработана система экспорта статей в PDF с **HTML → PDF** на **Конструктор → Изображение → PDF**.

## Основные компоненты

### 1. Модели данных (`src/types/pdf-constructor.ts`)

- `PdfDocument` - документ PDF
- `PdfPage` - страница документа
- `PdfBlock` - блок на странице
- `PdfTheme` - тема оформления
- `PdfExportConfig` - настройки экспорта

### 2. Сервисы

#### PdfDocumentBuilder
- Создание и управление документом
- Добавление/удаление страниц и блоков
- Управление темой

#### PageImageRenderer
- Рендеринг страниц в Canvas
- Конвертация в PNG/WebP
- Поддержка всех типов блоков

#### PdfAssembler
- Сборка PDF из изображений
- Поддержка jsPDF и pdf-lib
- Оптимизация размера

#### ArticleImporter
- Импорт статьи в конструктор
- Автоматическое создание страниц
- Преобразование секций в блоки

#### ThemeManager
- Управление темами
- 5 встроенных тем
- Регистрация пользовательских тем

### 3. UI компоненты

#### PdfConstructor
Главный компонент конструктора:
- Панель инструментов
- Навигатор страниц
- Холст для редактирования
- Панель стилей

#### BlockPalette
Палитра блоков для добавления

#### PageCanvas
Холст для отображения и редактирования страницы

#### StylePanel
Панель редактирования стилей блока

#### PageNavigator
Навигатор страниц

### 4. React Hook

`usePdfConstructor` - хук для работы с конструктором

## Типы блоков

1. **Заголовки**: `heading-h1`, `heading-h2`, `heading-h3`
2. **Текст**: `paragraph`
3. **Изображения**: `image`, `image-with-caption`, `image-gallery`
4. **Карта**: `map`
5. **Спецблоки**: `tip-block`, `important-block`, `warning-block`
6. **Другое**: `quote`, `checklist`, `table`, `divider`, `spacer`
7. **Специальные**: `cover`, `toc`, `author-block`, `recommendations-block`

## Темы

1. **Simple** - Минималистичная
2. **Light** - Светлая (по умолчанию)
3. **Dark** - Темная
4. **Magazine** - Журнальная
5. **Travel Book** - Для путеводителей

## Пайплайн экспорта

```
1. Пользователь редактирует документ в конструкторе
   ↓
2. PdfDocumentBuilder обновляет модель данных
   ↓
3. PageImageRenderer рендерит каждую страницу в Canvas
   ↓
4. Canvas конвертируется в PNG/WebP (base64)
   ↓
5. PdfAssembler собирает PDF из изображений
   ↓
6. Готовый PDF blob для скачивания
```

## Использование

### Базовый пример

```tsx
import PdfConstructor from '@/components/export/PdfConstructor';

<PdfConstructor
  travelData={travel}
  onExport={(blob, filename) => {
    // Автоматически скачивается
  }}
/>
```

### Через hook

```tsx
import { usePdfConstructor } from '@/hooks/usePdfConstructor';

const { importArticle, exportToPdf } = usePdfConstructor();

// Импорт
importArticle(travel, 'light');

// Экспорт
const result = await exportToPdf({ dpi: 300 });
```

## Настройки экспорта

```typescript
{
  dpi: 300,              // Разрешение (300 для печати)
  imageFormat: 'png',    // 'png' | 'webp' | 'jpeg'
  imageQuality: 0.95,    // Качество (0-1)
  optimizeImages: true,  // Оптимизация
  compressPdf: true,      // Сжатие PDF
}
```

## Производительность

- Рендеринг страницы: ~100-500ms
- Экспорт 10 страниц: ~2-5 секунд
- Размер PDF: ~1-5 MB на страницу

## Ограничения

1. Работает только в браузере (Canvas API)
2. Требует jsPDF или pdf-lib
3. Большие изображения могут замедлить рендеринг
4. CORS для внешних изображений

## Зависимости

```bash
npm install jspdf pdf-lib
```

## Файловая структура

```
src/
├── types/
│   └── pdf-constructor.ts          # Типы данных
├── services/pdf-export/constructor/
│   ├── PdfDocumentBuilder.ts      # Билдер документа
│   ├── ArticleConstructorService.ts # Главный сервис
│   ├── PdfAssembler.ts            # Сборщик PDF
│   ├── renderers/
│   │   └── PageImageRenderer.ts   # Рендерер страниц
│   ├── importers/
│   │   └── ArticleImporter.ts     # Импортер статей
│   └── themes/                    # Темы оформления
components/export/
├── PdfConstructor.tsx              # Главный компонент
└── constructor/
    ├── BlockPalette.tsx           # Палитра блоков
    ├── PageCanvas.tsx             # Холст страницы
    ├── StylePanel.tsx             # Панель стилей
    └── PageNavigator.tsx          # Навигатор страниц
hooks/
└── usePdfConstructor.ts            # React hook
```

## Интеграция

Конструктор интегрирован с `ArticleExportModal`:
- Кнопка "Открыть конструктор"
- Автоматический экспорт после редактирования
- Сохранение в localStorage

## Будущие улучшения

- [ ] Drag & Drop для перестановки блоков
- [ ] Inline редактирование текста
- [ ] Поддержка шаблонов
- [ ] История изменений (undo/redo)
- [ ] Коллаборативное редактирование
- [ ] Экспорт в другие форматы (EPUB, HTML)

## Документация

- `README.md` - Основная документация
- `ARCHITECTURE.md` - Архитектура системы
- `INSTALLATION.md` - Установка и настройка
- `SUMMARY.md` - Этот файл

## Поддержка

При возникновении проблем:
1. Проверьте установку зависимостей
2. Убедитесь, что код выполняется в браузере
3. Проверьте консоль на ошибки
4. См. `INSTALLATION.md` для решения проблем

