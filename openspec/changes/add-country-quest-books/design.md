## Context

Смысл уточнён владельцем31.10; см. proposal. Полный каталог282квеста проверен
по15страницам: BY82/PL73. Первые части41/37 дают164/148страниц только блоков.
Source collection получила78bundle,78covers и668точек; cover14.14MB, все реальные
1200×800/900/675. Intro достигает2769символов, маршрут —14точек.

Старые published contracts фиксируют2страны, alphabetic slug, author1/point IDs,
трёхстраничную композицию. Их нельзя обходить фиктивными статьями/местами.
На старте `catalog.ts` eagerly импортировал около176KB данных manifest. Итоговый
каталог10книг содержит11377B compact/1794B gzip и ленивые SHA-проверяемые
metadata; полный manifest/schema/quest authoring не входят в initial client
graph. Лимиты JSbudget не менялись; production bundle проверяется при выпуске.

## Goals / Non-Goals

Goals: правильный country/volume источник, четыре страницы на quest,
реальные карты и проверенные файлы, совместимость старых изданий.
Non-Goals: новый онлайн-квест, автоматический выбор общего возраста,
правка живых story/task/hint, player/host, paid render/печать, backend/stores.

## Decisions

### Источники и идентичность

`types/questBook.ts` задаёт отдельный `CountryQuestBook`: kind=quests,
country, volume, id/slug/revision, contentLocale=ru, catalog snapshot SHA,
ordered quests. Quest содержит numericID/questId/canonical questUrl,
title/city/tags/difficulty/duration, компактный overview по исходному intro,
все points с numericID/stepId/title/location/lat/lng/role, source bundle SHA/URL,
существующий cover URI/SHA/bytes/native dimensions. Машинные абсолютные пути,
счётчики/PII и raw answer/hint/task в эти данные не входят.
`catalog.json` сохраняет полный снимок155квестов; `selection.json` — включённые/
зарезервированные части и причины. Каждый source/media файл проверяется реально.
Новый источник не расширяет авторство страновых place-книг.

### Композиция и рендер

Отдельная семантика quest поверх существующих physical profiles, fonts,
HTML escaping, CSS page shell, imposition и PDF/preview инструментов.
`questBooks/composition.ts` считает4роли на quest и выравнивает начало на чётный
folio (левую страницу). Blank photo/notes без рамок, линий и декоративного текста.
`questBooks/render.ts` использует имеющуюся обложку, настоящий локальный QR,
полный список точек и редакционно сжатый сюжет. Нельзя брать первые Nсимволов,
уменьшать шрифт до нечитаемого размера или обрезать список ради сетки.
Сначала реальный четырёхстраничный образец A5, затем проверка longest-case
и compact150×100. Непоместившийся compact не объявляется готовым скрыто.

### Карты

Используется существующий `generateCanvasMapSnapshot` в изолированном Chromium
авторинга: подложка через собственный `/proxy/tiles/osm/{z}/{x}/{y}.png`,
та же атрибуция. Генератор обязан подтвердить покрытие: helper может молча
пропустить упавший tile, что для готового PDF недопустимо. По умолчанию номера
на реальной подложке без выдуманной линии дорог; если нужен walking path,
он берётся только из отдельного проверенного геометрического источника.
Карта — authored asset, не runtime-сценарий приложения. Новые прямые OSM URLs,
Google key или AWS render не вводятся.
Список URI/SHA/bytes тайлов выводится из точного возвращённого viewport и
закреплённого cache: request-interception не доказывает полный состав при
повторном использовании image-memory cache. Provenance хранит SHA Canvas-
renderer и authoring-адаптера; изменение только списка входов не меняет
редакцию/PDF, если все156PNG и48PDF сохранили исходные хеши.

### Публикация и бюджет

PublishedBook становится явным kind-discriminated контрактом с backward
default places; quest-kind не требует фиктивных sourceTravelId/authorId.
Уникальны id/slug и country+series+volume, не country. Старые manifest snapshots
не переписываются. Общие artifact/preview/quality структуры переиспользуются.
Тонкий catalog содержит карточки/пинованные metadata URI/bytes/SHA; детали
лениво читают проверенный статический JSON с существующими loading/retry states.
Копировщик ресурсов различает JSON книг и providers по typed discriminator,
не расширяет URI allowlist произвольно. Порог JS не повышается.

## Risks / Trade-offs

- [Книжка понята неверно] → старый неопубликованный pilot/player/host change
  удалён; прямое уточнение владельца сохраняется в feature doc и #2808.
- [Текст+14точек не помещаются] → короткое связное изложение без новых фактов,
  явный overflow gate и визуальная проверка actual PDF до серии.
- [Маршрут/сезонность/возраст] → теги сохраняются per quest, optional не становится
  обязательным, геометрическая линия не обещает доступ по дорогам.
- [Map tiles пропали] → fail closed, без SVG fallback под видом настоящей карты.
- [Смешение изданий] → kind/series/volume/revision и полное SHA-сопоставление.

## Migration Plan

Независимые блоки source→render sample→publication/catalog→QA. Коммиты явными
путями после review/gate, push main, production deploy и точечная приёмка.
Откат runtime — прежний указатель каталога/manifest; immutable файлы сохраняются.
Старые PDF и country place sources остаются байт-в-байт.

Validation: source ledger/URI/SHA/point parity; композиция/parity/overflow/QR,
actual PDF boxes/fonts/text/ppi и PNG inspection; targeted old manifest/preview/
download/imposition tests, typecheck/lint/guards/i18n. После independent review
и code gate — build/deploy по operation gate, mobile390/320→desktop1440,
консоль/сеть/точные скачивания. Native без изменённой границы не дублируется.

## Open Questions

Владелец01.11.2026 ответил: «Общая карта страны со всеми квестами».
Реализация показывает все квесты текущего тома; ключ ответов не добавляется.
Точная цитата/дата и предшествующий рабочий выбор сохранены в `ending.json`.
Дополнительного approval gate нет.
