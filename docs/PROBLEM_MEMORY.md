# Problem memory and recurrence registry

Актуализировано: 2026-08-18.

Этот документ — постоянная память о системных семействах проблем MeTravel. Он
не заменяет task board и не хранит обычный progress log. Борд остаётся
операционным backlog; здесь хранятся инвариант, подтверждённые корневые причины,
каноническая цепочка задач и правило, когда переоткрывать старую задачу, а когда
создавать связанную новую.

Перед созданием или переоткрытием карточки используй
`$metravel-problem-memory`, затем `$metravel-ticket-board` и
`$metravel-task-contract`.

## Как пользоваться

1. Сформулируй симптом, нарушенный инвариант, surface, owning layer,
   endpoint/files и target environment.
2. Найди совпадения в этом реестре и во всех статусах board, включая `done` и
   `wont_do`.
3. Выбери одно решение:
   - `reuse` — каноническая работа уже открыта;
   - `reopen` — снова нарушен тот же инвариант по той же причине;
   - `create-linked` — семейство то же, но подтверждённая причина/владелец другие;
   - `create-new` — исторического совпадения нет.
4. Для recurrence добавь в карточку датированный `Recurrence Log`: prior task,
   observed failure, same/different cause, почему прежний Done gate не удержал
   инвариант, corrective layer и новый regression control.
5. Обновляй этот файл только при новой подтверждённой причине, рецидиве или
   постоянном control. Не копируй сюда чеклисты реализации.

## Снимок аудита board

Read-only snapshot на 2026-07-28: 1111 задач, из них 997 `done`, 91 `wont_do` и
23 в открытых рабочих статусах. API задачи отдаёт `created_at`/`updated_at`, но
проверенные endpoints `history`/`activity` отсутствуют, поэтому точное число
переходов `done → in_progress` восстановить нельзя.

Минимально подтверждённые паттерны:

- false `done`/неинтегрированное исправление: `#483 → #595`, `#486 → #653`,
  `#38 → #923`;
- новый failure mode того же chokepoint: `#732 → #812` (это не одна причина:
  сначала отсутствовала конфигурация, затем fallback скрыл provider failure);
- точные/функциональные дубли: `#128/#131`, `#129/#132`, `#130/#133`,
  `#171/#172`, `#476/#477`, `#1090/#1102`;
- только 5 из 1111 задач используют `epic`, `story` не использует ни одна;
  связанный media-кластер `#1111–#1118` не сгруппирован epic/story;
- два sprint со статусом `active` фактически стали бессрочными очередями:
  `Backlog migration 2026-06-10` (248 задач) и `Android Release` (512 задач).

Вручную подтверждено минимум 6 duplicate-кластеров, 3 false-Done/
неинтегрированных исправления и 1 новый failure mode прежнего chokepoint.

Следствие: board сейчас показывает объём закрытых карточек, но не показывает
надёжно churn одного инварианта. Для анализа recurrence используй цепочки ниже,
связи и evidence в description, а не один статус.

### Churn-замер: что реально останавливает рецидивы

Измерение 2026-07-28 (тикеты по неделям создания + `git log` по владеющим
каталогам). Это единственное прямое доказательство, какой тип фикса работает.

| Семейство | Тикетов/неделю (нед. 24→30) | Коммиты владеющих каталогов | Что сделали |
|---|---|---|---|
| Карта | 30, 46, 38, 41, 23, 28, **11** | 203 до 19.07 → **11 после** | эпик консолидации `#988` + guard |
| Медиа | 18, 14, 4, 11, 12, 6, **18** | churn не падает | только точечные фиксы симптомов |

Карта и медиа — сопоставимые по сложности shared-подсистемы. После
`#988` (единый tile-провайдер, единый native-движок, единый `MapCanvas`,
единый попап, единый `useMapController`) + `guard:no-direct-osm-tiles` поток
карт-тикетов упал в ~4 раза, а коммиты в `components/MapPage`/`map-core` —
в ~18 раз. Медиа за тот же период чинили покарточно, и на последней полной
неделе (30) поток тикетов вернулся на уровень максимума за всё наблюдение
(18 — столько же, сколько на старте, в неделю 24). Неделя 31 неполная
(27–28.07) и в сравнении не участвует.

**Вывод, обязательный при планировании:** рецидив останавливает не «более
аккуратный фикс симптома», а консолидация владеющего слоя в один контракт плюс
guard, падающий в CI на попытке обойти этот контракт. Пока у семейства N
параллельных реализаций одного и того же — карточки будут воспроизводиться
бесконечно, независимо от качества каждой отдельной.

## Приоритетный structural backlog

Это направления, а не замена карточкам board. Перед реализацией для каждого
нужен Problem Memory Verdict и одна каноническая FE/BE task chain.

| Приоритет | Постоянное исправление | Почему раньше симптом возвращался |
| --- | --- | --- |
| P0 | Backend task history, typed relations, atomic create idempotency и active `problem_key` conflict | Board хранит текущее состояние карточки, а не жизненный цикл проблемы; duplicate обнаруживается после create. |
| P0 | Версионированный media capability/manifest contract и observable unsupported transform | Fail-open `200 original` делает тяжёлый ответ похожим на успешную оптимизацию; feature pipelines строят разные URL. |
| P0 | Travel `PATCH` или revision/ETag/idempotency save contract | Autosave вынужден отправлять full replace из частично hydrated state и может стереть серверные поля. |
| P1 | Единый auth session bootstrap и transport policy для `401/403/CSRF` | Cookie, локальная metadata и разные fetch/upload/download wrappers расходятся. |
| P1 | Общий bottom-chrome geometry provider | Каждый экран заново складывает dock, safe area и keyboard offsets. |
| P1 | Один routing adapter + typed provider failures/coordinates | Server canonical path, direct providers и legacy store bridge существуют одновременно. |
| P2 | Закрытие бессрочных sprint и группировка системных цепочек problem key/epic | Сотни несвязанных карточек скрывают один recurring invariant. |
| P2 | Ревалидация квест-контента против реального объекта (свежие фото по координатам шага) | Опубликованный эталон ответа стареет вместе с городом, и сломанный шаг ничем не отличается от здорового, пока туда не дойдёт живой игрок. |
| P2 | Жизненный цикл снимков живого прод-контента: снятый артефакт не остаётся в репозитории как данные | Применённый снимок неотличим от актуального и при повторном запуске молча возвращает прод к прошлой редакции. |

## Реестр

### MEDIA-001 — canonical media URL and byte budget

- **Инвариант:** один media identity в одном visual slot использует один
  канонический manifest/proxy variant; blur не создаёт вторую сетевую загрузку;
  неподдерживаемый transform не возвращает тяжёлый оригинал как успешный preview.
- **Surface/owner:** shared frontend + backend image proxy/capacity.
- **Симптомы:** мыльные/долго появляющиеся фото, 6–30 MB при открытии статьи,
  один файл в нескольких URL-вариантах, cold 502/504, LCP/jank.
- **Цепочка:** `#815`, `#828`, `#890`, `#1035`, `#1052`, `#1053`, `#1064`,
  `#1068`, `#1074`, `#1101`, `#1103`, `#1104`, `#1111–#1120`, `#1137`,
  `#1263`, `#1400`.
- **Подтверждённые причины:** `ImageCardMedia` централизовал renderer, но не
  source construction; URL собирают несколько helpers/consumers с разными
  `w/q/fit/v`; backend раньше принимал unsupported параметры и возвращал
  original с HTTP 200; on-demand conversion и раздробленный cache key грузят тот
  же app host; travel hero, rich text web/native, quests и SEO/SSG имеют
  независимые source pipelines; component tests часто mock'ают media primitive
  и не проверяют фактическое число URL/байт.
- **Controls:** ADR `0002`, `check:image-architecture`, bilateral
  `verify:slider` + `verify:slider-perf`, browser Network и Android rx evidence.
- **Пробел:** import guard не проверяет manifest-first source, supported transform
  contract, unsized same-origin URL или URL cardinality; route budgets не ловят
  catalog-wide DPR/Safari eager fan-out и количество страниц API.
- **Решение для новой жалобы:** если в цепочке есть открытая подходящая карточка —
  `reuse` её. Если каноническая карточка нужного слоя закрыта, переоткрывай её;
  новый linked task допустим только для другой подтверждённой причины/owner.
- **Recurrence Log — 2026-08-11 (`/search`, `#1400`):** закрытый инвариант
  «виртуализированный скролл не создаёт отменённых image requests» снова
  нарушен на production. Независимый raw CDP-прогон без request interception и
  без assertions штатного smoke дал семь `Network.loadingFailed` с
  `canceled=true`/`net::ERR_ABORTED` для одного точного `w=480&q=70` URL во
  время 10 циклов `scrollTop 0↔1160` по 50 мс при 1,6 Мбит/150 мс и CPU×4.
  Контроли до stress были здоровыми: desktop 18/18 и mobile 9/9 запросов
  завершились, `canceled=0`. Предыдущая приёмка проверила обычные циклы без
  этого быстрого throttled remount-окна и пропустила automated suites. Точная
  причина подтверждена отдельной DOM/CDP-трассой: FlashList оставлял один
  подключённый `<img>` (`seq=4`) и менял его источник `664→637→664`; Chromium
  уже начинал нативно-ленивый `w=480` запрос примерно в 1021 px ниже viewport,
  а следующая подмена `src/srcset` через 50 мс отменяла единственного владельца
  запроса. Это тот же frontend lifecycle-owner, что у предыдущего #1400, но
  прежнее исправление покрывало только `eager/high` ремоунты и не удерживало
  начавшийся lazy-запрос. Verdict: `reopen #1400`; корректирующий слой —
  ограниченный viewport-поясом keeper для catalog lazy media, backend media
  proxy не переоткрывается. Новый regression control обязан доказать
  невакуозный turnover/remount, завершение начавшегося запроса и
  `requestfailed=[]`/`canceled=[]` после точных 10 циклов `0↔1160`. Связанный
  gate `#1263` проверяет первый кадр, где видно не меньше 25 % новой обложки:
  фотография уже должна быть декодирована, поздний settle не считается PASS.
- **Recurrence Log — 2026-07-29 (`/quests` production):** закрытый `#1053`
  снова нарушен. В desktop Chrome на живом URL 137 quest covers имеют
  `currentSrc ...w=1280` в CSS-слоте около 420 px; первые 10 стартовавших
  вариантов `w=1280` весят существенно больше bounded `w=480`. Отдельный
  shared Safari change `29418f3f` превращал все 135 `loading=lazy` cover cards
  в eager. Первичная реализация `266a43bf` выбрала DPR до 2 и ladder до 1280,
  а тест `#1053` доказывал только 420 px при DPR 1. Production catalogue также
  делает 7 запросов `/api/quests/` и 5 `/api/quests/cities/`; read-only probe
  подтвердил, что `perPage=100` сокращает эту часть с 12 запросов до 3.
  Предыдущий Done gate не включал одинаковый live-URL Safari/DPR2 probe и
  page-wide request/byte budget. Verdict: `reopen #1053` для media/eager
  recurrence; API pagination fan-out — `create-linked`, потому что причина и
  corrective layer другие.
- **Linked finding — 2026-07-29 (`/places` production):** две карточки получили
  unsized 1024 px `address-image` из-за `PlaceListCard optimizeWeb=false`; в
  слотах около 300 px файлы весят 287902 B и 222750 B, тогда как `w=480`
  варианты — 41572 B и 33810 B. Verdict: `create-linked` к `#1113/#152/#725`,
  не переоткрывать их как тот же root cause.
- **Recurrence Log — 2026-07-29 (travel rich text + hero contention):** на
  production travel detail persisted rich-text URLs повторно проходили через
  sanitizer/HTML transform и накапливали до семи вложенных
  `images.weserv.nl`-слоёв. Изображения описания почти не загружались, а их
  конкурирующие запросы задерживали соседние hero-слайды 2–4. Full-board audit
  (1134 карточки) не нашёл открытого владельца точной причины. `#1114` закрывал
  другой rich-text failure mode (raw `detail_hd` double-fetch/aspect probing),
  `#890` — backend resize/availability legacy uploads, `#1116` — hero URL
  cardinality/manifest variants. Verdict: `create-linked` к `#1114`, related
  `#890/#1116`; подтверждённая новая причина — неидемпотентная FE-нормализация
  proxy URL и односоставный timeout fallback. Corrective layer: общий
  `unwrapWeservImageUrl`, один канонический proxy URL и recursive origin
  fallback в sanitizer/web transform/effects. Regression control: helper unit,
  repeated-sanitization idempotency, 6-layer real transform и malformed-input
  negative probes, bilateral slider/performance gates. Local browser evidence
  подтверждает один proxy layer и загрузку 600×400 mobile / 800 px desktop;
  production post-deploy и Android device evidence остаются обязательными.
- **Последняя проверка:** 2026-08-11; `#1400` recurrence и gate `#1263`,
  семейство активно.

### BOARD-001 — task history and duplicate prevention

- **Инвариант:** до create известны прежние карточки и причины; одно и то же
  исправление имеет одну каноническую цепочку; каждый status transition
  восстанавливается.
- **Surface/owner:** backend task board + Codex workflow.
- **Симптомы:** новый ticket вместо reopen/update, duplicate закрывается как
  `done`, recurrence rate нельзя посчитать, связанные задачи не собраны в epic.
- **Цепочка evidence:** duplicate pairs из snapshot выше; `#1090/#1102` — свежий
  пример competing backend reports; `#476/#477` возникли после timeout read API
  в момент дедупликации; `#653` содержит ручной Recurrence Log.
- **Подтверждённые причины:** нет обязательного historical-search gate перед
  create; API не отдаёт immutable status events; `search` и `limit` фактически
  игнорируются, list не отдаёт description/timestamps/full relations, поэтому
  смысловой поиск требует N+1 detail reads; title/description не имеют problem
  key/fingerprint; epic/story почти не используются; create не идемпотентен.
- **Controls:** `$metravel-problem-memory`, этот реестр, обязательный
  Problem Memory Verdict и Recurrence Log.
- **Пробел backend:** нужны immutable task events/status history, серверный
  search/similarity candidate endpoint или fingerprint, atomic idempotency key,
  typed links `duplicate_of`/`recurrence_of`/`supersedes`, active problem-key
  conflict, `reopen_count`/`done_at`/`last_seen_at` и server-side Done evidence
  validation. Это отдельная `area=back` задача; backend source из frontend
  workspace не меняется.
- **False-Done evidence:** `#653` имеет `status=done` вместе с
  `needs_human=true`, хотя последняя запись оставляет restart/deploy-swap gate
  незакрытым; у `#38` указанный commit из другого checkout не достижим из
  текущего canonical `main`, а production позже снова показал JS token.
- **Решение для новой карточки:** без pre-create verdict карточку не создавать.
- **Последняя проверка:** 2026-07-28; workflow guard добавлен, backend history gap
  остаётся.

### AUTH-001 — web cookie auth vs native token auth

- **Инвариант:** web использует HttpOnly cookie + `credentials: include` + CSRF
  и не хранит/читает auth token из JavaScript storage; Android использует
  SecureStore + `Authorization: Token`.
- **Surface/owner:** shared auth client with explicit web/native branches.
- **Цепочка:** backend `#3`, frontend `#38`, recurrence `#923`, связанные
  `#937/#947/#952`.
- **Подтверждённая причина recurrence:** несколько auth/direct-fetch wrappers и
  storage call sites позволили вернуть web token persistence; валидная HttpOnly
  cookie и локальные `userId`/profile metadata образуют два источника истины;
  fetch/upload/download wrappers неодинаково трактуют `401`; прежний architecture
  summary описывал единый token flow и скрывал platform split.
- **Controls:** auth/client/store tests, production browser login→reload→logout
  evidence, storage assertion на отсутствие readable token.
- **Решение для новой жалобы:** readable web token или web Authorization header —
  `reopen #923`; provider-specific OAuth defect с сохранённым invariant —
  `create-linked`.
- **Последняя проверка:** `#923 done`, 2026-07-15.

### OPS-STATIC-001 — production static ownership drift

- **Инвариант:** host deploy user и app container могут атомарно менять только
  документированные untracked `static/dist*` без ручного `chown`.
- **Surface/owner:** backend/ops; frontend workspace read-only.
- **Цепочка:** `#486 → #653`.
- **Подтверждённая причина recurrence:** один bind-mounted каталог попеременно
  создают uid 1000 и uid 1984; one-shot `static-permissions` выполнялся при
  compose up, но не удерживал права при restart/host-side recreate. Первый fix
  лечил owner snapshot, а не lifecycle двух writers.
- **Controls:** canonical deploy wrapper, tracked/untracked classification,
  несколько последовательных swap checks после recreate.
- **Решение для новой жалобы:** тот же permission-denied/uid drift — `reopen
  #653`, не создавать третий ticket и не чинить сервер из frontend workspace.
- **Последняя проверка:** `#653 done`, 2026-07-03.

### OPS-DEPLOY-LIFECYCLE-001 — frontend static deploy не управляет контейнерами

- **Инвариант:** frontend-owned публикация или аварийное восстановление может
  атомарно менять только документированные untracked static targets, проверять
  Nginx и делать graceful reload существующего master process. Она не выполняет
  `restart`, `recreate`, `down`, `up`, `stop` или `rm` для app, Nginx, Redis,
  Redis Images, Postgres либо full-stack Compose.
- **Surface/owner:** frontend release/recovery scripts (`build-prod.sh`,
  `scripts/fix-prod.sh`); backend/infra lifecycle остаётся у backend owner.
- **Цепочка:** `#1365` — основной production deploy; linked follow-up `#1427` —
  аварийный recovery path; backend context `#1368`.
- **Подтверждённые причины:** основной и аварийный пути развивались отдельно.
  `#1365` заменил hard restart на Nginx validate/reload и добавил source-contract
  test только для remote payload `build-prod.sh`; `scripts/fix-prod.sh` остался
  вне этого guard и продолжал выполнять `docker restart "$nginx_ctr"` после
  atomic static swap.
- **Controls:** общий source-contract test читает реальные `build-prod.sh` и
  `scripts/fix-prod.sh`, запрещает Docker/Compose lifecycle commands и содержит
  negative fixtures; оба пути используют Nginx config validation + graceful
  reload без изменения container identity/restart count.
- **Решение для новой жалобы:** lifecycle-команда вернулась в одном из этих двух
  путей — `reopen #1427`; новый frontend-owned deploy/recovery entrypoint с тем
  же обходом — `create-linked` к `#1427` и сразу расширить общий guard. Backend
  deploy или scheduler lifecycle относится к `#1368`/backend family.
- **Последняя проверка:** 2026-08-13; локальная реализация `#1427`, production
  acceptance требует отдельной явной deploy/recovery команды.

### ROUTING-ORS-001 — degraded routing must not look healthy

- **Инвариант:** нормальный production probe возвращает `provider: ors`,
  `is_optimal: true`, road geometry; direct fallback не кэшируется как healthy.
- **Surface/owner:** backend routing/provider + frontend runtime smoke.
- **Цепочка:** configuration `#732`, production failure `#784`, recurrence
  `#812`.
- **Подтверждённые причины:** сначала отсутствовал ORS config; затем upstream
  route-not-found скрывался generic `ors_http_error`, а direct fallback
  сохранялся в cache и переживал восстановление provider.
- **Controls:** car/bike/foot prod probes, status-specific fallback reason,
  no-cache for degraded fallback, `/map` Network/Console smoke.
- **Решение для новой жалобы:** persistent direct fallback по той же причине —
  `reopen #812`; новый provider/config failure — `create-linked` к семье.
- **Последняя проверка:** `#812 done`, 2026-07-06.

### ACH-CACHE-001 — achievements cache and invalidation

- **Инвариант:** `/achievements/me/` выполняет cold/warm latency budget и
  инвалидируется после activity/progression change без sync full recompute на
  каждый GET.
- **Surface/owner:** backend achievements cache; FE timeout только defensive.
- **Цепочка:** `#483`, FE mitigation `#588`, recurrence `#595`.
- **Подтверждённая причина recurrence:** `#483` был закрыт, но production cold
  path всё ещё занимал до 3.5s; первый Done gate не удержал одновременно real
  cold latency и invalidation contract.
- **Controls:** production cold/warm probes на тяжёлом аккаунте, cache-key
  alignment и invalidation tests.
- **Решение для новой жалобы:** тот же cold/warm/invalidation failure — `reopen
  #595`, не создавать третий cache ticket.
- **Последняя проверка:** `#595 done`, 2026-06-24.

### WIZARD-DRAFT-001 — three persistence layers

- **Инвариант:** server upsert, autosave state и local draft не удаляют и не
  реанимируют пользовательские изменения из-за async race или id migration.
- **Surface/owner:** shared travel wizard.
- **Цепочка:** duplicate `#171/#172`, Android symptom `#340`, system pass
  `#1037/#1039/#1043`.
- **Подтверждённые причины:** `_new → _id` key migration, pending debounce vs
  clear, structural equality against noisy server fields, background/flush and
  re-auth ordering.
- **Controls:** `docs/TRAVEL_DRAFT_RECOVERY.md`, focused Jest, Playwright
  recovery flow, paired mobile-web/Android background/offline evidence.
- **Решение для новой жалобы:** data-loss/phantom draft within documented state
  machine — `reopen #1043`; different backend upsert contract — `create-linked`.
- **Последняя проверка:** `#1043 done`, 2026-07-23.

### OFFLINE-001 — fragmented caches do not form an offline application

- **Инвариант:** Android app shell, tabs and Back remain usable without network;
  a user-selected package opens after force-stop/cold start; recent public data
  may degrade to a marked stale view instead of a full-screen network error.
- **Surface/owner:** shared query/network/source policy + Android durable content
  storage; mobile-web uses the same UX without Service Worker cold-start claims.
- **Цепочка:** refinement `#479`, public stale-cache implementation `#603`,
  related map/offline work `#107/#908/#909/#1076/#1079`, persistence
  foundation `#1015/#994`.
- **Observed recurrence 2026-07-28:** owner reports that an installed Android app
  opened without network presents offline errors across tab navigation even
  after using an offline download flow.
- **Подтверждённые structural causes:** persisted React Query restore starts
  asynchronously after screens mount; React Query `onlineManager` is not wired
  to native NetInfo; `#603` intentionally recovers public travel only from
  unauthenticated request paths, so signed-in public screens can hard-fail;
  `useOfflineTravelCache` writes travel snapshots but production detail reads do
  not consume them; quest bundles, map tiles, recent history and public stale
  payloads use separate manifests and cannot populate one offline library.
- **Previous Done-gate gap:** `#603` was closed with unit/type/check evidence and
  an explicit note that Android device smoke was not run. Its contract covered
  last-success travel list/detail, not cold-start hydration, signed-in public
  reads, tab-shell behavior or user-selected packages.
- **Permanent control:** one `OfflineCatalog`/package contract, atomic package
  writes, NetInfo→onlineManager bridge, hydration-before-offline-query test,
  guard/tests preventing direct parallel offline stores, and an Android
  online-save → force-stop → offline cold-launch matrix with measured package
  count/bytes/assets/source. Design contract: `docs/features/offline.md`.
- **Решение для новой жалобы:** hard error within the public list/detail/shell
  promise reopens `#603`; new content-package adapters are linked children of
  this family, not competing generic «offline fallback» fixes.
- **Последняя проверка:** 2026-07-28; recurrence confirmed, structural sprint
  planned.

### TRAVEL-SAVE-001 — destructive full-replace autosave

- **Инвариант:** частично hydrated или устаревший frontend snapshot не удаляет
  уже сохранённые поля travel; повторный save либо patch'ит изменённые поля,
  либо отклоняется по revision conflict.
- **Surface/owner:** backend travel save contract + shared frontend wizard.
- **Цепочка:** save/draft family `#171/#172`, `#340`, `#1037/#1039/#1043`;
  incident evidence для travel `641` описан в persistence normalization code.
- **Подтверждённая причина:** autosave работает поверх full-replace upsert.
  Frontend компенсирует это hydration gate, abort/epoch, field-by-field merge,
  rich-text baseline, gallery/marker preservation, placeholders и legacy schema
  guards. Каждое новое поле расширяет destructive race surface.
- **Постоянное исправление:** backend `PATCH` либо revision/ETag/idempotency
  contract со стабильным full echo; затем удалить frontend merge-workarounds по
  явному removal plan.
- **Controls:** destructive-save integration test с неполной hydration, stale
  revision conflict, repeated/background save и сохранностью media/markers.
- **Решение для новой жалобы:** потеря серверных полей при save — `reuse`/`reopen`
  canonical save-contract task; dialog/key lifecycle остаётся
  `WIZARD-DRAFT-001`, а не смешивается с API replace semantics.
- **Последняя проверка:** 2026-07-28; structural backend contract остаётся.

### SEO-SSR-001 — validated slug must serve exact static document

- **Инвариант:** public current slug returns its exact SSR/SSG HTML with
  canonical/content and no generic noindex; alias is 301; unknown/private is 404.
- **Surface/owner:** backend Django→Nginx routing + frontend post-deploy SEO gate.
- **Цепочка:** alias work `#1083`, incident `#1090`, duplicate `#1102`, guard
  `#1107`, older noindex context `#142`.
- **Подтверждённая причина:** Django correctly validated visibility but internal
  redirect collapsed every valid slug to `[param].html`; hydrated UI hid the
  crawler-only failure. `#1102` was created while `#1090` already owned it.
- **Controls:** exact HTML marker/canonical/noindex probes, alias/404 tests,
  `test:seo:prod`/postdeploy.
- **Решение для новой жалобы:** generic shell for a valid travel slug — `reopen
  #1090`; different page family — `create-linked`.
- **Последняя проверка:** `#1090 done`, 2026-07-27.
- **Рецидив (волны мёртвых алиасов):** `#1186` (49 адресов) → `#1197` (32) →
  `#1249` (9). Каждая волна находилась одинаково: человек шёл на прод-хост,
  тянул JSON access-лог nginx и глазами отделял старые адреса от проб e2e.
  Точечная доливка списка семейство не закрывает — она чинит найденное, а не
  способ находить.
- **Постоянный control с 2026-08-04:** `npm run seo:404`
  (`scripts/report-travel-404.js`) — разбор access-лога по расписанию
  ежедневной SEO-рутины (`seo-daily`, шаг 4). Делит 404 на сломанный редирект
  (переспрашивает прод живой пробой, чтобы не путать аварию с ожиданием
  деплоя), нового кандидата, склейку/обрезку ссылки (класс `ROUTE-NULL-001`),
  обращение по id, намеренный 404 и шум. Осознанные отказы живут в
  `scripts/seo-404-known.json` с тикетом и причиной, иначе каждая волна снова
  тонет в `mock`. Код возврата 1 = находки для человека.
- **Ложный класс волны — черновики автора (`#1255`, 2026-08-04):** четвёртая
  волна из 61 адреса целиком оказалась неопубликованными статьями
  (`publish=0`), а не потерянными адресами живых. Анонимно черновик неотличим
  от несуществующей статьи: и список, и `by-slug` отдают 404, поэтому проверка
  «таких статей нет» без токена всегда подтверждает ложную гипотезу — нужен
  запрос `where={"publish":0}` со staff-токеном. С `#1255` отчёт спрашивает
  список черновиков сам и кладёт такие адреса в корзину `draft`; статически в
  `seo-404-known.json` черновики не пишутся — после публикации статьи такая
  запись маскировала бы уже настоящую регрессию слага.
- **Решение для новой волны 404:** мёртвые адреса найдены отчётом и это только
  доливка алиасов — `create-linked` к `#1249`; адреса оказались черновиками —
  редиректы не нужны вообще, корзина `draft` (`#1255`); отчёт молчит, а адрес
  мёртв — чинить сам отчёт, это регресс control'а, а не новая волна.

### SEO-SNIPPET-001 — сниппет и разметка обязаны совпадать с тем, что видит читатель

- **Инвариант:** то, что редактор добавил в тело статьи ради выдачи (структурированные
  данные, ответы FAQ, лид), доезжает до краулера в машиночитаемом виде; в сниппет
  никогда не попадает машинный вывод.
- **Surface/owner:** frontend SSG (`scripts/generate-seo-pages.js`,
  `scripts/ssg-skeletons.js`) + контентный аудит (`scripts/seo-audit.js`).
- **Цепочка:** обрезка меты `#678`, og:image `#763`, поштучная правка лидов `#755`,
  потеря FAQ-разметки `#1138`, guard `#1139`, утечка stdout в тело `#1140`,
  обрезка тела на 9 000 символах `#1324`.
- **Подтверждённая причина:** body-санитайзер SSG держит узкий allowlist тегов и
  срезает все атрибуты, поэтому микроразметка из тела статьи существует только в
  JSON гидрации; отдельно — скрипты обслуживания могли писать stdout прямо в
  `description`, и `weak-lead` этого не видел, потому что слова заголовка всё равно
  попадали в 160-символьное окно. Третья причина (`#1324`, 2026-08-08): тот же
  санитайзер молча клампил тело на дефолтных 9 000 символах — под обрезку попадали
  150 из 306 статей, и терялся именно хвост («Что рядом», FAQ, практика). Обрезка
  шла по границе блока, поэтому в HTML выглядела как естественный конец статьи.
- **Controls:** unit-тесты `extractFaqEntries`/`buildTravelFaqJsonLd`, прод-проба
  маркера `data-seo-jsonld="travel-faq"`, guard `lead-noise` в `seo:audit`,
  unit на полный текст статьи в шелле (`SSG_ARTICLE_BODY_MAX_CHARS`, `#1324`).
- **Решение для новой жалобы:** пропала разметка из тела статьи — `reopen #1138`;
  мусор в сниппете — сначала прогнать `seo:audit` и смотреть `lead-noise`/`weak-lead`,
  затем `create-linked` к `#1139`; текст статьи в HTML обрывается на середине —
  `reopen #1324`; другой тип страницы — `create-linked`.
- **Замечание про замеры (2026-08-08):** сравнивать текст статьи с прод-HTML
  только после снятия тегов с обеих сторон. Проба «фраза из API ищется в сыром
  HTML» даёт ложные пропуски на каждой ссылке внутри предложения — первый прогон
  так показал 61 % медианного покрытия вместо фактических 100 %.
- **Замечание про замеры:** сравнивать слова заголовка и лида только по стеммам
  (`KEYWORD_STEM_LEN`). Точное сравнение слов в русском даёт кратное завышение —
  так «23 off-topic статьи» оказались фактическими 2.
- **Последняя проверка:** `#1138`/`#1139`/`#1140` — 2026-07-29; `#1324` —
  2026-08-08, генерация на копии `dist/prod`: Mont Blanc 17 % → 100 %, Витебск
  35 % → 100 %, Влёра → 100 %, медиана веса страницы 238 → 241 КБ.

### SEO-OPS-001 — отчётный инструмент обязан отличать «нет данных» от «нет проблем»

- **Инвариант (структурный, `#1391`):** SEO-скрипт с побочным эффектом наружу —
  подача в поисковики, запись в очередь, отчёт о состоянии — обязан требовать
  явного режима и обязан падать ненулевым кодом на неподдержанном или пустом
  входе; разрешающего дефолта у него нет.
- **Инвариант (исходный):** SEO-мониторинг либо меряет реальную выборку, либо
  падает; пустой результат никогда не выглядит как зелёный отчёт.
- **Surface/owner:** SEO-ops-скрипты (`scripts/index-status.js`,
  `scripts/seo-audit.js`, `scripts/test-seo-prod.js`, рутина `seo-daily`).
- **Цепочка:** ежедневный прод-гейт выдачи `#1107`, ложно-зелёный монитор
  индексации `#1325`, молчаливая подача всего сайта `#1389`, протухший адрес в
  очереди `#1390`; структурный ответ на рецидивы — `#1391`; формат записи файла
  обратно в репозиторий — `#1407`.
- **Структурный контроль (2026-08-10, `#1391`):** разбор аргументов всех 13
  SEO-CLI сведён в `scripts/lib/seo-cli-contract.js` (`parseCliArgs` — неизвестный
  или опечатанный флаг даёт `UsageError` и код `2`, объявленный режим обязателен,
  флаг со значением не проглатывает следующий флаг, целые читаются только как
  цифры, чтобы `Number('1e3')` не превращал опечатку в другой набор;
  `requireNonEmptySelection` — пустая выборка даёт ненулевой код; `runSeoCli` —
  единый контракт кодов выхода), а `npm run guard:seo-cli-contract` в
  `governance:verify` роняет CI, если файл под `scripts/` (кроме `scripts/lib/`)
  с именем `seo-*.js`, `indexnow-*.js`, `index-status.js`, `test-seo-prod.js` или
  `post-deploy-seo-check.js` парсит аргументы мимо контракта, ищет флаг через
  `includes`/`indexOf`/`case`/сравнение с литералом или выходит нулём явно.
  Покрытие обходится по файловой системе на любую глубину, allowlist'а нет:
  новый или перенесённый в подпапку скрипт семейства попадает под guard сам, а
  нулевая выборка самого guard'а — тоже провал, иначе он повторил бы ровно ту
  форму, которую запрещает. Прецедент из этого же реестра: карта с постоянным
  guard'ом дала четырёхкратное падение потока тикетов, медиа без guard'а —
  нулевое.
- **Достройка контроля (2026-08-12, `#1398`):** guard объявлял три правила, а
  обеспечивал два — «пустая выборка даёт ненулевой код» держалось на запрете
  явного нулевого выхода, поэтому скрипт, который просто `return`ится над пустым
  списком, проходил и завершался нулём. Теперь покрытый скрипт объявляет в
  `CLI_SPEC` поле `selection`: строка с тем, что он выбирает, или `'none'` для
  работы по одному названному id (`seo-edit`, `seo-apply-one`). Отсутствующая или
  пустая декларация — провал; объявленная выборка обязана звать
  `requireNonEmptySelection`; `'none'` рядом с флагом множества (`--all`, `--ids`,
  `--limit`, `--map-file`, `--urls-file`) — провал как протухшая декларация.
  Декларация выбрана вместо вывода признака из кода сознательно: эвристика при
  сомнении вынуждена отвечать «наверное, всё в порядке», а это и есть
  разрешающий дефолт семейства; условность правила читается из того, что скрипт
  сам о себе написал, и все три ветки fail-closed. Тогда же закрыт общий для всех
  правил обход: needle удовлетворялся упоминанием в хвостовом комментарии, а
  запрет по той же причине давал ложное срабатывание — теперь хвостовые
  комментарии срезаются, но `//` внутри строки остаётся частью строки.
- **Урок о самом guard'е (2026-08-17, `#1398`):** три ревью подряд находили в нём
  обходы одного вида — упоминание принималось за вызов, посторонний объект за
  декларацию, — и причина оказалась не в правилах, а в том, что файл читали три
  самописных сканера, по-разному решавших, где кончается литерал. Пока их было
  три, каждая заплатка закрывала одну форму и оставляла соседнюю: `selection`
  внутри строки, `requireNonEmptySelection(` в многострочном USAGE-шаблоне (а его
  так пишут все 13 скриптов), локальный `const CLI_SPEC` в теле функции. Сканер
  сведён в один: он замещает не-код пробелами символ в символ, поэтому номера
  строк не съезжают, и отдаёт два чтения — с литералами для правил о значениях и
  без них для правила о вызове; `${…}` остаётся кодом. Общий вывод для правил
  этого семейства: правило настолько же надёжно, насколько надёжен разбор,
  которым оно читает файл, и дублирование разбора — это и есть дыра, а не стиль.
- **Живые дефекты, найденные при консолидации (2026-08-10):** восемь `seo-*.js`
  искали флаг через ``args.indexOf(`--${name}`)``, поэтому `--limt 5` молча шёл в
  дефолт и аудит охватывал все 306 статей; `test-seo-prod.js --ur https://dev…`
  проверял ПРОД вместо dev по той же причине; `seo-fix-links.js` без единого
  аргумента переписывал тела всех опубликованных статей автора; `--restore <id>
  --dry-run` в `seo-rename.js` и `seo-fix-links.js` глотал репетицию и писал
  по-настоящему; `seo-fix-links.js` на пустом манифесте выходил кодом 0.
- **Вариант на запись (2026-08-10, `#1389`):** первые два случая — чтение, третий —
  запись. `indexnow-submit.js` проверял флаги через `argv.includes`, поэтому любой
  неизвестный или опечатанный аргумент проваливался в ветку по умолчанию, а ветка
  по умолчанию подавала весь сайт: `node scripts/indexnow-submit.js --help`
  отправил 544 URL. Контроль: режим (`--all` / `--sitemap` / `--urls-file`) стал
  обязательным и явным, неизвестный аргумент даёт usage и код `2` без единой
  подачи.
- **Вариант на вход (2026-08-10, `#1390`):** предыдущие случаи — про аргументы и
  про пустую выборку, этот — про непроверенные данные на входе. Очередь подачи
  `scripts/seo-index-queue.json` составлена снимком URL Inspection, а статьи
  переименовываются и после: 4 записи из 103 уже отдавали 301, и нашёл их человек
  curl'ом при полной подаче. Подать такой адрес нельзя (поисковик проиндексирует
  цель переезда), а в знаменателе доли он сидит вечно — конвейер подачи потреблял
  выход механизма переименований (`SEO-SSR-001`) и не проверял его.
  **Постоянный control:** `npm run seo:queue` (`scripts/seo-index-queue-check.js`)
  спрашивает у прода статус каждого адреса очереди (HEAD, тело не тянется) перед
  подачей и перед подсчётом доли: 3xx чинится `npm run seo:queue:fix` (запись
  переписывается на цель, старый слаг → `renamedFrom`, дата → `staleRedirectFixedAt`),
  404/5xx отбраковывается, любой оставшийся не-200 даёт код 1, а из знаменателя
  доли такие адреса исключаются поимённо. Пачка выдаётся на подачу только целиком
  живой: `--batch <n> --out batch.txt` создаёт файл лишь при всех 200.
  **Грань инварианта, найденная код-ревью:** отказ обязан быть во всех режимах
  вывода, а не только в человекочитаемом. В первой редакции гейта грязная пачка
  честно не выдавалась текстом, но `--json` всё равно отдавал полный список
  адресов вместе с не-200 — машиночитаемый потребитель получал ровно то, что
  человеку уже запретили. Это тот же класс, что `#1389`: широкое действие
  осталось доступно через ту дверь, которую при починке не проверили.
- **Вариант на формат записи (2026-08-11, `#1407`):** прежние случаи — про
  аргументы, пустую выборку и непроверенный вход; этот — про то, как инструмент
  кладёт файл обратно. `writeQueue` в `scripts/seo-index-queue-check.js` писал
  `JSON.stringify(queue, null, 2)` без завершающего перевода строки, хотя
  комментарий прямо над строкой заявлял, что файл перезаписывается «тем же
  двухпробельным JSON, каким лежит в репозитории». Первый же `--fix` подмешал бы
  к содержательной правке однобайтовый хвостовой diff. **Почему дожило:**
  сквозной тест на `--fix` существовал и гонял настоящий CLI, но сравнивал
  результат через `JSON.parse` — к байтам он слеп по построению, а Done gate
  `#1390` проверял поля после автоправки, не хвост файла. **Control:** тест
  сравнивает сырые байты с канонической сериализацией
  (`JSON.stringify(JSON.parse(raw), null, 2) + '\n'`), а не наличие `\n`, и
  проверен откатом фикса — без него падает. **Масштаб считается отдельно от
  факта, и первая попытка его посчитать была неверной.** Из 47 мест записи JSON
  в `scripts/` без завершающей строки пишут 39, и разделяет их не форма кода, а
  один вопрос: лежит ли файл-адресат в самом репозитории. По семье SEO-CLI
  дефект действительно ровно один — остальные пишут в бэкапы с таймстемпом,
  отчёты прогонов, `--json-out` и lock-файлы, то есть мимо git. Но обобщение
  этого вывода на весь `scripts/` было ложным и его снял код-ревью: тот же
  дефект жил в `analyze-bundle.js:114` и `analyze_bundle.py:161`, которые писали
  git-tracked `BASELINE_METRICS.json` (лежал с завершающей строкой) — оба
  писателя того же файла её теряли, оба починены здесь же. Ни файла, ни обоих
  писателей больше нет: пара разобрана в `#1408`, остаток удалён в `#1409`. **Урок про метод:**
  проверять надо адресат записи, а не каталог скрипта — счёт «tracked-файлов
  под `scripts/`» пропустил `../BASELINE_METRICS.json` в корне репозитория
  ровно потому, что смотрел не туда. Обратная ошибка тоже была: соседние
  `*-points.json` действительно самосогласованы, но не все — `minsk-guide-points.json`
  лежит С завершающей строкой; дефекта там нет только потому, что писателя у
  него вообще нет. **Переучёт правильным методом (от файла, а не от скрипта):**
  из 90 tracked `.json` завершающую строку имеют 77, писатель есть у семи —
  `BASELINE_METRICS.json` (на тот момент два писателя, js и py, оба теряли; py
  удалён в `#1408`, а сам артефакт вместе с оставшимся писателем — в `#1409`),
  `seo-index-queue.json`
  (терял), `config/bundle-budget.json`, `touch-targets-baseline.json`,
  `type-debt-baseline.json`, `seo-redirects.json` (эти четыре уже писали
  корректно) и `app.json` (`scripts/ios-build.sh:96` пишет через `jq`, а тот сам
  ставит завершающую строку — дефекта нет; в первой редакции этого пункта файл
  был пропущен). Сломанных писателей было три, все три починены; остальные
  упоминания этих файлов в скриптах — чтение.
- **Хвост того же разбора: у файла не должно быть двух писателей
  (2026-08-11, `#1408`):** починив завершающую строку в обоих писателях
  `BASELINE_METRICS.json`, мы тем самым узаконили саму пару. А пара была не
  безобидной: `scripts/analyze_bundle.py` не был подключён ни к одному
  npm-скрипту и при этом писал в те же поля другие числа — читал только
  `dependencies`, поэтому `devDependencies` терялись целиком (`total` 78 вместо
  120, `dev` всегда 0), а `timestamp` шёл локальным временем вместо UTC. То есть
  случайный запуск мёртвого скрипта тихо портил бы метрики, по которым потом
  сравнивают бандл. Питоновский вариант удалён, у файла остался один писатель.
  **Обобщение:** «оба писателя починены» — это не решение, а признак того, что
  владелец файла не определён; правильный вопрос не «одинаково ли они пишут», а
  «почему их два». Продолжение — следующий пункт: правильный ответ оказался
  «ни один».
- **Три шага починки того, что надо было удалить (2026-08-12, `#1409`):**
  следующий вопрос после «почему писателей два» — «а кто это читает». У
  `BASELINE_METRICS.json` читателей не было ни одного: ни кода, ни CI, ни
  парсинга stdout. Дальше выяснилось, что и писать было нечего — веса
  «тяжёлых зависимостей» в `scripts/analyze-bundle.js` были захардкожены, поля
  `estimatedMinified`/`estimatedGzipped` были строковыми литералами, а раздел
  «крупные файлы» печатал пустоту: обход каталогов был нерекурсивным, а в
  `components/` на верхнем уровне 0 файлов при 986 вложенных. Настоящий механизм
  всё это время работал рядом: `scripts/guard-bundle-budget.js` +
  `config/bundle-budget.json` меряют собранные чанки в raw/gzip/Brotli, держат
  потолки запросов по маршрутам (`#1286`, `#1372`, `#1393`) и запускаются
  принудительно в `release:check`. Артефакт, его писатель и гард единственного
  писателя из `#1408` удалены; `perf:bundle`, `check-performance.sh` и оба
  `metravel-performance-analyst/SKILL.md` переведены на настоящий механизм.
  **Урок про порядок вопросов:** `#1407` чинил формат записи, `#1408` — владельца
  записи, и только `#1409` спросил, нужна ли запись вообще. Два раунда аккуратной
  починки ушли на файл, который следовало удалить; вопрос «кто это читает»
  стоило задать первым, до того как чинить, — он дешевле любого из этих раундов.
- **Известное расхождение без инцидента (2026-08-10):** «сходить на прод и узнать
  статус адреса» реализовано в семействе минимум семь раз, и каждая реализация
  по-своему отвечает на вопросы «сколько хопов», «что если `Location`
  относительный», «что если 3xx без `Location`»: `report-travel-404.js:315`,
  `seo-index-queue-check.js` (единственная, кто читает `Location` и ходит по
  цепочке), `post-deploy-seo-check.js:91`, `post-deploy-media-check.js:201`,
  `lib/fetchJson.js:39`, `test-seo-prod.js:86`. Инцидента от этого пока не было —
  расхождение найдено чтением, а не поломкой, поэтому карточка не заводится:
  структурная задача без evidence и есть то дробление, от которого защищает
  правило. Запись существует, чтобы первый же реальный сбой на хопах сразу
  становился структурным, а не очередным точечным фиксом; консолидацию делать
  тем же приёмом, что `seo-cli-contract.js` в `#1391`. Решение согласовано
  владельцами `#1390` и `#1391` 2026-08-10.
- **Подтверждённая причина (2026-08-08):** `index-status.js` читал список статей
  как `res.data || res.items || res.rows`, тогда как `/api/travels/` отдаёт
  `{count, next, results}`. Список выходил пустым, отчёт печатал «Всего
  проверено: 0» и завершался кодом 0. За время молчания индексация ушла с
  291/306 до 203/306, и монитор этого не показал.
- **Controls:** `pickListRows` с приоритетом `results` и unit на все формы
  конверта; ненулевой выход при пустом списке; тот же разбор конверта в
  `seo-audit.js` (там `results` был изначально — поэтому контентный аудит
  работал, а монитор нет).
- **Решение для новой жалобы:** SEO-скрипт отчитался «0 проблем» — сперва
  проверить, сколько объектов он реально взял; если ноль, это `reopen #1325`
  либо `create-linked` для другого скрипта. Родственная семья по духу —
  `BUILD-CATALOG-001` (там `catch → exit 0` в билде).
- **Замечание про замеры:** URL Inspection отвечает ~22 с на URL — последовательный
  прогон 306 статей идёт около двух часов; полный срез снимать параллелью
  (8 потоков ≈ 15 мин при квотах 2000/день и 600/мин).
- **Последняя проверка:** 2026-08-08 — `stats:index --limit 5` берёт 5 статей и
  даёт реальные coverageState; несуществующий автор роняет прогон с внятным
  сообщением вместо зелёного отчёта.

### BUILD-CATALOG-001 — build-time catalog fetch must fail loudly

- **Инвариант:** production build либо содержит полный статический слой каждого
  контент-типа (travels, quests, city landings, travel quest promos), либо
  падает до rsync; частичный или пустой слой на прод не уезжает.
- **Surface/owner:** frontend build pipeline (`scripts/generate-seo-pages.js`,
  `build-prod.sh`, `scripts/build-web-prod.js`) + доступность production API в
  момент сборки.
- **Цепочка:** инцидент 2026-07-28 при прод-деплое; problem-memory verdict
  `create-new`. Board-карточку завести не удалось — MCP task board в той сессии
  не поднимался (`.mcp.json` ведёт на несуществующий
  `/Users/juliasavran/Sites/metravel2/...`, локального checkout бэкенда нет), а
  write через прямой `curl` запрещён. Временный fallback-черновик с полным Task
  Contract и board payload: `tasks/1137-quest-seo-build-catalog-guard.md` —
  после подъёма борда создать карточку, вписать сюда её id и удалить черновик.
- **Подтверждённая причина:** транзиентный `HTTP 502` на `/api/quests/?page=7`
  ронял весь quest-блок генератора (`catch` → `console.error` → exit 0), а
  Done gate проверял только travel-страницы. Билд без 137 quest-страниц, 137
  alias-копий и 190 city-лендингов считался успешным.
- **Controls:** retry с backoff на транзиентные ответы
  (`scripts/lib/fetchJson.js`), фатальный выход генератора при недоступном
  quest/travel каталоге и при нулевом числе quest-бандлов,
  `scripts/verify-static-quest-seo.js` в обоих build-флоу (страницы, алиасы,
  лендинги с crawlable-секцией, ненулевое travel promo coverage).
- **Решение для новой жалобы:** целый статический слой отсутствует после
  «успешного» билда — `reopen`; тот же паттерн на другом слое (например
  `article`) — `create-linked`.
- **Последняя проверка:** 2026-07-28, smoke против прод-API: retry
  восстанавливает каталог, гейт валит пустой/битый dist, генератор выходит с
  кодом 1 при недоступном каталоге.

### QUEST-ALIAS-001 — alias-лендинг адресует город, а не city_id

- **Инвариант:** `/quests/<alias>` перечисляет квесты ВСЕХ `city_id`, которые
  сводятся к этому alias. Ни одна запись лендинга не имеет права затирать
  другую: число записей = число различных путей.
- **Surface/owner:** frontend SSG (`scripts/generate-seo-pages.js`,
  `utils/questCityAlias.js`) + качество справочника городов в API.
- **Цепочка:** найдено 2026-07-29 при разборе расхождения «187 проверено против
  190 сгенерировано» в логе прод-сборки; см. [`BUILD-CATALOG-001`](#build-catalog-001--build-time-catalog-fetch-must-fail-loudly).
- **Подтверждённая причина:** каталог отдаёт один город под несколькими
  `city_id` (Гомель 19 и 92, Гродно 11 и 91, Могилёв 14 и 93). Оба получают один
  alias, лендинг писался в цикле по городам, и вторая запись молча затирала
  первую. На проде `/quests/gomel` показывал 3 квеста из 6, `/quests/grodno` 3 из
  5, `/quests/mogilev` 3 из 4 — при том, что numeric-лендинги обоих `city_id`
  канонизируются именно на эту страницу, то есть выпавшие квесты теряли и
  внутреннюю ссылку, и место в канонической группе.
- **Controls:** `mergeQuestCityLandingsByAlias()` собирает alias-лендинг из
  объединения городов; `scripts/verify-static-quest-seo.js` требует, чтобы
  alias-лендинг ссылался на каждый квест всех своих `city_id`, иначе сборка
  падает до rsync.
- **Решение для новой жалобы:** неполный список квестов на городской посадочной
  — `reopen`; тот же класс «сегмент URL адресует сущность шире, чем ключ
  генерации» на другом слое — `create-linked`.
- **Осталось на бэкенде:** дубли городов в справочнике (`area=back`) — фронт их
  только переживает, но не устраняет.
- **Последняя проверка:** 2026-07-29, против живого каталога: 6/5/4 квеста
  вместо 3/3/3, 0 из 92 alias-лендингов нарушают инвариант, гвард роняет сборку
  на старом last-write-wins выводе.

### QUEST-HINT-LEAK-001 — подсказка выдаёт ответ вместо направления взгляда

- **Инвариант:** правило авторинга 4a
  (`.claude/skills/metravel-quest/SKILL.md`) — `hint` говорит, КУДА и КАК
  смотреть, но не содержит принимаемый ответ, его синоним, его половину, точное
  число/диапазон ответа и не выдаёт ответ методом исключения. Подсказка
  открывается после двух неверных попыток и должна помочь додумать, а не
  засчитать шаг игроку, который на объект даже не посмотрел.
- **Surface/owner:** контент квестов (`quest_steps.hint` против
  `quest_steps.answer_pattern.value`), редакционная территория владельца.
- **Цепочка:** #1190 (правило введено, целевого прогона по `hint` не делала) →
  #1445 (семантический класс, 4 шага: 205, 1272, 278, 195) → #1447
  (буквальный класс, 3 шага: 677 `8-rotunda`, 1168 `5-ankeruhr`, 1224
  `3-fort`, плюс постоянный контроль).
- **Подтверждённая причина:** правило было, контроля не было. Три прохода
  подряд проверяли 4a глазами по одному квесту за раз, а пара «текст `hint` ×
  значения `answer_pattern.value`» на всей базе не сверялась ни разу. Механика
  засчитывания ответа при этом исправна — `normalize()` + `exact_any`
  отрабатывают штатно, дефект целиком в тексте.
- **Два разных класса, не путать.** *Буквальный*: ответ стоит в подсказке
  словом или словоформой («перед **вал**ом», «по **круг**у», «как **переход**
  поверху»). Ловится механически. *Семантический*: подсказка пересказывает
  ответ определением, не совпадая с ним ни одной буквой («что соединяет два
  берега» → мост). Не ловится ничем, кроме вычитки.
- **Controls:** `node scripts/scan-quest-hint-leak.js` — сверяет каждое
  значение `answer_pattern.value` (и весь диапазон `range`) как подстроку в
  `hint` по всей базе прода, по одному квесту (`--quest-id=`) или по локальному
  `scripts/<city>-quest-data.js` ДО заливки (`--source=`); exit 1 при находке.
  Порог совпадения — 3 символа: на 912 шагах с непустым `hint` он даёт ноль
  ложных срабатываний и находит все три известных кейса. Опциональный
  `--fields=hint,story,title` шумит закономерно (шаг «Кривая башня» с вопросом
  про название башни) и в gate не входит.
- **Открытый риск.** Скан закрывает ТОЛЬКО буквальный класс. Семантический
  остаётся открытым риском неизвестного объёма: сколько подсказок на базе
  пересказывают ответ определением — не измерено, сплошного прогона не было.
  Отдельно замечено на #1447: шаг 677 принимает ответ `ротонда`, который стоит
  в собственном `title` шага («Ротонда Святого Георгия»), то есть утечка того
  же семейства через соседнее поле — правка hint её не снимает. Соседних полей
  как минимум три: `title`, `story` и `location` — последнее печатается на
  карточке шага строкой над заданием (#1453).
- **Решение для новой жалобы:** «ответ виден прямо в подсказке» с буквальным
  совпадением — `reuse` этой записи и правка через
  `scripts/apply-quest-patches.js` с обязательной синхронизацией локального
  `scripts/*-quest-data.js` (иначе следующая перезаливка квеста вернёт старый
  текст); подсказка-определение без совпадения слова — `create-linked` с явным
  указанием, что скан этот класс не ловит; ответ верный, но устарел на
  объекте — это QUEST-CONTENT-ROT-001, а не эта семья.
- **Последняя проверка:** 2026-08-17 — три шага переписаны и подтверждены
  `GET /api/quest-steps/<id>/`; скан по всему проду (139 квестов, 1160 шагов)
  даёт ноль буквальных утечек.

### QUEST-ANSWER-UNREACHABLE-001 — вариант закрытого словаря `exact_any` нельзя набрать

- **Инвариант:** каждый элемент закрытого словаря `exact_any` обязан быть
  достижим после `normalize()`, быть единственным в своём словаре и состоять из
  букв одного алфавита. `buildAnswerChecker` (`utils/questAdapters.ts`)
  сравнивает ввод со словарём строго на равенство — без стемминга и морфологии,
  поэтому форма, которую игрок физически не может набрать, не сработает никогда.
- **Surface/owner:** контент квестов (`quest_steps.answer_pattern.value`),
  редакционная территория владельца; механика сравнения — фронтенд.
- **Цепочка:** аудит прода 06.08.2026 (161 недостижимый вариант в 93 шагах, из
  них 63 — единственная форма ответа на шаге; зафиксирован комментарием над
  `case 'exact_any'`) → #1446 (шаг 882 `vyaloe-tyshkevich-curse`, белорусский
  вариант записан украинской формой «цегла») → #1450 (постоянный контроль).
- **Подтверждённая причина:** правило «каждый вариант достижим» существовало
  только в голове автора. Рантайм закрыл катастрофический подкласс — словарь с
  `"-"` принимал бы любой ввод, поэтому пустые после нормализации варианты
  выбрасываются при сборке чекера, — но это защита, а не обнаружение: автор
  по-прежнему видит вариант в словаре и считает, что он принимается.
- **Четыре разных класса, не путать.** *Механический*: вариант пуст после
  нормализации, дублирует другой вариант того же словаря или смешивает алфавиты
  внутри одного слова («гадзiннiк» с латинской `i`, «zwykłы» с кириллической
  `ы`). Ловится сканом. *Падежный*: словарь достижим, но весь в именительном
  падеже, а вопрос ставит ответ в родительный («Какого она цвета?» → игрок
  вводит `коричневого`). Ловится сканом только для этого шаблона вопроса —
  правило узкое намеренно: «из какого материала» тоже начинается с «какого», но
  естественный ответ там существительное. *Лексический*: буквы алфавита верные,
  а словоформа — из чужого языка («цегла» uk вместо «цэгла» be в #1446, «сухій»
  uk вместо «сухі» be в `luninets-railway/3-suhoj`). Не ловится ничем, кроме
  словаря языка или носителя. *Семантический*: словарь достижим, но не
  покрывает естественную формулировку игрока. Не ловится ничем, кроме телеметрии
  отказов (`quest_answer_attempt`) и вычитки.
- **Controls:** `node scripts/scan-quest-answer-reachability.js` — гоняет каждый
  словарь `exact_any` через ту же нормализацию, что и рантайм, по всей базе
  прода, по одному квесту (`--quest-id=`) или по локальному
  `scripts/<city>-quest-data.js` ДО заливки (`--source=`). Blocker (exit 1):
  `dictionary_unusable`, `empty_after_normalize`, `mixed_script`,
  `step_unreachable`; warning (exit 1 только с `--strict`): `duplicate_raw`,
  `duplicate_normalized` (избыточная запись) и `case_form_gap` (шаг проходим, но
  игрок платит за него лишними отказами). Изменённые `scripts/*-quest-data.js`
  и `scripts/*-quests-data.js` сканируются автоматически в `npm run check:fast`
  против `scripts/quest-answer-reachability-baseline.json`: гейт падает на том,
  что принесла правка, а уже лежавшие в файле находки (130 в 59 файлах на
  2026-08-18) перечислены в baseline и чинятся отдельно, иначе правка одной
  строки краснела бы из-за чужого контента. Пополняется baseline только явно —
  `npm run quest:scan-answer-reachability:baseline`. Прод-свип сетевой (~140
  запросов) и в gate не входит. Паритет нормализации с
  `utils/questAdapters.normalize` держит
  `__tests__/scripts/scanQuestAnswerReachability.test.ts`: он сверяет и
  поведение на корпусе, и сам список преобразований, вырезанный из TS-исходника.
- **Открытый риск.** Скан закрывает механический класс целиком, а падежный —
  только для шаблона «какого … цвета». Лексический и семантический остаются
  открытыми: их объём на базе не измерен, сплошного прогона не было. Падежный
  класс заведомо шире пойманного шаблона — «какого/какой …» спрашивают 150
  шагов, — но широкое правило даёт 65 срабатываний, и просмотренные примеры
  («Из какого материала сложены стены?» со словарём `кирпич`/`кирпичный`)
  ложные: естественный ответ там существительное, и родительный падеж от него не
  требуется. Поэтому правило сужено до вопроса о цвете, где ответ обязан
  согласоваться.
- **Отдельно про дубли.** Их на проде много (102 `duplicate_normalized`, 5
  `duplicate_raw` на 5244 вариантах) и почти все безвредны («орёл»/«орел»),
  поэтому дубль не blocker. Но именно дубль прячет опечатку, когда автор метил
  во вторую языковую форму, а записал копию первой.
- **Решение для новой жалобы:** «ввёл верный ответ, не засчитало» с формой,
  которую нельзя набрать, — `reuse` этой записи и правка через
  `scripts/apply-quest-patches.js` с обязательной синхронизацией локального
  `scripts/*-quest-data.js`; ответ верный, но устарел на объекте — это
  QUEST-CONTENT-ROT-001; ответ виден в подсказке — QUEST-HINT-LEAK-001.
- **Последняя проверка:** 2026-08-18 после правки #1455 — скан по всему проду
  (145 квестов, 665 шагов `exact_any`, 5661 вариант) даёт **ноль blocker'ов**:
  класс `mixed_script` пуст, непроходимых шагов нет. Остаются 113
  `duplicate_normalized`, 5 `duplicate_raw` и 5 `case_form_gap` (шаги 119, 371,
  416, 930, 1212) — все warning. Контроль на здоровой позиции: из 21 шага с
  вопросом «какого … цвета» 15 родительный падеж уже держат, починенный шаг 791
  `yelnya-bog-bells` находок не даёт, а дефисные формы вида «SPA-центр» подменой
  не считаются — `normalize()` дефис срезает, игрок нет.
- **Как чинился класс `mixed_script` (#1455).** Прогон 2026-08-18 до правки (142
  квеста, 649 шагов, 5484 варианта) дал 6 blocker'ов — шаги 130 `grodno-royal`,
  147 `mogilev-stargazer`, 520 `amsterdam-on-piles`, 647 `belgrade-white-city`,
  1313 `lodz-murals`, 1379 `bratislava-coronation-crown`. Правка развалилась на
  два разных исхода, и это главный вывод карточки: **выравнивание алфавита
  осмысленно только там, где однородной формы в словаре ещё нет.** На шагах 130
  («гадзiннiк» → «гадзіннік»), 147 («могiслаў» → «могіслаў») и 1379 («делova
  gula» → `delová guľa`) правка добавила игроку новую вводимую национальную
  форму. На шагах 520 («четырe» при живом «четыре»), 647 («три шеšира» при живых
  «три шешира» и `tri šešira`) и 1313 («zwykłы» при живом «zwykły»)
  выравнивание дало бы дословный дубль соседнего варианта — там мёртвая запись
  снята, ни одна вводимая форма не потеряна. Шагу 1379 вместе со словацким
  `delová guľa` добавлена бездиакритическая форма `delova gula`. Это НЕ снятие
  непроходимости: шаг проходим и был проходим — в том же словаре лежат «ядро» и
  плоское `gula`. Недостижима сама по себе именно диакритическая форма:
  `normalize()` диакритику НЕ срезает, поэтому вариант с `ľ`/`á` вводим только
  со словацкой раскладки. Отсюда правило — диакритический национальный вариант
  всегда заводить парой с плоским, иначе он ложится в словарь мёртвым для всех,
  у кого нет нужной раскладки.
- **Доказательство правки.** Прод сверен `GET /api/quests/by-quest-id/{id}/` по
  всем шести квестам, локальные `scripts/*-quest-data.js` синхронизированы (иначе
  перезаливка вернула бы смешанный текст), baseline перегенерирован — 130 → 124
  находки, ушли ровно шесть строк `mixed_script`. Рантайм зафиксирован тестом
  `__tests__/scripts/scanQuestAnswerReachability.test.ts`: на прод-словаре шага
  130 ДО правки `buildAnswerChecker` отвергает белорусское «гадзіннік» (U+0456)
  и принимает только «гадзiннiк» с латинской `i` (U+0069), ПОСЛЕ правки —
  наоборот; пять остальных шагов проверены тем же чекером на своих формах.

### QUEST-VISIBLE-TEXT-MIXED-SCRIPT-001 — подменённая буква в тексте, который игрок читает

- **Инвариант:** слово в видимом игроку тексте шага (`story`, `task`, `hint`,
  `title`, `location`) набирается буквами одного алфавита целиком. Символы,
  неразличимые глазом, но разные по коду, — латинская `e` U+0065 против
  кириллической `е` U+0435, латинская `i` против белорусской `і` — внутри одного
  слова недопустимы.
- **Surface/owner:** контент квестов, поля текста шага; редакционная территория
  владельца. Поля рендерятся простым `<Text>` в
  `components/quests/questWizardStepCard.tsx` и ни в какой сверке ответа не
  участвуют.
- **Цепочка:** #1450 (скан-гард по словарям ответов) → #1455 (правка шести
  вариантов ответа, там же попутно найден этот слой и явно вынесен за scope) →
  #1464 (правка 13 слов текста + постоянный контроль).
- **Подтверждённая причина:** контроля на эту поверхность не существовало.
  `scan-quest-answer-reachability.js` смотрит только `answer_pattern` и только у
  шагов типа `exact_any`; видимый текст не сканировал никто, поэтому класс
  копился молча — первый же прогон дал 13 слов в 8 квестах разных волн контента
  (`pakocim-voices`, `porto-port-wine`, `dubrovnik-libertas` ×5,
  `belgrade-white-city` ×2, `sofia-serdica-underfoot`, `kazimierz-dolny-kogut`,
  `venice-lion-of-saint-mark`). Механизм появления самих символов не установлен:
  правдоподобно, что это автозамена раскладки при копировании или ручной набор
  национальной буквы не той клавиатурой, но вживую гипотеза не проверялась.
  Косвенно за неё говорит шаг 83 `pakocim-voices/1-herb`: слово `Dołęga` стоит в
  одном абзаце дважды, первый раз чистой латиницей, второй — с кириллическими
  `га`, то есть автор набрал одно и то же слово дважды и получил разные строки.
- **Controls:** `node scripts/scan-quest-mixed-script-text.js` — по всему проду,
  по одному квесту (`--quest-id=`), по локальному `scripts/<city>-quest-data.js`
  ДО заливки (`--source=`), по выбранным полям (`--fields=`). Подключён к
  `scripts/run-fast-scope-checks.js` рядом со сканом достижимости: гоняется на
  каждый изменённый `scripts/*-quest-data.js` в рамках `npm run check:fast`.
  **Baseline'а нет намеренно** — в отличие от QUEST-ANSWER-UNREACHABLE-001, где
  130 известных находок пришлось вынести в файл исключений, здесь #1464 вычистил
  все 13 находок до нуля, и порог поставлен нулевой: любое новое слово валит
  гейт сразу. Список исключений, в который нечего записать, только маскировал бы
  новые опечатки.
- **Общее определение с соседней семьёй.** `mixedScriptWords`/`confusableChars`
  вынесены в `scripts/lib/questScriptMixing.js` и используются обоими сканами.
  Это не косметика: разойдись копии регулярок хоть на один диапазон — и один
  скан начал бы отчитываться «чисто» о том, что другой считает дефектом.
  Паритет держит тест `__tests__/scripts/scanQuestMixedScriptText.test.ts`
  (блок «общее определение смешения» сравнивает сами функции по ссылке).
- **Популяция шагов шире, чем у словарного скана.** Скан достижимости пропускает
  `is_intro` и всё, что не `exact_any`, — вне словаря ему смотреть не на что.
  Видимый текст есть у КАЖДОГО шага при любом типе ответа, поэтому текстовый
  скан ходит по всем шагам, и подмешивать его находки в счётчики словарного было
  бы враньём обоими отчётами сразу. Ровно поэтому это отдельный скрипт, а не
  флаг существующего.
- **Открытый риск.** Скан ловит только МЕХАНИЧЕСКОЕ смешение алфавитов внутри
  слова. Не ловит и не может: опечатку внутри одного алфавита («предводетеля»),
  двуязычную запись из разных слов («кафе Bar», «SPA-центр» — они законны и
  специально не считаются находкой) и слово, написанное верным алфавитом, но
  формой чужого языка (тот же лексический класс, что открыт у
  QUEST-ANSWER-UNREACHABLE-001). Обычная вычитка текста этим сканом не
  заменяется.
- **Выбор написания — редакционный, а не механический.** Скан говорит «слово
  смешанное», но не говорит, каким алфавитом его писать. #1464 применил правило
  «слово следует алфавиту фразы, в которой стоит»: «площадь Луža» → «площадь
  Лужа», «Петко Momчилова» → «Петко Момчилова», а `Dołęга` осталось латинским
  `Dołęga`, потому что соседнее вхождение в том же абзаце — латинское имя
  собственное. Спорные случаи — транслитерация иноязычных топонимов
  («Собор Сé» → «Собор Се», «Пьетро да Салó» → «Пьетро да Сало»): правило даёт
  однозначный ответ, но владелец вправе выбрать латинское написание.
- **Отличие от соседних семей.** `QUEST-ANSWER-UNREACHABLE-001` — тот же
  механизм подменённого символа, но в словаре `exact_any`, со сверкой
  `buildAnswerChecker` и функциональным последствием «шаг непроходим для верного
  ввода»; здесь последствие косметическое, прохождение не страдает.
  `QUEST-HINT-LEAK-001` — тот же набор текстовых полей, но другой дефект:
  подсказка выдаёт ответ. `QUEST-CONTENT-ROT-001` — текст верен, но устарел на
  объекте.
- **Решение для новой жалобы:** «в тексте квеста опечатка, буква не та» —
  `reuse` этой записи, правка через `scripts/apply-quest-patches.js` с
  обязательной синхронизацией локального `scripts/*-quest-data.js`; поля
  `story`/`task`/`hint`/`location`/`title` разрешены в `ALLOWED` скрипта.
- **Последняя проверка:** 2026-08-18 после правки #1464 — прод-свип
  `scan-quest-mixed-script-text.js` по 146 квестам и 1237 шагам даёт ноль
  находок, свип по всем 140 локальным `scripts/*-quest-data.js` — ноль. Контроль
  на здоровой позиции: тот же скан по версиям файлов из `git show HEAD:` до
  правки честно возвращает exit 1 и находит 2 слова в `belgrade` и 5 в
  `dubrovnik` — скан ловит дефект, а не молчит на всём подряд.

### QUEST-CONTENT-ROT-001 — опубликованный эталон ответа устаревает вместе с объектом

- **Инвариант:** правильный ответ шага — это то, что игрок видит на месте
  сегодня. Признак, который у реального объекта может измениться после
  публикации (цвет, вывеска, состояние покрытия), не может быть единственной
  формой ответа в закрытом словаре `exact_any`.
- **Surface/owner:** контент квестов (`quest_steps.answer_pattern`, `task`,
  `hint`), редакционная территория владельца.
- **Цепочка:** найдено 2026-08-15 при разборе прохождения `quest_progress` 286
  агентом `quest-friction-analyst`; смежное по слою — класс F его механического
  аудита (выдуманная наблюдаемая деталь) и правила авторинга #1190.
- **Подтверждённая причина:** `mir-castle / church` спрашивал цвет куполов
  Троицкой церкви в Мире, словарь принимал синий/голубой/лазурный. Здание
  перекрашено: фото Wikimedia Commons 2014 — синие купола (совпадает с
  эталоном), фото 2023 — белые стены, тёмно-зелёные купола, золото. Игрок на
  месте 2026-08-15 шесть раз ввёл фактически верное (`золотой`, `зелёный`,
  `зелёный и золотой`, `желтые`), получил шесть отказов, прошёл только угадав
  устаревший `синий` и бросил квест на следующем шаге. Это самый отклоняемый шаг
  во всей телеметрии `quest_answer_attempt`. Механизм сверки исправен —
  контроль на здоровой позиции пройден: `normalize()` + `exact_any` отработали
  штатно, устарел сам эталон.
- **Отличие от класса F:** там наблюдаемой детали не существовало никогда
  (автор её выдумал); здесь деталь существовала и перестала быть верной из-за
  реального события после публикации. Разные причины — разные правки.
- **Масштаб:** 58 шагов базы построены на цвете, ~40 из них — закрытые словари
  с конкретным цветом. Ни один существующий инструмент (`quest-editor`,
  `quest-geo-verifier`, свип #1190) не сверяет признак объекта со свежими
  фотографиями, то есть контура, который должен был это ловить, не существует.
- **Controls:** пока отсутствуют. Метод верификации, доказавший себя на Мире —
  Commons geosearch по координатам шага + даты снимков, два независимых
  источника против одного устаревшего. Каноническая задача — #1431 (сплошная
  сверка 58 цветовых шагов); смежные находки того же разбора — #1428, #1429,
  #1430.
- **Решение для новой жалобы:** «игрок на месте назвал не то, что в словаре» на
  цветовом или ином изменяемом признаке — `reuse`; тот же класс на другом типе
  контента (описание маршрута, часы работы, наличие объекта) — `create-linked`;
  деталь, которой на объекте не было изначально — это класс F, а не рецидив.
- **Последняя проверка:** 2026-08-15 — точечный фикс `mir-castle / church`
  применён (шаг уведён с цвета на неперекрашиваемый признак), сплошная сверка
  остальных цветовых шагов не проводилась.

### QUEST-ANSWER-GRANULARITY-001 — шаг требует различения, которого игроку никто не дал

- **Инвариант:** принимаемый ответ шага обязан быть отличим от похожих теми
  средствами, которые есть у игрока на месте: сам объект, `task` и `hint`. Если
  подсказка одинаково верна и для принимаемого ответа, и для отклоняемых, шаг
  проверяет не наблюдательность, а экспертизу игрока.
- **Surface/owner:** контент квестов (`quest_steps.task`, `hint`,
  `answer_pattern`), редакционная территория владельца.
- **Цепочка:** найдено 2026-08-18 агентом `quest-friction-analyst` при разборе
  трения по прохождениям после 2026-08-15; каноническая задача — #1453.
- **Подтверждённая причина:** `vitebsk-kids-skazki / 1-ulichny-kloun` (шаг 993)
  спрашивает «На каком музыкальном инструменте он играет?» и принимает только
  `гармошка / гармонь / гармоника`. Подсказка — «Инструмент держат двумя руками
  и растягивают мехи» — одинаково верна для гармони, баяна и аккордеона, то есть
  не отбрасывает ни один из отклонённых ответов. Два независимых игрока
  промахнулись при открытой подсказке: сессия `3031e19c` 2026-08-11 ответила
  `скрипка` и ушла с первого шага навсегда; сессия `d2327dd9` 2026-08-17
  перебрала `баян` → `акардион` → `аккордеон` и взяла шаг четвёртой попыткой
  (`гармонь`), после чего бросила квест из 9 шагов на первом и через 37 минут
  открыла другой. Эталон при этом верен и сегодня: скульптура «Уличный клоун
  (Бродячий музыкант)», Витебск, пр-т Фрунзе 11, инструмент называется гармошкой
  (vitebsk.biz, vitebskcity.by — оба проверены 2026-08-18). Механика зачёта
  исправна: `exact_any` + `normalize()` отрабатывают штатно.
- **Отличие от соседних семей.** `QUEST-CONTENT-ROT-001`: там эталон устарел
  вместе с объектом, здесь эталон верен. Класс F механического аудита: там
  наблюдаемой детали не существовало, здесь она существует и названа правильно.
  `QUEST-HINT-LEAK-001`: то же поле `hint`, зеркальный дефект — там подсказка
  говорит слишком много и делает шаг кнопкой, здесь слишком мало и делает шаг
  лотереей. Недостижимый вариант словаря (#1450): там верная форма не может
  совпасть механически, здесь отклонённые ответы называют другую сущность и
  совпадать не должны — вопрос в самом требовании шага.
- **Масштаб:** не измерен. Механического признака у семьи нет: «подсказка не
  различает принимаемый ответ и похожие» — семантическое свойство, скан
  `scripts/scan-quest-hint-leak.js` его не видит (он ловит обратное — дословное
  совпадение). Косвенный сигнал в телеметрии — шаг, где отклонённые вводы лежат
  в одном смысловом семействе с принимаемым ответом (`баян`/`аккордеон` против
  `гармонь`), в отличие от разнородных ответов, которые означают «задание уводит
  не туда».
- **Controls:** отсутствуют. Единственный работающий контур сегодня — разбор
  трения по `quest_answer_attempt` постфактум.
- **Решение для новой жалобы:** «игрок назвал соседнюю сущность того же класса,
  а подсказка не помогает их развести» — `reuse`; «игрок назвал что-то из другой
  области» — это формулировка задания уводит не туда, `create-linked`; «ответ был
  верен, но устарел на объекте» — `QUEST-CONTENT-ROT-001`.
- **Замечено при починке #1453.** Смена вопроса на другую деталь объекта тянет
  за собой поля, которые эту деталь уже называют: у шага 993 подпись места была
  «Скульптура музыканта **с собакой**», и она рендерится на карточке шага
  (`components/quests/questWizardStepCard.tsx`), то есть новый вопрос про
  животное рядом с музыкантом получил бы готовый ответ строкой выше. Поэтому
  `location` добавлена в список правимых полей `scripts/apply-quest-patches.js`,
  а при выборе новой детали проверяются `location`, `title` и `story`, а не
  только `hint`.
- **Последняя проверка:** 2026-08-18 — правка применена. Владелец выбрал третий
  вариант (сменить вопрос, а не расширять словарь до семейства: расширение
  засчитывало бы фактически другой инструмент, что запрещено
  `docs/QUEST_ANSWER_INSIGHTS.md`, а названный в карточке признак «кнопки с
  обеих сторон» отличает гармонь от аккордеона, но не от баяна). Шаг 993 теперь
  спрашивает «Какое животное пританцовывает рядом с музыкантом?» со словарём
  `собака / собачка / пёс / песик / пудель / щенок`; деталь подтверждена теми же
  двумя источниками («рядом с ним — пританцовывающий пудель»). Подтверждено
  `GET /api/quest-steps/993/`, локальный `scripts/vitebsk-kids-quest-data.js`
  синхронизирован, сканы 4a и достижимости зелёные. Трение шага измеряется
  повторным `npm run quest:insights -- --quest vitebsk-kids-skazki --since 90d`
  через окно — механического гарда у семьи по-прежнему нет.

### QUEST-CONTENT-SOURCE-DRIFT-001 — снимок живого контента, оставленный в репозитории, откатывает прод

- **Инвариант:** живой контент квеста имеет один источник правды — прод. Файл в
  репозитории, повторяющий прод-контент, — это снимок на момент снятия, а не
  данные: он протухает при следующей правке прода. Инструмент записи не имеет
  права применять такой файл, а сам файл не имеет права лежать в репозитории под
  видом актуального.
- **Surface/owner:** инструменты контента квестов (`scripts/update-quest-content.js`,
  каталог снимков ревью), frontend-территория.
- **Цепочка:** найдено 2026-08-17 код-ревью #1445 (пункт P3 №3 находок), заведено
  #1448. Смежные: #1447 и #1445 — правки, которые снимки откатили бы; #1444 —
  тот же шаг `4-melnica`, но координата; #1431 — устаревание по другой причине.
- **Подтверждённая причина:** `scripts/update-quest-content.js` делал
  безусловный `PATCH /api/quest-steps/{id}/` по каждому `step_id` поданного
  файла, не сверяясь с продом, а `scripts/review/*.json` оставались в репозитории
  после применения и внешне не отличались от актуальных данных. Замер 2026-08-18
  против живого прода: из 33 снимков квестов 30 разошлись с продом, суммарно 436
  полей; ещё два файла (`32.json`, `37.json`) назывались DB-pk и не резолвились
  ни в один `quest_id`, то есть были неприменимы вообще. Головной пример
  подтверждён дословно: `scripts/review/torun-copernicus.json` (шаг `dom`) и
  `scripts/review/gdansk-amber.json` (шаг `mariacka`) держали подсказки вида
  «Красный, прямоугольный, обожжён в печи», то есть ровно те утечки ответа,
  которые #1445/#1447 уже убрали с прода. Контроль на здоровой позиции пройден:
  `brest-lantern.json`, `trakai-castle.json` и `vilnius-old-town.json` совпали с
  продом поле в поле — метод показывает конкретную рассинхронизацию, а не метит
  подряд весь каталог. Показателен и `minsk-loshitsa.json`: на момент заведения
  #1448 он был синхронен, через сутки разошёлся на 21 поле — снимок протухает
  сам, без чьей-либо ошибки.
- **Отличие от соседних семей:** `QUEST-CONTENT-ROT-001` — устарел эталон, потому
  что изменился реальный объект (перекрашенные купола); здесь прод верен, а
  устарела копия в репозитории, и вред наносится не игроку напрямую, а откатом
  прода на предыдущую редакцию. `QUEST-HINT-LEAK-001` — дефект самого текста;
  здесь текст на проде правильный, дефект в жизненном цикле файла. Общее с
  `BASELINE_METRICS.json` (#1407–#1409): у артефакта нет назначения после
  применения, поэтому он не должен лежать в репозитории.
- **Масштаб:** 35 tracked-снимков в `scripts/review/` + `scripts/minsk-quests-data.js`
  (третья копия трёх минских квестов, 85 расходящихся полей против прода; её
  единственный читатель `scripts/migrate-minsk-quests.js` — create-only, поэтому
  риск там условный и реализуется только при пересоздании квеста с нуля).
  Рабочие источники `scripts/*-quest-data.js` тем же свойством обладают частично
  (`minsk-loshitsa` — 11 полей, `minsk-traktorny` — 4), но это источники
  создания новых квестов, а не снимки применённых правок, и они остаются.
- **Controls:** #1448 — выбран жизненный цикл, а не сверка «до»: снимки не
  хранятся в репозитории. `scripts/.quest-review/` gitignored (тот же прецедент,
  что `scripts/.migrate-description-images/` из #1245);
  `scripts/update-quest-content.js` отказывается применять git-tracked data-файл
  и архивирует применённый снимок в `scripts/.quest-review/applied/`;
  `scripts/guard-quest-review-snapshots.js` (`npm run guard:quest-review-snapshots`,
  входит в `check:fast`) падает, если снимок снова окажется под git.
- **Решение для новой жалобы:** «применение файла из репозитория вернуло старый
  текст на прод» или «в репозитории лежит копия живого контента квеста» —
  `reuse`; «ответ был верен, но устарел на объекте» — `QUEST-CONTENT-ROT-001`;
  «подсказка пересказывает ответ» — `QUEST-HINT-LEAK-001`.
- **Последняя проверка:** 2026-08-18 — снимки удалены из репозитория, гвард
  зелёный, отказ инструмента на git-tracked файле проверен прогоном.

### ROUTE-BUNDLE-001 — eager-код маршрута это код, который маршруту нужен

- **Инвариант:** модуль едет тегом `<script>` только на тех маршрутах, которым
  он действительно нужен. «Общий» чанк — это дедупликация, а не разрешение
  грузить фичу там, где её нет.
- **Surface/owner:** frontend web bundle — `patches/@expo+metro-config+*.patch`
  (группировка shared-чанков по множеству владельцев), `metro.config.js`,
  `config/bundle-budget.json`, `scripts/guard-bundle-budget.js`.
- **Цепочка (восемь рецидивов):** `#765` (leaflet-вендор), `#764`/`#817` (вес
  entry и `__common` на travel-деталях), `#1148` (атрибуция `__common`), `#1178`
  (инструментарий `guard:eager-web:analyze`), `#1181`
  (`react-native-render-html`), `#1286` (route/shared-сплит и бюджет
  `eager.maxBrotliKB`), `#1372` (помаршрутный `eager.maxRequestsByRoute`),
  `#1393` (слой данных квестов и таблица контуров стран).
- **Подтверждённая причина:** Metro относит модуль к shared-чанку по множеству
  async-корней, из которых модуль достижим, и не спрашивает, нужен ли этот чанк
  маршруту. Достаточно ОДНОГО синхронного ребра из универсального узла — шапки,
  которая рендерится на каждом маршруте, — чтобы узкая фича стала стартовым
  кодом всего сайта. В `#1393` таким ребром были крошки:
  `CustomHeader` → `useBreadcrumbModel` → `useQuestsApi` → `questAdapters` →
  `geoCountry` → `geoCountryOutlines`, и таблица контуров стран (47 КБ raw)
  ехала на 960 из 967 маршрутов ради двух полей, `city_id` и `city_name`.
- **Почему прежние Done gate не удержали:** `#1286` и `#1372` меряют СУММУ
  (вес худшего маршрута и число его тегов). Дефект этого класса в сумму не
  попадает: `guard-bundle-budget` на сборке с ним был зелёный по обоим
  измерениям и сам чанк не видел.
- **Ловушка при починке:** разрез одного ребра НЕ является исправлением. Убрав
  только крошки (`#1393`, попытка №1), получили переразбивку графа: байты с
  неквестовых маршрутов ушли, но `travels/[param]` вырос 59 → 61 запрос, а
  `map.html` 40 → 42. Гипотеза «виновата новая граница `import()`» проверена и
  отвергнута — вариант с полностью статическими импортами дал те же 61 и 42.
  Оценивать раскладку обязательно по ОБОИМ измерениям сразу: brotli худшего
  маршрута И число запросов КАЖДОГО маршрута из `maxRequestsByRoute`.
- **Controls:**
  1. `__tests__/scripts/bundle-composition.test.ts` — `ROUTE_SCOPED_PAYLOADS`:
     синхронная достижимость payload'а от каждого маршрута в `app/`, allowlist
     маршрутов-владельцев, обязательное контрольное срабатывание
     (`mustReachFrom`), в сообщении печатается цепочка импортов. Работает по
     исходникам за секунду и падает ДО сборки.
  2. `scripts/guard-bundle-budget.js` — `eager.payloadRoutes`: атрибуция
     «payload → маршруты» по собранному `dist/prod`. Потолок `maxRoutes` плюс
     поимённый `mustNotLoad` (односторонний рэтчет по числу разрешил бы
     освободить главную и тем же числом нагрузить карту). Payload опознаётся по
     маркеру в собранном JS, а не по имени чанка: `__shared-N`
     перенумеровывается от сборки к сборке — в `#1393` один и тот же payload
     успел побывать `__shared-5`, `__shared-58` и `__shared-59`. Пропавший
     маркер, отсутствующий пиновый маршрут и выключенный разбор HTML — это
     провал гейта, а не молчание.
  3. `eager.maxRequestsByRoute` (`#1372`) с нулевым допуском.
- **Решение для новой жалобы:** узкий модуль снова на чужих маршрутах —
  `create-linked` к этой записи; тот же инвариант, но причина в другом слое
  (например, вендор через один синхронный импорт) — сперва
  `LAZY_ONLY_VENDORS` из `#1148`.
- **Последняя проверка:** 2026-08-10, две production-сборки подряд (`#1393`).
  Было: eager худшего маршрута 785,0 КБ brotli, `(tabs)/travels/[param].html` 59
  запросов, таблица контуров на 960 из 967 маршрутов. Стало: 758,4 КБ, 51
  запрос, 2 маршрута (обе HTML-копии `trips/plan/[id]` — законный партнёрский
  блок). Ни один маршрут из `maxRequestsByRoute` не вырос: `index` 36 → 35,
  `search` 32 → 30, `map` 40 → 39, `quests` 34 → 33. Разрез сделан тремя узлами
  сразу: крошки перестали импортировать `useQuestsApi` и читают сырой ответ
  `/quests/`; `QuestForCitySection` на web ушёл за платформенную пару
  `DeferredQuestForCitySection.web.tsx`; из `questAdapters` убран координатный
  фолбэк `getCountryCodeByCoords` (замер прод-API: `country_code` непустой у
  139 из 139 квестов). Промежуточный замер без третьего узла подтвердил
  ловушку: `map.html` тогда вырос 40 → 41.

### MOBILE-INSETS-001 — dock, keyboard and safe-area geometry

- **Инвариант:** primary CTA/content remains visible and tappable above app dock,
  browser chrome, keyboard and system insets on both mobile web and Android.
- **Surface/owner:** shared screen shells/layout primitives.
- **Цепочка examples:** `#130/#133`, `#508`, `#514`, `#792`, `#793`, `#796`,
  `#1038/#1039`, `#1061`, `#1069`, `#1072`.
- **Подтверждённая systemic cause:** screens repeatedly calculate padding,
  keyboard avoidance and dock geometry locally; a screen-specific fix protects
  one CTA but does not establish a shared shell invariant.
- **Controls:** shared shell/dock primitives where available, 44/48dp touch
  checks, paired mobile-web/Android screenshots and keyboard/device flows.
- **Решение для новой жалобы:** search this family first. Reuse an open shared
  shell task; create-linked only when the owning layout primitive differs.
- **Последняя проверка:** recurring family, no single canonical structural task.

### NATIVE-TEXT-ROW-001 — dynamic Text must have an explicit row sizing contract

- **Инвариант:** translated/user-generated `Text` рядом с другими children в
  React Native `flexDirection: 'row'` либо получает один positive-`flex` outlet,
  bounded width/whole-item wrapper, либо использует осознанный product
  ellipsis. Standalone `flexShrink` и `flex` сразу на нескольких competing
  labels не являются sizing contract: оба паттерна подтверждённо обрезались на
  Pixel; Android Yoga intrinsic width не имеет права молча обрезать текст.
- **Surface/owner:** shared React Native UI + Android governance; mobile web —
  обязательный parity control.
- **Цепочка:** `#672`, `#854`, `#1022`, `#1046`, `#1065`, `#1078`, свежий
  рецидив `#1342`; structural control — `#1344`.
- **Подтверждённая systemic cause:** каждый экран локально добавлял
  `flex`/`flexShrink` только после device finding. Web flex layout часто
  переносит ту же строку корректно и маскирует platform-specific Android/Yoga
  measurement; до `#1344` общего static/governance check для row + dynamic Text
  не было.
- **Controls:** `npm run guard:text-row-sizing` — TypeScript-AST guard для
  high-signal wrapping-row pattern с прямыми concurrent dynamic `Text`;
  positive/negative fixtures ловят исторический unsafe pattern `#1342`,
  принимают один positive-`flex` outlet, bounded direct wrapper, explicit
  product ellipsis и literal app label; standalone `flexShrink` и несколько
  competing `flex` labels остаются negative regressions. Translation lookup
  считается динамическим независимо от текущей RU-ширины; RU/BE/UK/PL/EN
  fixture и repository test запрещают locale-specific false negative и
  vacuous empty scan. Локальные
  style regression tests и парная Pixel/mobile-web проверка остаются runtime
  контролем конкретного экрана.
- **Решение для новой жалобы:** конкретный runtime symptom без открытого owner —
  `create-linked` к `#1344`; новый точечный ticket не заменяет structural guard.
  Если guard после закрытия `#1344` пропустит тот же pattern — `reopen #1344`.
- **Последняя проверка:** 2026-08-09; Pixel 10 Pro (`fontScale=1.15`) подтвердил
  фикс `#1342` и опроверг промежуточные `TripPlanCard.metaRow` варианты с
  standalone `flexShrink`, equal `flex: 1` и inner-wrapper `flexShrink`;
  `#1344` добавил structural guard в canonical governance/lint, а финальный
  `TripPlanCard` объединил transport/date в один normal-wrapping `Text` с
  единственным `flex: 1` outlet без прежнего неявного single-line ellipsis.
- **Разграничение с `NATIVE-TEXT-MEASURE-001` (2026-08-10, `#1392`):** обрезка
  текста на Android не всегда принадлежит этой семье. `#1392` завели сюда по
  симптому, но замер на устройстве гипотезу «wrapping row + единственный
  positive-`flex` outlet» опроверг: дефект пережил `nowrap`, `column`,
  `alignItems`, `gap: 0`, `padding: 0`, `maxWidth`/`width` на теле и на самом
  `Text`. Признак чужой семьи — текст обрывается НЕ у края коробки: справа
  остаётся пустое место, а хвост уехал на невидимую вторую строку. Признак этой
  семьи — текст упирается в край и режется по нему. Прежде чем менять sizing
  contract, снимите `onTextLayout` (сколько строк насчитал RN) и ширину чернил
  на скриншоте: расходятся замер и отрисовка — это `NATIVE-TEXT-MEASURE-001`.

### LOCALE-NUMBER-FORMAT-001 — отображаемое число печатает локаль, а не call-site

- **Инвариант:** число, которое видит пользователь, форматируется одним
  каноническим слоем — `i18n/format.ts` (`formatNumber`, `formatInteger`,
  `formatCompactNumber`, `formatCurrency`) или доменной обёрткой над ним
  (`utils/distanceCalculator.ts` для расстояния, `utils/ratingHelpers.ts` для
  оценки, `utils/fileSize.ts` для размера файла). Единица («км», «тыс.», «КБ») приходит из ключа перевода, а не
  склеивается с числом на месте. `toFixed` остаётся только там, где строка не
  показывается человеку: координаты, ключи кэша, параметры запроса, геометрия
  SVG, диагностика в консоли.
- **Surface/owner:** shared frontend; RU/BE/UK/PL — обязательный контроль, так
  как именно там «4.6» вместо «4,6» и «1.2K» вместо «1,2 тыс.» видны читателю.
- **Цепочка:** `#1433` (`formatDistance` печатал «1.0 км»), `#1440` (панель
  маршрута, `routeValidator`, разряды у ≥1000 км), `#1449` (семь call-site
  расстояния: попап места, квесты, каталог, Strava), `#1457` (компактные
  счётчики «1.2K»/«1.2M»); structural control — `#1459`.
- **Подтверждённая systemic cause:** правило жило только как договорённость в
  `AGENTS.md`/`docs/RULES.md` и как внимание ревьюера. Каждая карточка чинила
  свой набор файлов, а следующий домен — расстояние, счётчик, рейтинг, размер
  файла — заводил собственный `toFixed` заново, потому что механической проверки
  не было.
- **Controls:** `npm run guard:locale-number-format` — TypeScript-AST guard по
  `app/`, `components/`, `screens/`, `hooks/`, `utils/`. Ловит две формы:
  `toFixed(0..2)`, результат которого доходит до отображаемой позиции (JSX-текст,
  display-проп, аргумент перевода — включая цепочку переменных и
  функций-форматтеров того же файла), и вычисленное число, склеенное с хардкодным
  суффиксом единицы (`K`, `M`, `тыс.`, `км`, `KB`) — хоть через `toFixed`, хоть
  через `Math.round` или арифметику. Структурно, а не allowlist'ом, исключены
  координаты, точность выше двух знаков, ISO-8601 длительности (`PT45M`) и
  машинные пропсы. Известные границы: цепочка не проходит сквозь тело функции
  или `useMemo`, а каталог `services/` вне области сканирования. Governance-тест
  `__tests__/scripts/guard-locale-number-format.test.ts` держит allowlist пустым
  и запрещает vacuous scan; `__tests__/i18n/compactNumberCallSites.test.tsx` и
  `__tests__/i18n/distanceFormattingCallSites.test.tsx` остаются runtime-контролем
  конкретных экранов.
- **Решение для новой жалобы:** ещё одно место с английским числом — сначала
  проверьте, видит ли его guard. Не видит — это пробел в guard'е, `reopen #1459`
  с конкретной формой. Видит, но код прошёл в main — `create-linked` к `#1459`.
- **Последняя проверка:** 2026-08-18; первый прогон guard'а по чистому дереву
  нашёл десять call-site (рейтинг в семи местах, длительность квеста, размер
  файла маршрута) — все разобраны в `#1459`, allowlist остался пустым. Размер
  файла при разборе оказался вторым источником правды: те же единицы Б/КБ/МБ
  лежали в `offline`-namespace с другим округлением, поэтому оба экрана сведены
  на `utils/fileSize.ts`.

### NATIVE-TEXT-MEASURE-001 — RN Android меряет строку у́же, чем потом рисует

- **Инвариант:** видимость текста не может зависеть от того, насколько близко
  строка подошла к краю своей коробки. Подпись, которая по замеру RN помещается
  в одну строку, обязана и рисоваться в одну строку.
- **Surface/owner:** shared React Native UI на Android; mobile web — контроль
  паритета (в браузере расхождения нет, поэтому web маскирует дефект).
- **Цепочка:** `#1392` (партнёрский оффер, подпись теряла название места).
- **Подтверждённая systemic cause:** RN занижает измеренную ширину строки
  относительно фактической отрисовки. Замер на Pixel 10 Pro (`fontScale=1.15`,
  2026-08-10): `onTextLayout` для «Авторские экскурсии и местные гиды — Минск»
  отдаёт ОДНУ строку шириной 340dp при коробке 345.9dp, а реально строка
  занимает ~346.5dp (проверено расширением коробки до 361.9dp — там та же
  строка рисуется целиком и меряется по чернилам в 345.5dp). Разница до ~2% и
  зависит от строки: у короткой соседней подписи она ~0.7%. Итог: RN сажает
  коробку по высоте в одну строку, Android рисует две, вторая обрезается.
  Ellipsis при этом НЕ появляется — многоточия нет, слово просто исчезает.
- **Controls:** запас ширины у подписи, чья длина подходит к ширине контейнера
  (`maxWidth: '96%'` у `cardSubtitle` в
  `components/affiliate/AffiliateOffers.tsx`) плюс unit-тест на сам факт запаса.
  Проверка — только устройство: расхождение видно лишь при сравнении
  `onTextLayout` с шириной чернил на скриншоте. Статический guard здесь
  бессилен: в разметке нарушения нет.
- **Чего запас НЕ делает (важно, не считать это закрытием семьи):** он не
  устраняет расхождение, а сдвигает его. Отказ требует, чтобы измеренная ширина
  строки попала в узкую полосу (~2%) под границей коробки; запас переносит эту
  полосу на другую длину строки, но её ширина остаётся прежней. Значит другое
  название места, другая локаль или другой `fontScale` теоретически снова
  попадут в неё. Гарантию даёт только вертикальный запас (высота подписи под две
  строки), но он добавляет пустую строку под каждой короткой подписью, поэтому
  как общее решение не принят — решение за владельцем.
- **Не помогают (проверено на устройстве 2026-08-10, с полной перезагрузкой
  бандла, а не Fast Refresh):** `textBreakStrategy="simple"`,
  `android_hyphenationFrequency="none"`, `numberOfLines={2}`, `width: '100%'` на
  самом `Text`, `maxWidth: '100%'` на теле карточки, смена `flexDirection`,
  `flexWrap`, `alignItems`, `gap` и `padding` родителя. То есть помогает именно
  уменьшение доступной ширины, а не сама запись `maxWidth`.
- **Методическая ловушка:** Fast Refresh в этой сессии несколько раз отдавал
  устройству устаревший бандл, а правка, не меняющая геометрию, вдобавок не
  перезапускает раскладку текста. И то, и другое читается как «изменение не
  помогло». Каждый вывод «не помогает» подтверждать после
  `am force-stop` + запуска dev-client заново.
- **Решение для новой жалобы:** сначала отделить от `NATIVE-TEXT-ROW-001` по
  признаку «пустое место справа от обрыва». Если подтвердилось — `create-linked`
  к `#1392`; правка sizing contract строки бесполезна.
- **Последняя проверка:** 2026-08-10; Pixel 10 Pro, `fontScale` 1.0/1.15/1.30,
  экраны поездки и travel-деталей.

### MAP-USER-LOCATION-MARKER-001 — Android-маркер пользователя ниже POI

- **Инвариант:** trusted GPS-позиция на Android и mobile web
  обязана иметь заметный единый маркер «Вы здесь». На Android он
  остаётся выше POI/кластеров, но не перехватывает их нажатия;
  камера не центрируется по позиции, если маркер не был успешно
  нарисован.
- **Surface/owner:** Android Leaflet WebView renderer; mobile web — обязательный
  парный контроль. Владелец — `components/MapPage/Map/nativeMapHtml.ts`
  и native bridge `components/MapPage/Map.ios.tsx`.
- **Цепочка:** `#912/#914/#984` — trusted/live location state;
  `#1404` — порядок и надёжность визуального слоя Android.
- **Подтверждённая причина:** прежний `L.circleMarker` жил в
  `overlayPane` (z-index 400), а POI/кластеры — в `markerPane` (600), поэтому
  `bringToFront()` не мог поднять GPS-точку над POI. Кроме того,
  `map.__realUserLocation` записывался до отрисовки с пустым
  `catch`, а native adapter игнорировал явный target из `MapUiApi`. После
  подъёма user-location pane первый runtime-прогон выявил второй failure mode:
  при `preferCanvas` accuracy-круг создавал viewport-sized canvas в pane 625,
  который оставался DOM hit target и перекрывал POI из нижнего `markerPane`,
  даже когда сам GPS-маркер был `interactive: false`.
- **Controls:** dedicated pane z-index 625 (выше POI, ниже tooltip/popup),
  общий 30px `buildUserLocationHtml`, неинтерактивный pane/маркер (включая
  viewport-sized accuracy canvas) и атомарная команда render→commit→center.
  Исполняемый WebView regression test
  проверяет замену без дублей, fail-closed и запрет `setView` после
  ошибки. Runtime-control — MAP-04/MAP-06 на Pixel и mobile web 390×844,
  включая точное совпадение GPS с POI.
- **Решение для новой жалобы:** проблему trusted/fallback state связывать
  с `#912/#984`; исчезновение/перекрытие уже trusted маркера по той
  же pane/atomic-render причине — `reopen #1404`; другой renderer failure mode —
  `create-linked` к `#1404`.
- **Последняя проверка:** 2026-08-11; Pixel 10 Pro/API 36 и mobile web 390×844
  прошли парный post-correction overlap-контроль: GPS-маркер остался поверх POI,
  физическое нажатие открыло его карточку, повторный locate не создал дублей,
  runtime-ошибок нет (`#1404`).

### MAP-ROUTING-001 — incomplete routing migration

- **Инвариант:** один canonical adapter владеет provider selection, DTO
  validation, coordinate order, fallback semantics и route state; UI не знает о
  transport/provider деталях.
- **Surface/owner:** shared map frontend + backend routing boundary.
- **Цепочка:** `#732/#784/#812` и legacy/new store migration вокруг MapPage.
- **Подтверждённая systemic cause:** docs называют server routing canonical, но
  runtime сохраняет ORS/OSRM/Valhalla fallbacks; новый route store сосуществует
  с legacy adapter; координаты представлены `[lng, lat]`, `{lat,lng}` и разными
  geometry DTO; main/travel/quest maps частично дублируют bridges.
- **Controls:** один schema-validated response adapter, branded coordinate types,
  typed failure/fallback reasons и одна web/Android route matrix.
- **Решение для новой жалобы:** provider symptom сначала классифицировать:
  backend degraded-response issue относится к `ROUTING-ORS-001`, state/DTO/
  bridge drift — к этой семье; не создавать общую карточку «карта сломана».
- **Последняя проверка:** 2026-07-28; migration debt остаётся.

## Правило закрытия recurring problems

Статус `done` означает не только «симптом исчез». Для семейства выше нужны:

- подтверждённая причина или явный владелец оставшейся гипотезы;
- commit/diff, достижимый из канонического `main` (и `origin/main`, когда работа
  должна быть опубликована), а не только из временного checkout;
- regression control на слое, где сломался инвариант;
- runtime evidence на указанном target;
- для lifecycle/ops причины — несколько релевантных циклов, например restart и
  последовательные deploy swaps, а не один smoke;
- removal condition для mitigation/workaround;
- обновлённые canonical task links и дата последней проверки в этом реестре.

Если это не выполнено, задача остаётся в `review`/`testing`, а не маскируется
новой карточкой.
