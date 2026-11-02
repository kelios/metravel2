# data/travelBooks — данные готовых книг

Контракт фичи — `docs/features/travel-memory-books.md`, план страниц —
`docs/design/travel-memory-books-v1/layouts-31-30-2026-11-02.md`.

## Актуальные данные выпуска

| Путь | Назначение |
| --- | --- |
| `manifest.json`, `related.json`, `catalog.json`, `contents.json` | Активная публикация и производные индексы (см. «Откат публикации» в feature doc). |
| `releases/<sha256>.json` | Неизменяемые снимки опубликованных manifest. Не редактировать. |
| `{by,pl}/selection.json`, `{by,pl}/source-records.json` | Выбранные места (BY 31 / PL 30) и проверенные источники. |
| `{by,pl}/artwork-provenance.json` | Права и происхождение 61 акварели, обложки и шрифта; канонический реестр прав акварельной серии. |
| `{by,pl}/{photo,graphic,fantasy}-evidence.json`, `styles/**` | Доказательства и утверждения других визуальных стилей. |
| `quests/**`, `series/**` | Квестовые тома и тематические серии. |
| `assets/fonts/**` | Шрифты рендера (Marck Script, Lora, Cormorant Garamond) с OFL; используются сборкой. |
| `cover-copy.json`, `instructions/**`, `providers.json`, `maps/**` | Тексты обложки и инструкций, справочник печати, карты. |
| `schema/**`, `profiles.ts` | Схемы и физические профили. |

## Прототип A2–B1 (legacy, 27–30.10.2026)

Следующие файлы относятся только к прототипу «12 мест / 56 страниц». Ни одно
опубликованное издание из них не собирается:

- `by/editorial.json`, `pl/editorial.json` — редакционные снимки 12 мест,
  ревизия `2026-10-27.1`;
- `rights.json` — реестр прав 26 изображений прототипа (24 места и 2 обложки);
- `assets/belarus-memory/**`, `assets/poland-memory/**` — печатные JPEG этих
  26 изображений, около 25 МБ (см. `assets/README.md`).

Кто их читает (проверено 02.11.2026):

- `scripts/books/media-check.mjs --legacy` выводит строку «ARCHIVED PROTOTYPE MEDIA ONLY»;
- `scripts/books/media-fetch-originals.mjs` — ручная загрузка мастеров B1;
- `__tests__/services/book/readyBooks/media.test.ts` — регрессия валидатора
  `scripts/books/media-validation.mjs` на настоящих байтах и правах;
- `docs/design/travel-memory-books-v1/{build,verify}-reference.py` — воспроизведение
  эталона A2: SHA-256 обоих `editorial.json` закреплены в `geometry-v1.json`.

Приложение, сборка текущих изданий (`scripts/books/source-ready-book.mjs`) и
публикация эти файлы не используют.

Решение от 02.11.2026: файлы остаются на месте с явной пометкой legacy. Удалить или
перенести их нельзя без потери воспроизводимости эталона A2: его SHA закреплены.
Валидатор медиа не применяется к текущим данным, поэтому перенос тестов на них
не дёшев. Удалять эти файлы можно только вместе с эталоном A2 и регрессией
валидатора, отдельной задачей. Новые данные сюда не добавлять.
