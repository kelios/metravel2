## 1. Gate и бэкенд

- [x] 1.1 Gate §3.4.1: оценка объёма и стоимости (design.md); владелец 03.11.2026 подтвердил S3 и существующий медиа-ключ.
- [ ] 1.2 `area=back` карточка: nginx `location ^~ /travel-books/` (локальный файл → прокси S3, manifest no-cache, immutable, GET/HEAD, без спула на диск, 403/404 → 404, `limit_req`); связать с #2957.

## 2. Код фронта

- [x] 2.1 `scripts/books/storage.cjs`: ключ по пути URL, MIME, SigV4 PUT с `x-amz-checksum-sha256` и `If-None-Match: *`, HEAD-проверка с кэшем подтверждений, запрет перезаписи; CLI `verify|upload [--manifest <file>] [--source <dir>]` и `prune [--keep-manifest <file>] [--apply]` (ListObjectsV2 + DELETE, только `travel-books/`, живой manifest всегда сохраняется).
- [x] 2.2 Шаг публикации `storage.cjs upload --manifest` после `publish.mjs` (сам `publish.mjs` не меняется — `publisherHash`).
- [x] 2.3 `copy-publication.cjs`: без копирования файлов, проверка хранилища для файлов текущего manifest, гейт «в `travel-books` только `manifest.json`».
- [x] 2.4 `web-ssr-publication.sh` без `--link-dest`-заливки книг; `web-ssr-release-audit.sh books`: отказ при файлах кроме manifest и чистка store всегда.
- [x] 2.5 Тесты: `books-publication-copy`, `web-ssr-release-audit`, `web-ssr-publication`, новый `books-storage` (подпись, ключи, запрет перезаписи, гейт, чистка).
- [x] 2.6 Документы: «Хранилище файлов» и «Откат публикации» в `docs/features/travel-memory-books.md`; бюджет в `docs/ops/prod-disk-growth.md`.
- [ ] 2.7 Независимое ревью (review-auditor → code-review-gate), коммит явными путями.

## 3. Перенос и переключение

- [ ] 3.1 Загрузить файлы текущего manifest из кэша (`storage.cjs upload`); `verify` = 100 %.
- [ ] 3.2 После выката бэк-карточки: файл, которого нет на диске, отдаётся через `https://metravel.by` из S3 с верным SHA.
- [ ] 3.3 Выкат фронта без файлов книг; все URL текущего manifest через сайт — 200, размер и SHA тела; затем `prune` (отчёт) и `prune --apply` владельцем.
- [ ] 3.4 После выхода старых релизов из ретеншена: store пуст, `df -P /` до/после в `docs/ops/prod-disk-growth.md`; публикация `0baed26…` не растит диск.
