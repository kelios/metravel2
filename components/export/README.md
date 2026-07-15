# PDF export UI

`components/export/` содержит UI настроек PDF-книги. Канонический entrypoint —
`BookSettingsModal.tsx`; типы, defaults, helpers и крупные части разнесены по
соседним `BookSettingsModal.*` файлам.

## Основные компоненты

- `BookSettingsModal.tsx` — modal flow, validation и сохранение настроек;
- `BookSettingsModal.types.ts` — публичный `BookSettings` contract;
- `BookSettingsModal.constants.ts` — defaults и checklist options;
- `BookSettingsModal.helpers.ts` — чистые преобразования и visual tokens;
- `BookSettingsModal.parts.tsx` — fieldsets и footer;
- `BookSettingsModal.premium.ts` — premium availability/fallback contract;
- `ThemePreview.tsx`, `PresetSelector.tsx`, `GalleryLayoutSelector.tsx` —
  focused selectors.

Runtime export принадлежит `hooks/usePdfExport*.ts`,
`services/book/BookHtmlExportService.ts` и `services/pdf-export/`.

## Правила изменений

- не обходить `BookSettings` тип и premium fallback;
- сохранять web/native поведение и доступность modal controls;
- использовать существующие tokens и UI primitives;
- не добавлять отдельные «до/после» или implementation-summary документы —
  актуализировать этот README и тесты.

## Проверки

Выбирайте ближайшие тесты `BookSettingsModal`, export hooks и pdf-export service,
затем запускайте `yarn check:fast` для законченного изменения. Видимый web flow
дополнительно проверяется в браузере.
