## 1. Уточнённые источники и состав

- [x] 1.1 Сохранить прямое уточнение владельца, отменить ошибочный pilot/player-host scope и проверить полный каталог BY/PL.
- [x] 1.2 Предложить41/37квестов для первых частей,41/36для вторых; получить78bundle/cover и проверить668точек/реальные байты без ответов/PII в новом источнике.
- [x] 1.3 Реализовать воспроизводимый source compiler/schema/ledger и краткие сюжеты по исходным intro; проверить полное покрытие/отсутствие дублей и byte/SHA/URI/point parity.

## 2. Четырёхстраничные блоки и PDF

- [x] 2.1 Реализовать отдельную quest-композицию поверх общих физических профилей/шрифтов/page shell, начало блока с левого folio и чистые photo/notes.
- [x] 2.2 Получить настоящие карты через существующий mapSnapshot/own proxy с fail-closed tile coverage, numbered markers и обязательной атрибуцией.
- [x] 2.3 Собрать и визуально проверить реальный A5образец четырёх страниц, все QR и longest14point/longtext case; отдельно проверить compact, без обрезки.
- [x] 2.4 Сохранить owner decision01.11.2026 «Общая карта страны со всеми квестами»; собрать первые томаBY/PL с этим end matter, отдельными обложками и физическими пакетами/preview той же ревизии.

## 3. Каталог и публикация

- [x] 3.1 Добавить kind/series/volume с совместимостью прежних place-books; typed JSON resources и thin catalogue/SHA-verified lazy metadata без поднятия JSbudget.
- [x] 3.2 Подключить новые тома к существующим viewer/download/print flows и RU/BE/UK/PL/EN; старые URL/схемы/place sources сохранить.
- [x] 3.3 Проверить реальные PDF boxes/fonts/text/QR/ppi, локальные immutable ресурсы и старые manifest/preview/download/imposition regressions.

## 4. Review и приёмка

- [ ] 4.1 Выполнить targeted static/unit/guards/i18n, независимый review-and-fix и code-review-gate по всему task diff; повторить после fixes.
- [ ] 4.2 Коммит явными путями, pushmain, testing, штатный production deploy; сверить sourceSHA/artifactSHA/metadata revision.
- [ ] 4.3 Принять mobile390/320→desktop1440, guest catalogue/preview/download обоих томов, console/network и PLflow; сохранить ограничения физической/типографской приёмки, закрыть только фактически пройденный Donegate.

## Progress evidence — 01.11.2026

Исходники78/668 проверены локальным compiler, все overviews и три compact
варианта сохранены. Состав BY41/PL37 даёт174/156внутренних страниц с общей
картой (прямой ответ владельца сохранён в ending.json). Информационные полосы:
156/156layout checks; prefix/end-map/cover4/4. Четыре реальных standalone PDF
Мир/Hel-Jurata A5/compact: overflow/полный текст/шрифты/геометрияPASS,
8color/grayscale QR checksPASS, карта около150nativeppi — только проба.
После общей codefreeze локально собраны тома174/156внутренних страниц в
двух размерах:48PDF,26основных artifact reports и312цветных/серых QR проверок
PASS по точным итоговым файлам. Все156реальных карт связаны с1910nativeтайлами
(2150связей); подтверждённый cache-provenance дефект исправлен в общем adapter,
все156PNG/48PDF побайтно сохранены. Полный список входов закреплён в двух
`*-volume-1-provenance.json`, без приватных путей. Инспекция8итоговых raster
страниц не выявила обрезки;676WebPpreview получены из тех же readingPDF.
Локальный staging содержит730проверенных ресурсов. Nativeкарты≈150ppi и
обложкиA5≈206ppi: printReady=false, бумажная/типографская приёмки не выполнены.
После graphic-активации8 выполнена локальная активация8→10: все8rawbook
objects,1998прежних ресурсов и8related entries сохранены побайтно/семантически
соответственно. Итоговый snapshot46330b9545ed5326d7f277d27dc659d01efc47e4b26b738b225c4ee040a537b0
точно совпадает с рассмотренным кандидатом. Canonical artifact CLI принял
все2728ресурсов, metadata/catalog/related содержат по10книг. Related index
выводится из полного результата. Исходные6книг/1498ресурсов и6добавленных
book.json сохраняются через оба шага активации; промежуточные snapshots оставлены.
Thin catalog11377B compact/1794B gzip; full manifest1043135B compact и
1039471B book.json загружаются отдельно. Client metadata graph не импортирует
полный manifest/schema/quest authoring; лимиты бюджета не менялись. Это
локальные data/module metrics, production bundle verdict остаётся этапу выпуска.
Общий final review/code gate, deploy и runtime/testing ещё не завершены.
Ни quality gate, ни app/browser/API runtime, ни deploy этим исполнителем
до review/testing не запускались. Raw evidence: `.codex-temp/books-quests/f1/`.
