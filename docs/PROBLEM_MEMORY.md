# Problem memory and recurrence registry

Актуализировано: 2026-07-28.

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
  `#1068`, `#1074`, `#1101`, `#1103`, `#1104`, текущие `#1111–#1118`.
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
  contract, unsized same-origin URL или URL cardinality.
- **Решение для новой жалобы:** пока `#1111–#1118` открыты — `reuse` подходящую
  карточку. После их закрытия переоткрывай каноническую карточку того слоя, где
  снова нарушен инвариант; новый linked task допустим только для другой причины.
- **Последняя проверка:** 2026-07-28; семейство активно.

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
