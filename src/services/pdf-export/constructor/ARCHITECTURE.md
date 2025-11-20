# Архитектура PDF Constructor

## Общая концепция

Система переработана с **HTML → PDF** на **Конструктор → Изображение → PDF**:

1. Пользователь открывает статью
2. Переходит в «Конструктор PDF»
3. Видит страницы как холсты (canvas/artboard)
4. Перетаскивает и настраивает блоки
5. Каждая страница рендерится в PNG/WebP
6. Из изображений собирается PDF

## Архитектура данных

### Модели

```
PdfDocument
├── id: string
├── title: string
├── pages: PdfPage[]
├── theme: PdfTheme
├── format: PageFormat
└── orientation: PageOrientation

PdfPage
├── id: string
├── pageNumber: number
├── format: PageFormat
├── orientation: PageOrientation
├── blocks: PdfBlock[]
├── background: PageBackground
└── margins: Margins

PdfBlock
├── id: string
├── type: BlockType
├── position: BlockPosition
├── styles: BlockStyles
├── content: BlockContent
└── zIndex: number

PdfTheme
├── id: string
├── name: string
├── colors: ThemeColors
├── typography: Typography
├── spacing: Spacing
└── blocks: BlockStyles
```

## Пайплайн рендеринга

### 1. Конструктор → Модель данных

```
User Actions → PdfDocumentBuilder → PdfDocument
```

- Пользователь добавляет/редактирует блоки
- `PdfDocumentBuilder` обновляет модель
- Изменения сохраняются в состоянии

### 2. Модель → Canvas

```
PdfDocument → PageImageRenderer → Canvas
```

- `PageImageRenderer` получает страницу и тему
- Создает Canvas с нужным разрешением (DPI)
- Рендерит фон страницы
- Рендерит каждый блок:
  - Текст → `fillText()`
  - Изображения → `drawImage()`
  - Границы/тени → `strokeRect()`, `shadowBlur`
  - Спецблоки → комбинация выше

### 3. Canvas → Изображение

```
Canvas → toBlob() → PNG/WebP (base64)
```

- Canvas конвертируется в blob
- Blob → base64 для передачи
- Каждая страница = отдельное изображение

### 4. Изображения → PDF

```
RenderedPage[] → PdfAssembler → PDF Blob
```

- `PdfAssembler` получает массив изображений
- Использует jsPDF или pdf-lib
- Создает PDF документ
- Добавляет каждое изображение как страницу
- Возвращает готовый PDF blob

## Компоненты UI

### PdfConstructor (главный компонент)

```
┌─────────────────────────────────────┐
│         Toolbar                      │
│  [+ Блок] [+ Страница] [Тема] [Экспорт] │
└─────────────────────────────────────┘
┌──────────┬──────────────────┬────────┐
│          │                  │        │
│  Pages   │    Canvas        │ Styles │
│  List    │    (PageCanvas)  │ Panel  │
│          │                  │        │
└──────────┴──────────────────┴────────┘
```

### BlockPalette

Модальное окно с палитрой блоков:
- Группировка по типам
- Иконки и описания
- Клик → добавление блока

### PageCanvas

Холст для отображения страницы:
- Масштабирование для отображения
- Визуализация блоков
- Выделение выбранного блока
- Клик → выбор блока

### StylePanel

Панель редактирования стилей:
- Редактирование текста
- Настройка шрифтов
- Цвета и отступы
- Удаление блока

### PageNavigator

Навигатор страниц:
- Список всех страниц
- Переключение между страницами
- Дублирование/удаление

## Алгоритм импорта статьи

### ArticleImporter

1. **Парсинг статьи**
   - Использует `ArticleParser`
   - Преобразует `Travel` → `ArticlePdfModel`

2. **Создание структуры**
   - Обложка (cover page)
   - Оглавление (если есть заголовки)
   - Страница с метаданными
   - Страницы с контентом
   - Карта (если есть)
   - Рекомендации (если есть)

3. **Преобразование секций в блоки**
   - `heading` → `heading-h2`/`heading-h3`
   - `paragraph` → `paragraph`
   - `image` → `image-with-caption`
   - `imageGallery` → `image-gallery`
   - `infoBlock` → `tip-block`/`important-block`/`warning-block`
   - `quote` → `quote`
   - `list` → `paragraph` (с маркерами)

4. **Распределение по страницам**
   - Каждый H2 → новая страница
   - Проверка переполнения
   - Автоматическое создание новых страниц

## Система тем

### Структура темы

```typescript
PdfTheme {
  colors: {
    primary, secondary, text, textSecondary,
    background, surface, accent, border,
    tipBlock, importantBlock, warningBlock
  },
  typography: {
    headingFont, bodyFont,
    headingSizes: { h1, h2, h3 },
    bodySize, lineHeight
  },
  spacing: {
    pagePadding, blockSpacing, elementSpacing
  },
  blocks: {
    borderRadius, borderWidth, shadow
  }
}
```

### Применение темы

При переключении темы:
1. Обновляется `document.theme`
2. Все блоки получают новые стили
3. Перерендеривается Canvas
4. Обновляется предпросмотр

## Оптимизация

### Производительность

1. **Ленивая загрузка изображений**
   - Загрузка только при рендеринге
   - Кэширование загруженных изображений

2. **Батчинг операций**
   - Группировка обновлений блоков
   - Единое обновление состояния

3. **Виртуализация**
   - Рендеринг только видимых страниц
   - Отложенная загрузка больших изображений

### Размер файлов

1. **Оптимизация изображений**
   - Сжатие PNG/WebP
   - Настройка качества JPEG
   - Удаление метаданных

2. **Сжатие PDF**
   - Включение сжатия в jsPDF
   - Оптимизация шрифтов
   - Дедупликация ресурсов

## Ограничения и решения

### Ограничения

1. **Только браузер** - Canvas API доступен только в браузере
2. **Большие изображения** - могут замедлить рендеринг
3. **CORS** - изображения должны быть доступны с текущего домена

### Решения

1. **Прокси для изображений** - загрузка через сервер
2. **Предварительная обработка** - ресайз изображений перед рендерингом
3. **Прогрессивная загрузка** - показ прогресса при экспорте

## Будущие улучшения

- [ ] Drag & Drop для перестановки блоков
- [ ] Inline редактирование текста
- [ ] Поддержка шаблонов
- [ ] История изменений (undo/redo)
- [ ] Коллаборативное редактирование
- [ ] Экспорт в другие форматы (EPUB, HTML)

