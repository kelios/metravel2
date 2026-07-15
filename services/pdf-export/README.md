# PDF export service

`services/pdf-export/` преобразует travel data в HTML/PDF-книгу. Публичная
оркестрация идёт через `services/book/BookHtmlExportService.ts` и
`hooks/usePdfExportRuntime.ts`.

## Текущий pipeline

```text
BookSettingsModal
  -> usePdfExport / usePdfExportRuntime
  -> BookHtmlExportService
  -> TravelDataTransformer
  -> EnhancedPdfGenerator (v2 public entrypoint)
  -> HTML/print renderer
```

Ключевые зоны:

- `TravelDataTransformer.ts` — валидация и нормализация выбранных travels;
- `generators/EnhancedPdfGenerator.ts` — стабильный re-export генератора v2;
- `generators/v2/` — page assembly, renderers, image processing и atlas pages;
- `themes/` — типы, tiers и theme configs;
- `parsers/ContentParser.ts`, `renderers/BlockRenderer.ts` — rich content;
- `entitlement/` и `premiumSettingsGate.ts` — источник premium availability;
- `utils/` — локальные helpers без feature-level imports.

## Контракты

- `BookSettings` импортируется из `components/export/BookSettingsModal`;
- `TravelForBook` и export states — из `types/pdf-export`;
- новые callers используют `BookHtmlExportService`, а не внутренние runtime
  renderer classes;
- premium-only setting должен иметь явный free fallback;
- HTML/rich text и URLs проходят существующую sanitization/normalization;
- legacy comments с префиксом `src/` не означают наличие каталога `src/`.

## Проверки

Запускайте ближайшие тесты в `__tests__/services/pdf-export/`, export-hook tests и
`BookSettingsModal` tests. Для видимого результата дополнительно проверяйте
preview/download/print flow в реальном браузере. Полный PDF UI audit не хранится
как отдельный статичный отчёт: открытые изменения должны жить на task board.
