Борд — источник статусов: спринт #30, карточка #2854 (FE-BOOKS-E1).

## 1. Источники

- [x] 1.1 Собрать оригиналы всех выбранных статей автора 1 с SHA и размерами (`source-ready-book-photos.mjs`).
- [x] 1.2 Проверить снимки по каждому месту и записать `photo-evidence.json` BY31/PL30 с наблюдаемым содержанием (Photographic style uses only verified author originals).
- [x] 1.3 Статические Lora-Italic/Lora-Medium и OFL в `data/travelBooks/assets/fonts/lora/`.

## 2. Рендер и модель

- [x] 2.1 `visualStyle` в editorial-схеме; шрифт заголовка и подписи стиля в общем рендере; тесты render (Shared renderer, style-specific presentation).
- [x] 2.2 Коллажи 1–3 снимков без увеличения, реестр с ppi (Honest resolution limits per style).
- [x] 2.3 `loadSelectedBook` для `photo`, `renderReadyBooks({style})`, валидаторы и publish со стилем.

## 3. Сборка

- [x] 3.1 Собрать BY31/PL30 × 150×100/A5, read/print-shop/home/controls/templates.
- [x] 3.2 `--production --digital-only`, QR-декодирование всех PDF, честные ppi.

## 4. Публикация и сайт (после коммита F1 #2808)

- [x] 4.1 `PublishedBook.visualStyle`, уникальность country+style, старые JSON как акварель (One edition identity across visual styles).
- [x] 4.2 Переключатель стиля в каталоге и на странице издания, i18n RU/BE/UK/PL/EN (Style choice on the site).
- [ ] 4.3 Публикация ревизий (staging .codex-temp/books-photo/publication готов 01.11.2026), активация в catalog/manifest, copy-publication, SSR-оболочки новых slug — после коммита F1 #2808.

## 5. Проверка

- [ ] 5.1 typecheck, целевые Jest, test:i18n, review-and-fix и code-review-gate.
- [ ] 5.2 После выката: приёмка на проде mobile 390 → desktop 1440 по Task Contract #2854.
