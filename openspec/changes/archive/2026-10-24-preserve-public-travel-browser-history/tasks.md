## 1. Диагностика и реализация

- [x] 1.1 Проверить контракт #2703, историю семьи и независимый анализ вариантов до кода.
- [x] 1.2 Исправить pinned fullHistory params-dedup и выбрать fullHistory только на web.
- [x] 1.3 Добавить regression настоящего reducer и layout/platform boundary; подтвердить red/green и clean patch apply.
- [x] 1.4 Добавить real-card browser/CDP regression в стандартный production-smoke и запись семьи в Problem Memory.

## 2. Code review

- [x] 2.1 Выполнить узкие unit/static/guards и OpenSpec validation.
- [x] 2.2 Независимый review-auditor review-and-fix, затем отдельный code-review-gate pass по всему task diff.
- [x] 2.3 По разрешённому AGENTS.md пайплайну: commit явных task paths и push main, записать SHA и перевести #2703 в testing.
- [x] 2.4 После RAW03: закрепить actual memory/linking red regression потери state snapshots и исправить подтверждённый общий owner, сохранив первый TabRouter fix и native boundary. RED 7FAIL/6PASS → 13PASS; с прежним router/native suite 25PASS; lint/strict test TS/guards и clean pinned tarball apply/reverse/reapply PASS. Отдельная #2702 lag-гипотеза сохранена без изменения assertions в ignored evidence, её RED не входит в #2703 verdict.
- [x] 2.5 Actual-container и real LazyInstantSEO RED/GREEN corrections выполнены: source42PASS, scoped lint/strict TS/guards/audit/OpenSpec PASS; независимые review-auditor/code-review-gate PASS0, actual staged/prepush PASS без SKIPPED. Exact source `6b84b69156ec635be910eb4e48832c755b917aa8` коммитнут, запушен и штатно выкачен; final strict production5/local2 acceptance PASS. Исходные RAW04/RAW05 failures сохранены.

## 3. Testing

- [x] 3.1 Выполнить штатный production deploy через frontend-deployer и проверить exact SHA.
- [x] 3.2 Production06 desktop/mobile guest RU: strict5/5 PASS,31.705 с, workers1/retries0/skip0/flaky0, console/page/network/writes0. Полные A/B/C Back/Forward, mobile app Back B→Forward C, cross-tab/catalog/modifier controls, metadata/canonical и59 CDP checkpoints; четыре screenshots независимо просмотрены. Evidence: `.codex-temp/task-2703/acceptance-prod-06/results.json`, `acceptance-notes.md`.
- [x] 3.3 Local04 immutable6b84 existing card-link semantics2/2 PASS,76.697 с включая fresh standard build, workers1/retries0/skip0/flaky0; backend watchdog16 HTTP200/0fail. After-provenance6718/6718 exact Git blobs, missing0/mismatch0, шесть installed Expo/native hashes MATCH; два screenshots независимо просмотрены. Evidence: `.codex-temp/task-2703/acceptance-local-04/results.json`, `source-provenance-after.json`, `watchdog-summary.json`.
- [x] 3.4 Независимый Done gate PASS: production5/local2 и final after-provenance6718/6718/0mismatch приняты, полные receipts подготовлены для #2703. Observable spec3requirements/9scenarios синхронизирован и точно сверен; Собственная change/all-main strict, prompt audit/diff/source-input checks PASS; global71PASS/1known foreign missing-delta FAIL зафиксирован отдельно. Change архивирован в `2026-10-24-preserve-public-travel-browser-history`; app inputs и десять чужих Instagram paths сохранены.

## Repository validation limitation

Общая `openspec validate --all --strict` выполнена:71PASS/1FAIL — прежняя `persist-planned-trip-original-route-file` не содержит delta specs; оба её файла byte-identical принятому6b84. Собственная change и все main specs strict PASS; чужой незавершённый proposal не менялся. Следующий check владельца #1496: добавить intended delta (либо корректное intentional no-spec declaration, если scope действительно изменился), затем повторить --all. Raw global FAIL и diagnostic сохранены в `.codex-temp/2703/final-docs-prepared/` и не объявлены global PASS.
