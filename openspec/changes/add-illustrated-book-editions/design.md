## Context

`add-book-visual-styles` ввёл идентичность стиля и раздельные шрифты общего
рендера. `source-ready-book.mjs` проверяет selection, автора, точку, статью,
права и навигацию до выбора style branch. Его watercolor/photo ветки остаются
без изменений во время работы владельца E1.

## Decisions

Новый `loadIllustratedEdition` принимает уже выбранные `stops` и `sources`
из общего source loader и читатель `projectFile`, который сохраняет текущую
границу локальных файлов. Данные берутся из существующих tracked
`styles/<style>/inputs.json` и country evidence; отдельный registry с другим
составом не создаётся. Одни и те же проверки используются для graphic/fantasy.

Результат содержит assets, provenance, cover, fonts и revision seed в форме,
которую уже потребляет общий pipeline. Он не создаёт книгу, QR, страницы,
preview, imposition или публикацию. До освобождения E1 его вызывает только
изолированный authoring harness; shared wiring выполняется отдельным шагом.

Loader требует явного одобрения направления, точного покрытия выбранных
stop ID без дубликатов, той же опубликованной статьи автора1 и original URI,
прав, source/art SHA и нативных размеров, точного промпта, утверждённого
style SHA, визуальной проверки и полного статического TTF с OFL. Неизвестная
модель сохраняется как null, без предположений. Никаких fallback на акварель.

Точные промпты, source association, tool/model disclosure и результаты
проверки находятся в tracked evidence. Исторические ignored provenance/plan
сохраняются как audit references, но loader не читает их для сборки.
Локальные исходные фото и готовые artwork bytes — авторский кэш; исчезновение
нужных bytes даёт явную ошибку. Конечные PDF/preview идут существующим
неизменяемым publication pipeline, не ссылаются на временный provenance.

Файлы изображения могут быть перекодированы в JPEG без изменения размеров;
и нативный SHA/размер, и encoded SHA/размер сохраняются. Апскейл запрещён.
Стиль меняет artwork/type/copy, но не выбранный объект или sourced copy.

## Staging subsets without adopting unrelated schema normalization

The publisher validates the complete candidate catalog: the current immutable
editions plus replacements/additions in the incoming subset. This preserves the
canonical requirement that both watercolor countries remain present and checks
country/style/ID/slug collisions across the complete result. It emits the raw
staged subset, discarding parser normalization output. Activation merges raw
current book objects, so schema defaults from a different in-progress feature
cannot rewrite old objects or leak fields into new editions.

The existing activation adapter is exported without changing its algorithm.
It checks every staged byte before cache/pointer writes, preserves immutable
cache leaves and writes the release snapshot and related/manifest pointers.
No new uploader or weaker staging schema is introduced. Code and rendering for
the final candidate must use clean main plus this task's explicit paths;
unrelated dirty F1 map/schema/catalog files are excluded.

Rejected approaches: relaxing the watercolor-pair invariant, manually removing
one injected field after publication, or treating the unrelated F1 working
schema as the accepted API. They would leave other subset/default cases broken.

## Risks / Rollback

Главный известный предел — около180ppi на A5 у фэнтези; `printReady=false`
сохраняется. Статический Cormorant требует собственной проверки overflow и
встраивания в итоговый PDF. Графический образец ещё не одобрен.
Откат новых входов/helper не меняет watercolor/photo и их прежние URL.

## Validation

Focused tests: принятие корректного набора, отказ при другом авторе/статье,
подмене source/art bytes, стиле, промпте, cover, неполном составе или approval;
полное покрытие глифов и static TTF. Authoring: один графический A5 sample,
PDF boxes/fonts/overflow, QR color+grayscale. После shared wiring — текущие
composition/render/publication checks, полные локальные PDF/QR и независимое
ревью до production/browser acceptance.
