## Context

Мотивация — [proposal.md](proposal.md); требования —
[book-visual-styles](specs/book-visual-styles/spec.md) и правка
[ready-travel-books](specs/ready-travel-books/spec.md). Нормативный дизайн —
`docs/design/travel-memory-books-v1.md`; продуктовый контракт —
`docs/features/travel-memory-books.md`. Согласованный образец фотостиля —
`.codex-temp/books-e1/sample/` (Мирский замок, 01.11.2026), его выводы
перенесены в это решение.

Сейчас `loadSelectedBook` (`scripts/books/source-ready-book.mjs`) связывает
место с одной акварелью из реестра медиа, `buildReadyBookHtml`
(`services/book/readyBooks/render/`) печатает «Акварель» в alt, титул,
страницу использования и выходные данные, а `publicationSchema` различает
издания только по стране. Шрифт Marck Script задан для всего текста и для
эпиграфа обложки через профиль метрик (`marckFontAdapter`).

## Goals / Non-Goals

**Goals:** одна модель идентичности для всех стилей; полная фотографическая
редакция BY/PL в 150×100 и A5 из проверенных оригиналов; общий рендер без копий;
честные ppi; выбор стиля на сайте при неизменной акварели.

**Non-Goals:** другие стили (#2855, #2856), новый эпиграфный шрифт в движке
персонализации, изменение состава/статей, backend, облачный рендер,
store release, увеличение пикселей.

## Decisions

### 1. Идентичность и публикация

`editorialShape.visualStyle` — необязательное поле со значениями
`watercolor|photo|graphic|fantasy`, по умолчанию `watercolor`.
`PublishedBook.visualStyle` — то же; `publicationSchema` проверяет уникальность
`places:<country>:<style>` вместо `places:<country>`. Фотографические книги:
`belarus-photo-memory`/`belarus-photo`, `poland-photo-memory`/`poland-photo`,
заголовки «Беларусь. Фотокнига воспоминаний» / «Польша. Фотокнига
воспоминаний». Slug допускает дефис. Старые immutable JSON без поля читаются
как акварель (preprocess). Правка `catalog.ts`/`publication.ts` — после
коммита F1 #2808, который держит эти файлы.

### 2. Источники фотографий и PhotoEvidence

`scripts/books/source-ready-book-photos.mjs` скачивает все оригиналы
(`variants.original`) из тела статьи, галереи путешествия и фото точек
(`address_images[pointId]`) каждой выбранной статьи автора 1, с SHA-256 и
реальными размерами. Выбор снимков объекта фиксируется в
`data/travelBooks/{by,pl}/photo-evidence.json`: `PhotoEvidence{pointId,
articleId, authorId:1, originalUri, sha256, widthPx, heightPx, rights,
verifiedOn, observedContent, role}`. Основной кадр каждого места — тот же
проверенный оригинал, что у акварели (`source-records.json`), либо явно
записанная замена из той же статьи с причиной.

### 3. Коллаж

`scripts/books/render-ready-book-collage.py` (Pillow, только LANCZOS-уменьшение)
собирает на бумаге `#fffefa` коллаж 1–3 снимков в боксы рендера: A5 страница
148×210, compact бокс 62×42, обложки 148×106 и 120×41 мм. Маска —
суперэллипс с плавной полосой (смягчение по размеру бокса) и 1,5 мм
финальным переходом к бумаге. ppi холста = min(300, минимальное реальное
ppi размещённых снимков); увеличение запрещено проверкой. Результат — PNG
без потерь и реестр `.codex-temp/books-photo/collage-registry.json` с SHA,
рецептом и ppi каждого снимка.

### 4. Общий рендер

`ReadyBookRenderInput.fonts.heading` (необязательно) и `book.visualStyle`
задают `BookHeading`/`BookHand`; `render/styleCopy.ts` даёт подписи стиля:
alt («Фотография места»/«Акварель»), титул, страница использования,
выходные данные (фотографии автора; Lora — The Lora Project Authors,
SIL OFL 1.1). Для compact источник книги собирается отдельно с коллажем
62×42 в `dataUri` ассета, для A5 — с коллажем 148×210; рендер не меняет
логику бокса. Бокс, заголовок, рассказ, QR, карта и
обложка не меняются. Эпиграф — существующий `createPersonalizedCoverPdf` с
Marck Script (профиль метрик привязан к SHA; смена эпиграфного шрифта —
отдельная работа).

### 5. Сборка и файлы

`loadSelectedBook(country, {style:'photo', profileId})` строит ассеты из
реестра коллажей; `renderReadyBooks({style})` пишет production в
`.codex-temp/books-photo/production`. Валидаторы и `publish.mjs` получают
стиль из editorial-снимка; QR, imposition, controls, cover templates —
без изменений. Шрифты `data/travelBooks/assets/fonts/lora/` — статические
Lora-Italic (текст) и Lora-Medium (заголовки), OFL 1.1.

### 6. Сайт

Каталог показывает подпись стиля; страница издания — переключатель
«Стиль» между редакциями одной страны с сохранением размера через query
`?profile=`. Ключи `books:style*` в пяти локалях.

## Risks / Rollback

Риск: оригиналы 400–1000 px дают A5 ниже 300 ppi — показывается честно,
`printReady=false`. Риск: F1 не коммитит `publication.ts` — модель и UI
откладываются, сборка файлов не ждёт. Откат — возврат предыдущего
manifest/catalog; акварельные URL и файлы не меняются.

## Validation

`npm run typecheck`; Jest `__tests__/services/book/readyBooks/{render,
publication,manifest}`, `__tests__/components/books/{catalog,details}`;
`npm run test:i18n`; локальная сборка 2 стран × 2 профилей,
`validate-ready-books.mjs --production … --digital-only` и `validate-qr.mjs`;
после коммита — штатный выкат и приёмка на проде: mobile 390, затем
desktop 1440.
