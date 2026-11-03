## ADDED Requirements

### Requirement: Book files live in object storage, not in the web release

Неизменяемые файлы изданий текущего manifest SHALL храниться в S3 под ключом
`travel-books/<книга>/<ревизия>/<файл>`, равным пути публичного URL. Релиз фронта
SHALL нести в `travel-books/` только указатель `manifest.json`.

#### Scenario: Build carries only the publication pointer
- **WHEN** собирается production-релиз фронта
- **THEN** каталог `travel-books` релиза содержит ровно `manifest.json`, а появление любого другого файла останавливает сборку

#### Scenario: Publishing books does not grow the server disk
- **WHEN** выпускается новая ревизия любого издания и затем выкатывается фронт
- **THEN** объём релиза на VPS не зависит от числа и размера файлов книг

### Requirement: Storage holds only the current editions

Хранилище SHALL содержать под `travel-books/` только файлы текущего manifest:
без прежних ревизий и рабочих материалов. Чистка SHALL сначала показывать отчёт
и удалять только по явному `--apply`, и SHALL NOT удалять файлы manifest, который
сайт отдаёт сейчас, manifest чекаута или явно указанного подготовленного manifest.

#### Scenario: Prune after a publication
- **WHEN** новая ревизия активирована и выкачена, затем запущен `prune --apply`
- **THEN** объекты прежней ревизии удалены, а каждый файл живого manifest по-прежнему отдаётся

#### Scenario: Live manifest unavailable
- **WHEN** живой `https://metravel.by/travel-books/manifest.json` не читается
- **THEN** чистка отказывает и ничего не удаляет

### Requirement: Public book URLs and checksums stay unchanged for current editions

Адрес `https://metravel.by/travel-books/<книга>/<ревизия>/<файл>` SHALL отвечать
200 (или 206 на Range) телом, чей размер и SHA-256 совпадают с manifest, для
каждого файла текущего manifest.

#### Scenario: Current edition after migration
- **WHEN** гость открывает URL файла текущей ревизии, которого нет в релизе
- **THEN** ответ 200 с тем же телом и `Cache-Control` неизменяемого ресурса, без редиректа на другой домен

#### Scenario: Missing object
- **WHEN** запрошен путь под `/travel-books/`, которого нет ни в релизе, ни в хранилище (в том числе ревизия, удалённая чисткой)
- **THEN** сайт отвечает 404, а не ошибкой хранилища

### Requirement: Storage is verified before activation and before deploy

Публикация SHALL загрузить и подтвердить в хранилище каждый файл новой ревизии
(размер и SHA-256 из manifest, проверенные S3) до активации manifest. Сборка SHALL
отказать, если хоть один файл текущего manifest не подтверждён в хранилище. Объект
SHALL NOT перезаписываться другим содержимым.

#### Scenario: Unconfirmed file blocks the build
- **WHEN** у файла текущего manifest в хранилище нет объекта или его checksum/размер другой
- **THEN** сборка останавливается с указанием пути, релиз не создаётся

#### Scenario: Re-upload of an existing revision
- **WHEN** загрузка встречает существующий объект того же пути с другим SHA
- **THEN** загрузка завершается ошибкой и объект не меняется

### Requirement: Rollback is a metadata switch plus re-upload

Откат публикации SHALL переключать `manifest.json` и производные метаданные на
предыдущий снимок и повторно загружать файлы откатанной ревизии из локального
кеша публикации; снимки `releases/**` не удаляются.

#### Scenario: Roll back after a prune
- **WHEN** manifest переключён на предыдущий снимок, а её файлов в хранилище уже нет
- **THEN** сборка фронта отказывает, пока `storage.cjs upload` не вернёт эти файлы из кеша; после загрузки и выката они отдаются по прежним URL
