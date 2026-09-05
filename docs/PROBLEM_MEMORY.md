# Problem memory and recurrence registry

Актуализировано: 2026-09-01.

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
| P0 | Travel `PATCH` или revision/ETag/idempotency save contract (канонические `#1513` BE / `#1516` FE) | Autosave вынужден отправлять full replace из частично hydrated state: может стереть серверные поля и, как показал 19.08.2026, перегрузить прод серией полных пересборок статьи. |
| P1 | Единый auth session bootstrap и transport policy для `401/403/CSRF` | Cookie, локальная metadata и разные fetch/upload/download wrappers расходятся. |
| P1 | Общий bottom-chrome geometry provider | Каждый экран заново складывает dock, safe area и keyboard offsets. |
| P1 | Один routing adapter + typed provider failures/coordinates | Server canonical path, direct providers и legacy store bridge существуют одновременно. |
| P2 | Закрытие бессрочных sprint и группировка системных цепочек problem key/epic | Сотни несвязанных карточек скрывают один recurring invariant. |
| P2 | Ревалидация квест-контента против реального объекта (свежие фото по координатам шага) | Опубликованный эталон ответа стареет вместе с городом, и сломанный шаг ничем не отличается от здорового, пока туда не дойдёт живой игрок. |
| P2 | Жизненный цикл снимков живого прод-контента: снятый артефакт не остаётся в репозитории как данные | Применённый снимок неотличим от актуального и при повторном запуске молча возвращает прод к прошлой редакции. |

## Реестр

### HEADER-HYDRATION-CLS-001 — резерв шапки расходится с её responsive-геометрией

- **Инвариант:** высота зарезервированного `[data-header-slot]` совпадает с
  высотой первого runtime-кадра глобальной шапки во всех responsive-полосах;
  контент страницы и узлы шапки не участвуют в `layout-shift` при гидрации.
- **Surface/owner:** общий web layout и critical CSS:
  `app/(tabs)/_layout.tsx`, `app/global.css`,
  `components/layout/customHeaderModel.ts` и `utils/criticalCSSBuilder.ts`.
  Подтверждённая поверхность — desktop web в полосе `768–1279`; mobile web
  `412` и широкий desktop `1280` — здоровые контроли. Localization impact:
  none.
- **Цепочка:** `#1144` (первый фикс высоты header slot) → `#1298`
  (канонический `header-hydration-cls`, закрыт проверками только на `412/1280`)
  → recurrence 2026-08-27, обнаруженный новым narrow-desktop gate `#1564`;
  параллельный route-specific контракт высоты travel header ведёт `#1563`.
- **Подтверждённая причина recurrence:** статический slot считает mobile только
  ниже `768px` и резервирует `78px` на `1152`, тогда как runtime-модель и
  critical CSS считают шапку narrow/mobile до `1280` и рисуют `64px`. Холодные
  production-build прогоны дали CLS `0.010928357…–0.011072531…` (стабильный
  внутри retry) и источник `div[data-testid="search-container"]`, сдвинутый
  `y=78 → 64`. Контроли:
  `1280` — `78 → 78`, CLS `0`; `412` — `64 → 64`, CLS `0`.
- **Почему прежний control не удержал инвариант:** матрица `#1298` проверяла
  только крайние профили `412` и `1280`, поэтому полоса `768–1279`, где
  breakpoint slot и breakpoint шапки расходятся, не исполнялась вовсе.
- **Controls:** каноническая карточка `#1298` переоткрыта и связана с
  `#1144/#1563/#1564`. Постоянная матрица обязана проверять
  `412/768/1152/1279/1280`, фактическую высоту slot/runtime и отсутствие
  `search-container`/header sources в layout-shift. `#1564` добавляет отдельный
  `desktop-narrow` perf-профиль, не ослабляя бюджеты `desktop` и `mobile`.
- **Решение для новой жалобы:** повторный `reserved height → runtime height`
  сдвиг глобальной шапки по той же breakpoint-причине — `reopen #1298`; иной
  route-specific дополнительный ряд/контекст — `create-linked` к семье (как
  `#1563`), а не новый общий «CLS страницы».
- **Последняя проверка:** 2026-08-30, production acceptance `#1298` закрыт.
  Общий `mobile/compact/wide` контракт резервирования и critical-CSS breakpoint
  живут на `metravel.by` (`[data-header-slot=""]` = 78 px, `64 px` под
  `@media (max-width:1279.98px)`, `64 px` под `max-width:767.98px`). Холодная
  Layout-Instability матрица `/` и `/search` на `412/768/1152/1279/1280`:
  CLS `0` и ноль кадров сдвига во всех 12 прогонах, включая три холодных
  `/search` `1152×720` против baseline `0.010928357`; статический резерв slot
  равен гидрированной высоте на каждой ширине (`64` в `412–1279`, `78` в
  `1280`), `search-container` стоит на `y=64` уже в статике — сигнатуры
  `y=78 → 64` больше нет; console/page errors и React `#418/#419` — 0.
  Нулевой результат откалиброван позитивным контролем на том же наблюдателе:
  синтетическая полоса `40 px` перед `search-container` даёт CLS `0.0312` и
  источник `div[testid=search-container] (y 64→104)`. Focused Jest владеющего
  слоя — 3 suite / 59 тестов PASS. Gate `#1564` продолжает держать narrow
  baseline.

### TRAVEL-DEFERRED-RESERVE-CLS-001 — placeholder и первый runtime-кадр имеют одну внешнюю геометрию

- **Инвариант:** deferred-placeholder остаётся в потоке до первого ненулевого
  layout разрешённого runtime-модуля, а его внешний reserve совпадает с
  runtime-геометрией. Узлы footer/runtime не должны попадать в
  `layout-shift.sources` в момент reveal.
- **Surface/owner:** web travel details:
  `components/travel/details/TravelDetailsDeferred.tsx`,
  `TravelDetailsPostLcpRuntime.tsx`, `TravelDetailsDeferredTransition.tsx`,
  `TravelDetailsFooterRuntimeFrame.tsx` и focused browser/Jest guards.
  Обязательная матрица — `1024×640`, `1366×768`, mobile web `390×844`;
  Android/iOS и localization вне этой семьи.
- **Цепочка:** каноническая семья `#160`; связанные причины/прецеденты
  `#561/#164`; текущий recurrence — `#1604`. `#562/#565` — соседние deferred
  performance controls, а `#1588` про другую footer-поверхность и не заменяет
  этот invariant.
- **Подтверждённая причина recurrence:** web footer оставался за
  bottom/intersection gate и начинал lazy resolve уже в видимой области. Общий
  `SectionSkeleton` и footer fallback не совпадали с полным runtime-кадром
  (включая Telegram-блок). На исходном `1024×640` footer-transition внёс
  `0.1019878` CLS; exact mobile recheck воспроизвёл рост видимой высоты
  `525 → 621.97px` и footer-source `0.0749415`. Изменение
  `EmailSubscriptionForm` в scope не входит.
- **Почему прежний control не удержал инвариант:** presence/state Jest-тесты
  видели загрузку компонента, но не проверяли ненулевой первый layout,
  Layout Instability API и фактический внутренний scroll-container страницы.
- **Controls:** web разрешает footer внутри уже post-LCP, но ещё offscreen tree;
  native сохраняет intersection gate. Reserve действует только в
  pending/measuring и снимается после ready, чтобы не оставлять пустой хвост.
  Focused Jest держит pending/ready/error/native состояния;
  `e2e/travel-details-footer-transition-cls.spec.ts` скроллит
  `[data-testid="travel-details-scroll"]` только после resolved frame и снятия
  placeholder, fail-closed собирает
  `PerformanceObserver`, проверяет footer sources, console/page errors,
  горизонтальный overflow и остаточный trailing reserve на production export.
- **Решение для новой жалобы:** повторный сдвиг `deferred placeholder → runtime`
  в footer — `reopen #1604`; тот же механизм в другой секции —
  `create-linked` к `#160`, а не ещё один общий «CLS страницы».
- **Последняя проверка:** 2026-08-27; implementation и повторный независимый
  code review завершены; первый production candidate выявил mobile recurrence и
  persistent-reserve риск, оба исправлены. Финальный Jest/ESLint — `3 suites /`
  `13 tests`; refreshed production build — PASS; deterministic и exact-slug
  browser matrix — `3/3 + 3/3`, footer/total CLS, overflow и trailing reserve
  равны `0` во всех трёх viewport; bilateral slider/perf — `2/2 + 5/5 + 33/33`.
  Post-deploy замер ещё не разрешён и не выполнен, поэтому `#1604` не закрыта.

### MEDIA-CONTAIN-SLOT-001 — геометрия `contain`-слота против пропорций контента

- **Инвариант:** изображение в `contain`-слоте не оставляет плоское поле шире
  10% стороны слота (`docs/RULES.md` → «Images and placeholders»); `cover`,
  второй raster/blur и правка самого правила запрещены (прецедент
  `29c30d95`/INV2-17).
- **Surface/owner:** каждая `fit="contain"`-поверхность отдельно: route-карточки
  (`TravelListItem`/`UnifiedTravelCard`), hero-слайдер главной
  (`HomeHeroBookLayout`), квест-плитки (`QuestForCityCard`), миниатюры /places.
- **Симптомы:** широкие однотонные полосы `dominant_color` по бокам или
  сверху/снизу фото; на скриншотах главной/каталога выглядит как дефект качества.
- **Цепочка:** `#134`, `#152` (done, /places), `#1487` (route-карточки),
  `#1541` (hero-слайдер), `#1542` (квест-плитки), `#1674` (вкладка
  публичного профиля).
- **Подтверждённые причины (у каждого узла своя):** /places — бэкенд не отдавал
  вариант под ландшафтный слот (вылечено backend-вариантом); route-карточки —
  фиксированный ландшафтный слот при моде контента 1:1 (80% из 360 обложек);
  hero — разнородный curated-набор (0.667…1.336) в одном кросс-фейд-кадре;
  квест-плитки — фиксированный квадратный тайл под сплошь ландшафтные обложки;
  вкладка публичного профиля (#1674) — слот вообще НЕ следовал пропорции:
  `imageHeight={180}` в пикселях при резиновой ширине карточки (до 460 px на
  web), то есть широкий и низкий бокс, в который квадратная обложка вписывалась
  по высоте с полосами сверху и снизу. Отличие от #1487: там слот спорил с
  модой контента, здесь контракта пропорций у поверхности не было вовсе.
- **Ограничение владельца (2026-08-24, #1487):** сеточные поверхности обязаны
  оставаться ровными сетками одинаковых карточек — слот НЕ может следовать
  пропорциям конкретной обложки (первый заход #1487 так делал и был отклонён
  по прод-скриншоту /search). Итоговый контракт route-карточек: единый
  квадратный слот = мода контента; не-квадратный хвост — контентный долг.
- **Треугольник несовместимости:** «поле ≤10% на всех обложках» + «contain» +
  «ровная сетка» одновременно недостижимы при разбросе пропорций контента
  больше ±25% (у travel-обложек — 3.16×). Чинить можно только контентом:
  варианты изображений под пропорцию слота (#134/#152) или нормализация
  curated-набора (#1541).
- **Controls:** `cardMediaLetterbox.test.ts` — числовой контракт (единый слот +
  потолок поля) И source-гейт #1674: сканер `components`/`app`/`screens`
  требует, чтобы каждая `contain`-карточка `UnifiedTravelCard` объявила
  `mediaAspectRatio` либо стояла в замороженном списке известного долга (список
  проверяется на протухание, поэтому не превращается в вечное разрешение).
  Contain здесь считается по ДЕФОЛТУ компонента: карточка без `mediaFit` — тоже
  contain, и именно так выглядит самая вероятная новая поверхность; мимо гейта
  уходит только явный не-contain литерал. Комментарии сканер пропускает —
  иначе апостроф в тексте уводит посимвольный разбор в режим строки и гейт
  молча перестаёт ловить (у сканера есть собственные тесты на это);
  `check:image-architecture`; браузерная проба
  `(slot − rendered)/2/slot` над `img[object-fit=contain]` + СКРИНШОТ РЯДА —
  числовая проба не видит рваную сетку, скриншот обязателен.
- **Пробел:** гейт объявления контракта закрыт для `UnifiedTravelCard` (#1674),
  но НЕ для остальных `contain`-поверхностей: hero главной, квест-плитки и
  прямые `ImageCardMedia` живут вне сканера и не покрыты авто-тестом на поле.
  Остаток долга по `UnifiedTravelCard` — семь поверхностей с пиксельным слотом:
  `PlaceListCard`, `TravelsForQuestSection`, `calendarScreen.parts`,
  `TravelTmlRound` (явный `contain`), `TabTravelCard` (проп с дефолтом contain),
  `RecentViews` и `PublicTripCard` (`mediaFit` не задан вовсе). Их доля поля на
  прод-обложках не замерена.
- **Решение для новой жалобы:** полоса на route-карточках → `reuse #1487`;
  hero → `#1541`; квест-плитки → `#1542`; карточки профиля → `#1674`; новая
  поверхность → create-linked с собственной подтверждённой причиной, точечный
  фикс без записи сюда запрещён.

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
- **Linked finding — 2026-08-31 (TestFlight 1.0.5 (4), iOS inline body
  media):** два screenshot-report одного тестировщика показывают пустые
  inline-кадры тела travel; в одном отчёте отдельно указано, что фото появляется
  только после нажатия. Третий пустой primary region снят при активной вкладке
  карты и не позволяет отличить map от media без TestFlight-retest.
  Source/runtime chain подтверждённых inline-кадров ведёт через
  `TravelDescription` и `CustomImageRenderer` в
  `components/ui/richMediaViewport.tsx`: viewport-unmount gate из Android-задачи
  `#1035` был включён для всех native-платформ, хотя его причина и измеримый
  выигрыш относятся к Android Glide/bitmap upload. Это та же медиа-семья и тот
  же компонент, но другая подтверждённая platform-boundary причина, поэтому
  verdict — `create-linked` к `#1035` (дополнительный исторический контекст
  `#828`), а не reopen принятого Android performance-инварианта. Board id новой
  iOS-карточки назначается только после review Task Contract и здесь намеренно
  не выдуман. Постоянный control: gate обязан быть Android-only; unit-матрица
  доказывает немедленный mount на iOS и сохранение viewport-gating на Android,
  а TestFlight-приёмка проверяет те же inline-кадры без tap и без потери
  `contain`/blur. Platform impact: iOS primary, Android regression; web не
  меняется. Localization impact: none.
- **Последняя проверка:** 2026-08-31; `#1400` recurrence и gate `#1263`
  остаются активной общей media-цепочкой, iOS boundary finding ожидает
  связанную карточку после review.

### TRAVEL-RICHTEXT-FLOAT-ORDER-001 — обтекание одиночного фото зависит от порядка абзацев

- **Инвариант:** одиночное портретное фото с достаточным соседним текстом на
  desktop web должно визуально занимать боковую часть полосы, а строки текста —
  идти рядом с ним независимо от того, где фото оказалось в исходном HTML.
  Заголовок и полноширинный блок завершают обтекание; mobile web остаётся
  одноколоночным.
- **Surface/owner:** web rich text travel detail:
  `utils/richTextImageLayout.ts`,
  `components/travel/stableContent/htmlTransform.ts`,
  `components/travel/stableContent/webStyles/floats.ts` и browser regression
  control. Backend и сохранённый авторский HTML не являются владельцами.
- **Цепочка:** `#1602` (общая механика desktop float, принят локально
  2026-08-27) → `#1623` (production order-dependent variant, создан
  2026-08-28, `create-linked`).
- **Подтверждённая причина:** `groupConsecutiveImages` сохраняет порядок
  исходных `p`, а `appendSingleImage` только назначает класс
  `img-float-left/right`. CSS `float` влияет на последующий поток и не может
  ретроактивно сузить уже расположенный выше абзац. Поэтому последовательность
  «длинный текст → одиночное фото → заголовок» оставляет текст полноширинным,
  тогда как контроль «фото → длинный следующий абзац» обтекается.
- **Почему прежний control не удержал инвариант:** Done gate `#1602`
  проверял `Range.getClientRects()` для текста, следующего за float, но не
  проверял обратный порядок `text → image → heading`; наличие CSS-класса и
  рабочий соседний случай скрыли зависимость от порядка DOM.
- **Controls:** браузерная матрица должна проверять обе последовательности на
  `1280/1440` и mobile `390`, отсутствие наложений, сохранение `alt`/подписи,
  очистку перед заголовком и контрольные `single-wide`/группы.
- **Решение для новой жалобы:** тот же общий симптом при том же layout-family,
  но другой подтверждённый corrective layer — `create-linked #1623` к
  `#1602`; `#1602` не переоткрывать как будто CSS float снова исчез.
- **Последняя проверка:** 2026-08-28; production URL
  `https://metravel.by/travels/adrshpashskie-skaly-v-chekhii-gde-snimali-narniiu?returnTo=%2Fsearch`,
  Chromium `1280×720`, DPR 1. Контрольные последующие абзацы обтекаются,
  failing-последовательность остаётся полноширинной.

### TRAVEL-DETAILS-STYLE-SETS-DRIFT-001 — одно имя стиля имеет одно определение

- **Инвариант:** имя ключа в наборах стилей детали путешествия объявлено ровно
  один раз. Ключ, нужный нескольким наборам, живёт в общем фрагменте, который
  они раскладывают спредом, и переобъявлять его поверх спреда нельзя.
- **Surface/owner:** `components/travel/details/TravelDetailsHeroStyles.ts`
  (набор `useTravelDetailsHeroStyles`) и
  `components/travel/details/TravelDetailsShellStyles.ts` (набор
  `useTravelDetailsShellStyles`) плюс все файлы, спредящиеся в
  `TravelDetailsStyles.ts` (набор `useTravelDetailsStyles`):
  `TravelDetailsStyleFragments.ts` и `styles/travelDetails{Layout,Nav,
  SectionHeader,HeroMedia,Insight,Misc}Styles.ts`. Общий фрагмент —
  `styles/travelDetailsSectionRhythm.ts`.
- **Симптомы:** два вида, и второй молчит. Живое расхождение — один и тот же
  блок выглядит по-разному в зависимости от того, каким хуком отрисован
  (`#1704`: секция на web 40px против 32px, чип быстрых переходов разного
  цвета). Мёртвое расхождение — правка в копии ключа не меняет экран вообще,
  потому что копию никто не читает, и причину ищут не в том файле (`#1703`,
  `#1708`).
- **Цепочка evidence:** `#1702` (избыточные ссылки на перекрытые стили у
  обёрток футера — проблема на стороне применения) → `#1703` (один мёртвый
  `authorCardContainer` в hero-наборе) → `#1704` (канонический: девять
  пересекающихся ключей hero против nav/layout, три расходились по значению;
  общее вынесено в `TRAVEL_DETAILS_SECTION_RHYTHM`) → `#1708` (шесть ключей —
  `sliderContainer` и `heroFavoriteBtn*` — объявлены ТРИЖДЫ: живой hero-набор
  плюс две копии в агрегате, обе мёртвые и обе расходящиеся с живой:
  `rgba(0,0,0,0.45)` против `rgba(0,0,0,0.2)`, `radii.md` с бордером и тенью
  против `radii.xl` без них) → `#1711` (восемнадцать имён shell-набора —
  оболочка страницы, боковое меню, скролл и экраны ошибок — сняты из
  `styles/travelDetails{Layout,Misc}Styles.ts`; вместе с ними уехал
  пришпиленный в гейте список, а два теста, сверявшие боковое меню и
  `useTravelDetailsLayout` с МЁРТВОЙ копией в агрегате, переведены на shell-набор
  — они проходили только потому, что эти два ключа ещё не разошлись). Пять
  карточек за два дня, и каждый раз аудит предыдущей находил «ещё один» дубль
  вне своего scope.
- **Подтверждённые причины:** у экрана три параллельных способа получить стили —
  общий агрегат, hero-хук и shell-хук. Ключ копируется в любую сторону, а
  спред-агрегат вдобавок делает дубль внутри себя невидимым: побеждает
  последний спред, предыдущая копия молча выключается, и TypeScript о ней не
  говорит ничего, потому что потребители секций принимают `styles: any`.
  Отсюда же несимметричность вида: дубль между hero-набором и агрегатом можно
  увидеть на экране, дубль ВНУТРИ агрегата не проявляется никогда.
- **Controls:** `__tests__/components/travel/travelDetailsStyleKeyOwnership.test.ts`
  — гейт в CI: собирает все девять наборов (семь фрагментов агрегата, hero и
  shell), вычитает ключи общего фрагмента и падает, если имя объявлено более
  чем в одном; отдельно сверяет, что каждый набор отдаёт значения фрагмента без
  переобъявления. С `#1711` гейт работает без пришпиленных исключений и
  вдобавок проверяет владение поимённо: восемнадцать имён оболочки обязаны
  встречаться только в shell-наборе, шесть hero-ключей — только в hero. Проверен
  на искусственно заведённом дубле — возврат `wrapper` в
  `travelDetailsLayoutStyles.ts` роняет оба теста разом. Первый же прогон нашёл
  два семейства сверх `#1708`: семь
  `mobileInsight*` (`TravelDetailsStyleFragments.ts` против
  `styles/travelDetailsInsightStyles.ts`) и девять `error*`/`loadingSkeleton*`
  (те же фрагменты против `styles/travelDetailsMiscStyles.ts`) — обе копии
  побайтово совпадали с победившими и были сняты вместе с гейтом. Плюс
  `travelDetailsSectionRhythm.test.ts` (`#1704`) — паритет ритма секций на web и
  native.
  `__tests__/components/travel/travelDetailsStyleKeyReadership.test.ts` (`#1713`)
  — второй гейт, инвариант другой: у объявленного ключа обязан быть хотя бы один
  читатель, то есть обращение `.<ключ>` в исходниках.
  ВАЖНО, чем этот гейт был сломан в первой редакции и почему так больше нельзя:
  он собирал имена после точки по всем 1282 файлам `components/`, `hooks/`,
  `app/`, никак не привязываясь к набору детали. Любой ключ, чьё имя совпало с
  обращением в ЧУЖОМ компоненте с его собственным локальным `styles`, молча
  считался живым. Так гейт не поймал бы `heroTitle` — один из четырёх ключей,
  ради которых заводился (`.heroTitle` есть в `components/home/`,
  `components/listTravel/` и `components/screens/roulette/`), и так же прятался
  мёртвый `sectionBadgeText` при мёртвой родне `sectionBadge*`.
  Область чтения теперь = граф детали: весь `components/travel/details/**`
  (внутри него набор ходит пропом `styles` вниз по секциям) плюс любой файл
  `components/`/`hooks/`/`app/`, который импортирует модуль набора напрямую (так
  в область входит `hooks/useTravelDetailsLayout.ts` и войдёт будущий внешний
  потребитель — список не пришпилен). Именно `details`, а не весь
  `components/travel`: до соседей (`upsert/`, `gallery/`, `sliderParts/`) набор
  детали не доезжает, а объявленные имена вроде `errorText` и `wrapper` там
  встречаются — держать их в области значило бы сохранить то же молчание
  радиусом поменьше. Наборы тоже берутся с диска: оба каталога читаются глобом
  (корневые модули — по имени `*(Styles|StyleFragments).ts`, как в гейте
  владения), и набор нового модуля гейтится на читаемость независимо от того, в
  каком из двух каталогов модуль заведён — отбор фабрик идёт по сигнатуре имени
  `create|getTravelDetails<Имя>Styles`. Покрытие корня — не формальность: два
  последних набора экрана, hero и shell, заведены именно там, а не в `styles/`.
  Поиск по тексту законен ровно потому, что других путей к стилю в этом дереве
  нет: ни деструктуризации набора, ни спреда его в чужой объект, ни
  вычисляемого `styles[имя]` — проверено на 2026-09-02. Остаточный риск: набор,
  переданный пропом в компонент ВНЕ `components/travel/details/**`, гейт не увидит и
  посчитает его ключи мёртвыми — соврёт в сторону падения, а не молчания.
  Проверен мутацией в четыре стороны: заведомо нечитаемый ключ в реальном наборе
  роняет гейт с именем ключа и владельца; ключ, читаемый ТОЛЬКО чужим
  компонентом, тоже роняет (регресс ровно на промах первой редакции); известный
  мёртвый ключ, которому дали читателя внутри фичи, роняет проверку списка
  наследства; новый модуль наборов на диске с нечитаемым ключом роняет гейт без
  единой правки в нём самом.
  Наследство: не читаются 39 ключей из 118 — 18 `decisionSummary*`, 14 `misc`
  (включая `travelListFallback`, `loadingSkeleton*`, `sectionBadge*` вместе с
  `sectionBadgeText`), 3 `neutralActionButton*`, 2 `backToTop*` и 2 `error*`.
  Тридцать девятым `sectionBadgeText` стал после привязки области чтения: под
  «любой точкой во всём дереве» его назначали живым `components/home/` и
  `components/profile/`. Ключи перечислены в `KNOWN_UNREAD_KEYS` явно, а не
  прощены молча, и список самоосушающийся: ключ, который удалили или которому
  нашли читателя, обязан из него исчезнуть, иначе гейт падает — отстать от кода
  незаметно, как отстал пришпиленный перечень в `#1711`, он не может.
  Наследство слито в `#1714` (2026-09-04): фрагмент `decisionSummary` снят
  целиком вместе со спредом в агрегате (осиротел вместе с удалённой секцией),
  14 ключей `misc`, 3 `neutralActionButton*`, 2 `backToTop*` и 2 `error*`
  удалены из своих наборов; с `errorButton`/`errorButtonText` сняты и поля
  интерфейса `ErrorStateStyles` — единственный ложный признак их жизни
  (компонент рендерит `<Button>`, а не `<Text style={styles.errorButton}>`).
  `KNOWN_UNREAD_KEYS` из гейта убран: у каждого объявленного ключа обязан быть
  читатель без оговорок, а перечень снятых имён остался только как
  `REMOVED_LEGACY_KEYS` — возврат любого из них в набор роняет гейт по имени.
  Экран не менялся по построению — ни один из ключей не читался.
- **Пробел:** причина не снята, снят только её сигнал. Пока у экрана три набора,
  дублировать по-прежнему есть куда — гейт лишь не даёт этому пройти молча.
  Структурное решение — перевести hero- и shell-компоненты на общий агрегат и
  убрать `useTravelDetailsHeroStyles`/`useTravelDetailsShellStyles` совсем;
  тогда дублировать становится негде. Открытых дублей имён на 2026-09-02 нет:
  восемнадцать shell-имён, пришпиленных ревью `#1708`, сняты в `#1711`, и
  `KNOWN_OPEN_DUPLICATES` из гейта убран.
  Отдельно про мёртвые ключи: закрыто в `#1713`. `heroOverlay`/`heroTitle`/
  `heroMeta` в `styles/travelDetailsHeroMediaStyles.ts` и `lazySectionReserved`
  в `styles/travelDetailsLayoutStyles.ts` удалены, и вместе с ними заведён
  второй гейт — на читаемость. Класс закрыт не только для этих четырёх: любой
  новый ключ без потребителя теперь роняет CI.
- **Решение для новой карточки:** прежде чем править стиль на детали
  путешествия, проверить, каким хуком отрисован блок (`useTravelDetailsStyles`,
  `useTravelDetailsHeroStyles` или `useTravelDetailsShellStyles`), и прогнать
  гейт владения ключами — он называет все источники имени.
- **Последняя проверка:** 2026-09-04; `#1711`, `#1713` и `#1714` закрыты по
  коду, оба гейта — владения и читаемости — зелёные на текущем дереве и без
  списков исключений. Открытых дублей имён нет; мёртвых ключей нет — но эта
  фраза стоит ровно столько, сколько область чтения гейта: до 2026-09-03 она была
  неверна (`sectionBadgeText` прятался за чужим компонентом), и нашло это
  код-ревью, а не сам гейт.

### CHUNK-DEPS-CONTENT-ADDRESSED-001 — манифест зависимостей чанка не переживает сборку

- **Инвариант:** всё, что кэшированный по immutable-имени файл говорит о других
  файлах, обязано быть выведено из содержимого: shared-зависимости чанка
  называются хешированным путём и входят в хеш имени самого чанка. Порядковый
  индекс в списке текущей сборки (`sharedIndex`) в отдаваемом браузеру файле не
  появляется.
- **Surface/owner:** web-экспорт, `patches/@expo+metro-config+57.0.3.patch`
  (`getAsyncChunkTargets`, `dependencyRegistration`) и
  `patches/expo+57.0.4.patch` (`maybeLoadRegisteredDependencies`); деплой хранит
  прошлые поколения 14 дней (`scripts/deploy-expo-overlay.sh`).
- **Симптомы:** после деплоя у вернувшихся посетителей главная (и любой маршрут)
  падает в корневой ErrorBoundary с `Requiring unknown module "<id>"`; в чистом
  браузере и в статическом разборе выпуск полностью консистентен, файлы на
  сервере на месте, 404 нет.
- **Цепочка evidence:** 04.09.2026 — владелец получил `Requiring unknown module
  "1986"` на `metravel.by/` наутро после выкладки `#1721` (перегруппировка
  shared-чанков по маршрутам, из 48 shared-файлов имя сохранили 8); свежая
  сессия открывала сайт без ошибок, прогон замыкания sync-зависимостей по всем
  128 чанкам и 8 HTML — 0 пробелов. Ранее `scripts/fix-missing-chunk.sh` —
  ручная подмена `CustomHeader-*.js` для «закэшированного старого _layout».
- **Подтверждённые причины:** (1) upstream `getAsyncChunkTargets` при
  `includeAsyncPaths` (прод-экспорт) выходит до наших циклов, поэтому хеш имени
  маршрутного/секционного чанка не включал его shared-зависимости — имя жило
  сквозь перегруппировки; (2) `__METRAVEL_CHUNK_DEPS__` кодировал зависимости
  индексами `sharedIndex`, которые в хеш не входят и меняются каждой сборкой.
  Кэшированный чанк со старыми индексами разрешался по новому
  `__METRAVEL_SHARED_CHUNKS__` и тянул чужие shared-файлы — нужного модуля в
  реестре нет.
- **Controls:** shared-зависимости попадают в `targets` до раннего выхода
  (участвуют в хеше); манифест пишется путями; рантайм принимает путь и, для
  сборок до фикса, индекс. Гейт `__tests__/scripts/perf014-gh-stub-guard.test.ts`
  («names required shared chunks by hashed path…») проверяет порядок и формат в
  установленном node_modules и в патчах; `scripts/guard-bundle-budget.js`
  снимает префикс манифеста в обоих форматах.
- **Пробел:** модульные id Metro остаются порядковыми: чанк с неизменным
  содержимым ссылается на id ядра (`entry`/`__shared-0`) — если ядро
  перенумеруется, а чанк нет, ссылка съедет. Пока не наблюдалось (id
  стабильны при стабильном графе), но content-addressing ядра не доказан.
- **Последняя проверка:** 2026-09-04; фикс в `main`, прод пересобран с
  манифестом по путям. Диагноз «виноват кэш вернувшегося посетителя» оказался
  неверен: то же сообщение воспроизводится в чистом браузере — см.
  SHARED-CHUNK-ASYNC-TARGET-001.

### SHARED-CHUNK-ASYNC-TARGET-001 — shared-чанк как цель `import()` едет без соседей

- **Инвариант:** любой чанк, который рантайм может загрузить сам (его путь лежит
  в `paths` какого-нибудь модуля), обязан привезти с собой ВСЕ чанки, чьи
  определения требуют его фабрики синхронно. Для shared-чанков это отдельный
  манифест `__METRAVEL_CHUNK_DEPS__` с ТРАНЗИТИВНЫМ списком: рантайм читает
  манифест ровно одного запрошенного чанка и не обходит манифесты того, что
  только что загрузил.
- **Surface/owner:** web-экспорт, `patches/@expo+metro-config+57.0.3.patch`
  (`extractSharedChunks`, `linkSharedChunkDependencies`,
  `propagateOwnersThroughSyncEdges`), гейт `scripts/guard-chunk-closure.js`.
- **Симптомы:** маршрут то падает в корневой ErrorBoundary с
  `Requiring unknown module "<id>"`, то навсегда остаётся на SSG-скелетоне
  (гидратация не доходит до конца). Флаки: падение зависит от того, дошёл ли
  код до фабрики с недостающей зависимостью. 404 нет, файлы на месте, бюджеты и
  SEO-проверки зелёные.
- **Цепочка evidence:** 04.09.2026 — `/map` на проде отдавал
  `Requiring unknown module "1947"` в ЧИСТОМ headless-браузере (не кэш).
  Модуль 1947 = `useMapTravels` лежал в `__shared-24`; его требовал модуль 1980
  `useMapDataController` из `__shared-25`; `__shared-25` грузился как цель
  `import()` модуля 2143 из чанка `map`, а `__shared-24` не вёз ни HTML
  маршрута, ни чей-либо манифест. Статический прогон замыкания по выпуску:
  0 пробелов в стартовом наборе `/map` и 88 пробелов на async-целях
  (`__shared-10/20/22/24/25/7`).
- **Подтверждённые причины:** (1) shared-чанк получал `requiredChunks` только
  через владельцев-маршрутов, поэтому рёбер shared→shared не существовало и
  манифест для него не писался вовсе; (2) замыкание владельцев по синхронным
  рёбрам выполнялось ДО слияния групп с одинаковым набором маршрутов, а слияние
  объединяет владельцев — группе, которую влили, никто не передавал её
  владельцев дальше по её же зависимостям.
- **Controls:** `linkSharedChunkDependencies` строит транзитивные рёбра
  shared→shared в отдельном поле `sharedDependencies` — оно идёт в манифест и в
  хеш имени, но НЕ в `metadata.requires` (HTML-сериализатор топологически
  сортирует это поле и падает на цикле, а shared-чанки ссылаются друг на друга в
  обе стороны). Замыкание владельцев прогоняется второй раз после слияния.
  `scripts/guard-chunk-closure.js` (`npm run guard:chunk-closure`) проверяет оба
  пути доставки на каждом наборе маршрутов и стоит в `build-prod.sh` сразу после
  экспорта, до генерации SEO.
- **Пробел:** гейт разбирает выпуск регуляркой по `__d(...)` — смена формата
  сериализации Metro сделает его молча пустым; на такой случай он печатает число
  найденных чанков и наборов маршрутов.
- **Последняя проверка:** 2026-09-04; на прод-выпуске до фикса гейт падал,
  после — «55 наборов маршрутов, 202 чанков — замыкание полное», `/map`
  рендерит карту и список.

### BACK-NAV-SINGLE-OWNER-001 — «назад» описан один раз

- **Инвариант:** правило «сначала настоящая история переходов, иначе запасной
  экран» живёт только в `utils/backNavigation.ts` (`goBackOrReplace`); экраны
  зовут его и не переписывают `canGoBack() ? back() : replace(...)` от руки.
- **Surface/owner:** frontend-навигация, все кнопки/ссылки «Назад» на web и
  native, аппаратная кнопка Android через `hooks/useAndroidBackHandler.ts`
  (отдельный механизм без replace-фолбэка — единственное сознательное
  исключение).
- **Симптомы:** соседние экраны ведут себя по-разному на прямом входе по
  ссылке — один уводит с сайта, другой на Главную, третий кладёт запасной экран
  поверх; «Назад» из статьи уводит не туда, откуда пришли.
- **Цепочка evidence:** `#573` — «Назад» из статьи кидал на Главную вместо
  предыдущего экрана (Android QA); `#1725` — с главной по подсказке попадаешь на
  `/search` без «Назад», заведён `goBackOrReplace`, переведены три места;
  `#1727` — код-ревью `#1725` нашло ещё пять рукописных копий
  (`PublicTripsCatalog`, `privacy-settings`, `TravelDetailsBackButton.native`,
  `article/[id].native`, `useTravelWizard.handleExit`), одна из них с
  `push`-фолбэком вместо `replace`.
- **Подтверждённые причины:** единая точка появилась 03.09.2026, копии — код,
  написанный до неё; без гейта новая копия заводится в НОВОМ экране и проверка
  «только изменённого» её не видит.
- **Controls:** `goBackOrReplace(router, fallback, { fallbackMode })` —
  единственная реализация, `fallbackMode: 'push'` для экранов, где запасной
  экран сознательно кладётся поверх. Сам вызов `canGoBack()` вне chokepoint и
  `useAndroidBackHandler` ловит `npm run guard:no-inline-back-navigation`
  (безусловно в `check:fast`); тесты `__tests__/utils/backNavigation.test.ts`
  и `__tests__/scripts/guard-no-inline-back-navigation.test.ts`.
- **Пробел:** гейт построчный — копия через `router['canGoBack']()` или идиома
  без `canGoBack` (`try { back() } catch {}`) не ловится; runtime-поведение
  native-экранов (аппаратная кнопка в статье, деталь травела по deep link)
  доказывается только на устройстве.
- **Последняя проверка:** 2026-09-03; `#1727` в `main` (`e87cd7de5`), гейт
  зелёный на дереве и падает на нарочно добавленной копии; web-проба прямого
  входа `/trips` → `/` (с ростом history) и `/privacy-settings` → `/profile`.

### API-PAGE-SIZE-CAP-001 — завышенный `perPage` не гарантирует полный набор

- **Инвариант:** клиент, запрашивающий «всё одним запросом», обязан сверить
  число полученных записей с `count`/`total` из ответа и дочитать хвост; размер
  страницы для расчёта берётся ФАКТИЧЕСКИЙ, а не запрошенный.
- **Surface/owner:** frontend API-слой; серверная величина — DRF-пагинаторы
  бэкенда (`metravel/common/view_paginator.py` `max_page_size = 100`,
  `user_points/views.py` `max_page_size = 200`, `quests/views.py` 200,
  `travel_comments`/`messaging` 50).
- **Симптомы:** список молча обрывается на круглом числе (100/200/50) без
  ошибки и без пустого состояния; счётчик на экране расходится с профилем или с
  `count`; «дубль» при повторном действии над записью, которой нет в индексе.
- **Цепочка evidence:** `#1705` — календарь, вкладка «Был» показывала ровно 100
  из 368 авторских путешествий (`stores/travelStatusStore.ts`
  `fetchAuthoredTravelStatusEntries`, `perPage: 9999`); прямая проба
  `GET /api/travels/?perPage=9999` вернула `count: 310` при 100 записях.
  `#1706` — тот же паттерн в `components/travel/hooks/usePointListSavedModel.ts`
  и `hooks/map/useSavedPointToggle.ts` (`getPoints({ perPage: 1000 })` против
  кап 200), дефект не подтверждён пробой. Семейный прецедент: `#1238`/`#1240`
  (тот же серверный кап, но код честно листал `next` — цена была в fan-out
  запросов, не в потере данных); `#749`/`#752` (зеркальная причина: бэкенд
  сначала вовсе игнорировал пагинацию, кап появился как результат фикса).
- **Подтверждённые причины:** `page_size_query_param` молча зажимается
  `max_page_size` — сервер отвечает `200 OK` с усечённым `results`, и отличить
  «всё» от «первая страница» можно только по `count`. Фронтовые обёртки часто
  выбрасывают `count`/`next` и возвращают голый массив (`api/userPoints.ts`),
  из-за чего у вызывающего кода рычага для проверки уже нет.
- **Controls:** правило «делить `count` на фактическую длину первой страницы»
  живёт единственной функцией `resolveTotalPages()` в `utils/fetchAllPages.ts`
  (там же `fetchAllPages()` — готовая докачка для тех, кому хватает простого
  «первая страница → остаток одним заходом»); фолбэк на кэш вместо пустого
  списка при отказе одной из страниц. Появление новой инлайн-копии правила
  ловит `npm run guard:no-inline-page-fetch-loop` (в наборе `check:fast`).
- **Пробел:** закрыт `#1710`. Три копии сведены к одному владельцу правила:
  `stores/travelStatusStore.ts` переведён на `fetchAllPages()`,
  `api/quests.ts` сохранил собственную обвязку (спекулятивные страницы,
  404-как-конец каталога, дочитывание по `next`) под неконфликтующим именем
  `fetchAllQuestPages`, но число страниц берёт из `resolveTotalPages()`.
- **Решение для новой карточки:** прежде чем чинить конкретный экран, проверить
  `grep -rn "perPage: *[0-9]\{3,\}"` и сверить каждый найденный вызов с
  `max_page_size` соответствующего пагинатора.
- **Последняя проверка:** 2026-09-02; `#1705` закрыт, `#1706` не подтверждён,
  `#1710` закрыл структурный пробел (один владелец правила + guard в CI).

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
- **Recurrence Log — 2026-08-31 (TestFlight 1.0.5 (4), public
  `/api/feedback/`):** contact form на iPhone показывает общий белорусский
  заголовок frontend-toast «Памылка адпраўкі»; подзаголовок и HTTP status в
  screenshot-report не читаются, поэтому конкретная server-response ветка этим
  кадром не доказана. Независимый source audit цепочки
  `ContactForm` → `sendFeedback` → `api/misc.ts::publicPostInit` →
  `POST /api/feedback/`. Принятый в `#1045` helper подписывал native AllowAny
  POST токеном из SecureStore и не исключал native cookies явно: stale header
  token превращает публичный endpoint в `401`, а cookie-auth на unsafe POST
  может вернуть CSRF `403`. Это повторно нарушает принятый `#1045` инвариант
  «публичный POST не зависит от состояния авторизации» в том же chokepoint;
  verdict — `reopen #1045`, related history `#110/#923/#849/#850`. Прежний Done
  gate проверил Android `/api/subscribe/` с актуальной сессией, но не iOS cookie
  jar, stale-token control, `/api/feedback/`, AI-chat и локализацию `451`.
  Постоянный control: публичный helper всегда отправляет `credentials: 'omit'`
  без `Authorization`; unit coverage держит feedback/subscribe/AI-chat на
  web/native boundary со stale auth-state, а native UI coverage исключает
  browser honeypot на iOS и Android. Ошибка недоступной доставки `451`
  локализуется на RU/BE/UK/PL/EN. Сам `451` соответствует контракту
  `#850` и не доказывает backend-рецидив: SMTP/config/queue/zero-delivery owner
  определяется отдельной production-пробой; та же credential/config причина
  переоткрывает `#849`, другая причина создаётся linked к `#849/#850`.
- **Последняя проверка:** `#923 done`; recurrence `#1045` подтверждён
  2026-08-31 и ожидает board reopen после review.

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

### OPS-NGINX-COPY-001 — правка конфига, которую никто не деплоит

- **Инвариант:** конфигурация nginx меняется только в
  `deploy/prod/nginx/nginx.conf` backend-репозитория. `nginx/nginx.conf` во
  frontend-репозитории — read-only копия: её не читает ни один скрипт, и правка
  в ней не меняет прод ни на байт.
- **Surface/owner:** backend/ops; frontend workspace read-only, изменение
  оформляется задачей `area=back` с точным диффом директив.
- **Цепочка:** `#472 (wont_do)` → `#966 (done)` → `#1508`.
- **Подтверждённая причина recurrence:** файл в репозитории выглядит как
  конфигурация и правится как конфигурация, а прод берёт правила из другого
  репозитория. 2026-06-21 так «включили» `emrldtp.cc`; 2026-08-19 — домены Apple
  для веб-входа (`d45b2429`, фича `#1506`). В обоих случаях правка попала в
  `main`, а прод-политика осталась прежней. Прежние фиксы закрывали конкретный
  домен, а не свойство «копию можно принять за источник правды».
- **Controls:** правило в `docs/RULES.md` → «Nginx config ownership (mandatory)»
  и `AGENTS.md` §3; баннер в шапке `nginx/nginx.conf` с источником и датой
  снимка; сам файл приведён к снимку backend `origin/master`, чтобы в копии не
  оставалось правок, которых нет на проде; факт проверяется не чтением файла, а
  `curl -sI https://metravel.by/` и
  `git -C ../metravel-backend show origin/master:deploy/prod/nginx/nginx.conf`.
- **Решение для новой жалобы:** фронтовой фиче не хватает правила nginx —
  `create-linked` к `#1508` с точным диффом директив. Правка локальной копии
  вместо задачи бэку — рецидив этой семьи, а не выполненная работа.
- **Последняя проверка:** 2026-08-19; `#1508` в `todo`, прод-CSP без доменов
  Apple (проверено `curl -sI https://metravel.by/`).

### NGINX-TRAVEL-EDIT-SHELL-001 — редактор получает общую 404-оболочку

- **Инвариант:** валидный приватный веб-маршрут редактора
  `/travel/<numeric-id>` отдаёт HTTP 200 с Expo-шаблоном
  `travel/[id].html`, `Cache-Control: no-store` и
  `X-Robots-Tag: noindex, nofollow`; серверная и первая клиентская разметка
  принадлежат одному дереву маршрута. Общий `+not-found.html` не может
  использоваться как оболочка существующего редактора.
- **Surface/owner:** маршрутизация nginx на стороне бэкенда и эксплуатации;
  desktop web и mobile web. Канонический
  `deploy/prod/nginx/nginx.conf` находится в backend-репозитории; из этого
  frontend workspace его можно только анализировать, но нельзя менять.
- **Цепочка:** `#1312` — тот же класс пропущенного правила динамической
  оболочки для `/trips/{id}` и `/trips/plan/{id}`; `#1512` — соседний резервный
  шаблон для `/travels/<id|slug>`, который явно исключает маршрут редактора;
  каноническая задача — `#1524`. Симптом React `#418` исторически встречался в
  `#1299`, но там причина была в порядке гидратации фронтенда и потому задача
  не переоткрывается.
- **Подтверждённая причина:** в production nginx отсутствует отдельный
  `location` для `/travel/<id>`. Общий `location /` проверяет физические
  `$uri`, `$uri.html`, `$uri/index.html`, получает 404 и через глобальный
  `error_page 404 /+not-found.html` отдаёт чужой SSG-документ. При этом нужный
  `/travel/%5Bid%5D.html` уже опубликован и отвечает 200. Авторизованный клиент
  затем загружает существующее путешествие и заменяет дерево 404-страницы
  редактором: браузер на production воспроизводит React `#418`, а в
  пользовательском логе следом идут `#185` и `Step 2 error`. Причинная связь
  `#185` с nginx пока не доказана: контролируемый импорт фото отдельно её не
  воспроизвёл.
- **Controls:** регрессионный тест бэкенда для канонического nginx-конфига
  должен удерживать числовое регулярное выражение, точный резервный шаблон
  `/travel/[id].html`, `no-store`, `X-Robots-Tag: noindex, nofollow`, все семь
  заголовков безопасности и неперехват `/travel/new`; release gate — реальный
  `nginx -t` и HTTP-матрица после деплоя для `/travel/<id>`, `/travel/new`,
  неизвестного URL и соседних динамических маршрутов. Браузерная проба
  редактора на desktop/mobile подтверждает отсутствие `#418`; `#185` после
  правильной оболочки перепроверяется отдельно и не заменяет принадлежащий
  бэкенду HTTP/nginx Done gate.
- **Решение для новой жалобы:** общая 404-оболочка или ошибка гидратации на том
  же правиле `/travel/<id>` — `reuse` открытый `#1524` либо `reopen #1524`, если
  он уже закрыт. Другой динамический маршрут без своего Expo-шаблона —
  `create-linked` к `#1524/#1312`; сбой API загрузки с отдельным HTTP-ответом к
  этой семье не относится.
- **Последняя проверка:** 2026-08-21; на production `/travel/591?returnTo=%2Fmetravel`
  отдаёт 404 с `+not-found.html`, `/travel/%5Bid%5D.html` и `/travel/new` — 200;
  `#1524` создан в `todo`.

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

### OFFLINE-002 — персональные данные в общем кэше устройства

- **Инвариант:** публичный offline payload не содержит состояние текущего
  аккаунта; после выхода A или входа B чужая оценка/прогресс не появляется.
  Общий рейтинг, его количество и счётчики комментариев сохраняются.
- **Surface/owner:** shared frontend persistence; ключи прогресса квестов,
  `api/questBundleCache.ts`, travel/article adapters в `services/offline/`.
- **Цепочка:** `#1456` (прогресс квеста без user-scoped ключа) → `#1793`
  (персональные поля каталога квестов) → `#1799` (travel/article `user_rating`).
  Это одно семейство изоляции аккаунтов с разными носителями данных.
- **Подтверждённая причина #1799:** оба builder явно переносили `user_rating`
  в `authScope: public`, а оба reader возвращали legacy snapshot без фильтра.
  Исправление каталога квестов в #1793 эти адаптеры не покрывало.
- **Permanent control:** исключать персональные поля из allowlist записи и
  снимать их из копии при чтении старого пакета. Публичные авторские metadata
  и агрегаты не являются состоянием читателя. Для travel/article regression —
  `__tests__/services/offlineContentSnapshots.test.ts`: write/read по id и slug,
  legacy `user_rating` (5/0/null), сохранность агрегатов и online-объекта.
- **Testing gate:** на локальном стеке A оценивает и сохраняет оба материала;
  после logout и отдельно login B реальное отключение сети в загруженном
  приложении не показывает «Ваша оценка». Затем reconnect: своя оценка A и
  повторная отправка работают. API-ответы не подменяются.
- **Решение при рецидиве:** для тех же travel/article adapters переоткрывать
  #1799; другой носитель персонального состояния оформлять linked task с
  отдельной причиной и проверкой write/read legacy.

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
- **Observed recurrence 2026-08-19:** второй симптом того же корня — не потеря
  данных, а перегрузка. При редактировании описания `travel/619` автосейв выдал
  ~20 `PUT /travels/upsert/` подряд, каждый убит клиентом на ~5,05 с
  (`(canceled)` / nginx `499`) и при этом полностью выполнен сервером; прод ушёл
  в `CPU sustained high: 100%, load1=1.70 on 1 core`. Усилители: дебаунс 5 с при
  сохранении 11–12 с; безусловный `abort()` предыдущего запроса в prod-версии
  `useImprovedAutoSave`; `select_for_update` на строке travel, удерживаемый до
  commit, из-за чего конкурентные сохранения одной статьи сериализуются;
  клиентский таймаут 30 с, добавляющий повторы; предохранитель
  `endpointLimits: { '/travels/upsert/': 120 }`, который в такой аварии не
  срабатывает никогда. Дополнительно вскрыто: `TravelTextVersion` пишется на
  каждый тик автосейва при retention 10, из-за чего история версий покрывает
  около минуты и заявленная защита от затирания не выполняется.
- **Канонический контракт (заведён 2026-08-19):** BE `#1513` (разделение
  content-save и full-replace), BE `#1514` (горизонт версий текста), BE `#1515`
  (стоимость структурного сохранения); FE `#1511` (единственность летящего
  сохранения и запрет самоотмены), FE `#1516` (переход на узкий content-save,
  blocked by `#1513`), FE `#1517` (устранение дремлющих движков и честный
  статус). Спецификация поведения:
  `openspec/changes/stabilize-travel-article-autosave/`.
- **Решение для новой жалобы:** потеря серверных полей при save — `reuse`/`reopen`
  canonical save-contract task `#1513`; перегрузка/шторм сохранений — `#1511`;
  dialog/key lifecycle остаётся `WIZARD-DRAFT-001`, а не смешивается с API
  replace semantics.
- **Постоянное исправление выполнено (2026-08-25, FE `#1516`):** фоновое
  автосохранение правок текста больше не идёт через full-replace. Выбор пути —
  `utils/travelContentSaveDelta.ts`: если относительно подтверждённого
  сервером baseline изменился только текст существующей статьи, уходит узкий
  `PATCH /travels/{id}/content/` (BE `#1513`), который не трогает точки,
  галерею, обложку, справочники и статус публикации. Полный
  `PUT /travels/upsert/` остался для структурных правок, создания статьи,
  ручного сохранения и публикации — то есть destructive race surface у
  фонового сейва текста снят, а не расширен. Frontend merge-workarounds
  сохраняются: они по-прежнему обслуживают полный путь, их removal plan не
  входил в `#1516`. Предохранитель приведён к измеренной частоте автосейва
  (≤12/мин): `/travels/upsert/` — 40/мин, `/travels/*/content/` — 20/мин.
- **Последняя проверка:** 2026-08-25; recurrence 2026-08-19 закрыт на обеих
  половинах контракта (BE `#1513`, FE `#1516`).

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
- **Ловушка диагностики — редирект держит бэкенд, а не манифест (2026-08-31):**
  докстринг `scripts/seo-rename.js` до 31.08.2026 описывал УСТАРЕВШУЮ модель —
  «пара `{from,to}` в `scripts/seo-redirects.json` → `generate-seo-pages.js`
  выпускает soft-301 стаб старого URL», — как будто production-редирект держится
  на фронтовом манифесте; тем же изменением, что и эта запись, докстринг
  переписан. На самом деле редирект создаёт бэкенд: `Travel.save()`
  (`../metravel-backend/travels/models.py:610-631`) безусловно и синхронно
  заводит `TravelSlugRedirect` при любом изменении slug, то есть уже внутри
  самого `PUT /api/travels/upsert/` (`_set_name_and_slug`,
  `upsert_travel_service.py:218`, кладёт `slug` в `_dirty_fields`, а `:557`
  вызывает `save(update_fields=…)` — сам `save` снимает старый slug только когда
  тот попал в этот список, `models.py:622`). Публичный маршрут отдаёт алиас,
  пока статья остаётся `publish=1, moderation=1`
  (`travels/views_public.py:23-29`). Отсюда вывод, на котором 31.08.2026 чуть
  не завели карточку: провал verify-GET в `seo-rename.js` (шаг 3 докстринга,
  `renameOne()` → `getTravel()`, который бросает на любой не-200) НЕ оставляет
  старый slug живым 404 — алиас к этому моменту уже создан, теряется только
  запись в манифесте. Прежде чем заводить карточку на «потерянный редирект» в
  этом скрипте, проверять бэкенд-алиас, а не только фронтовый манифест: `#1083`
  прямо запрещает считать статический стаб production-редиректом, `#1249`
  фиксирует, что пары от `seo-rename.js` работают сразу, а `#1234` — 20/20
  one-hop 301 без осиротевших случаев. Манифест и алиасы штатно расходятся
  (замер 31.08.2026 по локальной копии прод-базы: 289 строк
  `TravelSlugRedirect` против 219 пар в `seo-redirects.json`), потому что
  `scripts/seo-alias-backfill.js` манифест не пишет вовсе, плюс четыре
  бэкенд-миграции backfill'а (`0045`, `0049`, `0050`, `0052`) — расхождение
  само по себе не признак дефекта.
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
- **Замечание про терминологию (2026-09-04, `#1759`):** «meta description» в
  карточках значит две разные вещи, и их регулярно путают. Хранимое поле
  `travel.meta_description` в сборке сниппета НЕ участвует:
  `buildTravelSeoDescription` (`scripts/generate-seo-pages.js:441-442`, вызов
  `:3681`) строит `description`/`og:description`/`twitter:description` из тела
  статьи — `stripHtmlToSnippet(detail.description, 160)`. Поле читают только
  бэкенд-рассылки: дайджест маршрутов (`send_routes_digest.py:55`) и уведомления
  о контенте (`content_notifications.py:139`), лимит 255 задан моделью
  (`travels/models.py:456`). Известно с `#678` (2026-07-03) и записано
  комментарием в `scripts/seo-audit.js:147`. Рычаг правки сниппета —
  `seo-edit.js --desc-file` (тело/лид), а не `--meta`; жалоба «мета не долетает
  до сниппета» закрывается этой записью как not-a-defect, без повторного разбора.
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
- **Вариант на классификацию входа (2026-09-01, `#1686`):** пять прежних
  случаев закрывали пустой, опечатанный, непроверенный или неканонично
  записанный вход, но не вход, который тихо попал не в тот агрегат.
  `/quests/country/<alias>` по общей эвристике вложенного quest-URL считался
  `quest-page`, поэтому индексация стран растворялась в статистике отдельных
  квестов. **Control:** отдельный kind `quest-country` со своим `KIND_LABELS`;
  загрузчик живого `sitemap.xml` до фильтрации `--section` сверяет каждый адрес
  с единым списком стабильных route-family shapes: numeric quest detail,
  country landing, одноуровневые city/travel URL и точные static routes.
  Неизвестные вложенные формы вроде `/quests/foo/bar` и `/travels/foo/bar`
  падают, пока классификатор и подпись отчёта не будут обновлены. Функциональные
  регрессы фиксируют `/quests/krakow`, `/quests/1/krakow-dragon`,
  `/quests/scenario` и отдельную country-ветку рядом с numeric detail и city.
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
  (8 потоков ≈ 15 мин при квотах 2000/день и 600/мин). Ставка меняется в разы:
  замер 25.08.2026 (7 адресов подряд, `--delay 0`) дал ~6,7 с на адрес, то есть
  673 адреса ≈ 75 минут последовательно. Перед планированием прогона мерить
  заново на `--limit`, а не брать число отсюда.
- **Пятый случай — слепая зона по охвату (2026-08-25, `#1559`):** тот же монитор,
  но сломан не разбор ответа, а сама выборка. `index-status.js` по построению
  обходил только `/travels/` автора 1 — 310 адресов из 673 в `sitemap.xml`, то
  есть 46% сайта. Квесты (268 адресов вместе с `/quests` и `/quests/scenario`),
  статьи остальных авторов (91) и 4 статические страницы не проверял ни один
  прогон за всю историю — 310 + 268 + 91 + 4 и есть те самые 673, — поэтому 17
  городских страниц квестов вне индекса Google не были видны, пока не сняли
  ручной срез по всему sitemap.
  Отличие от `#1325` важно для диагностики: там прогон брал ноль объектов и
  печатал зелёный ноль, здесь он честно брал свои 310 и честно о них
  отчитывался — врало не число, а умолчание, что 310 и есть весь сайт.
  Отчётный инструмент обязан называть не только результат, но и охват.
- **Controls (`#1559`):** `--section articles|travels|quests|all`, где выборка
  нестатейных разделов читается из живого `sitemap.xml`, а не из списка одного
  автора; разбивка «в индексе / вне индекса» по видам страниц в отчёте и в
  JSON (`byKind`: travel / quest-page / quest-city / quest-country / static —
  это не значения `--section`, и поле названо так, чтобы их не путали);
  `requireNonEmptySelection` и на карте сайта, и на её фильтре по разделу —
  пустой `--section quests` при непустом sitemap падает так же, как пустой
  список статей; `--user-id` вне `--section articles` отвергается, а не
  игнорируется молча; `npm run stats:index:all` встал в `seo-daily` шагом 1.2
  (раз в неделю, ~680 проверок из суточной квоты 2000).
- **Ловушка длинного прогона (`#1559`, поймана на ревью):** расширение охвата
  сделало прогон длиннее, чем живут его собственные ключи. URL Inspection
  отвечает ~6,7 с на адрес (замер 25.08.2026), 673 адреса ≈ 75 минут, а
  `access_token` Google живёт 3599 с (проба того же дня). Токен брался один раз
  перед циклом — до `#1559` это было безопасно, потому что самый длинный прогон
  (310 статей ≈ 36 минут) укладывался в час. На `--section all` токен умирал бы
  на середине, и хвост примерно в 150 адресов пришёл бы как `HTTP 401`, то есть
  лёг бы в отчёт как «не в индексе»: сбой авторизации в роли вердикта Google —
  ровно тот жанр, от которого заведена вся семья. Контроль: токен
  перевыпускается по возрасту (45 минут) и принудительно на первый 401;
  неудачный перевыпуск обнуляет кэш, чтобы прогон падал, а не копил ошибочные
  строки; в отчёте и в JSON появилось поле «не проверено» — счётчик адресов без
  ответа, отдельно от «не в индексе».
- **Последняя проверка:** 2026-08-25 (ревью) — `stats:index --section quests
  --limit 1|3` на живом проде даёт реальные coverageState и замер 6,7 с на
  адрес; `parseSitemap` на боевом `sitemap.xml`: 676 `<loc>` → 673 адреса (три
  дубля городских страниц схлопнуты), классификация 401 travel / 156 quest-page
  / 110 quest-city / 6 static, ни одного нераспознанного адреса. До этого —
  `stats:index --section quests --limit 4`: адреса берутся из sitemap, отчёт
  даёт разбивку по видам страниц; `--section quets` и `--section all --user-id
  1` отвергаются кодом 2 вместо тихого отката к умолчанию; дефолтный
  `stats:index --limit 1 --json` отдаёт прежние поля (`userId: "1"`,
  `byCoverageState`, `problems`) плюс новые. До этого: 2026-08-08 —
  `stats:index --limit 5` берёт 5 статей и даёт реальные coverageState;
  несуществующий автор роняет прогон с внятным сообщением вместо зелёного
  отчёта.

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
- **Controls:** `buildQuestCityLandingGroups()` собирает alias-лендинг из
  объединения `city_id`; `scripts/verify-static-quest-seo.js` требует, чтобы
  alias-лендинг ссылался на каждый квест всех своих `city_id`, иначе сборка
  падает до rsync.
- **Решение для новой жалобы:** неполный список квестов на городской посадочной
  — `reopen`; тот же класс «сегмент URL адресует сущность шире, чем ключ
  генерации» на другом слое — `create-linked`.

### QUEST-CITY-LANDING-VALUE-001 — городской URL ценнее единственной карточки квеста

- **Инвариант:** каждый индексируемый и включённый в sitemap адрес
  `/quests/<alias>` несёт самостоятельную ценность сверх дочерних карточек:
  обзор прогулки по городу, практику планирования и catalog-derived
  перелинковку на соседние quest-города; при наличии данных — ссылки на
  travel-статьи. Это правило действует и при ровно одном квесте в городе.
- **Surface/owner:** frontend quest city route + SSG/build verifier
  (`app/(tabs)/quests/[city]/index.tsx`, `utils/questCityAlias.js`,
  `scripts/generate-seo-pages.js`, `scripts/verify-static-quest-seo.js`),
  canonical task `#1569`. Production `sitemap.xml` принадлежит Django и
  для фронтового verifier является внешним input.
- **Цепочка:** 2026-08-25 полный URL Inspection из `#1559` показал 17 городских
  страниц вне индекса; 11 уже были «Обнаружена, не проиндексирована». В
  фактическом `GET /api/quests/` 96 из 113 логических городов имели ровно один
  квест, поэтому их лендинг вырождался в оболочку единственной карточки.
- **Подтверждённая причина:** техническая разметка была исправна (`200`, title,
  description, self-canonical, H1, SSG marker, sitemap), но шаблон не содержал
  city-owned секций. Повторная подача URL не меняет этот structural thin-content
  класс.
- **Controls:** `buildQuestCityLandingGroups()` строит правило из всего
  пагинированного каталога без списка городов и объединяет дубли `city_id` по
  canonical alias; SSG пишет обязательные `data-ssg-quest-city-overview` и
  `data-ssg-quest-city-practical`; verifier проверяет эти поля, отличие metadata
  от единственного child, self-canonical и присутствие canonical alias в
  живом backend-owned `${API_BASE}/sitemap.xml`. Пустой/недоступный
  quest catalog или sitemap роняют build до rsync; HTTP 200/3xx остаются
  post-deploy-контрактом.
- **Решение для новой жалобы:** исчезло самостоятельное содержание или новый
  одно-квестовый город не прошёл guard — `reopen #1569`; страновая посадочная
  (`/quests/country/<alias>`) — отдельный продуктовый контракт, `create-linked`.
- **Последняя проверка:** 2026-08-27, локальный targeted/smoke: logical one-quest
  group создаёт `/quests/rome`, SSG содержит обязательные city-only секции,
  self-canonical и каталоговые ссылки; production deploy и повторный
  пятидневный индекс-срез остаются Done gate после review.
- **Осталось на бэкенде:** дубли городов в справочнике (`area=back`) — фронт их
  только переживает, но не устраняет.
- **Второй surface, подтверждён 2026-08-25:** предсказанный выше бэкенд-рецидив
  случился. Прод `sitemap.xml` содержит `/quests/gomel`, `/quests/grodno` и
  `/quests/mogilev` дважды каждый: `QuestCitySitemap.items()`
  (`../metravel-backend:maintenance/sitemap.py:109-115`) строит список по
  `city_id`, а не по алиасу, и два `city_id` одного города дают два элемента с
  одинаковым `location()`. До `#1569` фронтовый verifier проверял только
  SSG-вывод и не читал backend sitemap. Теперь build проверяет
  alias-membership в живом backend input, но дедупликация элементов и
  сама генерация остаются backend-обязанностью. Заведена `area=back`
  карточка; фронт только проверяет границу владения.
- **Кто владеет прод-`sitemap.xml` (ловушка, стоившая полудиагностики
  2026-08-25):** карту генерирует бэкенд —
  `../metravel-backend:maintenance/sitemap.py` через `django.contrib.sitemaps`, а
  nginx эксклюзивно проксирует `location = /sitemap.xml` на апстрим `app:8000`
  раньше любой раздачи статики. Фронтовый `scripts/generate-sitemap.js` не
  вызывается ниоткуда — ни из `build-prod.sh`, ни из `package.json`, — но
  объявляет собственный `STATIC_ROUTES` и выглядит источником правды. Тот же
  класс ловушки, что локальная копия `nginx.conf` в `OPS-NGINX-COPY-001`:
  прежде чем чинить sitemap во фронте, проверь, кто его на самом деле отдаёт.
- **Последняя проверка:** 2026-07-29, против живого каталога: 6/5/4 квеста
  вместо 3/3/3, 0 из 92 alias-лендингов нарушают инвариант, гвард роняет сборку
  на старом last-write-wins выводе. Фронтовый инвариант с тех пор держится;
  бэкенд-surface (sitemap) впервые проверен 2026-08-25 и нарушен.

### QUEST-COUNTRY-LANDING-001 — одна страна имеет один catalog-derived URL

- **Инвариант:** каждый валидный ISO alpha-2 с хотя бы одним routable квестом
  создаёт ровно один `/quests/country/<alias>` с уникальными квестами и
  canonical city groups. Missing/invalid code не создаёт страницу, а новый
  валидный код не требует изменения allowlist.
- **Surface/owner:** frontend country route, общий ISO/alias model, SSG и build
  verifier (`app/(tabs)/quests/country/[country]/index.tsx`,
  `utils/questCountryLanding.js`, `scripts/generate-seo-pages.js`,
  `scripts/verify-static-quest-seo.js`), canonical task `#1607`. Production
  sitemap принадлежит Django task `#1606`.
- **Цепочка:** пользователь 2026-08-27 выбрал точную схему
  `/quests/country/<alias>` с контрольными `BY → belarus` и `PL → poland`.
  `#1569` остаётся владельцем city value; country layer создан как
  `create-linked`, потому что вводит новую агрегированную сущность URL.
- **Подтверждённая причина:** каталог умел группировать страны только внутри
  `/quests`, но у группы не было route, self-canonical, самостоятельного
  контента и SSG-документа. Affiliate slug-map неполон и partner-specific,
  поэтому не может быть источником канонических URL.
- **Controls:** полный ISO alpha-2 set валидирует вход, а locale-neutral alias
  выводится из English ISO display name; группы строятся из всего каталога до
  city merge, чтобы одинаковый city alias в разных странах не смешал квесты.
  SSG обязан содержать `data-ssg-quest-country-overview`, `-cities` и
  `-practical`, self-canonical, все city/quest links; генерация fail-closed
  требует собственный Expo route template `quests/country/[country].html`,
  чтобы не выпустить country HTML с hydration bundle городского route.
  Неизвестный runtime alias
  возвращается в `/quests`, fallback-template получает `noindex`.
- **Release boundary:** обычный frontend build проверяет country HTML, но не
  падает из-за ещё не раскатанного `#1606`. После согласованного deploy
  membership backend sitemap включается явно флагом
  `--verify-country-sitemap`; HTTP 200/no-3xx остаётся post-deploy gate.
- **Решение для новой жалобы:** пропала или смешалась country group, alias либо
  SSG-секция — `reopen #1607`; sitemap не публикует уже существующую страницу —
  `reopen #1606`.

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
  `3-fort`, плюс постоянный контроль) → #1461 (контур расширен на подпись места
  `location`, объём измерен, кросс-шаговый класс в печати признан ограничением
  формата) → #1467 (правка контента 17 шагов с утечкой в подписи) → #1488
  (поверхность интро/финала: скан научен читать текст уровня квеста, класс
  измерен, 18 утечек переписаны, остаток закрыт baseline) → #1540 (поверхность
  заголовка квеста: класс измерен, одна утечка переписана, остаток закрыт
  baseline, SEO-канал уточнён пробой).
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
  тексте шага по всей базе прода, по одному квесту (`--quest-id=`) или по
  локальному `scripts/<city>-quest-data.js` ДО заливки (`--source=`); exit 1 при
  находке. Порог совпадения — 3 символа: на 912 шагах с непустым `hint` он даёт
  ноль ложных срабатываний и находит все три известных кейса. Набор полей —
  `--fields=hint,story,title,task,location`; по умолчанию (#1467) сканируются
  `hint` и `location` — оба контура вычищены до нуля на проде, поэтому любая
  находка в них означает НОВУЮ утечку. `title`/`story`/`task` ШАГА в gate не входят:
  у них есть известные неразобранные находки, и включение любого из них уронило
  бы каждый прогон, после чего скан перестал бы отличать новую утечку от давно
  известной. Набор поверхностей — `--scopes=step,quest_title,intro,finale`, по
  умолчанию `step`, `quest_title` (#1540) и `intro` (#1488); остаток по тексту
  уровня квеста удерживает `--baseline=scripts/quest-hint-leak-baseline.json`.
- **Открытый риск 1: семантический класс.** Скан закрывает ТОЛЬКО буквальный
  класс. Семантический (подсказка пересказывает ответ определением, не совпадая
  ни одной буквой) остаётся открытым риском неизвестного объёма: сколько
  подсказок на базе пересказывают ответ определением — не измерено, сплошного
  прогона не было.
- **Открытый риск 2: соседние поля того же шага — `location` закрыт, три поля
  остались.** Утечка не ограничена полем `hint`: игрок видит до попытки ещё
  четыре поля шага. Сплошной прогон 18.08.2026 по проду (148 квестов, 1256
  шагов) до правок: `hint` — 0, `title` — 20, `story` — 26, `task` — 16,
  `location` — 17. `location` рендерится не только в печати, но и в мастере
  строкой под заголовком шага (`questWizardStepCard.tsx:468`), то есть класс бил
  по основному сценарию прохождения. Все 17 находок разобраны поштучно (#1461) и
  переписаны (#1467): подпись места теперь говорит, КУДА прийти, и не называет
  ответ («Ротонда Святого Георгия» → «Двор между Президентством и отелем
  „Балкан“, краснокирпичное здание среди римских руин», «Арт-объект „Пуговица
  фонарщика“» → «Арт-объект на мостовой ул. Советская», «Могила Влястимила
  Хофмана» → «Кладбище у костёла, надгробие художника»). На шести из этих шагов
  ответ дублировался в `title`/`story` того же шага (154, 206, 537, 538, 677,
  1190) — там правка захватила и их, иначе чистка подписи была бы косметикой.
  Повторный прогон `--fields=location` по проду: 0 находок, поле переведено в
  умолчание скана, а `check:fast` с #1467 гоняет его по каждому изменённому
  `scripts/*-quest-data.js` (`run-fast-scope-checks.js`, рядом с
  answer-reachability и mixed-script) — до #1467 скан не вызывался ни из
  `check:fast`, ни из CI, только руками. Осознанный остаток на этих же 17 шагах:
  у 677 `story` совпадает по «круг» внутри слова «вокруг» — артефакт
  подстрочного поиска; поле в умолчание не входит. Списки `title` (20), `story`
  (26) и `task` (16) по остальной базе поштучно не разбирались — отдельный
  разбор.
- **Вторая поверхность: текст УРОВНЯ КВЕСТА — измерен и взят под гейт (#1488).**
  «0 находок» #1467 относилось только к полям ШАГОВ: `scanQuests` обходил
  `quest.steps`, а интро и финал приходят отдельными ключами бандла
  (`scripts/lib/questBundles.js:78`), и скан их не читал вовсе. В #1488 контур
  добавлен: интро сверяется с ответами ВСЕХ шагов своего квеста, потому что
  игрок читает интро до первого шага. Поля интро шире полей шага
  (`title`/`location`/`story`/`task`) сознательно: у интро нет своего ответа,
  значит нет и самореференции, из-за которой `title`/`story` шага шумят
  закономерно.
  - **Две поправки к правилу совпадения, обе получены замером, а не на глаз.**
    Первая: на уровне квеста ищем только словарные значения, без чисел. Свип
    23.08.2026 дал 51 числовой хит в интро, и все 51 — адреса
    («Пролетарская, 5»), часы работы («9:00–18:00»), длина маршрута («3,7 км») и
    маркеры списка «Что делать: 1) 2) 3)», который стоит в каждом интро; у текста
    без своего вопроса одиночная цифра ответом не бывает. Вторая: подстрочного
    совпадения мало. Словарь ответов записан в именительном, а проза интро ставит
    слово в косвенный — «ротонда» шага 677 НЕ является подстрокой «ротонду» в
    интро `sofia-serdica-underfoot`, «пуговица» шага 538 — подстрокой «пуговице»
    в `brest-lantern`. Именно эти два примера завели карточку, и наивный скан их
    не нашёл бы. Поэтому к подстроке добавлена основа с начала слова: срезается
    ОДНО окончание и только если в остатке ≥4 букв (два символа превращают
    «мария» в «мар» и ловят «маршрут», порог в три оставляет от «роза» основу
    «роз» и ловит «розовый»).
  - **Замер и разбор.** Сплошной прогон по проду 23.08.2026: 149 квестов, 596
    текстов интро, **85 находок в 71 квесте**. Разобраны поштучно; 18 находок в
    27 квестах признаны настоящими утечками и переписаны через
    `apply-quest-patches.js` (29 патчей — интро правится тем же
    `PATCH /api/quest-steps/<id>/`, потому что интро это строка шага с
    `is_intro`), локальные `scripts/*-quest-data.js` синхронизированы (36 правок;
    у `vilnius-old-town` локального файла нет — правка только на проде).
    Показательные: `tbilisi-warm-city` называл имя царя из шага 404,
    `berlin-wall-line` — обе даты с таблички шага 528 и шляпу «светофорного
    человечка» шага 535, `spb-guardians` — орла шага 690, `karpacz-duch-gor` —
    вокзал шага 846, `glubokoe-cherry-baron` — фамилию Сухого шага 1139,
    `bratislava-coronation-crown` — «ядро» прямо в подписи места. Повторный
    прогон по проду: **67 находок**, ни одной новой. Ревью нашло в первой
    редакции две правки, где слово ушло, а утечка осталась или появился ляп:
    `karpacz-duch-gor` вместо «вокзала» получил «дом у железной дороги, откуда
    въехали первые туристы» — то же самое другими словами, а
    `soroca-round-fortress` — «не крепость с бастионами» через фразу после
    «крепость, каких больше нет». Обе переписаны второй волной патчей.
    Попутно вскрылось, что локальный `scripts/krakow-district-quests-data.js`
    отстал от прода: шаг `3-schindler` там всё ещё спрашивал номер дома при
    подписи места «ul. Lipowa 4» (прод этот вопрос давно заменил) — шаг
    синхронизирован с прода.
  - **Осознанный остаток — 67 находок, три класса.** (1) Совпадение внутри
    чужого слова: «крест» в «окрестностях», «купал» в «скупали», «ров» в
    «километров», «стол» в «столицами» — артефакт подстрочного поиска, тот же,
    что у шага 677. (2) Родовое существительное о ДРУГОМ объекте: «храм» в
    перечислении конфессий при вопросе о здании внутри крепости, «дерево» в
    «деревьями»/«деревне», «музей» в обороте «не спрятано в музее». (3) Слово,
    которым квест назван и без которого его не рассказать: «фонари» в квесте про
    единственного фонарщика страны, «корона»/«король» в квесте про коронации,
    «Полесье» в квесте про Пинск, «Гомель»/«Белград» в подписи места. Переписать
    их — не убрать утечку, а сломать текст.
  - **Гейт.** Поверхность `intro` входит в умолчание скана
    (`--scopes=step,intro`), а остаток удерживает baseline
    `scripts/quest-hint-leak-baseline.json` (121 ключ в 56 локальных файлах,
    обновляется `npm run quest:scan-hint-leak:baseline`) — тот же механизм, что у
    скана достижимости, и с #1488 он живёт в общем `scripts/lib/scanBaseline.js`,
    а не двумя копиями. Известное молчит, любая НОВАЯ находка роняет `check:fast`
    сразу. Без baseline контур пришлось бы держать вне умолчания, и он снова
    остался бы без охраны — ровно так интро и прожило между #1467 и #1488.
    - **Два свойства baseline, купленные на ошибках первой редакции.** (1) В
      baseline попадает ТОЛЬКО текст уровня квеста; находка ШАГА не уходит туда
      никогда, и фильтр стоит и на записи, и на чтении. Первая редакция сняла
      baseline с умолчанием `step,intro` и молча проглотила настоящую утечку
      подписи места (`krakow-podgorze` / `3-schindler`, «ul. Lipowa 4» при
      ответе «lipowa 4») — красный прогон стал зелёным. (2) Ключ строится на
      КАЖДОЕ слово-ответ отдельно, а не один на всю находку: при склейке автор,
      убравший из интро одно слово из трёх, получал «новую находку» на уже
      разобранном остатке.
  - **Финал в умолчание НЕ входит, и это не долг.** Замер 23.08.2026: 106 находок
    на 151 квест — две трети базы. Экран финала игрок читает ПОСЛЕ последнего
    шага, а сам текст по замыслу пересказывает пройденный маршрут; в печатной
    версии он и помечен спойлером («Не подглядывай раньше времени: финал читают
    после последней точки», `QuestPrintable.tsx:280`). Это принятое ограничение
    формата, как кросс-шаговый класс в печати. Измеряется флагом
    `--scopes=finale`.
- **Третья поверхность: ЗАГОЛОВОК квеста — измерен и взят под гейт (#1540).**
  Название квеста — самостоятельный ключ бандла, НЕ `intro.title`. Маппинг
  прод-бандла в `loadFromApi` перечислял ключи руками и `title` в список не
  включал, поэтому поверхность молча читала undefined: максимальный прогон
  `--fields=hint,story,title,task,location --scopes=step,intro,finale` по таким
  квестам отвечал «утечек нет». Локальный `loadLocalBundles`
  (`scripts/lib/questBundles.js:82`) `title` носил с самого начала — то есть
  `--source` и `--api-url` расходились. Маппинг вынесен в `toScanBundle` и
  покрыт тестом: новый ключ уровня квеста обязан появиться и там, иначе
  прод-контур слепнет незаметно.
  - **Где виден заголовок и где утечка на самом деле уходит в выдачу.** Каталог
    и шапка визарда на десктопе (`questWizardShell.tsx:510-514`, гейт
    `!isMobile`) — как и предполагала карточка. Но «только десктоп» неверно:
    QA 24.08.2026 на 375px показало заголовок в контекстной шапке приложения
    (`HeaderContextBar.tsx`, `data-testid="header-context-bar"`, видимый узел
    251×17), то есть мобильный игрок читает название так же — гейт `isMobile`
    убирает заголовок только из шапки самого визарда. А вот SEO-канал проба уточнила:
    `<title>`/`og:title`/`twitter:title` собираются через `buildBrandedSeoTitle`
    и КЛАМПЯТСЯ, поэтому длинный заголовок обрезается многоточием — прод
    24.08.2026 отдавал по `minsk-cmok` «Минск: что посмотреть — Квест по центру
    Минска…», и слово-ответ в тег не попадало вовсе. Утечка уходит в выдачу
    другим каналом: `description`/`og:description` вставляет заголовок ЦЕЛИКОМ в
    кавычках (`utils/questSeo.js:96-99`) — «…бесплатный пеший маршрут „Квест по
    центру Минска: Свислочский цмок“…». Короткий заголовок попадает и в
    `<title>` (`bratislava-coronation-crown`: «…Квест по Братиславе: корона…»).
    Вывод для правила тот же — гейтом `isMobile` SEO-поверхность не закрыта, —
    но чинить и проверять надо мета-описание, а не только тег заголовка.
  - **Замер и разбор.** Сплошной прогон по проду 24.08.2026: 156 квестов, 156
    заголовков, **14 находок**. Разобраны поштучно: настоящая утечка одна —
    `minsk-cmok` «Квест по центру Минска: Свислочский цмок» при ответе шага 102
    «свислочь» на вопрос «как называется река». Остальные 13 — осознанный
    остаток трёх классов: (1) совпадение внутри чужого слова, тот же артефакт
    подстроки, что у интро — «белая» в «Беларуси» (`polotsk-ancient`), «дерево»
    в «деревня» (`gervyaty-kostel`), «нет» в «планетария»
    (`minsk-kids-zvezdochka`), «кот» в «который» (`riga-cinema`); (2) имя
    города, обязательное для каталога — `belgrade-white-city`,
    `gomel-teens-city-blueprint`; (3) слово, которым назван сам квест и без
    которого его не рассказать — «Полесье» у `pinsk-polesie`, «фонарщик» у
    `brest-lantern`, «костёл» у `gervyaty-kostel`, «мыши» у
    `kruszwica-mysia-wieza`, «сад» у `brest-kids-garden-song` (там имя площадки
    и ЕСТЬ ответ шага), «мяч» у `mogilev-kids-lion-ball`, «белый орёл» у
    `gniezno-white-eagle`, «корона» у `bratislava-coronation-crown`. Классы 2 и
    3 — ровно те слова, которые #1488 уже признал остатком в ИНТРО, и проверка
    подтвердила: у всех тринадцати то же слово стоит в их собственном интро либо
    вовсе является ложным совпадением, поэтому чистка одного заголовка была бы
    театром.
  - **Правка контента.** Переписаны два заголовка, и оба — те, у кого интро уже
    чистое, то есть название осталось ПОСЛЕДНЕЙ поверхностью с ответом:
    `minsk-cmok` → «Квест по центру Минска: в поисках цмока»,
    `batumi-golden-fleece` → «Квест по Батуми: по следам аргонавтов» (ответ шага
    439 «руно»/«золотое руно»). Кандидаты проверены matching-кодом скана по
    полным словарям ответов своих квестов (37 и 93 значения) ДО заливки. Правка
    прошла через `apply-quest-patches.js`, которому для этого добавлен маршрут
    уровня квеста (`quest_db_id` → `PATCH /api/quests/<id>/`, разрешено
    единственное поле `title`): заголовок не лежит в шаге, и без второго
    маршрута его правили бы мимо инструмента — без валидации и без общего лога.
    Прод сверен `GET /api/quests/by-quest-id/`, локальные данные синхронизированы
    (`minsk-cmok-quest-data.js`, `batumi-quest-data.js`,
    `migrate-quests-to-backend-data.js`, `migrate-quests-to-backend.js`), иначе
    следующая перезаливка вернула бы старый заголовок. URL квеста заголовком не
    задаётся (`/quests/<city>/<quest_id>`), редирект не нужен; статический HTML
    страницы подхватит новое мета-описание после ближайшей пересборки.
  - **Слепое пятно, измеренное, а не предположенное.** `batumi` в 14 находок НЕ
    попал: «руно» → «руна» не проходит порог основы (срезается одна гласная и
    только если в остатке ≥4 букв). Ослабление порога до трёх букв измерено на
    прод-данных: по заголовкам оно даёт ровно +1 находку — тот самый `batumi`, —
    а по интро +32, и все 32 шум («кота» ловит «который», «косо» — «косой»,
    «одна» — «одну»). Порог оставлен прежним; класс «короткое слово-ответ в
    косвенном падеже» остаётся известным слепым пятном семьи, и `batumi` найден
    глазами, а не сканом.
  - **Гейт.** Поверхность `quest_title` входит в умолчание
    (`--scopes=step,quest_title,intro`), остаток удерживает тот же baseline: 121
    → 143 ключа, добавилось 22 ключа по 13 квестам, ни одного по двум
    переписанным. Контроль на здоровой позиции: тот же скан по версии
    `git show HEAD:scripts/minsk-cmok-quest-data.js` до правки честно возвращает
    exit 1 и находит «свислочь», после правки — exit 0. Повторный прод-свип:
    14 → 13 находок, новых нет.
  - **Структурный вывод.** Это пятое точечное расширение одного скана в
    семействе (`hint` → `location` шага → `title`/`story`/`task` шага флагом →
    интро/финал → заголовок квеста), и каждое новое поле находило ручное
    код-ревью СЛЕДУЮЩЕЙ карточки, а не прогон. Инвариант, который надо держать
    вместо перечисления полей: под правило 4a попадает ВЕСЬ текст бандла,
    который игрок читает до попытки, — и всё, что этот текст пересказывает
    наружу (каталог, печать, офлайн-экспорт, мета-теги страницы). Причина повторяемости —
    контракты перечисляли конкретные поля вместо инварианта «весь текст бандла,
    который игрок читает до попытки»; поэтому очередной Done gate структурно не
    мог удержать поле, которого в нём не было.
- **Открытый риск 3: кросс-шаговый класс в печати и офлайн-экспорте — принятое
  ограничение формата.** `QuestPrintable` печатает все шаги на одном листе
  (`QuestPrintable.tsx:99` — подпись места в шапке шага, `:255` — она же в
  таблице маршрута), `questOfflineMapExport.ts:81` кладёт подпись в описание
  точки GPX, а при пустом заголовке шага (`:80`, `point.title || point.location`)
  — и в её имя. Поэтому ответ шага N читается с листа заранее, если стоит
  в полях шага M. Замер 18.08.2026 разовой пробой: для каждого шага берутся
  значения `dictionaryValues(answer_pattern)` длиной от 3 символов после
  `normalizeAnswer` (тот же порог и та же нормализация, что у скана) и ищутся
  подстрокой в печатаемых полях `location`, `title`, `story`, `task`, `hint`
  ЛЮБОГО другого шага того же квеста; популяция — все шаги прода кроме
  `is_intro`. Результат: 574 совпадения, из них 458 на границе слова (перед
  найденным фрагментом начало строки или не буква/цифра) — 204 шага в 111
  квестах из 148. Пробы в `scripts/` нет намеренно: она разовая и мерила
  решение, а не охраняет инвариант; воспроизводится по этому описанию. Гейтом
  это не становится: три четверти квестов падали бы, а выборка показывает, что
  подавляющая часть — неизбежный повтор лексики («башня», «костёл», «круг») и общеупотребительные
  слова в словарях ответов («лежит», «одно», «деревянная»); реальные спойлеры
  вроде «в основании — крупные валуны» в задании соседнего шага
  (`krevo-walled-maiden`) в этом шуме не отделяются. Подавлением подписей
  проблема тоже не решается — печатный формат по замыслу несёт ПОЛНЫЙ ключ
  ответов: `QuestPrintable.tsx:310-335` печатает страницу ведущего с ответами
  всех шагов и надписью «Отрежь или сложи этот лист и не показывай игрокам до
  финала». Замер 18.08.2026: ответ раскрыт на этой странице у 824 шагов из 1256
  (66%) — это ВСЕ шаги с проверяемым ответом (`exact`, `exact_any`, `range`,
  `approx`); оставшиеся 432 свободные (`any`, `any_text`, `any_number`) эталона
  не имеют вовсе. То есть прятать подпись места на листе, где рядом напечатан
  сам ответ, — театр. Формат рассчитан на пару «ведущий + игрок», а не на
  самостоятельного игрока с полной распечаткой, и подпись места на листе нужна
  для навигации по маршруту.
  Решение: класс признан ограничением печатного и офлайн-формата, отдельного
  режима скана не заводится. Проверено вживую 18.08.2026 на проде: печать квеста
  `vitebsk-kids-skazki` открыта из мастера, стоящего на шаге 2, — лист содержит
  все 8 шагов, подпись «Скульптура собаки у порога» и задание шага 8 про собаку
  (ответ шага 1 — `собака`), а страница ведущего печатает ключ всех восьми
  шагов, включая «собака / собачка / пёс». То есть утечка на листе реальна и
  подтверждена, но она заведомо слабее ключа ответов, который тот же лист несёт
  по замыслу.
- **Решение для новой жалобы:** «ответ виден прямо в подсказке» с буквальным
  совпадением — `reuse` этой записи и правка через
  `scripts/apply-quest-patches.js` с обязательной синхронизацией локального
  `scripts/*-quest-data.js` (иначе следующая перезаливка квеста вернёт старый
  текст); то же для подписи места (`--fields=location`); «ответ виден в НАЗВАНИИ
  квеста» — `reuse` этой записи, правка тем же скриптом патчем уровня квеста
  (`quest_db_id` → `PATCH /api/quests/<id>/`), но сперва проверить, не имя ли это
  самого квеста или его города: такие совпадения — принятый остаток в baseline,
  а не долг; подсказка-определение
  без совпадения слова — `create-linked` с явным указанием, что скан этот класс
  не ловит; «на распечатке виден ответ другого шага» — `reuse` этой записи с
  ответом «принятое ограничение формата, см. открытый риск 3», карточка не
  заводится; ответ верный, но устарел на объекте — это QUEST-CONTENT-ROT-001, а
  не эта семья.
- **Последняя проверка:** 2026-08-24 (#1540) — скан читает заголовок квеста,
  прод-свип по 156 квестам даёт 13 находок, и все 13 — разобранный остаток в
  baseline; после правки `minsk-cmok` и `batumi-golden-fleece` прод сверен GET.
  До этого 2026-08-18 (#1461): `--fields=location` по всему проду (148 квестов,
  1256 шагов) — 0 утечек по `hint` и 17 по `location`; кросс-шаговый класс
  измерен отдельной пробой и признан ограничением формата.

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
  отказов (`quest_answer_attempt`) и вычитки. Механически ловимый срез этого
  подкласса выделен в #1536: словарь принимает оба написания короткого ответа
  («сад»/«садъ», «михаил»/«міхаіл»), а составную форму автор собрал только
  вокруг одного, и игрок, списавший надпись с объекта целиком, шаг не проходит.
  Ловится сканом.
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

  `node scripts/scan-quest-compound-spelling-gap.js` (#1536) — зеркало
  предыдущего по вопросу: тот спрашивает «можно ли набрать то, что в словаре
  лежит», этот — «лежит ли в словаре то, что игрок напишет». Срабатывает, только
  когда словарь сам себя выдаёт: есть пара написаний одного слова, есть фраза
  вокруг одного из них и нет её зеркала вокруг второго. Те же ключи
  (`--quest-id=`, `--source=`, `--json`, `--baseline=`), тот же exit 1, тот же
  автозапуск по изменённым `scripts/*-quest-data.js` в `npm run check:fast`.
  Порог нулевой: все 11 находок прод-базы вычищены (9 из них — #1536), новый
  пропуск валит гейт сразу. **Baseline при этом пуст, а не отсутствует** —
  `scripts/quest-compound-spelling-gap-baseline.json`. Он нужен для омографов:
  свёртка склеивает «цепь» и «цеп», но «цеп» — самостоятельное слово
  (молотильное орудие), и «якорная цеп» была бы несуществующей фразой. Без этого
  выхода у автора остаются только два плохих — выдумать фразу или выкинуть из
  словаря послабление, которым игрок пользуется. Границы свёртки написаний и
  связку находки с рантаймом держит
  `__tests__/scripts/scanQuestCompoundSpellingGap.test.ts`.
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

- **Механически ловимый срез семантического класса (2026-08-23, #1536).** До
  этого прогона семантический класс считался «не ловится ничем, кроме телеметрии
  и вычитки». Одна его часть ловится: если словарь содержит существительное в
  ДВУХ орфографических написаниях (`сад`/`садъ`, `михаил`/`міхаіл`,
  `калинина`/`калініна`), а составные варианты («прилагательное +
  существительное») собраны только вокруг одного написания, то второе написание
  внутри фразы недостижимо — и игрок, списавший надпись с объекта целиком,
  получает отказ. Числа по всей базе (1469 шагов прода): подходит под условие —
  21 шаг, дефект есть — 11, контроль чист — 10; после двух точечных починок
  2026-08-23 — 9 и 12. Команда: `npm run quest:scan-compound-spelling-gap`
  (постоянный `scripts/scan-quest-compound-spelling-gap.js`; порт разового
  `.quest-audit/scan-compound-spelling-gap.py` воспроизвёл те же 21/9/12 и тот
  же список шагов — 2026-08-24, #1536). Оставшиеся девять шагов починены в тот
  же прогон, прод-свип даёт 20/0/20.

  **Осторожно с числом «контроль чист».** Счётчик «подходит под условие» широкий:
  он требует только пару написаний и хоть какую-нибудь составную форму, ровно как
  разовый python-скан, — иначе исторические 21/9/12 не воспроизвести. Но словарь,
  где ни одна фраза не кончается на спорное слово, дефектным стать не мог, и в
  «проверено и чисто» ему не место. Строгое число печатается отдельной строкой
  (`из них фраза стоит вокруг одного из написаний`): до правки под риском были не
  21, а 11 словарей — 9 дефектных и всего 2 здоровых; после правки 10 из 20.
  Норму авторинга показывает именно оно.

  **Что скан по-прежнему не видит.** Он смотрит только на ПОСЛЕДНЕЕ слово
  фразы, поэтому `мизинец левой руки` рядом с принятым `мізінец` пропуском не
  считается; и свёртка написаний не ходит по гласным, поэтому `река свіслач`
  рядом с `река свислочь` тоже молчит. Оба сужения сознательные — гейт с нулевым
  порогом обязан молчать на здоровом контенте, — но остаток класса на базе не
  измерен. Проверка, если понадобится: прогнать зеркалирование по любой позиции
  слова и вручную просеять шум.

  **Синхронизация локальных data-файлов после #1536 — пошаговая, не поквестовая.**
  К проду приведены ровно девять починенных словарей. Соседние шаги тех же файлов
  от прода по-прежнему отстают (проверено GET: `pinsk-polesie/3-franciskanskiy-sobor`
  локально 18 форм против 36 на проде, `2-dvorec-butrimovicha` 10 против 20,
  `minsk-cmok/6-word-memory` 6 против 18), а `scripts/hel-city-quest-data.js`
  описывает `quest_id: hel-fishermen` с совсем другим содержимым, чем прод.
  Значит перезаливка любого из этих файлов целиком откатит прод. Дрейф не
  внесён #1536 и лежал до него. Починен в #1554 вместе с дублями `quest_id`:
  дубли удалены, 68 шагов приведены к проду, класс закрыт двумя гейтами.
- **Доказательство при n=1.** Экземпляр найден не сканом, а разбором
  прохождения: сессия `28a968cc`, `brest-teens-erased-city` шаг 1018
  `1-garden-arch`, 19.08.2026. Словарь был `["сад","садъ","городской сад"]`;
  надпись на арке Городского сада Бреста — «Городской садъ» (БЕЛТА, 03.09.2019).
  То есть буквальная форма ответа, которую игрок видит глазами, в словаре
  отсутствовала. Починены шаг 1018 и его близнец 1016
  `brest-kids-garden-song/6-garden-arch` (тот же объект, тот же словарь),
  подтверждено `GET /api/quest-steps/{1018,1016}/`, локальные data-файлы
  синхронизированы.
- **Почему это не отдельная семья.** Инвариант тот же — «словарь закрытого типа
  обязан покрывать форму, которую игрок физически напишет». Разница только в
  том, где дефект: в `mixed_script`/`empty_after_normalize` вариант в словаре
  ЕСТЬ и мёртв, здесь варианта НЕТ. Первое ловит
  `scan-quest-answer-reachability.js`, второе — новый скан; оба про один и тот же
  контракт словаря, поэтому живут в этой записи, а не в новой.

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
  #1464 (правка 14 слов текста + постоянный контроль).
- **Подтверждённая причина:** контроля на эту поверхность не существовало.
  `scan-quest-answer-reachability.js` смотрит только `answer_pattern` и только у
  шагов типа `exact_any`; видимый текст не сканировал никто, поэтому класс
  копился молча — первый же прогон дал 13 слов в 8 квестах разных волн контента
  (`pakocim-voices`, `porto-port-wine`, `dubrovnik-libertas` ×5,
  `belgrade-white-city` ×2, `sofia-serdica-underfoot`, `kazimierz-dolny-kogut`,
  `venice-lion-of-saint-mark`), а расширение обхода на интро добавило
  четырнадцатое — `bielsko-biala-cartoon-vienna`. Механизм появления самих символов не установлен:
  правдоподобно, что это автозамена раскладки при копировании или ручной набор
  национальной буквы не той клавиатурой, но вживую гипотеза не проверялась.
  Косвенно за неё говорит шаг 83 `pakocim-voices/1-herb`: слово `Dołęga` стоит в
  одном абзаце дважды, первый раз чистой латиницей, второй — с кириллическими
  `га`, то есть автор набрал одно и то же слово дважды и получил разные строки.
- **Controls:** `node scripts/scan-quest-mixed-script-text.js` — по всему проду,
  по одному квесту (`--quest-id=`), по локальному `scripts/<city>-quest-data.js`
  ДО заливки (`--source=`), по выбранным полям (`--fields=`, включая `finale`).
  Читает текст бандла через `textNodes()`: заголовок квеста, интро, каждый шаг
  (пять текстовых полей плюс проза внутри `poi_info` — часы работы и цена
  билета) и текст финала в ОБЕИХ его формах. Не читает сознательно и это
  перечислено здесь, чтобы следующая слепая зона не выглядела как ещё один
  недосмотр: `finale.title` (в прод-сериализатор финала не попадает, игрок его
  не видит), `poi_info.is_museum` (булев) и `poi_info.website` (URL — смешанный
  алфавит там ломает саму ссылку, это другой класс дефекта с другим контролем),
  `city.name` (не авторский текст квеста, приходит из справочника городов;
  смешанных слов там нет — проверено по всем локальным квестам), а также
  `media.cover.alt` и `finale.poster_media.alt` — alt-текст обложки и постера
  финала. Их не пишут ни в локальных `scripts/*-quest-data.js` (ключа `alt` там
  нет вовсе), ни `sync-quest-to-prod.js`/`migrate-quest-from-file.js`: их
  синтезирует сериализатор бэка при ответе, `alt=quest.title` для обложки и
  `alt=<title родительского квеста>` для постера (`quests/serializers.py`,
  `get_quest_media`/`get_poster_media`). Значит alt — это уже сканируемый
  `quest.title`, добавление его в `textNodes()` дало бы дубль, а локальный
  `--source`-гейт его всё равно не видит, потому что в данных его нет.
  Подтверждено рантаймом 2026-08-18: из 277 полей `alt` на проде (148 квестов,
  формы ровно две — `media.cover.alt` ×139 и `finale.poster_media.alt` ×138)
  ноль пустых, ноль расхождений с title квеста/шага, ноль смешанных слов.
  Открытый риск назван явно: если бэкенд когда-нибудь начнёт заводить alt
  отдельным авторским полем, оно выпадет из контроля — это уже будет
  backend-изменение, требующее своего решения о скане. Подключён к
  `scripts/run-fast-scope-checks.js` рядом со сканом достижимости: гоняется на
  каждый изменённый `scripts/*-quest-data.js` в рамках `npm run check:fast`.
  **Baseline'а нет намеренно** — в отличие от QUEST-ANSWER-UNREACHABLE-001, где
  130 известных находок пришлось вынести в файл исключений, здесь #1464 вычистил
  все 14 находок до нуля, и порог поставлен нулевой: любое новое слово валит
  гейт сразу. Список исключений, в который нечего записать, только маскировал бы
  новые опечатки.
- **Общее определение с соседней семьёй.** `mixedScriptWords`/`confusableChars`
  вынесены в `scripts/lib/questScriptMixing.js` и используются обоими сканами.
  Это не косметика: разойдись копии регулярок хоть на один диапазон — и один
  скан начал бы отчитываться «чисто» о том, что другой считает дефектом.
  Паритет держит тест `__tests__/scripts/scanQuestMixedScriptText.test.ts`
  (блок «общее определение смешения» сравнивает сами функции по ссылке).
- **Популяция текста шире, чем у словарного скана, и шире, чем `steps`.** Скан
  достижимости пропускает `is_intro` и всё, что не `exact_any`, — вне словаря
  ему смотреть не на что. Видимый текст есть у каждого шага при любом типе
  ответа, поэтому это отдельный скрипт, а не флаг существующего: подмешивание
  другой популяции в счётчики словарного скана врало бы обоими отчётами сразу.
- **Грабля, на которой скан уже один раз соврал.** Интро лежит в бандле
  ОТДЕЛЬНЫМ объектом `quest.intro`, а не элементом `steps` (`is_intro` у всех
  элементов `steps` равен нулю); так же устроен и локальный
  `scripts/<city>-quest-data.js`. Заголовок квеста — `quest.title`. Финал живёт в
  ДВУХ формах: `finale.text` (140 локальных квестов) и `finale.story` без ключа
  `text` (5 квестов: `chisinau-white-stone`, `hel-fishermen`, `hel-jurata-amber`,
  `orheiul-vechi-rock-monastery`, `soroca-round-fortress`) — на прод обе уезжают
  в одно поле, `scripts/sync-quest-to-prod.js` берёт `finale.text ||
  finale.story`. Часы работы и цена билета лежат ещё на уровень глубже, внутри
  `poi_info`, и ключ блока тоже двоится — `poi_info` и `poiInfo`
  (`sync-quest-to-prod.js:69` принимает обе формы). Первая редакция
  `scan-quest-mixed-script-text.js`
  обходила только `parseSteps(quest)`, поэтому 147 интро прода в проверку не
  попадали вовсе, и живая находка «пройdём» (латинская `d`) в интро
  `bielsko-biala-cartoon-vienna` пряталась за отчётом «Смешанных слов нет» с
  exit 0. Ошибка повторилась дважды на исправлениях: следующая редакция добавила
  финал одним ключом `finale.text` и осталась слепа к пяти квестам с
  `finale.story`, а прозу внутри `poi_info` не видела вовсе. Все три слепые зоны
  поймало код-ревью #1464, ни одну — прогон. Отсюда три вывода на будущее: (1) любой скан контента квеста обязан собирать текст через
  `textNodes()` — заголовок квеста, интро, шаги, финал, — а не через `steps`;
  (2) прежде чем объявлять поверхность закрытой, проверять, в скольких ФОРМАХ
  поле встречается в данных (`finale` их две), а не по одному примеру бандла;
  (3) счётчик в отчёте должен считать то, что скан ПРОЧИТАЛ («7153 текстовых
  узла»), а не косвенную величину вроде «1237 шагов»: косвенный счётчик и скрыл
  первый пропуск. Оговорка к самому счётчику: он считает СОЗДАННЫЕ узлы, поэтому
  поле, которое `textNodes()` вообще не перечислил, в нём тоже не отражается —
  второй пропуск он бы не показал.
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
- **Последняя проверка:** 2026-08-18 после правки #1464 и расширения обхода на
  интро/финал/заголовок квеста — прод-свип `scan-quest-mixed-script-text.js` по
  148 квестам и 7153 текстовым узлам даёт ноль находок, свип по всем 142
  локальным `scripts/*-quest-data.js` — ноль. Всего закрыто 14 слов: 13 в шагах
  восьми квестов и одно в интро `bielsko-biala-cartoon-vienna`, найденное только
  после расширения обхода. Контроль на здоровой позиции: тот же скан по версиям
  файлов из `git show HEAD:` до правки честно возвращает exit 1 и находит 2
  слова в `belgrade` и 5 в `dubrovnik` — скан ловит дефект, а не молчит на всём
  подряд.

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
- **Controls:** с 2026-08-23 — скан `scripts/scan-quest-surface-answer.js`
  (исполняемая редакция правила 4f: две ветки, цвет и материал ПОВЕРХНОСТИ,
  граница с конструктивным материалом, стоп-лист ложных цветов) с baseline
  `scripts/quest-surface-answer-baseline.json`, подключённый к `check:fast` по
  изменённым `scripts/*-quest-data.js`, плюс governance-тест
  `__tests__/scripts/scanQuestSurfaceAnswer.test.ts`. Полный свип по проду —
  `npm run quest:scan-surface-answer`. До этого контроля не было вовсе: критерий
  жил в `.quest-audit/` (gitignored), то есть на одной машине.
  Скан ловит только механическую часть — «ответ зависит от вида поверхности»;
  устарел ли конкретный эталон, решает датированное фото по порогу свежести 4f.
  Метод верификации, доказавший себя на Мире — Commons geosearch по координатам
  шага + даты снимков, два независимых источника против одного устаревшего.
  Каноническая задача — #1431 (сплошная сверка 58 цветовых шагов); смежные
  находки того же разбора — #1428, #1429, #1430.
- **Решение для новой жалобы:** «игрок на месте назвал не то, что в словаре» на
  цветовом или ином изменяемом признаке — `reuse`; тот же класс на другом типе
  контента (описание маршрута, часы работы, наличие объекта) — `create-linked`;
  деталь, которой на объекте не было изначально — это класс F, а не рецидив.
- **Последняя проверка:** 2026-08-23 — свежий свип прода трекаемым сканом: 156
  квестов, 1345 шагов, 120 в scope + 45 конструктивных. На замороженном корпусе
  17.08 трекаемый скан воспроизводит классификацию разового аудита шаг-в-шаг
  (107 + 40 = 147, нулевые расхождения), поэтому норматив #1431 — 60 + 47 + 40.
  Свип нашёл дефект самого критерия: ответ «голубь святого духа» (шаг 1410,
  Риальто) числился ЦВЕТОВЫМ из-за корня «голуб» внутри названия птицы —
  стоп-лист пополнен, брать короткий корень нельзя, он убьёт настоящий
  «голубой». Ранее: 2026-08-15 — точечный фикс `mir-castle / church` применён
  (шаг уведён с цвета на неперекрашиваемый признак).

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
- **Рецидив 2026-09-02 — счётный подкласс, и у него механический признак ЕСТЬ.**
  `minsk-teens-oktyabrskaya / 9-amigos` (шаг 1135, `range` 2..4, задание «Сколько
  жёлтых персонажей встречает тебя на ней?»): игрок `progress_id` 415, взявший
  все восемь предыдущих точек с первой попытки, дал у стены шесть отказов подряд
  — `6`, `5`, `7`, затем при открытой подсказке `5`, `7`, `8` (строки телеметрии
  409–414, 2026-09-02 18:33:43–18:35:05 UTC), и прошёл седьмой попыткой `3`,
  подобрав оставшееся маленькое число. Игрок был именно у объекта: координаты
  шага 53.8883390/27.5779690 совпадают с узлом OSM 6746025910 «Мурал «3 Amigos»»
  (`OSGEMEOS & SPETO`, 2019) с точностью 0,3 м, темп по маршруту пешеходный.
  Эталон не устарел — «3 Friends» подтверждён официальной страницей фестиваля
  (vulicabrasil.com/en/vb-2019) и тегом OSM. Не задана **граница счёта**: у
  OSGEMEOS желтокожие фигуры фирменные, у Speto манера своя, и ни задание, ни
  подсказка («считай только человечков с жёлтой кожей») не говорят, что считать.
  То есть тот же инвариант семьи, но различать надо не сущность, а границу.
  Кулдаун перебора при этом исправен (интервалы 6→7→18→30→21→21 с) и на трёх
  допустимых значениях перебор не останавливает.
- **Масштаб счётного подкласса измерен** (в отличие от семьи в целом, у которой
  механического признака нет). Условие: тип ответа `range`/`any_number` И слово
  «скольк» в задании. По всем 1612 шагам прода — 91 шаг подходит под условие,
  70 задают эталон диапазоном вместо числа, 19 задают одним числом (контроль на
  здоровой позиции; там граница счёта прописана словами — шаг 323
  `minsk-cipher/1-vorota` «не считая венчающую надстройку», шаг 261
  `prague-old-town/st-vitus` «толстую колокольню сбоку в счёт не бери»). Спорная
  подгруппа «диапазон при мелком счёте» (`span >= 2` и `max <= 6`) — 42 шага,
  среди них уже задокументированный эталон перебора `braslav-mezh-ozyor /
  1-uspenskaya-church` (шаг 746, `range` 4..6, пройден перебором за 11 секунд).
  Команда замера и полный список 42 шагов — в карточке #1718.
- **Решение для новой жалобы счётного вида:** «игрок насчитал у объекта другое
  число, а задание и подсказка границы счёта не задают» — `reuse` этой семьи,
  дописать в #1718. Правка: свести эталон к одному числу и прописать границу
  словами, либо сменить вопрос на несчётный признак. Расширять диапазон нельзя —
  это засчитывает неверный ответ.

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
  Рабочие источники `scripts/*-quest-data.js` в #1448 были оставлены вне охвата с
  формулировкой «это источники создания новых квестов, а не снимки применённых
  правок». **Оговорка снята в #1554:** замер 24.08.2026 показал, что они успели
  стать именно снимками, причём протухшими — 68 разошедшихся с продом шагов в 26
  квестах, плюс восемь `quest_id`, описанных сразу в двух файлах. Механизм риска
  оказался тот же самый, только инструмент другой: `scripts/sync-quest-to-prod.js`
  переносит поля локального файла на прод без проверки свежести и с выключенным
  по умолчанию `--dry-run`.
- **Controls (#1554, рабочие источники):** офлайн-половина класса —
  `scripts/guard-quest-data-sources.js` (`npm run guard:quest-data-sources`,
  безусловно входит в `check:fast`): падает, если один `quest_id` описан в двух
  data-файлах, и если данные квеста лежат в файле, не названном
  `*-quest-data.js`. Второе важнее первого: под непринятым именем файл невидим
  для ВСЕХ инструментов проекта, и ровно так `migrate-quests-to-backend-data.js`
  четыре месяца держал устаревшие копии четырёх квестов мимо любого контроля.
  Сетевая половина — `scripts/scan-quest-prod-drift.js`
  (`npm run quest:scan-prod-drift`), сверяет каждый локальный файл с
  `GET /api/quests/by-quest-id/`; в `check:fast` не входит сознательно, потому
  что офлайн-гейт по построению не знает состояния прода (#1489). Устранение
  дрейфа — `scripts/sync-quest-data-from-prod.js`, направление только прод → файл.
  Правила сравнения у скана и синхронизатора общие, в `scripts/lib/questProdDiff.js`.
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

### APP-SHELL-BOOT-001 — пол TBT задаёт общий каркас, а не код маршрута

- **Инвариант:** медианный prod mobile TBT укладывается в сайтовый бюджет
  ≤400 мс на КОНТРОЛЬНОМ лёгком маршруте (`/`), а не только на измеряемом
  тяжёлом. Помаршрутная цель по TBT без такого контроля недостижима по
  построению: она смешивает пол каркаса и добавку маршрута.
- **Surface/owner:** общий web app shell — root providers, expo-router tabs
  layout, тема, i18n, RNW StyleSheet; critical-shell компоненты
  (`components/travel/details/hooks/travelDetailsContainerViewModel.ts:80-81` —
  `criticalChromeReady`/`deferredChromeReady`). Вторичный слой —
  `scripts/generate-seo-pages.js:1488,1505` (`gateAppScriptsBehindHero`,
  `setTimeout(go, …)`).
- **Цепочка:** `#1499` (впервые завёл travel-detail под работающий TBT-гейт и
  записал, что оставшийся рычаг «требует собственного Task Contract»), `#1552`
  (снял 154.6 КБ с travel-маршрута, довёл прод-TBT 948 → 548, поставил
  контрольный замер главной и признал цель недостижимой в своём scope),
  `#1643` (канонический владелец этого инварианта).
- **Подтверждённая причина:** одна и та же четвёрка длинных задач стоит и на
  `/travels/[param]`, и на `/` — совпадают состав, порядок и смещения от
  приземления `entry`: eval `__shared-1` (72–97 / 69–70 мс), eval `entry`
  (123–132 / 108–113 мс), первый коммит React (342–372 / 290–319 мс), задача
  документа (100–114 / 72–78 мс). Главная выполняет в 2.5 раза меньше скрипта
  (Script Evaluation 1042 мс против 2569 мс), не содержит галереи, тела статьи
  и карты — и всё равно даёт median TBT 445 мс. Добавка travel-маршрута поверх
  пола — всего ~70–100 мс (548 против 445). Тяжёлый первый коммит принадлежит
  критическому, а не deferred шеллу, поэтому не может быть отложен без
  нарушения нормативно защищённой геометрии hero и свайпа.
- **Почему прежние Done gate не удержали:** пять карточек подряд после `#1286`
  мерили ровно один самый тяжёлый маршрут без контроля на лёгком, поэтому пол
  каркаса и добавка маршрута были неразличимы три карточки подряд.
- **Отвергнутые рычаги (не повторять):** `startTransition` не дробит эти задачи
  (A/B двумя прод-сборками: TBT 348 → 340 мс, шум — commit-фаза с
  layout-эффектами непрерываема); резка eager-байт отдельного маршрута
  исчерпана (первопартийного кода в eager `entry` всего 9 КБ). Обратно:
  переразбивка на большее число чанков TBT УЛУЧШАЕТ — на travel 16 → 23 чанка
  при почти неизменных байтах (2970.7 → 2900.3 КБ raw) дало TBT 896 → 548,
  поэтому `eager.maxRequestsByRoute` и цель по TBT тянут в разные стороны.
- **Решение для новой жалобы:** «мобильный TBT выше бюджета на конкретном
  маршруте» — сначала замерить контрольный лёгкий маршрут; если пол уже выше
  бюджета, это `reuse` `APP-SHELL-BOOT-001`, а не новая помаршрутная карточка.
  «Модуль едет на маршрут, которому он не нужен» — `ROUTE-BUNDLE-001`.
- **Последняя проверка:** 2026-08-30 — прод, тихий хост (load average 6.16–9.82
  при триггере <12), Lighthouse devtools mobile, оба маршрута из одного деплоя
  (`Last-Modified` 19:00:34 и 19:00:37 GMT): travel median TBT 548 мс,
  главная 445 мс, LCP и CLS зелёные на обоих.

### UI-WEB-AUTOFILL-THEME-001 — Safari Autofill должен сохранять тему формы

- **Инвариант:** браузерное Autofill остаётся включено, а фон, текст, рамка и
  caret автозаполненного поля совпадают с обычным тематическим полем и в light,
  и в dark theme.
- **Surface/owner:** frontend web forms; впервые подтверждено в
  `components/quests/QuestInaccuracyReportModal.tsx`, корректирующий слой —
  web-стили `app/global.css` или переиспользуемый `.web`-примитив поля.
- **Симптом:** в iPhone Safari на mobile web в dark theme автозаполненный e-mail
  становится бледно-жёлтым, хотя соседние поля остаются тёмными.
- **Каноническая цепочка:** `#665` — ближайший завершённый контекст dark theme;
  `#1523` — подтверждённый связанный WebKit-specific баг.
- **Подтверждённая причина:** `autoComplete="email"` включает WebKit Autofill,
  обычный RN-web background не покрывает его pseudo-state, а
  `:-webkit-autofill` отсутствует и в исходниках, и в production CSS. WebKit
  документирует жёлтую UA-заливку и при dark color scheme. Отключать Autofill
  для обхода проблемы нельзя.
- **Постоянный control:** задача `#1523` должна добавить стабильный семантический
  marker/переиспользуемый web-примитив, тематические normal/hover/focus правила
  Autofill, source/CSS regression test и runtime evidence в Safari/WebKit для
  light и dark theme.
- **Решение для новой жалобы:** тот же жёлтый Autofill из-за отсутствующего
  pseudo-style — переиспользовать или переоткрыть `#1523`; другая браузерная
  или field-specific причина — `create-linked`.
- **Последняя проверка:** 2026-08-20; `#1523` создана в `todo`, реализация не
  начиналась.

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
  счётчики «1.2K»/«1.2M»); structural control — `#1459`; `#1465` (PDF-экспорт,
  профиль высоты) — первый случай, найденный человеком именно в непросканированном
  каталоге, и потому расширивший область guard'а вместо очередной точечной правки;
  `#1468` (третья форма: единица уже из ключа, а число сырым в интерполяции) —
  вторая половина того же инварианта, которую guard не выражал ничем.
- **Подтверждённая systemic cause:** правило жило только как договорённость в
  `AGENTS.md`/`docs/RULES.md` и как внимание ревьюера. Каждая карточка чинила
  свой набор файлов, а следующий домен — расстояние, счётчик, рейтинг, размер
  файла — заводил собственный `toFixed` заново, потому что механической проверки
  не было.
- **Controls:** `npm run guard:locale-number-format` — TypeScript-AST guard по
  `app/`, `components/`, `constants/`, `screens/`, `hooks/`, `services/`, `utils/`. Ловит три формы:
  (1) `toFixed(0..2)`, результат которого доходит до отображаемой позиции (JSX-текст,
  display-проп, аргумент перевода — включая цепочку переменных и
  функций-форматтеров того же файла); (2) вычисленное число, склеенное с хардкодным
  суффиксом единицы (`K`, `M`, `тыс.`, `км`, `KB`) — хоть через `toFixed`, хоть
  через `Math.round` или арифметику; (3) `numeric-translation-argument` (`#1468`) —
  число уходит аргументом в вызов перевода, а в самом ключе за подстановкой стоит
  единица (`{{value1}} км`), при этом значение не пришло из форматтера локали.
  Третью форму guard проверяет не по шаблонной строке в коде, а по RU-каталогу
  (`i18n/locales/ru`, типизированный baseline): резолвит ключ → читает текст →
  смотрит, стоит ли за подстановкой единица; фикс — отдать в аргумент уже строку
  из `i18n/format.ts` или доменной обёртки (`formatDistance`, `formatRadiusValue`).
  Структурно, а не allowlist'ом, исключены
  координаты, точность выше двух знаков, ISO-8601 длительности (`PT45M`),
  машинные пропсы, подстановки без единицы (счётчики, индексы, годы, номера
  страниц) и плюральный `count` i18next. Известная граница: цепочка не проходит
  сквозь тело функции или `useMemo`. Каталог `services/` был вне скана до `#1465`,
  `constants/` — до `#1468`; оба расширения дали реальные находки, а не осознанную
  границу. Governance-тест
  `__tests__/scripts/guard-locale-number-format.test.ts` держит allowlist пустым
  и запрещает vacuous scan (для третьей формы — по счётчикам `catalogueSize` и
  `unitPlaceholderCount`, иначе guard прошёл бы, просканировав пустоту);
  `__tests__/i18n/compactNumberCallSites.test.tsx`,
  `__tests__/i18n/distanceFormattingCallSites.test.tsx` и
  `__tests__/i18n/translationArgumentNumberFormat.test.tsx` остаются runtime-контролем
  конкретных экранов на пяти локалях.
- **Решение для новой жалобы:** ещё одно место с английским числом — сначала
  проверьте, видит ли его guard. Не видит по причине пробела в РЕАЛИЗАЦИИ уже
  описанной формы — `reopen #1459`. Не видит потому, что механизм новый (как у
  `#1468`: единица правильная, интерполяция числа — нет) — `create-linked`.
  Видит, но код прошёл в main — тоже `create-linked`.
- **Последняя проверка:** 2026-08-18 (`#1468`); третья форма
  `numeric-translation-argument` добавлена в guard, её первый прогон по чистому
  дереву дал 58 находок — все locale-sensitive числа с единицей в ключе (км, м,
  ч, мин, MB), ни одного ложного на счётчиках/индексах/`count`. Разобраны 20
  call-site в `components/`, `hooks/`, `screens/`, `services/`, `utils/`,
  `constants/`: число уходит в интерполяцию уже строкой из `formatInteger`/
  `formatNumber`/`formatRadiusValue`. Радиус приходит и числом, и id-строкой
  опции, поэтому в `constants/mapConfig.ts` добавлен `formatRadiusValue`
  (числовое печатает локаль, нечисловая подпись остаётся как есть). guard зелёный
  на 1544 файлах при пустом allowlist (`toFixed=148`, `unitPlaceholders=67`).
  Ранее 2026-08-18 (`#1465`): расширение скана на `services/`
  дало ровно одну находку — `${round(km)} км` в
  `services/pdf-export/.../MapPageRenderer.ts`, сведена на `formatDistance`
  (+ соседние числа профиля высоты — на `formatNumber`/`formatInteger`). Ещё ранее 2026-08-18; первый прогон guard'а по чистому дереву
  нашёл десять call-site (рейтинг в семи местах, длительность квеста, размер
  файла маршрута) — все разобраны в `#1459`, allowlist остался пустым. Размер
  файла при разборе оказался вторым источником правды: те же единицы Б/КБ/МБ
  лежали в `offline`-namespace с другим округлением, поэтому оба экрана сведены
  на `utils/fileSize.ts`.

### I18N-HERMES-INTL-001 — канонический форматтер не должен зависеть от того, какой Intl-конструктор есть в движке

- **Инвариант:** канонические форматтеры `i18n/format.ts` не бросают исключение на
  сборке с движком Hermes независимо от того, какой именно `Intl.*`-конструктор в
  конкретной сборке отсутствует.
- **Surface/owner:** shared frontend i18n layer, `i18n/format.ts` и его прямые
  доменные потребители; Android (движок Hermes в production-сборке приложения) —
  подтверждённая поверхность; iOS также собирается на Hermes и имеет тот же
  проверенный риск.
- **Подтверждённая поверхность Hermes:** извлечение строк из Android
  `lib/arm64-v8a/libhermesvm.so` установленного APK `by.metravel.app`
  (versionCode 20) и iOS
  `hermesvm.xcframework/ios-arm64/hermesvm.framework/hermesvm` из release-архива
  Pods показало один состав: есть `Intl.Collator`, `Intl.DateTimeFormat`,
  `Intl.NumberFormat`, `getCanonicalLocales`; нет `Intl.PluralRules`,
  `Intl.RelativeTimeFormat`, `Intl.ListFormat` (0 вхождений подстрок). То есть
  отсутствует не весь `Intl`, а конкретное подмножество конструкторов, и это
  подмножество за два подтверждённых инцидента ни разу не совпало с тем, что уже
  было защищено.
- **Цепочка:** `#1335` (нет `Intl.PluralRules` — плюрал молча схлопывался в
  `_other`, `done`) → `#1511`/`#1517` (нет `Intl.RelativeTimeFormat` — краш в
  `TravelFormErrorBoundary` на физическом Pixel 10 Pro, закрыто guard'ом на
  конкретном месте вызова `useUpsertTravelController.ts`, `in_progress`/`review`)
  → `#1528` (тот же `Intl.RelativeTimeFormat`, но на уровне канонического
  экспорта `formatRelativeTime`, а не места вызова; заводит governance-тест на
  весь файл).
- **Подтверждённая systemic cause:** защита добавлялась точечно — на месте
  вызова (`#1511`) или сразу в паре форматтеров одним коммитом (`39a682c6`,
  15.07.2026, защитил `formatList` и `selectPlural`, но не `formatRelativeTime`,
  потому что на тот момент прямого небезопасного вызывающего не было).
  Собственный guard проекта (`scripts/guard-locale-number-format.js:106-124`,
  `LOCALE_FORMAT_CALLEES`) при этом направляет новый код звать именно
  канонический экспорт как безопасный слой, не проверяя, что сам экспорт
  безопасен. Механической проверки состава Hermes-поверхности против списка
  канонических форматтеров не было ни разу.
- **Controls:** governance-тест в `i18n/format.ts`/`__tests__/i18n/format.test.ts`
  (доставляется `#1528`), который перебирает все Intl-зависимые канонические
  форматтеры файла и падает, если хотя бы один бросает исключение при снятии
  своего конструктора — по образцу уже существующего теста на
  `Intl.PluralRules` (`__tests__/i18n/format.test.ts:41-63`). Держит инвариант и
  для форматтеров, которые появятся в файле позже, а не только для текущих трёх.
- **Решение для новой жалобы:** новый Intl-конструктор без защиты в
  `i18n/format.ts` — если governance-тест из `#1528` его не ловит из-за пробела
  в реализации самого теста (не видит новый форматтер, не видит новый
  конструктор) — `reopen #1528`; если это тот же класс, но в другом каноническом
  i18n-файле или на другом движке (не Hermes) — `create-linked`; если это разовая
  точечная защита на месте вызова без затрагивания канонического слоя — сначала
  проверить, не проще ли перенести её в канонический экспорт тем же приёмом, и
  завести `create-linked`, а не чинить симптом ещё раз.
- **Последняя проверка:** 2026-08-25 (`#1528`) — состав Android и iOS
  Hermes-бинарников подтверждён извлечением строк; канонический formatter и его
  comments/history consumer покрыты RU/BE/UK/PL/EN без
  `Intl.RelativeTimeFormat`.

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

### MAP-POI-SOURCE-GROUPING-001 — одна точка статьи ошибочно считается отдельным физическим местом

- **Инвариант:** один физический POI имеет один стабильный `place_id`, одну
  каноническую координату, один marker/hit target и одну карточку. Все связанные
  статьи и изображения сохраняются как перелистываемые sources; ни один article
  URL нельзя терять как «дубль».
- **Surface/owner:** backend place identity, map cluster/radius/catalog DTO и
  shared frontend map model/popup; desktop/mobile web, Android и iOS используют
  один source-pager contract.
- **Цепочка:** `#741` — light marker payload без `place_id`; `#988/#993` — общий
  map core и popup; `#1347` — keyed marker diff, который намеренно сохраняет
  разные records; `#1566` — отдельная ошибочная координата Национальной
  библиотеки; `#1567/#1568` — canonical backend/frontend owners; `#1571` —
  shared place/source model и линейная группировка dataset; `#1573` — стабильный
  выбор места через native bridge.
- **Подтверждённая systemic cause:** `/api/travels/search_travels_for_map/` и
  `/api/map/clusters/` используют `travel_address` как marker identity. Поэтому
  две статьи одного места становятся двумя markers, а frontend не может
  восстановить семантическое равенство по координате или названию. На
  production это подтверждено Национальной библиотекой Минска (`14029/15688`) и
  точными парами в Станьково: библиотека «Скарбец» (`2986/15506`), беседка
  (`2990/15507`) и усадьба (`2985/15831`).
- **Controls:** immutable backend `place_id`; cluster count по places; compact
  `primary_source + source_count` и lazy cached sources; legacy row без
  `place_id` остаётся отдельным. Proximity/geohash/name fuzzy merge запрещён.
  Frontend нормализует dataset через `Map` за `O(n)`, передаёт native bridge
  `placeKey`, монтирует только активное фото и не пересобирает marker layer при
  перелистывании. Regression — MAP-20 плюс positive `one place -> N sources` и
  negative `different place_id -> never merge` на backend, web и native.
- **Регрессия группировки #1571:** `groupMapPlaces` в `api/mapPlaces.ts`
  выполнял `sources.some(isSameMapPlaceSource)` для каждой строки одного места:
  внешний `Map` не устранял внутренние `n(n-1)/2` сравнений. Теперь raw source
  ID, canonical source ID и non-null point ID индексируются отдельными `Set`.
  Индекс пополняют только принятые sources: отвергнутый дубль не добавляет
  алиасы, порядок первого принятия и правила `isSameMapPlaceSource` сохранены.
  `NaN` исключён из числового индекса, чтобы `Set` не менял strict equality.
  Регрессия в `__tests__/api/mapPlaces.test.ts` считает реальные чтения ID для
  500/1000/2000 sources через post-construction getter и сверяет результат с
  прежним компаратором; отдельно проверена первая строка без source.
- **Регрессия native selection #1573:** после обновления dataset запоздалый
  `SELECT_PLACE` с исчезнувшим `placeKey` проваливался в legacy lookup по
  `id`/`coord`/`index` и мог открыть другое место. Непустой `placeKey` теперь
  авторитетен: отсутствие ключа в актуальном dataset означает `null`, а не
  fallback. Legacy lookup сохранён только для сообщений без ключа.
  `mapPlaceMarkers.test.tsx` проверяет отказ по всем трём fallback-путям;
  `Map.ios.test.tsx` — отсутствие `onMarkerSelect` после удаления места и
  последующий корректный выбор существующего места. Native runtime gate
  проверяется отдельно от этих unit-контролей.
- **Решение для новой жалобы:** неверную геометрию конкретной записи вести как
  отдельный data defect (как `#1566`). Повторный случай потери/раздвоения
  источников при той же модели — reuse открытых `#1567/#1568` или reopen после
  закрытия; новый marker renderer failure mode — create-linked, не fuzzy-fix.
  Квадратичная группировка или drift source identity — reuse/reopen `#1571`.
  Ошибочный выбор по устаревшему native key — reuse/reopen `#1573`.
- **Исходная проверка:** 2026-08-25; production API подтвердил две записи
  Национальной библиотеки с разными статьями/фото и ещё три пары в Станьково.
- **Последняя проверка:** 2026-08-28; локально для `#1571` исходный алгоритм
  дал 499000/1998000/7996000 чтений ID, индексированный — 500/1000/2000 при
  сохранении всех sources; 4 suites / 58 tests модели, pager и lazy cache
  прошли. Evidence — `.codex-temp/task-1571-finish/`. Этот pure-model check не
  подменяет приёмку backend/renderer/UI для всей семьи `#1567/#1568`.

### MAP-IOS-TILE-GRAY-001 — native tileerror не восстанавливается вместе с сетью

- **Инвариант:** после `offline → online` уже открытая native-карта сама
  перезапрашивает failed базовые тайлы; пользователю не нужно двигать карту,
  переключать вкладку или перезапускать приложение.
- **Surface/owner:** общий iOS/Android Leaflet WebView renderer —
  `components/MapPage/Map.ios.tsx` и native tile bridge. Web использует другой
  tile lifecycle.
- **Цепочка:** `#1561` закрыл collision/retry/minZoom причины серой подложки;
  `#1665` — новый connectivity-redraw failure mode; controls `#990/#202`.
- **Подтверждённая причина:** offline cache miss завершается пустым tile и
  `tileerror`; NetInfo затем меняет состояние на online, но Leaflet не повторяет
  этот запрос до pan/zoom/remount, потому что base layer не получает `redraw()`.
- **Controls:** один coalesced `baseTileLayer.redraw()` + `invalidateSize` на
  переходе `false → true`, включая pending-ready ветку; unit-контроль запрещает
  redraw при стабильном online. Runtime — три airplane-mode цикла без жеста,
  `loaded > 0`, `pending = 0`, затем Android smoke общего renderer.
- **Решение для новой жалобы:** серый фон только после reconnect — reuse/reopen
  `#1665`; low-zoom/key/retry recurrence — reopen `#1561`; proxy/GPU причины —
  create-linked после точного измерения.
- **Последняя проверка:** 2026-08-31; code-path и пользовательский iOS screenshot
  подтверждены, runtime-приёмка текущей сборки ожидается в testing.

### TRIPS-PLAN-SAVED-ROUTE-TRUTH-001 — display tuple не может противоречить точкам

- **Инвариант:** geometry, routing state, summary, header и export описывают
  один маршрут. При двух валидных координатах stale `not_enough_points` не
  авторитетен; waypoint fallback всегда явно approximate, а не healthy road.
- **Surface/owner:** planned-trip route display — `useTripRouteDisplay`,
  `RouteBuilder`, page header и web/native route renderers.
- **Цепочка:** каноническая `#873`; live draft `#1490`; persisted backend
  geometry `#871/#1336`; рецидив iOS от 2026-08-31 снова ведётся в `#873`.
- **Подтверждённая причина рецидива:** repair запускался для healthy state без
  geometry, но не для `fallback_reason=not_enough_points` после появления двух
  координат; native renderer одновременно стилизовал waypoint segment как
  сплошную routed-линию, а header читал отдельный persisted tuple.
- **Controls:** exact fixture `coordinates >= 2 + stale not_enough_points`;
  shared preview repair; callback полного live tuple в header; approximate
  native payload и warning/dashed polyline. Runtime проверяет success,
  provider failure/retry и несохранённую вторую точку.
- **Решение для новой жалобы:** рассогласование line/state/summary на planned
  trip — reopen `#873`; деградированный HTTP 200 provider/cache contract —
  отдельная диагностика `ROUTING-ORS-001`, не смешивать причины.
- **Последняя проверка:** 2026-08-31; recurrence подтверждён screenshot и source
  trace, code-level regression в работе.

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

### TRAVEL-POINT-EDIT-PHOTO-IMPORT-ISOLATION-001 — фото существующей точки не является командой создания новой

- **Инвариант:** загрузка или drop фото в редакторе существующей точки может
  обновить только эту точку. Количество, id, координаты, адрес, категории и
  порядок точек остаются прежними. Переход `N → N+1` разрешён только явной
  командой «Из фото» в панели точек.
- **Surface/owner:** web travel wizard, шаг маршрута; portal-модалка
  `EditMarkerModal` и command boundary в `MarkersListComponent`. Каноническая
  задача — `#1603`.
- **Симптом:** drop JPEG в поле фото существующей точки одновременно вызывал
  `onAddMarkerFromPhoto` и создавал новую GPS-точку.
- **Цепочка:** `#505` владеет отдельной семьёй save/merge race, `#1599` —
  отображением preview. `#1603` канонична для утечки portal-drop в команду
  создания точки.
- **Подтверждённая причина:** synthetic drag-события React из portal-потомка
  всплывают по React component tree, даже когда DOM target расположен вне
  панели списка. Корневые `dragover`/`dragenter`/`dragleave`/`drop` handlers
  `MarkersListComponent` не проверяли DOM containment и интерпретировали drop
  внутри модалки как panel-level EXIF import.
- **Controls:** `isDragEventFromContainer` допускает обработку только когда
  `currentTarget.contains(target)`. Integration test подтверждает upload фото
  выбранной точки, отсутствие panel overlay и `onAddMarkerFromPhoto`, а также
  сохранение нового URL; healthy controls сохраняют прямой drop в панель и
  marker reorder.
- **Решение для новой жалобы:** повтор той же утечки portal-drop в panel import
  — `reopen #1603`; дефект preview без создания точки — `#1599`; мутация данных
  при save/readback без portal leak — `#505` или `create-linked` по
  подтверждённой причине.
- **Последняя проверка:** 2026-08-27; targeted suite дошёл до 13/14, при этом
  релевантные portal upload/no-add assertions прошли. Единственный упавший
  неоднозначный selector исправлен, но полный повтор suite, browser-проверка и
  реальный save/readback ещё не выполнены, поэтому `#1603` не принят.

### TRAVEL-POINT-CATEGORY-DICTIONARY-001 — новая категория из админки отсутствует в редакторе точки

- **Инвариант:** активная категория, созданная в админке, появляется в редакторе
  точки после входа на шаг с точками и после возврата в уже открытый шаг 2/3.
  Поиск по префиксу находит новый id, а по полному имени не предлагает создать
  дубль; выбранные id, поиск, адрес, фото и страны сохраняются.
- **Surface/owner:** shared frontend: словарь `categoryTravelAddress` в
  `hooks/useTravelFilters.ts`, `components/travel/hooks/usePointListCategoryDictionaryModel.ts`
  и `utils/pointCategoryDictionaryQuery.ts`; источник — `GET /api/getFiltersTravel/`.
  Админская запись создаётся через `/admin/travels/travelcategoryaddress/`.
- **Симптом:** 2026-08-28 админка показала успешное создание активной категории
  «Планетарий». В редакторе точки поиск `пла` показал старые категории
  «Параплан», «Плато» и «Чайная плантация», но не «Планетарий».
  Также отображалась строка «Добавить категорию «пла»». Она сама по себе не
  доказывает дефект: поиск работает по подстроке, а создание запрещается только
  для полного существующего имени (`SimpleMultiSelect.tsx:89-102`).
- **Цепочка:** `#1518` — каноническая frontend-задача; `#1436` — связанный
  backend/nginx-контракт заголовков и HTTP-кэша.
- **Подтверждённая причина прежнего инцидента:** устаревший клиентский путь
  словаря: HTTP/TTL/React Query-кэш и не срабатывавшая принудительная догрузка.
  **Подтверждённый рецидив (2026-08-29, локальный стек):** прежний
  `useTravelFilters` обновлял категории только при входе в шаг. Новая тестовая
  id=230 присутствовала в реальном API, но после возврата на неизменный шаг
  отсутствовала в UI: число GET осталось 2 → 2. Смена шага получала новую
  запись. Дополнительная гонка — общий cache helper присоединял возврат к
  forced-запросу, начатому ещё до него. Исправление: одна web-подписка на
  уход/возврат, граница свежести по sequence общего loader, отмена отложенного
  намерения и защита старых ответов. Точные cache/network условия исходной
  пользовательской production-сессии по-прежнему не измерены.
- **Controls:** forced `GET /api/getFiltersTravel/` при входе на шаг 2/3,
  единая форма `queryKeys.filters()`, троттлинг 60 секунд и browser-проверка
  Network не из disk cache. Новый обязательный сценарий — создать уникальную
  категорию в админке и сразу найти её в редакторе точки на desktop web и
  mobile web, не меняя шага. Для префикса проверять наличие новой категории,
  для полного имени — также отсутствие предложения создать дубль. Постоянные
  регрессии: существующие suites `useTravelFilters.test.ts` и
  `miscOptimized.test.ts` (оба порядка событий, старый запрос, отмена,
  error/empty/recovery, native/DOM-граница); два сценария возврата в
  `e2e/travel-wizard.spec.ts` сохраняют форму и ограничивают сеть одним GET.
  Контракт: `openspec/changes/fix-travel-point-category-refresh/`.
- **Решение для новой жалобы:** при открытой #1518 — `reuse`; после закрытия
  и повторного нарушения инварианта — `reopen #1518`; отдельная карточка нужна
  только при подтверждённом другом владельце или другой причине.
- **Последняя проверка:** 2026-08-29; локальный реальный API + admin → editor,
  desktop 1440×900 (новая id=231) и mobile web 390×844 (новая id=233): один
  GET после возврата, новые записи видимы за 29/20 мс после ответа, выбранные
  id и поля сохранены; save/readback 200. Mobile-возврат через 41,5 с после
  прошлого обновления обходит step-троттлинг; обычный 2 → 3 → 2 дополнительных
  GET не даёт. В live-пробе отключается искусственный focus Playwright, обе
  вкладки находятся в одном browser context; иначе отсутствие события —
  ошибка измерения. Production-выкладка и её повторная проверка отдельны.

### IOS-UNIVERSAL-LINKS-AASA-001 — AASA не может смешивать legacy- и modern-ключи

- **Инвариант:** тап по поддерживаемой ссылке `https://metravel.by/<путь>` из
  другого origin открывает установленное iPhone-приложение на точном экране —
  отдельно при killed и при уже запущенном приложении. Без приложения тот же
  URL остаётся обычной веб-страницей.
- **Surface/owner:** backend. Ответ `/.well-known/apple-app-site-association`
  строит `../metravel-backend/maintenance/apple_app_site_association.py`;
  nginx имеет явный `location = /.well-known/apple-app-site-association` с
  `proxy_pass http://metravel`. Фронтенд отдаёт статикой только
  `public/.well-known/assetlinks.json` (Android) и AASA не владеет.
- **Симптом:** 2026-08-24 и 2026-08-31 на физическом iPhone реальный tap не
  активировал MeTravel ни при закрытом, ни при запущенном приложении (0/1 и
  0/1). Контекстное меню Safari по ссылке не предлагало «Open in MeTravel».
  При этом entitlement, provisioning profile, `application-identifier`, AASA
  200 на origin и на Apple CDN — все зелёные, поэтому неделю причину искали в
  «залипшем системном association-cache устройства».
- **Цепочка:** `#1413` — каноническая backend-задача (публикация AASA);
  `#1414` — frontend/iOS route mapper и lifecycle, заказчик приёмки;
  `#1423` — приёмка TestFlight-кандидата; `#1047` — тот же класс инварианта на
  Android, но другой владеющий слой (intent-handling, не AASA).
- **Подтверждённая причина:** 2026-09-01. И origin, и зеркало Apple CDN
  синхронно (564 байта, байт-в-байт) отдавали `details[0]`, где legacy-ключ
  `appID` (String) стоял вместе с современным `components` (Array). Apple
  TN3155 «Debugging universal links» требует ЛИБО `appIDs` (Array) +
  `components` (Array), ЛИБО legacy `appID` (String) + `paths` (Array), и
  дословно предупреждает: «Please avoid mixing formats. Doing so may result in
  unexpected behavior for universal links.» Смешанный формат зафиксирован в
  самой спеке `#1413`
  (`openspec/changes/publish-apple-app-site-association/design.md:36`), поэтому
  генератор, независимый верификатор и тесты согласованно валидировали
  сломанную форму как эталон, и все гейты были зелёными.
- **Диагностический приём:** разложить проверки по признаку «нужна ли
  системная ассоциация iOS». Внешний cross-origin tap и пункт «Open in
  <app>» в long-press меню — нужна; `devicectl --payload-url`, custom scheme
  `metravel://`, симулятор и web fallback — не нужна. Если 100% первых красные
  и 100% вторых зелёные, дефект в ассоциации, а не в route mapper и не в кэше
  устройства: кэш одного телефона не объясняет одинаковый отказ на четырёх
  сборках после переустановки, перезагрузки и повторного доверия сертификату.
  Внешний контроль на здоровом примере: `https://slack.com/.well-known/apple-app-site-association`
  → чистый legacy `{appID, paths}`; рабочие production-AASA ключи не смешивают.
- **Controls:** `verify_apple_app_site_association` обязан явно проверять, что
  `details[0]` НЕ содержит одновременно `appID` и `components` — до правки он
  сам ожидал гибрид и на сломанном проде давал PASS. Клиентские гейты
  (`scripts/ios-release-guard-lib.js:401,590`,
  `scripts/ios-artifact-audit-lib.js:16`) проверяют только `app.json` и
  entitlement и к этому классу дефекта слепы; предложен frontend-side guard на
  форму реально отдаваемого AASA. Приёмка на устройстве обязана начинаться с
  ПЕРЕУСТАНОВКИ приложения: iOS перечитывает associated domains только при
  install/update, смены build number недостаточно. On-device верификация по
  TN3155 — Settings → Developer → Universal Links → Associated Domains
  Development → Diagnostics.
- **Решение для новой жалобы:** при открытой `#1413` — `reuse`; после её
  закрытия и повторного нарушения инварианта — `reopen #1413`; отдельная
  карточка нужна только при подтверждённом другом владельце или другой причине.
  Клиентские дефекты маршрутизации остаются за `#1414`.
- **Последняя проверка:** 2026-09-01. Причина подтверждена, `#1413`
  переоткрыта в `todo`, `#1414` переведена в `blocked_by #1413`. Исправление и
  его проверка на физическом iPhone ещё не выполнены.

### IOS-PRIVACY-ASC-FORM-DRIFT-001 — манифест приватности меняется кодом, а форма App Store Connect — только руками

- **Инвариант:** список типов данных в опубликованной форме App Privacy в App
  Store Connect построчно совпадает с `NSPrivacyCollectedDataTypes` в
  tracked `ios/metravel/PrivacyInfo.xcprivacy` — расхождений нет ни в одну
  сторону.
- **Surface/owner:** внешний артефакт App Store Connect, владелец — человек.
  Каноническая карточка действия — `#1420`; инвариант «манифест = форма»
  зафиксирован приёмкой `#1416`.
- **Симптом:** 2026-09-01 задача `#1417` (APNs/push lifecycle) добавила в
  манифест десятый тип `NSPrivacyCollectedDataTypeDeviceID` (`Linked=true`,
  purpose `AppFunctionality`, `Tracking=false`, коммит `3540bf615`), а
  опубликованная форма по последнему задокументированному состоянию содержит
  девять типов без Device ID.
- **Подтверждённая причина:** код-слой (манифест плюс ожидаемый список
  `IOS_PRIVACY_DATA` в `scripts/ios-release-guard-lib.js`) обновляется одним
  коммитом вместе с фичей, а внешняя форма ASC не обновляется ничем, если это
  не выделено отдельным шагом человека. Сверка в `#1416` была разовым снимком
  на момент публикации, а не постоянно действующим правилом.
- **Почему гейты зелёные:** `ios:release:guard` сверяет манифест со своим же
  ожидаемым списком, обновлённым тем же коммитом, поэтому на десяти типах он
  честно даёт PASS. У App Privacy нет API/CLI, и внешнюю форму ни один гейт
  проекта увидеть не может — это ограничение слоя, а не пробел в скрипте.
- **Диагностический приём:** `plutil -p ios/metravel/PrivacyInfo.xcprivacy`
  (или `plistlib`) и подсчёт записей `NSPrivacyCollectedDataTypes`; затем
  сверка с числом типов, зафиксированным в Done gate `#1420`/`#1416`. Число в
  карточке — единственный доступный агенту снимок опубликованной формы.
- **Controls:** программный контроль невозможен. Процессный: любой diff,
  меняющий `NSPrivacyCollectedDataTypes`, обязан в своём описании потребовать
  повторной публикации формы и сослаться на `#1420`; закрыть это до
  следующего submit/upload.
- **Решение для новой жалобы:** `reopen #1420` с указанием нового типа данных;
  отдельная карточка нужна только при другом владельце или другой причине.
- **Последняя проверка:** 2026-09-01. Владелец опубликовал обновлённую форму
  App Privacy в App Store Connect. Форма показывает 10 типов, включая
  `Device ID`; для него сохранены `App Functionality`, связь с пользователем и
  отсутствие tracking. Построчная сверка с `ios/metravel/PrivacyInfo.xcprivacy`
  расхождений не выявила; `#1420` повторно закрыта.

### NATIVE-DUP-BACK-AFFORDANCE-001 — на одном экране ровно один владелец навигации назад

- **Инвариант:** на любом экране приложения ровно один способ вернуться:
  либо глобальный контекст-бар (`HeaderContextBar`), либо собственная шапка
  экрана — никогда оба и никогда ни одного. Инвариант держится во ВСЕХ
  состояниях экрана (гость / загрузка / пусто / основное), а не только в тех,
  что проверяли руками, и на всех ширинах: «Назад» бар рисует только в своей
  мобильной ветке (`resolveHeaderContextBarIsMobile` — 360–767 dp), а на
  планшете, в ландшафте телефона и у́же 360 dp уходит в desktop-ветку, где у
  этих путей нет крошек (`showBreadcrumbs: false`) и видимого бара нет вовсе.
- **Surface/owner:** native (Android, iOS) кабинетные коллекции `/favorites`,
  `/history`, `/calendar`; владелец решения —
  `components/layout/customHeaderModel.ts` (`isCollectionBackAffordanceGlobal`)
  поверх набора `SELF_HEADED_COLLECTION_PATHS` в
  `components/layout/topLevelSections.ts`, а ширину подставляет хук
  `components/layout/useCollectionBackAffordance.ts`; экраны `app/(tabs)/favorites.tsx`,
  `components/screens/calendar/CalendarScreen.tsx`,
  `components/screens/history/HistoryScreen.tsx`. Web — здоровый контроль:
  бар на этих путях скрыт, шапка экрана единственная. Localization impact: none.
- **Цепочка:** `#234` (22.06.2026, дубль глобальной шапки на табе карты —
  скрыли шапку целиком) → `#799` (06.07.2026, экран статьи: своя кнопка
  поверх системного header — убрали кнопку) → `#836` (07.07.2026, `/history`:
  точечный `Platform.OS !== 'web'` только в этом экране) → `#1725`
  (03.09.2026, гвард добавлен лишь в двух новых состояниях `/favorites` и
  `/calendar`) → `#1726` (03.09.2026, канон семьи).
- **Подтверждённая причина recurrence:** на native
  `shouldShowHeaderContextBar` возвращает `true` до классификации разделов,
  поэтому глобальный бар с «Назад» рисуется на любом пути; при этом каждый
  экран решал «рисовать ли свою шапку» заново, своим локальным
  `Platform.OS !== 'web'`, и не во всех состояниях: `/favorites` — загрузка и
  список, `/calendar` — скелет и список оставались без гварда. Второй слой той
  же ошибки: `Platform.OS !== 'web'` отвечает про платформу, а бар рисует
  «Назад» только в мобильной ветке по ширине, поэтому «native ⇒ бар владеет
  Назад» ложно на планшете и в ландшафте — там ответ обязан вернуться к шапке
  экрана.
- **Почему прежний control не удержал инвариант:** четыре фикса — четыре
  разных ad hoc механизма без общей точки решения и без теста, перечисляющего
  набор коллекций; ручная device-проверка каждый раз смотрела выбранные
  состояния одного экрана.
- **Controls:** единая точка `isCollectionBackAffordanceGlobal(pathname,
  isContextBarMobile)` и хук `useCollectionBackAffordanceGlobal(pathname)`,
  который читает ширину тем же `useResponsive` и тем же
  `resolveHeaderContextBarIsMobile`, что и сам бар, — экраны обязаны
  консультировать их, а не `Platform.OS`; компактная
  «Очистить» на native — общий `components/profile/CollectionNativeClearButton`;
  тест `__tests__/components/customHeaderModel.contextBar.test.ts` перечисляет
  набор явно и проверяет для каждого пути три ответа: native в мобильной ветке —
  бар владеет «Назад», native вне её — владеет шапка экрана, web — бар скрыт;
  screen-тесты `favorites-screen`/`calendar` проверяют отсутствие in-page
  «Назад» на native в загрузке и списке, а `favorites-screen` — что при ширине
  900 dp шапка возвращается и остаётся единственной.
- **Решение для новой жалобы:** второй «Назад» на кабинетной коллекции из
  набора — `reopen #1726`; новая кабинетная коллекция без записи в
  `SELF_HEADED_COLLECTION_PATHS` — `create-linked` к семье с обязательным
  добавлением пути в набор и в тест; дубль на экране вне кабинетных коллекций
  (карта, статья) — свои каноны `#234`/`#799`.
- **Последняя проверка:** 2026-09-03, `#1726` — реализация; device-прогон по
  четырём состояниям трёх экранов записывается в карточке.

### ARTICLE-RATING-001 — отсутствует серверный API рейтинга статьи

- **Инвариант:** существующий клиент рейтинга статьи получает и сохраняет
  оценку через `GET/POST /api/articles/{id}/rating/`; общий рейтинг публичен,
  `user_rating` относится только к текущему пользователю.
- **Каноническая задача:** `#1800` (`area=back`, `todo`), обнаружена при
  приёмке `#1799` (OFFLINE-002). Это отдельная серверная причина, а не рецидив
  сохранения личного поля в публичном офлайн-снапшоте.
- **Подтверждение — 2026-09-05:** локальный backend `origin/master aa4450c`;
  пользователь A (104), `GET/POST /api/articles/1/rating/` → Django HTML 404.
  Здоровый контроль: `POST /api/travels/rating/`, travel 739, оценка 4 → 200.
  Независимое чтение `articles/urls.py`, `views.py`, `models.py`,
  `serializer.py` подтвердило отсутствие rating action, модели и полей
  рейтинга. Production не проверялся.
- **История:** поиск всех статусов по article/rating/оценка/статьи/рейтинг не
  нашёл серверного дубля; `#1124` относится к офлайн-пакетам, `#916` отменён
  как ошибочная задача об авторе статьи. Решение — `create-linked` к `#1799`.
- **Требуемый постоянный контроль:** серверные тесты точного JSON-контракта,
  диапазона 1–5, уникальности article/user, повторной записи без роста
  количества, агрегатов и изоляции A/B/guest при прогретом общем кэше.
  Контроль ещё не реализован; реальные API-пробы локального target и
  интеграция backend-кода входят в Done gate `#1800`.
- **Решение для новой жалобы:** тот же отсутствующий/неработающий endpoint —
  использовать `#1800`; ошибки офлайн-изоляции остаются в OFFLINE-002.

### USERPOINTS-MAP-SETTINGS-WEB-ONLY-GATE-001 — кнопка без доступной панели

- **Каноническая задача:** #1787; #1774 исправляет подписи действий в той же
  карточке, но не их доступность.
- **Инвариант:** кнопка настроек и сама панель используют одну доступность;
  пользователь не может включить настройку, которой нечем управлять.
- **Подтверждённая причина:** `PointsListHeader` всегда показывал кнопку,
  тогда как `PointsListGrid` монтировал панель только на web в фильтрах.
  Native `UserPointsMap` не передаёт `MapUiApi`; узкий web размонтирует карту
  при переходе к фильтрам, а отдельный desktop list не содержит панели.
- **Решение:** capability вычисляется в `PointsList` из платформы, ширины и
  режима; разрешена только широкая web карта. Один результат управляет
  видимостью кнопки и эффективным состоянием панели. Состав настроек и
  native bridge не расширяются.
- **Permanent control:** regression-тесты `PointsList`, `PointsListHeader`
  и `PointsListGrid`; iOS/Android/narrow web/desktop list не показывают
  недоступный контрол, desktop map сохраняет открытие/закрытие панели.
  Нормативный UI: `docs/design/userpoints-map-settings-1787.md`.
- **При рецидиве:** тот же рассинхрон кнопки и панели — reuse/reopen #1787;
  реализация полноценного native управления картой — отдельная feature.

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

Граница этого правила — фактический scope семьи и задачи. Validation-only gap
не возвращает карточку в `todo`: незавершённый временной in-scope gate остаётся
в `testing`, а `todo`/`in_progress` нужен только когда подтверждённый дефект
требует новой реализации. Device evidence обязательно лишь для затронутого
Android/iOS-specific behavior; его отсутствие вне scope не блокирует `done`.
Упоминания paired/device evidence в датированных записях реестра сохраняются как
исторические факты конкретных инцидентов, а не как глобальный all-device gate.

### FEEDBACK-SUCCESS-LOCALE-001 — известный успех обратной связи обходит i18n

- **Инвариант:** служебное подтверждение отправки `/contact` и `/about`
  отображается на выбранной RU/BE/UK/PL/EN локали; неизвестный API-текст
  сохраняется, ошибка не становится успехом.
- **Каноническая задача:** #1808; приёмка-источник #1784. Связи
  #1045 (публичный transport), #850 (доставка), #1505/#1520 (ошибки).
- **Подтверждённая причина:** `api/misc.ts::sendFeedback` возвращает известную
  строку success либо `message:string` дословно; `app/contact.tsx` и
  `app/(tabs)/about.tsx` выводят результат. Ключ
  `errorsStatic:api.misc.messageSent` применяется только как запасной текст.
- **Доказательство:** 2026-09-05 21:55:42 UTC, физический iPhone 13 mini,
  TestFlight 1.0.5 (8), BE: после HTTP 200 плашка по-русски, соседний тост
  корректно на BE. Независимое чтение кода подтверждает путь. В #1045 success
  copy была вне scope и реальный успех проверялся на RU; auth/SMTP-рецидива нет.
- **Решение:** create-linked #1808; `sendFeedback` нормализует только точную
  известную строку успеха через текущую локаль. Норма UI —
  `docs/design/contact-feedback-success.md`. Постоянный контроль в
  `__tests__/api/misc.behavior.test.ts`: оба success shape и fallback на пяти
  локалях с реальным i18n, unknown passthrough, смена локали во время ответа,
  отсутствие ложного успеха на HTTP 400/401/403/451 и сетевой ошибке.
  `__tests__/app/about.test.tsx` связывает результат и ошибку с обеими формами.
  Повторное production-письмо требует новой команды:
  разрешение на одну отправку в #1784 уже использовано.
