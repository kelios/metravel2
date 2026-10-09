## 1. B1 #2353 — Backend contract, полный выбор и snapshot

- [ ] 1.1 Backend owner согласует additive v2 existing books API: capabilities, full versioned settings, paged ordered selection/filter 2012–2013, immutable finalize/hash/revisions; old HTML потребитель сохранён. Requirement: Complete selection and immutable source.
- [ ] 1.2 Реализовать owner ACL, consistent revision finalize, server entitlement, no total/per-travel photo/travel/text/point cap; request/page budgets регулируют передачу, а не selection size. Requirement: No logical content count caps.
- [ ] 1.3 Зафиксировать immutable media bytes/generation/content hash либо private materialization; distinguish selection-finalized от asynchronous full-snapshot-frozen. Проверить replacement after freeze/retry, access revoke и bounded reading oversized source fields.
- [ ] 1.4 Contract tests: first catalog page20 → all matching >50; 201/1000+ occurrences; empty selection, unauthorized IDs, changed revisions, duplicate append/idempotency, full options/5 locales; snapshot counts совпадают с источниками.

## 2. F1 #2354 — Canonical document/plan и renderer artifact

- [ ] 2.1 Вынести full DTO из UI types с compatibility exports; определить versioned paged BookDocument/BookPlan/asset-occurrence schemas, frozen seed, inclusion-aware expected coverage. B1 согласует schema; не создавать второй Python template stack.
- [ ] 2.2 Адаптировать текущие transformer/themes/rich-text/gallery/map/QR renderers под bounded segment generation и pinned worker artifact, Node HTML-tree adapter через существующий parse5 подход; shared bundles без worker imports/DOM globals.
- [ ] 2.3 Сделать продолжения gallery auto и huge rich-text главы по измеренным физическим страницам; сохранить заголовки/таблицы/ссылки/aspect/caption, reserved folio geometry; не считать длинное content ровно одной страницей.
- [ ] 2.4 Bounded ingestion до whole-field ContentParser: incremental tokenize/sanitize, huge single paragraph/table, paged atlas/all-points и disk-backed metadata aggregates; зафиксировать parity/stress evidence по каждому примеру.
- [ ] 2.5 Unit/golden parity web/native для тем/settings; repeated resource используется в нескольких occurrences; разные chunk sizes дают эквивалентную coverage/order; одна huge chapter остаётся bounded. Requirements: Faithful settings and pagination; Verifiable completeness.

Подготовка F1 в рамках родителя #2352 (2026-10-09): настройки и их полные
DTO/defaults вынесены в независимый от UI модуль с compatibility exports;
существующая parse5-реализация выделена из native adapter для повторного
использования. Это сохраняет малую печать и не закрывает пункты 2.1–2.5:
порционный document/plan, incremental ingestion и физическая пагинация ещё
требуют принятого B1 и интеграции worker. Неиспользуемый snapshot reader не
включается в production-код до появления реального потребителя B2/B3.

## 3. B2 #2355 — Durable jobs, storage и capacity readiness

- [ ] 3.1 Backend owner заменяет daemon thread durable queue с leases/heartbeat/idempotent claim, persisted checkpoints, retry_wait/cancel/expiry, owner job list и counters; full artifacts вне TextField. Requirement: Recoverable background lifecycle.
- [ ] 3.2 Private snapshot/segment/artifact storage, cleanup/purge и permissions при status/download/ticket; повторная проверка access revoke/delete; secret-safe metrics и bounded asset gateway.
- [ ] 3.3 Измерить текущую app+worker capacity (история VPS1CPU/1.8GB), зафиксировать конкретные process-tree RSS/CPU/temp-disk/concurrency budgets и app health acceptance thresholds; PDF capability объявляется только после capacity pass B2 И сертификации полного результата B3. Недостаточная мощность → backend/ops решение об isolated runtime с отдельным authorization, не новый count cap.
- [ ] 3.4 Source/contract tests: crash/restart/lease expiry/duplicate claims, cancel race, snapshot pin, cleanup, unauthorized download, expired snapshot rebuild; readiness report с объявленными числами. Requirement: Private bounded execution and delivery.

## 4. B3 #2356 — Segment PDF, финализация и full-result certificate

- [ ] 4.1 Backend owner интегрирует F1 renderer artifact с isolated Chromium, bounded image/font readiness, SSRF/redirect/IP controls, decode/byte/pixel budgets; render→disk→release и adaptive subdivision включая отдельную огромную главу.
- [ ] 4.2 Spike реального file-based composer на 1000/5000-photo нагрузках; проверить peak-RSS каждого этапа и отсутствие full-book JS buffer; выбрать composer по budget, не библиотечному названию.
- [ ] 4.3 Physical body/atlas measurement → frontmatter/TOC/offsets → reserved global folio → rebind links/bookmarks/page labels; stability recheck после merge. Один итоговый PDF, не ZIP/обязательные тома.
- [ ] 4.4 Сертифицировать integrity, actual pages, planned/rendered content blocks и occurrences, order/settings hashes; missing media даёт failure/retry без blank-success. Requirements: One PDF; Verifiable completeness.
- [ ] 4.5 В rendering stress включить oversized single source field/paragraph/table и many-points atlas, replacement frozen media after worker restart; все ingestion/render/aggregate/merge stages соблюдают B2 budget.
- [ ] 4.6 Review code/tests/config; в testing реальные authorized API/PDF/load probes на deployed SHA, 201/1000/5000 фото, one huge chapter, same resource repeated, slow/broken media, restart/cancel/expiry; обеспечить одинаковый B2 budget без content omission.

## 5. F2 #2357 — Complete selection, resumable desktop UX и download

- [ ] 5.1 `/export`: all matching против loaded, owner year range2012–2013, paged manual ordered selection, full settings DTO и snapshot count confirmation; reuse existing controls по design.md, координация с #2229.
- [ ] 5.2 API/hook lifecycle использует capabilities + idempotency и owner job refs/list; реальные stages/counters, reconnect/reload/cancel/retry/expired; timeout polling не создаёт второй job и не запускает large client fallback.
- [ ] 5.3 File export не резервирует print popup; private scoped download ticket→browser direct file saving без entire Blob; проверенные externalLinks helpers. Оставить small printSession path доступным.
- [ ] 5.4 i18n RU/BE/UK/PL/EN, accessible live status/keyboard/focus, counters/date/size formatting без client translation editorial text; `npm run test:i18n`, API/hooks/state tests.
- [ ] 5.5 Done только с B3 реальным PDF; common UI desktop/mobile evidence после review; mobile catalog availability и small single-export control сохранены. Requirement: Preserve existing surfaces and localized feedback.

## 6. F3 #2358 — Safe routing вместо count gates и complete-source guarantees

- [ ] 6.1 После B3+F2 удалить legacy count rejection, сохранив semantic/auth validation; resource eligibility отправляет полный выбор server job. Unsupported/capacity/permission/expired/error не маскируются giant local generation.
- [ ] 6.2 Ограничить новое unlimited routing desktop v2; legacy native eligibility и small-print resource safeguards сохранить отдельно от canonical content validity, без случайного huge native base64 export.
- [ ] 6.3 Detail fetch signal/revision-aware cache и completeness contract; исчерпанные retries не возвращают partial list card как полный source; обновить тест, закрепляющий прежний partial success. Inline text/gallery/POI placements учитываются по enabled sections.
- [ ] 6.4 До/во время review targeted static/unit/guards, web/native golden и print tests, подходящие lint/typecheck и i18n; полный task diff — review-auditor, затем code-review-gate. Browser/API/device runtime только в testing.

## 7. Testing — приёмка книги владельца и соседних потребителей

- [ ] 7.1 В разрешённом testing проходе снять exact ordered owner selection2012–2013 + snapshot/settings hash и expected block/media occurrence counts; private fixture хранить только в approved ignored evidence. Выполнить реальный экспорт и проверить PDF, а не только HTML/202.
- [ ] 7.2 Проверить complete coverage, first/middle/last chapter, TOC destinations/folios, captions/aspect, темы и полный текст; compare different internal chunk sizes. Получить screenshots/console/network и actual saved PDF aggregate evidence.
- [ ] 7.3 Старые границы >30/>200/>50, >50k/>500k, >200 route points; нагрузки1000/5000; worker restart, >120s job, offline/reload, popup block, cancel races, broken asset, unauthorized/expired download. Числа — тестовые нагрузки, не новые пользовательские лимиты.
- [ ] 7.4 Записать process-tree RSS, browser memory, CPU/time, temp disk/artifact bytes, planned/rendered counts и deployed SHA; failure любого declared B2 budget/coverage — отказ приёмки. Не выдавать прежний two-travel benchmark за доказательство архива.
- [ ] 7.5 Регресс малых книг mobile web/native, print/cancel/golden/governance; runtime device/simulator только при реально изменённом native output/adapter по матрице design. Квест/GPX/KML и общая media ladder сохраняются.

## 8. Завершение planning и future change

Родительская feature: [#2352](https://metravel.by/board?sprint=27#task-2352). B1 [#2353](https://metravel.by/board?sprint=27#task-2353) стартует; F1 [#2354](https://metravel.by/board?sprint=27#task-2354) и B2 [#2355](https://metravel.by/board?sprint=27#task-2355) зависят от B1; B3 [#2356](https://metravel.by/board?sprint=27#task-2356) — от F1+B2; F2 [#2357](https://metravel.by/board?sprint=27#task-2357) — от B1+B2+F1, Done с B3; F3 [#2358](https://metravel.by/board?sprint=27#task-2358) — от B3+F2. Статусы и зависимости ведутся только на борде.

- [ ] 8.1 После отдельного запроса apply реализовать карточки по реальным dependencies; metadata/status/backlog остаются на MCP board, backend выполняет его владелец.
- [ ] 8.2 По завершении реализации синхронизировать living capability, выполнить strict change validation и `openspec validate --all` перед archive; обновить Problem Memory фактическим regression control. Planning не считается исправлением экспорта.
