---
name: metravel-travel-pdf
description: >-
  Экспорт путешествий metravel.by в PDF-книгу (фотоальбом/путеводитель): добавить
  тему, раздел, шаблон обложки/галереи, починить превью-печать, изменить
  сортировку/пресеты. Триггеры: «сделай PDF из путешествия», «добавь тему в книгу
  путешествий», «почини экспорт PDF», «новый раздел в книге», «не печатается PDF».
---

# metravel-travel-pdf

Регламент работы с подсистемой экспорта путешествий в **PDF-книгу** (фотоальбом,
путеводитель, журнал поездки). Это **web-only** фича: книга собирается как HTML и
печатается браузером (`window.print()` → «Сохранить как PDF»). **Библиотеки jsPDF /
pdf-lib НЕТ** — не добавляй их, генератор отдаёт HTML+CSS `@media print`.

## Главные правила (ОБЯЗАТЕЛЬНО)

1. **Только web.** На native (`Platform.OS !== 'web'`) экспорт заблокирован Alert'ом
   (`TravelPdfExportControl.tsx`, `usePdfExportRuntime.ts`). Любую новую кнопку/вызов
   экспорта гейти тем же образом — не тащи DOM/print-код в native-бандл.
2. **HTML, а не PDF-API.** Страницы книги — это HTML-строки с классом `.pdf-page` и
   печатным CSS. Новый контент = новая функция-рендерер, возвращающая HTML-строку.
   Не подключай canvas/jsPDF/puppeteer.
3. **Экранируй всё.** Данные путешествия (название, описание, подписи) — пользовательский
   HTML. Используй `escapeHtml`/`buildSafeImageUrl` из
   `services/pdf-export/utils/htmlUtils.ts`; не вставляй сырые строки в разметку.
4. **Картинки — через `ImageProcessor`/`buildSafeImageUrl`**, не сырые URL: нужен
   прокси/preload, иначе печать стартует до загрузки фото (в превью встроен retry-preload).
5. **Тяжёлый runtime грузится лениво.** Точка входа — тонкий хук `usePdfExport`, вся
   генерация в `usePdfExportRuntime` + `services/`. Не импортируй генератор статически в
   UI-компонентах — сломаешь bundle-split (PERF-014).
6. **Фото — доминанта** (правило CLAUDE.md): на фото-страницах и обложке кадр главный,
   оверлеи только в углах; не подменяй `contain`+blur на `cover`.
7. **Верифицируй в браузере** перед сдачей: реально открой превью книги и проверь печать
   (см. «Верификация»). «Готово» — только после визуальной проверки.

## Архитектура (поток)

```
Кнопка экспорта
  ├─ TravelPdfExportControl.tsx        (одно путешествие)
  └─ ListTravelExportControls.tsx      (список, выбор + сортировка)
        │
        ▼
  BookSettingsModal.tsx                (template, обложка, секции, галерея)
        │
        ▼
  usePdfExport.ts  (тонкий React-хук: state, stage, lazy import)
        │
        ▼
  usePdfExportRuntime.ts  (worker: batch-fetch ×3, retry ×2, стадии)
        │  fetchTravel / fetchTravelBySlug  ← api/travelDetailsQueries.ts
        ▼
  BookHtmlExportService.ts  (оркестратор + enhanceHtmlForPrintPreview)
        │
        ▼
  TravelDataTransformer.ts → EnhancedPdfGenerator (v2)
        │  EnhancedPdfGeneratorBase.ts собирает страницы:
        │   обложка → TOC → контент → галерея → карта(атлас) → чек-лист → финал
        ▼
  openBookPreviewWindow.ts  →  окно браузера  →  window.print() → PDF
```

## Карта файлов (где что менять)

| Слой | Файл | Роль |
|------|------|------|
| UI (одно) | `components/travel/TravelPdfExportControl.tsx`, `components/travel/ShareButtonsPdfExportBridge.tsx`, `components/travel/hooks/useSingleTravelExport.ts` | Кнопка + дефолтные настройки для одного travel |
| UI (список) | `components/listTravel/ListTravelExportControls.tsx`, `components/listTravel/hooks/useListTravelExport.ts` | Мульти-выбор, drag-сортировка, batch |
| Настройки | `components/export/BookSettingsModal.tsx` (+`.types/.constants/.helpers/.parts.tsx`), `components/export/README.md` | Модал настроек книги; `BookSettings` тип в `.types.ts` |
| React-хук | `hooks/usePdfExport.ts` | Стейт, стадии, ленивый import runtime |
| Runtime | `hooks/usePdfExportRuntime.ts` | Batch-fetch, retry, прогресс, открытие превью; web-гейт |
| Оркестратор | `services/book/BookHtmlExportService.ts` | Transform → генератор → `enhanceHtmlForPrintPreview` (toolbar + preload-скрипт) |
| Данные | `services/pdf-export/TravelDataTransformer.ts` | `Travel[]` → нормализованная модель книги |
| Генератор | `services/pdf-export/generators/v2/EnhancedPdfGenerator.ts` → `runtime/EnhancedPdfGeneratorBase.ts` | Сборка всех страниц книги |
| Страницы | `runtime/coverPage.ts`, `runtime/travelContentPage.ts`, `runtime/travelPhotoPage.ts`, `runtime/atlasPages.ts` (+`atlas/`), `runtime/pdfSectionRenderers.ts` (TOC, чек-лист), `runtime/renderers/{GalleryPageRenderer,MapPageRenderer,FinalPageRenderer}.ts` | Рендереры конкретных разделов (HTML-строки) |
| Сборка/markup | `runtime/pdfPageAssembly.ts`, `runtime/pdfRuntimeMarkup.ts` (+`pdfRuntimeMarkup/`), `runtime/pdfVisualHelpers.ts` | DOCTYPE, печатный CSS, склейка страниц, running header |
| Контент | `services/pdf-export/parsers/ContentParser.ts`, `services/pdf-export/renderers/BlockRenderer.ts` | Парс/рендер блоков описания (plus/minus/recommendation) |
| Темы | `services/pdf-export/themes/PdfThemeConfig.ts` (реестр), `themes/types.ts` (`PdfThemeConfig`), `themes/configs/*.ts` (18 тем) | Цвета/типографика/отступы темы |
| Имя темы | `components/export/ThemePreview.tsx` (экспорт `PdfThemeName`) | Союз допустимых тем |
| Пресеты | `types/pdf-presets.ts` (`BOOK_PRESETS`, `getPresetById`) | Готовые наборы настроек |
| Типы | `types/pdf-export.ts` (`ExportStage`, `ExportConfig`), `types/book.ts`, `types/pdf-gallery.ts` | Енумы/модели |
| Утилиты | `services/pdf-export/utils/htmlUtils.ts` (escape/safe-url), `services/pdf-export/generators/v2/processors/ImageProcessor.ts`, `services/pdf-export/quotes/travelQuotes.ts`, `utils/openBookPreviewWindow.ts` | Безопасность, картинки, цитаты, открытие окна |

## `BookSettings` (что управляет книгой)

`components/export/BookSettingsModal.types.ts`:

- `title`, `subtitle`
- `coverType`: `'auto' | 'first-photo' | 'gradient' | 'custom'` (+ `coverImage`)
- `template`: `PdfThemeName` — одна из 18 тем (`minimal`, `classic`, `modern`,
  `romantic`, `adventure`, `travel-magazine`, `ocean`, `forest`, `sepia`, `newspaper`,
  `nordic`, `retro`, `tropical`, `illustrated`, `dark`, `light`, `black-white`, `sunset`)
- `sortOrder`: `'manual' | 'date-desc' | 'date-asc' | 'country' | 'alphabetical'`
- секции: `includeToc`, `includeGallery`, `includeMap` (+`showCoordinatesOnMapPage`),
  `includeChecklists` (+`checklistSections`: clothing/food/electronics/documents/medicine)
- галерея: `galleryLayout`, `galleryColumns`, `galleryPhotosPerPage`,
  `galleryTwoPerPageLayout`, `showCaptions`, `captionPosition`, `gallerySpacing`
- фото-страница: `photoPageLayout`: `'full-bleed' | 'framed' | 'split'`

## Типовые задачи

### Добавить тему
1. `services/pdf-export/themes/configs/<name>.ts` — экспортируй `PdfThemeConfig`
   (colors / typography / spacing) по образцу `minimal.ts` или `classic.ts`.
2. Зарегистрируй в `services/pdf-export/themes/PdfThemeConfig.ts` (реестр `PDF_THEMES`).
3. Добавь имя в `PdfThemeName` (`components/export/ThemePreview.tsx`).
4. (Опц.) Превью в `ThemePreview.tsx` и/или пресет в `types/pdf-presets.ts`.

### Добавить раздел книги (напр. «Маршруты»)
1. Новый рендерер `runtime/<section>PageRenderer.ts` → функция, возвращающая HTML-строку
   (бери `theme`, `escapeHtml`, образец — `pdfSectionRenderers.ts` / `GalleryPageRenderer.ts`).
2. Вызови его в `EnhancedPdfGeneratorBase.ts` в нужном месте сборки страниц (под флагом).
3. Добавь флаг в `BookSettings` (`.types.ts`) и тумблер в `BookSettingsModal`.
4. Проброс флага через `useSingleTravelExport`/`useListTravelExport` дефолты при необходимости.

### Изменить обложку / галерею / порядок
- Обложка: `runtime/coverPage.ts` + `pages/CoverPageGenerator.ts`; типы — `coverType`.
- Галерея: `runtime/renderers/GalleryPageRenderer.ts` (+ `legacyGalleryLayouts.ts`).
- Карта/атлас: `runtime/atlasPages.ts` + `runtime/atlas/`, `renderers/MapPageRenderer.ts`.
- Сортировка: `runtime/bookData.ts` (`sortTravels`).

### Починить превью/печать
- Превью-окно и preload-скрипт картинок: `BookHtmlExportService.ts`
  (`enhanceHtmlForPrintPreview`) + `utils/openBookPreviewWindow.ts`.
- Печатный CSS/`@media print`, разбиение на страницы: `runtime/pdfRuntimeMarkup.ts`,
  `runtime/pdfPageAssembly.ts`, `runtime/pdfVisualHelpers.ts`.
- Стадии/прогресс/таймауты/батч: `hooks/usePdfExportRuntime.ts` (`ExportStage`).

## Премиум-шаблоны (FE-8, эпик #37) — план и модель доступа

Платная фича: красивые «дизайнерские» PDF-шаблоны книги. Решения владельца
(2026-06-19) зафиксированы на борде; здесь — понятная сводка для исполнителя.

**Что бесплатно / что премиум:**
- **Free:** базовые утилитарные темы (`minimal`, `light`, `classic`, `dark`,
  `black-white`) + деликатный водяной знак «Создано на metravel.by». Экспорт всегда
  работает (регресс обязателен).
- **Premium:** все дизайнерские темы (`romantic`, `travel-magazine`, `illustrated`,
  `sepia`, `newspaper`, `ocean`, `forest`, `sunset`, `nordic`, `retro`, `tropical`,
  `modern`, `adventure`) + 2 новых флагмана (`editorial-luxe`, `watercolor`), снятие
  водяного знака, кастомная обложка, журнальные раскладки галереи.

**Модель доступа (entitlement):**
- **Сейчас (разработка):** ВСЕ пользователи премиум по умолчанию — paywall не
  блокирует никого. Стаб-источник `isPremium=true`, один переключатель на реальный
  источник.
- **Раскатка (earned-or-paid):** `premium = (опубликовано ≥20 путешествий, publish=1)
  ИЛИ (оплачено)`. Порог 20 конфигурируемый.
- **Server-authoritative:** правило «≥20» считает БЭКЕНД и отдаёт готовый `is_premium`
  в профиле. Фронт только читает — порог нельзя подделать на клиенте.
- earned-путь (≥20) не зависит от биллинга → реальный гейтинг можно включить до оплаты.

**Архитектура (pluggable):** тир (`free`/`premium`) у каждой темы/пресета +
entitlement-слой `usePdfPremium` с интерфейсом источника. Меняется только источник
(стаб → бэк → платёж), UI и генератор не трогаются. Подробности задач — на борде.

**Карта тикетов:** эпик **#37**; FE: **#292** тиры тем · **#294** entitlement+стаб ·
**#296** paywall-UI · **#297** гейт+водяной знак · **#295** 2 новые темы ·
**#298** премиум-фичи. BE: **#293** `is_premium` (≥20 OR оплата). Платформа — web-only.

## Серверная / headless генерация PDF (в коде ПОКА НЕТ)

По умолчанию книга печатается вручную в браузере. Если нужен **готовый PDF-файл
без ручного `Ctrl+P`** (по запросу, в CI, для рассылки) — есть два пути.

**Путь A — FE headless через Playwright (без правок бэкенда, предпочтительно).**
В проекте есть `@playwright/test` (e2e). HTML-генератор почти чистый: RN-зависимость
только в обёртке `BookHtmlExportService` (гейт `Platform.OS`), а сам генератор
`services/pdf-export/generators/EnhancedPdfGenerator.ts` и `TravelDataTransformer` —
без RN. Поэтому скрипт (`scripts/export-travel-pdf.*`, новый) может:
1. `fetchTravel(id)` → `new TravelDataTransformer().transform(...)` →
   `new EnhancedPdfGenerator().generate(travels, settings)` — получить HTML **в обход**
   `BookHtmlExportService` (чтобы не упереться в web-гейт).
2. Playwright: `await page.setContent(html, { waitUntil: 'networkidle' })` →
   `await page.pdf({ format: 'A4', printBackground: true })` → записать файл.
   Картинки сами догрузятся (`networkidle`); preload-скрипт превью не нужен.
Это переиспользует ту же вёрстку/темы, что и интерактивный экспорт — единый источник
правды по виду книги. Не дублируй рендереры.

**Путь B — настоящий API-эндпоинт на бэкенде.** Бэкенд — **отдельное репо, НЕ правим**
(см. CLAUDE.md). Если решение должно жить на сервере metravel.by (напр.
`GET /api/travels/{id}/book.pdf`) — это **тикет на MCP-борд** (`area=back`, через агента
`ticket-board`), а не правка здесь. Во фронте только потребляем готовый URL.

Текущее состояние: ни A, ни B не реализованы — есть только браузерная печать. Прежде
чем строить headless, уточни у владельца, нужен ли файл на сервере (B) или достаточно
локального/CI-скрипта (A).

## Данные путешествия

Полные данные тянет `api/travelDetailsQueries.ts` → `fetchTravel(id)` /
`fetchTravelBySlug(slug)`. Для ручной сверки структуры — `GET /api/travels/{id}/`
(`name`, `description`, `recommendation`, `plus`/`minus`, `gallery`, `travelAddress[]`
с координатами и фото). Сортировка/группировка по странам и году — в `runtime/bookData.ts`.

## Верификация (web)

1. `npm run web` (или статика `dist/prod`, см. memory «Static SPA Browser Verify»).
2. Открой страницу путешествия → кнопка экспорта PDF → выбери template/секции → собери книгу.
3. Проверь в превью-окне: обложка, TOC, контент, галерея, карта, финал; фото прогружены
   (preload отработал), печатные разрывы страниц корректны.
4. Печать: `Ctrl/Cmd+P` → «Сохранить как PDF» — убедись, что страницы не рвут фото/блоки,
   running header на месте, цвета темы применились.
5. На разных темах прогон 2–3 шаблонов; для списка — экспорт нескольких travel.

Не отмечай «готово», пока книга реально не собралась и не распечаталась в превью.
