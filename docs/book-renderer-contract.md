# Pinned book renderer: F1 → B3

Приватный worker-контракт #2354 в составе #2352. Требования — в
`openspec/changes/scalable-travel-book-export/`. Этот артефакт не включает
server PDF capability и не подтверждает готовность B2/B3.

## Build / invocation

`node scripts/build-book-renderer.js --out .codex-temp/book-renderer/1.0.0`
собирает замкнутый Node-граф. Нужен уже проверенный font bundle
`.codex-temp/book-renderer-fonts`; подготовка и сетевые операции проходят
operation gate. Артефакт содержит frozen Yarn lock, точные версии зависимостей,
хэши шрифтов, `renderer-runtime.json` и `renderer-manifest.json` с хэшами файлов
и общим `content_hash`. B3 проверяет эти данные до запуска и устанавливает
зависимости по frozen lock.

Frozen WOFF2 faces декларируют покрытие характерных букв RU/BE/UK/PL/EN. Их
`unicode-range` не включает CJK/emoji (`界😀`): эти glyphs используют системный
fallback, который не входит в artifact hash. B3 фиксирует runtime image,
fontconfig и fallback fonts и проверяет видимые glyphs и извлечение текста из
PDF для пяти локалей и `界😀`. Unicode corpus F1 проверяет сохранность текста и
геометрию; он не доказывает одинаковые pixels системных glyphs.

```sh
node <artifact>/workers/book-renderer/index.js <private-job-dir> <new-output-dir>
```

CLI и `runWorker` — диагностический полный проход для fixtures, а не одна
B2 portion. Нельзя оборачивать всю книгу одним `cpu_seconds`/`portion_seconds`
budget или выдавать этот CLI за durable queue adapter.

Вход: `document.json` (`BookDocument` v1, B1 contract v2), упорядоченный
`manifest.ndjson` (`BookSnapshotChunk`) и приватные исходные файлы.
Поддерживаются B1 refs `<snapshot_uuid>/<checksum>` и durable B2 refs
`<job_uuid>/attempt-<epoch>/<checksum>`. Для text доступны `canonical_key` и
`field_end`; offset и длина проверяются в Unicode-символах. ACL, entitlement и
immutable materialization обеспечивает B1/B2. Chromium получает приватные
checksum-addressed assets и frozen fonts; credentials и live assets не нужны.

Node API: `runWorker(jobDir, outDir, {read_bytes?, fonts_dir?, resource_profile?})`.
`resource_profile` задаёт renderer-часть утверждённого B2 budget. Опциональный
`measure` используется только Jest protocol tests и выдаёт `measured: false`.

Для интеграции экспортируется `renderPreparedPage(jobRoot, planRoot, portionOut,
pinnedDocument, request, options)`: ровно один подготовленный page source до
512 KiB, проверенный `source_checksum`, independently committed
`expected.blocks`/`expected.occurrences` и fixed `page_context`.
`planRoot` содержит source JSON и `assets/<checksum>.json`; `jobRoot` — frozen
private source bytes. Новая output directory получает `page.html` и immutable
`receipt.json`; receipt фиксирует checksum источника и HTML, document/settings/
renderer identity, physical measurement и применённый resource profile.
Все source refs относительны приватному root; symlink refs запрещены.

Также экспортируются pull-driven `iterateSnapshotChunks`, `iterateTextFieldRefs`,
`streamSnapshotChunk`, `incrementalContent`, `subdivideSource`,
`CanonicalPageRenderer` и `renderSegment`. B3 владеет committed planning cursor,
parser continuation/checkpoint adapter, epoch/lease/cancel fencing, supervisor и
publication. После каждого подготовленного/rendered portion B3 проверяет свой
cgroup budget и только затем публикует checkpoint/receipt; restart не должен
выдавать неподтверждённые промежуточные файлы за готовые страницы.

## Outputs / certificate

`plan.ndjson` сохраняет порядок `pages/<order>.html`, checksum, тип,
`start_page`, `folio_area_mm: 12`, `measured_pages`, block/occurrence keys.
Физический segment успешен только при одной PDF-странице без overflow.
Измерение проверяет также text ranges внутри произвольных контейнеров и их
clipping ancestors, поэтому наличие caption в HTML не доказывает её видимость.
Worker captions растут по содержимому вместо canonical legacy crop; collage
также сохраняет включённые подписи. Если подпись не помещается рядом с
единственным фото, `caption_policy: detached` оставляет image placement ровно
один раз, а следующие `gallery-caption` portions сохраняют полный текст и
source photo ordinal без повтора изображения. Их подписи также дробятся и
измеряются. Вызовы shared gallery renderer без worker context сохраняют прежнее
поведение.
`sources-plan.ndjson` отдельно сохраняет порядок B1-источников. `body.ndjson`,
`sources/`, chapter/atlas indexes и coverage ledgers — приватные промежуточные
данные. TOC измеряется до вычисления итоговых offsets.

`certificate.json` фиксирует renderer/snapshot/settings hashes и равенство
`expected`/`completed` по travels, blocks, media occurrences и physical pages.
`source_count` включает все source records. `source_media_coverage` независимо
сверяет включённые исходные placements: gallery/map settings исключают
соответствующее media, повторные placements одних bytes сохраняют разные keys.
Производные cover/TOC placements входят в plan coverage отдельно.
`resource_profile` отражает применённые renderer limits. `peak_heap_bytes` —
выборка Node heap; это не process-tree RSS и не capacity certificate.

Текущие defaults: encoded resource 8 MiB / decoded 24 million pixels;
portion 24 MiB / 72 million pixels / 64 distinct resources; DOM 10000 nodes;
HTML 512 KiB; segment PDF 4 MiB. Профиль может задавать byte/pixel/DOM limits.
Это ограничения ресурса и portion, а не полной selection. Переполненная
страница дробится; недоступный asset или неделимый layout приводит к failure.
Defaults не означают утверждённый B2 budget.

## Physical acceptance (только testing)

До запуска: независимое review, коммит полного diff, переход в `testing`,
точный reviewed SHA и artifact content hash. Нужны штатный Node и установленный
pinned Playwright Chromium. Runner не устанавливает браузер, не вызывает API,
не меняет backend и не создаёт production jobs. Данные остаются в ignored
`.codex-temp/tests/`. Проверяются HEAD, чистота runner/fixture/DTO inputs,
artifact hashes и отсутствие symlink escape.

```sh
METRAVEL_STAGE=testing node scripts/pdf-book-worker-acceptance.cjs \
  --reviewed-sha <40-character-reviewed-HEAD> \
  --artifact .codex-temp/book-renderer/1.0.0 \
  --artifact-hash <renderer-manifest-content_hash> --suite golden

METRAVEL_STAGE=testing node scripts/pdf-book-worker-acceptance.cjs \
  --reviewed-sha <40-character-reviewed-HEAD> \
  --artifact .codex-temp/book-renderer/1.0.0 \
  --artifact-hash <renderer-manifest-content_hash> --suite stress \
  --profile .codex-temp/2352/approved-b2-profile.json

METRAVEL_STAGE=testing node scripts/pdf-book-worker-acceptance.cjs \
  --reviewed-sha <40-character-reviewed-HEAD> \
  --artifact .codex-temp/book-renderer/1.0.0 \
  --artifact-hash <renderer-manifest-content_hash> --suite stress \
  --case huge-chapter --read-bytes 17,257,65536 \
  --profile .codex-temp/2352/approved-b2-profile.json
```

Последний проход повторить с `--case repeated-inline`. Default read size 65536;
`--suite all` объединяет corpus. Проходы последовательны. Ошибка возвращает
nonzero exit; source/output/report сохраняются для разбора.

`--profile` принимает приватный JSON B2 v1 до 16 KiB с `version`, `id`,
`approved_by`, `isolation`, `concurrency: 1` и всеми положительными numeric
LIMITS из `book_exports/resources.py`. Renderer slice берётся из тех же полей
`encoded_resource_bytes`, `encoded_portion_bytes`, `decoded_resource_pixels`,
`decoded_portion_pixels`, `dom_nodes`, передаётся worker-у и сверяется с
certificate. Измеренные full-run RSS и disk проверяются против `rss_bytes` и
`temp_disk_bytes`; превышение или ошибка monitor прекращает проход fail-closed.
`cpu_seconds` и `portion_seconds` относятся к отдельной portion: они не
сравниваются с CPU/time всей книги. Per-portion CPU/time, cgroup/CPU quota,
app health/RSS/CPU, disk reserve, manifest/text/page budgets и общая concurrency
остаются явно `unenforced_profile_gates` для authoritative B2/B3 monitor.

Отдельная диагностическая форма требует `profile_kind: diagnostic-run`,
`profile_version: 1`, `concurrency: 1`, `renderer_resources` и положительные
whole-run `process_tree_peak_rss_bytes`, `browser_tree_peak_rss_bytes`,
`cpu_seconds`, `wall_ms`, `temp_disk_peak_bytes`. Она не заменяет B2 profile.
Один SHA файла профиля применяется ко всем нагрузкам (`profile_file_hash`);
это хэш исходных bytes, а не Python B2 canonical `profile_hash`. Без профиля
результат явно `NO_PROFILE`; `capacity_verdict` всегда `NOT_EVALUATED`.

Входы строятся существующим Jest B1-shaped fixture helper; компилируются только
он и два pure DTO-модуля. Worker загружается из pinned artifact без fake measure.
Corpus: 20 тем, RU/BE/UK/PL/EN, gallery layouts/auto sizing, settings inclusion,
повторные placements одного ресурса, 201/1000/5000 gallery photos, 51 глава в
manual order, >500k characters в огромных paragraph/table, длинный numbered list,
37 routes в главе, multiline captions и допустимые 500 Unicode-character
polaroid/collage captions с pinned 4-column layout.

Проверяются source/chapter order, streaming text hashes, доставка текста в
сохранённый HTML, реальные image placements, полный caption text по независимым
B1 source records (inline и detached portions), photo ordinals, theme styles,
локализованные видимые source totals, inclusion-aware media и certificate.
Разные read sizes должны дать одинаковые ordered page hashes/counts. Corpus
дополняет shared web/native canonical golden Jest; не заменяет малую печать
или визуальную приёмку.

`report.json`: SHA/artifact/profile-file hashes, settings/locale/snapshot, counts,
unique resources, page digest, wall time, sampled worker/browser process-tree
RSS/CPU, input+output logical disk bytes. Выборка раз в секунду может пропустить
короткоживущие процессы: RSS/CPU — нижние оценки. Проверка профиля ограничена
доступными выборками; authoritative B2 monitor и app-health evidence обязательны.

## B2/B3 acceptance handoff

B2 фиксирует process-tree RSS, CPU, temp-disk, concurrency и application-health
budgets **до** запуска 1000/5000. Одинаковые пороги применяются к обеим
нагрузкам. Fixture PASS и sampled limits не подтверждают capacity readiness.

B3 физически рендерит ordered HTML/asset/font refs на диск с освобождением
каждого segment, затем создаёт один PDF измеренным file-backed composer.
Итоговые pages/blocks/placements сверяются с F1 certificate; после merge
проверяются settings/order, TOC и first/middle/last chapter destinations,
bookmarks/page labels и reserved folios. Missing media означает failure/retry.
Текст и captions проверяются также в физическом/merged PDF; HTML hash не
заменяет visible-text evidence. В testing нужны multiline/oversized polaroid
captions и source title, длинный URL, таблица и список у границ страницы.
Merged PDF correctness, composer RSS, restart/retry/cancel, download ACL и
реальная selection владельца 2012–2013 остаются gates B3/F3. Fixture PASS F1
не включает v2 availability и не закрывает эти gates.

## Prepared source schema 2: complete map fields

The B1 `BookDocument`/manifest/settings schemas and `renderer_version` remain
unchanged (`metravel-book-renderer/1.0.0`). This additive **private prepared
source** contract is version 2, exported as `BOOK_SEGMENT_SOURCE_SCHEMA_VERSION`
and pinned in `renderer-runtime.json`/manifest as
`prepared_source_schema_version: 2`. B3 must pin the new exact artifact
content/source hash and this schema; the previous `026e6f34…` artifact cannot
consume `map-text` sources. The full-run certificate records the schema, and a
prepared-page receipt records the actual source schema.

Every new prepared source envelope has `source_schema_version: 2`. Unsupported
versions/page types fail closed before rendering. For compatibility, absent
version or explicit 1 accepts only the original page types; `map-text` and new
map context fields require version 2. A legacy map must be explicitly upgraded
before subdivision because its global position and coordinate policy cannot be
inferred from a single portion.

A map source has `point_start` (zero-based global source offset),
`show_coordinates` (pinned settings policy), and optional `text_policy`
(`inline` by default, or `detached`). The worker-only map context prints the
complete raw address, category labels and enabled coordinates, preserving
commas, whitespace, Unicode and unbroken words. Cards grow naturally, a single
card uses the available width, and each frozen thumbnail has a bounded frame.
Card and SVG numbers preserve the global point ordinal through row splitting.
Calls to the shared renderer without this context retain the legacy markup.

A physically rejected single card detaches its source text. Its map/card/image
placement is emitted once, followed by bounded `map-text` pages:
`{type:'map-text', travel, point_id, point_ordinal, field, html}` where `field`
is `address`, `category` or `coord`. Escaped HTML fragments preserve the entire
field and may be subdivided again without repeating the image. Hidden
coordinates produce no continuation. Disabled map/coordinate settings reject
incompatible prepared sources rather than dropping their receipts.

Planning rejects overflowing geometry before PDF allocation; every geometrically
fitting candidate must then prove one actual Chromium PDF page and the unchanged
4 MiB PDF portion budget. Aggregate PDF/DOM/page-image/HTML budget
failures trigger subdivision. Individual resource limits, corrupted bytes,
font failures and mutable resource requests remain fatal. Failed PDF portions
release the working page before retry. Schema 1/2 serve original encodings. The
schema-3 successor below adds fixed print-local derivatives while preserving
original immutable bytes and placement identities.

The acceptance runner independently derives expected route IDs, global
ordinals, raw addresses, ordered category labels and enabled coordinates from
the input manifest. It reconciles these against saved HTML source field markers
across inline and detached pages, requires each point card once, compares its
actual thumbnail checksum to the original route media and checks occurrence
receipts in source point order. The physical corpus adds
long Unicode/unbroken fields, addresses with more than three comma-separated
segments, coordinate policies and repeated frozen thumbnail bytes. Protocol
unit measurements prove source ordering/failure handling only; root-owned
physical acceptance must prove geometry, per-page PDF budgets and independently
extracted real Luxembourg PDF text before any completion claim.

## Prepared source schema 3: bounded print assets

Schema 3 supersedes the schema-2 artifact for newly prepared pages. B1 document,
settings, original media checksums, occurrence keys and `renderer_version` remain
unchanged. Sources 1/2 retain original `/assets/<originalSHA>` serving. A schema-3
source requires all four private fields: `resource_bindings`,
`resource_bindings_hash`, `resource_policy_hash`, `encoder_identity_hash`.
Unsupported/mixed schemas, invalid numerical fields and mismatched pins fail
before printing. The artifact manifest/runtime declare the canonical
`PRINT_ASSET_RECIPE`, its policy hash and Chromium vendor pin. B3 must accept the
new exact artifact content/source hash and schema 3 before using these sources.

The fixed recipe keeps the entire frame and aspect ratio (integer pixel rounding),
never crops or upscales, and caps the longest edge at 2400 and output at 5.76M
pixels. Opaque images use JPEG quality 0.92. Actual source/output transparency
uses PNG, without flattening on white. A bounded native-resolution alpha scan
uses one canvas at most 2400×16, exact source-coordinate tiles, `clearRect` before
each tile, and tile-only `getImageData`; downsampled pixels alone cannot prove
opacity. Suitable JPEGs pass through unchanged when their original encoded bytes
are at most 2MiB and their EXIF-oriented longest edge is at most 2400. JPEG,
PNG and WebP have bounded header dimension checks; active/vector/other containers
and animated sources fail with typed unsupported errors before decoding. There
is no adaptive quality reduction or codec retry to evade the 4MiB PDF guard.
An indivisible noisy/transparent asset can honestly remain unprintable under the
fixed resource profile; the runner must report that failure.

Encoding runs in a separate worker Chromium context/page, never from inside the
print-page request handler. The decoder image uses anonymous CORS and the private
route supplies ACAO; mutable requests are rejected. Chromium launches with the
explicit public `chromium.executablePath()` path. The actual encoder identity
contains browser name, locked Playwright version, Chromium revision/version,
streamed executable SHA, platform and architecture, verified against hashed
artifact runtime metadata. Cache identity includes original SHA, canonical recipe
hash and actual encoder identity hash. Cache descriptors bind original file/hash,
raw and oriented dimensions, source/output alpha, recipe and served bytes. Cache
reuse rechecks the immutable original, descriptor digest, derived digest/MIME/
dimensions/policy; missing, corrupt, substituted or symlinked cache files fail.
JPEG orientation follows its bounded EXIF header. For PNG/WebP whose header probe
does not expose orientation, the pinned decoder provides a witness constrained
to the exact raw or swapped dimensions, preserving the same pixel count. The
preallocation ledger charges the larger possible tile/scratch orientation.
Descriptors bind this witness to original SHA, recipe and encoder identity;
cache reuse rejects arbitrary dimensions. The independent verifier applies the
same two-orientation domain and real EXIF6 fixtures additionally require their
known oriented dimensions. Cover brightness/composition uses the same static
raster/animation guard before decoding and releases its working page afterward.

Printing uses `/print-assets/<originalSHA>/<servedSHA>`. The derived disk path is
`print-assets/<servedSHA>` under the private plan root. Origin-qualified URLs keep
lineage distinct when two original encodings produce identical derived bytes.
Only image resource attributes and CSS `url()` are rewritten; editorial text,
hyperlinks and proof attributes remain intact. Selection and media occurrence
ledgers retain original identities and ordering. Source3 rendering verifies the
exact active binding set against actual responses before persistence/receipt.

`physicalMeasurer(...).prepareHtml(html, pinnedSource?)` prepares or verifies one
bounded resource set. `prepareSegmentSource(source,pinned,pageContext,physical)`
returns a schema-3 envelope that B3 commits/checksums before rendering. A legacy
map requires explicit ordinal/coordinate-policy upgrade first. `planBody` also
materializes bindings before fit measurement and source persistence. Subdivision
clears parent bindings and returns schema-2 children: B3 must rematerialize each
child, including no-image caption/map-text continuations, before committing it.
`renderPreparedPage` requires the three binding/policy/encoder digests in its
request and records them, the actual encoder identity and actual
`served_resources:[{original_checksum,served_checksum}]` in the receipt. Injected
measurement cannot certify a schema-3 prepared page.

The conservative compressed working ledger per binding charges
`2×original bytes + 2×served bytes + 4×(original base64 bytes + derived base64 bytes)`
for retained buffers, Blob and UTF-16/protocol transfer copies. The pixel ledger
charges original decode, alpha tile canvas and tile scratch, target canvas,
encoder RGBA bound, served decode and output alpha scratch. These bounds are
checked before decode/canvas allocation and for the full portion; encoded output
is bounded before base64 transfer. Derived files/descriptors remain private disk
artifacts counted by the runtime temp-disk monitor. The bounded file reader
allocates to pinned file size and rejects concurrent size changes. These are
conservative logical bounds, not a proof of total Chromium/process RSS or B2's
256MiB capacity gate.

The independent acceptance verifier checks original source bytes, persisted
source checksum, descriptor/derived bytes, MIME/dimensions/full-frame recipe,
actual URL response lineage and original occurrence ordering. Physical fixtures
include fully opaque RGBA and a single transparent pixel after the first native
tile, plus real EXIF6 PNG and WebP fixtures with known swapped dimensions.
Actual Luxembourg media/text acceptance and all 20 themes with its real
2500×1875 WebP remain required after review: grayscale/sepia filters can alter PDF
embedding even after JPEG encoding. The unchanged actual one-page/4MiB PDF guard,
vector text and theme appearance must all pass; synthetic codec mocks establish
protocol failure behavior only.
