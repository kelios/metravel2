# Problem memory and recurrence registry

Актуализировано: 2026-08-08.

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
  очереди `#1390`; структурный ответ на рецидивы — `#1391`.
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
