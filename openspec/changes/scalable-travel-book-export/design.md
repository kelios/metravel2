## Context

См. `proposal.md` — Why. Это анализ уровня L и предложение, не реализация. Начальный frontend `main` был чистым. Источник backend — только `git show origin/master`, снимок `8adf94d` от 08.10.2026; production job не создавался и текущие production overrides не читались.

### Подтверждённый механизм

| Evidence | Следствие |
| --- | --- |
| `services/book/BookHtmlExportService.ts:27`; `TravelDataTransformer.ts:285–289,351–378` | Перед генерацией блокируются 50 travels / 30 gallery+thumb на travel / 200 всего / 50k на поле / 500k текста. Фото rich text не считаются, настройки выключенной галереи не учитываются. |
| `hooks/usePdfExportRuntime.ts:84–90,111–159,297`; `api/bookExportApi.ts:41–42,109–130` | Сервер получает лишь четыре настройки; любая ошибка/120s polling timeout возвращает большой export в локальный pipeline. |
| Backend `book_exports/services.py:68,81,101–107`; `serializers.py:22,29` | Серверный default — 20 путешествий (serializer ещё ограничивает request 100 IDs); выполнение daemon thread; PDF намеренно unavailable. Это исходники, не замер текущего production config. |
| Backend `book_exports/services.py:244,294–321,387,407,448–464`; `models.py:44` | Отдельный Python HTML renderer: 200 фото, 50 gallery/travel, 200 points/travel, 2 MiB HTML; rich text через strip_tags; весь HTML в TextField. |
| `components/listTravel/hooks/useListTravelExport.ts:66–89`; `ListTravelBase.tsx:295`; `useListTravelData.ts:128–156` | Select-all использует только накопленные страницы по 20, не все matching travels. |
| `hooks/usePdfExportRuntime.ts:166–179,229–253`; `hooks/usePdfExport.ts:28` | Непустая неполная gallery считается полной; исчерпанные retries дают карточку вместо details; cache без revision/TTL. |
| `pdfPageAssembly.ts:58,82–122`; `pdfRuntimeMarkup/htmlDocument.ts:373`; `utils/openBookPreviewWindow.ts:31–35` | Все данные, страницы, единый HTML и весь DOM накапливаются в памяти. Web фотографии не встраиваются массово в base64; ресурсный риск остаётся. |
| `EnhancedPdfGeneratorBase.ts:625–645`; `services/book/bookPrintChrome.web.ts:165–207,228–242` | Одновременное ожидание всех фото/aspects, после неудачных загрузок печать разрешена. |
| `EnhancedPdfGeneratorBase.ts:99–110`; `runtime/bookData.ts:142–158`; `pdfPageAssembly.ts:94–95` | galleryPhotosPerPage=0 означает всю gallery на одной странице; content заранее считается одной физической страницей. |
| `__tests__/hooks/usePdfExport.test.tsx:236–247`; `__tests__/services/pdf-export/TravelDataTransformer.test.ts:15–44` | Тест закрепляет продолжение после отказа details; граничных 30/200/50 тестов transformer нет. |

Скриншот владельца подтверждает поверхность `/export` и 25 выбранных travels; сообщение ошибки и IDs не показаны. Отказ сообщён владельцем, количественный механизм подтверждён двумя независимыми source-разборами. Точное число фото и состав книги 2012–2013 не установлены; анализ не выдаётся за воспроизведение этой книги.

### Problem History

Полный read-only board audit: 2344 карточки, все 8 статусов, открытого дубля нет. `tasks_list` скрыто ограничивает выдачу 300, поэтому использован весь `task_board`. Verdict — **create-linked**, family **PDF-BOOK-SCALE-001**.

История: #713 done — сознательный HTML-only сервер; #716 done — capability memo/fallback; #788 done — ограничения памяти; #1133 done — прежняя граница 20/21 и фиксированные print derivatives; #754 wont_do — отменённое выделенное железо, не переоткрывается. Reuse: #2232 media aspects, #2274 native cancellation. #2229 testing — чужой активный поезд, координация перед overlap. #2349 зависит от #2260 и удаляет мёртвые PDF-модули — не делать их базой нового renderer.

Созданы 09.10.2026 в sprint #27: родительская feature-карточка [#2352](https://metravel.by/board?sprint=27#task-2352), B1 [#2353](https://metravel.by/board?sprint=27#task-2353), F1 [#2354](https://metravel.by/board?sprint=27#task-2354), B2 [#2355](https://metravel.by/board?sprint=27#task-2355), B3 [#2356](https://metravel.by/board?sprint=27#task-2356), F2 [#2357](https://metravel.by/board?sprint=27#task-2357), F3 [#2358](https://metravel.by/board?sprint=27#task-2358). Родитель — поддерживаемая feature с related children, не фиктивный Epic: текущий MCP не создаёт отдельную модель Epic. Live statuses/dependencies — на борде.

## Goals / Non-Goals

**Goals:** ресурсно ограниченное выполнение любой конечной книги, один полный PDF, эквивалентность настроек и оформления, проверяемая полнота, возобновление, приватная доставка.

**Non-Goals:** гигантский browser DOM, перемещение полного PDF в JS buffer как итоговый способ delivery, дублирование тем в Python, автоматическое предоставление инфраструктуры, native large-download/share в первой поставке. Соседние квесты и GPX/KML не меняются.

## Decisions

### 1. Один канонический контракт документа

Отделить версионированные `BookSettingsDto`, `BookDocument` и `BookPlan` от модалки/RN. Перенести тип настроек из UI-зависимого слоя с compatibility re-export для существующих потребителей. `BookDocument` — полный доступный snapshot по страницам; `BookPlan` — упорядоченные блоки/страницы и occurrences, читаемые порциями, не огромный JSON в heap.

Snapshot фиксирует ordered travel IDs + revisions, текст, media versions/aspects, точечные данные, locale, entitlement verdict, renderer/settings version, детерминированный seed. Resource key и occurrence key различны: одинаковый кадр обложки/описания/галереи может использовать один файл, но имеет несколько намеренных placements. Inclusion-флаги определяют expected coverage.

Media version означает immutable object generation/content hash с гарантированными байтами, а не просто mutable URL или aspect. Если хранилище не обеспечивает immutable generation, worker приватно материализует bytes перед объявлением полного snapshot `frozen`. Selection finalize фиксирует IDs/порядок/revisions; полный settings DTO/hash фиксируется единожды при `POST job` и входит в full snapshot. Дорогая материализация full snapshot идёт асинхронной стадией задания, не долгим HTTP-запросом. До render все источники committed; retry после frozen использует те же bytes. При замене картинки в исходной статье результат сохраняет frozen bytes; отзыв доступа/удаление приватного исходника всё равно имеет приоритет и блокирует выдачу.

Reuse: `TravelDataTransformer`, ContentParser/BlockRenderer, существующие 20 тем, галереи, карты/атлас, sanitization и `printImageUrl`. Node-адаптер HTML tree использует уже применяемый parse5-подход; web DOMParser и native adapter сохраняются. Browser/canvas/QR/map операции идут через явные adapters: worker может материализовать карту в своём ограниченном Chromium, без DOM-глобалов в shared bundle. Renderer запускается в изолированном worker как versioned build artifact, pinned к snapshot, без Expo UI runtime.

Альтернатива Python BookHtmlRenderer отвергнута: strip_tags теряет inline фото/разметку, темы и настройки расходятся. Выделение нового jsPDF/canvas-движка во frontend отвергнуто: нарушает reuse и не устраняет ресурсную проблему.

### 2. Версионировать существующий API, не создавать параллельный экспорт

Предлагаемое расширение, реализуемое владельцем backend:

- `GET /api/exports/books/capabilities/`: contract/settings/renderer versions, PDF availability и resumable/download возможности. Не создавать заведомо failed job ради проверки capability.
- Selection draft в существующем book-export семействе: `POST /api/exports/books/selections/`; paged ordered append `PATCH /selections/{id}/`; finalize `POST /selections/{id}/finalize/`. Альтернатива ввода — owner-scoped filters с year-from/year-to 2012/2013 и сортировкой, server resolves все страницы. Request byte/page limits допустимы, total selection cap — нет. Finalize возвращает immutable selection reference/hash/count; partial uploads не принимаются как законченный выбор.
- `POST /api/exports/books/`: `{contract_version:2, selection_id, settings_version, settings:fullDto, format:'pdf', idempotency_key}`. Старый `{travel_ids,settings,format}` поддерживается как legacy до миграции; old HTML не выдаётся за equivalent v2.
- `GET /api/exports/books/{job_id}/`: queued/running/retry_wait/cancel_requested/cancelled/done/failed/expired, stage, counters `{travels, blocks, mediaOccurrences, pages}` expected/completed, snapshot/settings hash, completeness verdict, retryable error, expiry, download metadata. `GET /api/exports/books/` — только jobs текущего owner для восстановления после reload.
- `POST /api/exports/books/{job_id}/cancel/` и `/retry/` — idempotent state transitions; retry тот же snapshot/checkpoints. Expired artifact создаёт явный rebuild с доступным snapshot либо новый selection, без ложного обещания восстановления очищенных данных.
- Download существующего `/download/` — потоковый файл с Content-Length/Content-Type/checksum и owner ACL. Short-lived scoped ticket URL выдаётся аутентифицированным API, чтобы браузер скачал файл непосредственно без JS Blob; токен не равен account auth, не логируется. Доступ проверяется перед выдачей ticket и его использованием, хранение приватное, `no-store` и подходящий Referrer-Policy. URL проходит existing externalLinks helpers при навигации.

Детали schema/коды согласуются contract-карточкой; layout/settings не silently downcast. Отзыв доступа/удаление приватного исходника блокирует выдачу старого snapshot и запускает cancel/purge.

### 3. Долговечная очередь, bounded stages, checkpoint

Расширить `BookExportJob`, заменить daemon thread durable queue/worker с lease/heartbeat, idempotent claims, retry/backoff и requeue после смерти процесса. Бинарные части и PDF хранить private filesystem/object storage; DB содержит metadata и refs, не цельный HTML/PDF. Persist snapshot порциями, без долгой глобальной DB-транзакции; finalize подтверждает revision set либо явно перезапускает изменившийся snapshot.

Бюджеты задаются для каждой стадии: manifest fetch pages, encoded bytes, decoded pixels, DOM/pages на порцию, concurrency, RSS всего process tree, CPU и temp disk; merges тоже измеряются. Первоначальная concurrency worker — 1. На OOM/timeout portion уменьшается и переиспользуются уже подтверждённые checkpoints. Одна огромная глава дробится по блокам/физическим страницам; большие фото декодируются безопасными derivatives и constrained decoder, не бесконечными originals.

Bounded начинается до текущего `ContentParser`: нельзя сначала загрузить весь HTML field в строку/tree и лишь потом делить. Snapshot хранит поля как versioned chunks/files; backend читает oversized поля порциями с revision verification, renderer выполняет incremental tokenization/sanitization с теми же правилами. Один huge paragraph/table делится по text/runs/rows с переносом структуры, не становится неделимым атомом. Atlas/points, оглавление, metadata, coverage aggregates читаются постранично/с диска; огромный points array или aggregate Map всего архива не возвращают полный heap. Golden comparison bounded/unbounded для малых fixtures и stress на huge single block/field/table/many-points обязательны.

Нет обещания бесконечного физического файла. Контракт убирает произвольные product count caps для конечного архива; исчерпание реальных ресурсов возвращает прозрачный recoverable state, не обрезает книгу и не скрывается новым count cap.

История #754 описывает app VPS 1CPU/1.8GB. До включения PDF обязательны измерения app+worker под load, фиксированный конфиг RSS/temp-disk/concurrency и отсутствие деградации web/API. Если ресурсный бюджет не помещается — worker размещается в отдельном изолированном runtime по решению backend/ops owner; выделение мощности требует отдельного authorization. Старую карточку отменённого железа не переоткрывать. Пока deployment readiness не пройдена, capability unavailable; frontend не маскирует это.

### 4. Реальные страницы, две фазы финализации, один PDF

`BookPlan → renderSegment(segment,pageContext)` использует bounded assets/HTML, печатает segment во временный PDF, закрывает страницу/освобождает кадры. Галерея auto означает continuation pages; длинные rich-text блоки разбиваются с сохранением текста/таблиц/ссылок. Планирование и measurement учитывают шрифты, margins, aspect и manual photo placements.

Сначала физически измеряются body segments и atlas, затем вычисляется frontmatter/TOC и глобальные offsets. Рендер headers/folios не должен менять геометрию: зарезервированные области, tabular digits, контроль стабильности числа страниц; изменившийся page count означает повтор measurement, не выдачу неверного TOC. Frontmatter, checkpoints и итоговый manifest получают hashes. После disk-backed assembly заново привязываются внутренние destinations/TOC, page labels, bookmarks и metadata. Проверить tagged structure, не обещать автоматического сохранения tags при merge.

Предлагаемый engine — изолированный Chromium через Playwright с существующим print CSS. [Официальный API page.pdf](https://playwright.dev/docs/api/class-page#page-pdf) подтверждает print-media рендеринг и возвращаемый buffer: buffer удерживается только для ограниченного segment, не всей книги. Image/font readiness проверяется явно, один networkidle не доказывает отсутствие broken assets.

Composer-кандидат — qpdf или иной файловый PDF tool, окончательный выбор по нагрузочному spike в renderer-карточке. [Документация qpdf](https://qpdf.readthedocs.io/en/stable/cli.html#page-selection) подтверждает merge и предупреждает о document-level outlines/tags: plain concat не является готовым решением ссылок. Если composer не укладывается в budget, подобрать другой/иерархический merge; не загружать целиком PDF в pdf-lib на клиенте.

После всех этапов проверяется PDF integrity, физическое число страниц, expected/rendered content и media occurrences, настройки/порядок, наличие первой/последней chapters и конечного финала. `done` ставится только после совпадения. Broken media даёт failure/retry с отчётом; выбор неполного PDF не добавляется без отдельного продуктового решения.

### 5. UX фонового задания

Один desktop-web flow от кнопки существующего `/export` и одиночного travel:

1. Выбор: «Загружено N» отдельно от «Найдено M»; select-all явно «Все M по фильтру», 2012–2013 — единый year range. Выбранный count подтверждается finalized snapshot. Manual reorder сохраняется при paged selection.
2. Настройки: текущая модалка, полный DTO; расчёт состава книги без искусственного count error.
3. Сборка: компактный panel «В очереди / Подготовка / Сборка страниц / Объединение / Проверка», реальные done/expected counters, «Отменить». Не выдавать заранее придуманный ETA.
4. После reload: восстановить job ID из owner job list; локально persist только refs и UI preferences. Ошибка сети переводит observation в reconnecting, job остаётся прежним.
5. Готово: size/pages/counts/expiry и «Скачать PDF», retry/rebuild для явных failed/expired. Кнопка download не зависит от popup print permission; background file export отделён от `beginPrint()`. Малый browser print остаётся отдельным штатным adapter.

Design evidence — этот постоянный design и последовательность выше. Новых экранов/визуального redesign каталога не требуется. Reuse `components/ui`, tokens, Feather и существующие state feedback controls. Полоска progress имеет aria/live-status без объявления каждого кадра; keyboard focus остаётся у пользователя, cancel/retry/download имеют labels, mobile touch targets — в уже поддерживаемом single-export flow.

Large server fallback запрещён после permission/expired/job failure/offline/timeout. Малый локальный путь допустим по измеренному runtime budget и capabilities, не как retry любой ошибки. Если локальный budget превышен, весь полный выбор идёт серверному job; параметры не обрезаются.

В первой поставке routing полного server v2 относится только к desktop web. Canonical validation отделяется от legacy-native eligibility; native small-print safeguards и отмена сохраняются до отдельно спланированного large-file delivery. Удаление shared count gate не должно случайно отправить огромную native-книгу в прежний base64 pipeline.

### Ownership и шесть implementation-карточек

| Карточка | Area / task-owned paths | Зависимости / результат |
| --- | --- | --- |
| B1 selection/snapshot/API v2 | back, только backend owner; `book_exports/{models,serializers,views,urls,services}.py` | Полный paged choice, версии настроек/capabilities, immutable snapshot, ACL; заменяет прежние logical count contracts. |
| F1 общий document/plan/renderer | front; `types/book.ts`, export settings types/compat re-export, `services/pdf-export/**`, relevant tests | Согласованный B1 schema; versioned worker artifact, continuation text/gallery, deterministic occurrences; не трогать dead-модули #2349. |
| B2 durable worker/storage/readiness | back; export job model/service, owner выбранные worker/management modules, миграции/tests/ops | B1; очередь, leases/checkpoints, cancel/retry, private artifact refs, readiness budget и expiry. |
| B3 PDF render/merge/completeness | back; export worker/renderer integration и tests | F1 + B2; готовый полный PDF, actual pagination/TOC/links, resource and coverage evidence; TS renderer поставляет front, сервер integration владеет back. |
| F2 lifecycle/selection/download UI | front; `api/bookExportApi.ts`, `hooks/usePdfExport*.ts`, list export hooks/controls, settings UI, i18n/tests | B1 + B2 + F1; complete year range selection, resumable statuses, popup-independent download, без large fallback; может разрабатываться до B3, Done после него. |
| F3 снятие legacy gates/полнота/integration | front; `TravelDataTransformer`, runtime detail/cache/fallback consumers, tests/evidence tooling | B3 + F2; semantic validation остаётся, count caps заменены routing, partial-card success запрещён, реальный 2012–2013 PDF и load acceptance. |

Backend paths — описание read-only dependencies, не task-owned edit paths этой frontend-сессии. Детальная ответственность frontend не дублирует сервер deployment. QA включена в Done gate каждой карточки и завершающую F3, отдельная карточка ради отсутствующего evidence не нужна.

## Risks / Trade-offs

- **[Большая книга занимает время/диск]** → очередь/checkpoint, size/expiry, отмена, наблюдаемые ошибки; без принудительных томов и потери содержимого.
- **[Merge memory растёт с числом страниц]** → отдельный composer spike и peak-RSS process-tree замер на 1000/5000 фото, disk-backed refs; решение по факту, не название библиотеки.
- **[TOC и реальные страницы разойдутся]** → двухфазное measurement, reserved folio geometry, повторная сверка после merge, переходы в первой/средней/последней главах.
- **[Snapshot не соответствует accessibility/revisions]** → atomic finalize revision set, auth recheck, deletion/cancel lifecycle, private purge.
- **[SSRF/HTML]** → shared sanitization, worker CSP/изоляция, allowlisted asset gateway, redirect/IP/private-network checks, limits на one decoded resource, без account tokens в браузер worker и логах.
- **[Premium или темы расходятся]** → full DTO + server entitlement + pinned canonical renderer; golden corpus всех тем и сохранённые настройки.
- **[Новый runtime попадает в app bundle]** → node/browser worker adapters отдельно, shared imports без Playwright/Node/DOM, lazy runtime остаётся.
- **[Имеющиеся count-validation тесты считают старое поведение верным]** → новые tests полного экспорта old max/max+1; semantic/invalid-access negatives сохраняются, исторический #1133 не переобъявляется провалом.

## Migration Plan

1. Backend owner согласует B1 контракт, paged selection и версии; F1 выделяет renderer/DTO без изменения малой печати. Read-only capabilities отличает v1 HTML от полноценного PDF v2.
2. B2 проходит isolation/readiness budget; B3 собирает реальные PDF и только после проверки полноты advertises v2 availability. Не включать capability лишь потому, что endpoint возвращает 202.
3. F2 включает job lifecycle по реальной capability, F3 снимает count gates только вместе с безопасным маршрутом и fail-closed details. В недоступном окружении явный state; mocks не release evidence.
4. Post-review testing на собственном выкате по project gates: small regression, стресс, настоящий двухгодичный selection владельца с разрешённым authenticated запуском. Production создание артефактов/infra операции следуют backend owner authorization.
5. Rollback: capability off возвращает проверенный small-print adapter, текущие jobs/checkpoints доступны для resume другим compatible worker; schema additive, snapshot/renderer версии не меняются у уже начатого job. Большой выбор не возвращается в unsafe local fallback. Архивирование OpenSpec после закрытия всех AC.

### Validation matrix

| Surface / stage | Фактическая будущая проверка |
| --- | --- |
| До/во время review | DTO/API tests, complete-vs-partial data, deterministic segment/manifest tests, golden web/native corpus, print/media governance, localized errors; targeted lint/typecheck/guards. Независимый review-auditor + code-review-gate. |
| Backend testing | B1 ACL/version/append/finalize; B2 duplicate claims/restart/cancel/purge/expiry; B3 real PDF correctness, worker RSS/CPU/temp disk, error/retry and download authorization. Source snapshot подтверждать deployed SHA. |
| Desktop web testing | `/export` all matching 2012–2013, pagination/manual order/settings, job >120s, reload/offline/cancel, popup blocked download, real saved PDF first/middle/last chapters, screenshots+console/network. |
| Mobile web testing | Existing catalog unavailable rule preserved; small single-export responsive UI, localized feedback and print; не открывать весь каталог ради новой фичи. |
| Android / iOS regression | Shared renderer golden без DOM, existing native print preparation/cancel tests. При изменении native output/print adapter — reviewed build в testing: Android USB print/save, iOS simulator PDF/print; physical AirPrint только при изменении hardware-контракта. Новый server sharing в scope не входит. |
| Все locales | RU/BE/UK/PL/EN status/accessibility/date-number formatting; `npm run test:i18n`; authored prose без client translation. |
| Load / completeness | 201/1000/5000 фото; >30 в одном travel; >50 travels; >50k field/>500k total; одна huge chapter, repeated resource placements, different segment sizes; retries/renderer restart/slow assets. Числа — нагрузки, не product caps. |

Для каждой нагрузки сохранять snapshot hash, settings/renderer/media versions, planned/rendered blocks/occurrences, unique resource count, page count, TOC destination probes, wall time, worker process-tree peak RSS, browser memory, temp disk/output size, errors и deployed SHA. Заголовки, тексты, private IDs/URL/credentials — только в разрешённом приватном fixture; публичные evidence — агрегаты в ignored `.codex-temp/`.

Acceptance budgets фиксируются B2 до execution (конкретные RSS/temp-disk/app health пороги в config и отчёте). Один и тот же budget применяется к 1000/5000; измерения с нарушенным budget не pass. Текущий двух-ID `scripts/pdf-book-acceptance-benchmark.cjs` нельзя использовать как доказательство всего архива; нужен отдельный fixture runner без изменения его безопасности/целевого аккаунта.

## Open Questions

Отложены только operational значения: фактический RSS/CPU/temp-disk budget и размещение isolated worker после benchmark B2; composer по измерению B3. Обе развилки имеют одинаковый продуктовый/контрактный результат и не разрешают новый count cap. Точные owner IDs и число фото за 2012–2013 снимаются в разрешённом acceptance проходе, не выдумываются по screenshot.
