# Travel details performance contract

Актуализировано: 2026-08-23.

Этот документ фиксирует текущий performance contract страницы
`/travels/:param`. Он не хранит iteration log и не считается свежим Lighthouse
baseline: метрики принимаются только из нового production build или реального
URL с абсолютной датой замера.

Канонические обязательные правила находятся в `AGENTS.md` и `docs/RULES.md`.
Карта travel-кода — в `docs/features/travel.md`.

## 1. Scope

Контракт применяется к:

- `components/travel/details/**`;
- `components/travel/sliderParts/**`;
- `components/ui/ImageCardMedia.tsx` и hero media helpers;
- travel preload/query path;
- lazy/deferred composition, responsive media и post-LCP chrome;
- web bundle budgets, если изменение затрагивает route/shared graph.

UI redesign, backend API changes, deploy и server caching не входят в этот
документ автоматически.

## 2. Текущая архитектура

```text
app/(tabs)/travels/[param].tsx
  -> TravelDetailsContainer
  -> TravelDetailsCriticalShell
     -> TravelDetailsHero / optimized first media
  -> TravelDetailsPostLcpRuntime
  -> TravelDetailsDeferredRuntimeSlot*
     -> description, points, map, author, comments, related content
```

Data ownership:

- `hooks/useTravelDetails.ts` и `hooks/travel-details/**` — route/controller state;
- `api/travelDetailsQueries.ts` — id/slug fetch и cache policy;
- `app/+html.tsx` — direct-load preload/SEO shell;
- React Query — server state; duplicate first-load request запрещён.

Наличие lazy boundary само по себе не доказывает улучшение. Проверяется реальный
network/module timing и сохранение пользовательского поведения.

## 3. First-screen contract

- Web hero сохраняет стабильную высоту `70vh` от первого релевантного paint.
- Main image, blurred surround и slider chrome формируют единый визуальный state.
- Slider/background не ждут click, pointer, keyboard или scroll.
- Blur backdrop находится в DOM с первого релевантного кадра и по возможности
  использует тот же effective source, что видимое изображение.
- Skeleton, static media и slider handoff не меняют геометрию.
- Главное изображение не показывается как размазанный progressive frame на iOS
  Safari: reveal следует подтверждённой load/decode логике `ImageCardMedia`.
- Нельзя улучшать метрики удалением blur, interaction-gating слайдера или
  user-visible таймером раскрытия.

## 4. Loading contract

- Above-the-fold shell начинает работу сразу и не зависит от map/comments.
- Пользовательские секции начинают загрузку при page load по правилам
  `docs/RULES.md`; нельзя скрывать их до scroll/interaction через
  `IntersectionObserver` или длинный fallback timeout.
- Skeleton резервирует геометрию, но не блокирует остальной экран.
- Runtime/UI timeout не используется для маскировки readiness; лимит и
  исключения определены в `docs/RULES.md`.
- Preload и React Query переиспользуют один in-flight promise/payload вместо
  второго запроса той же travel detail.

## 5. Media contract

- Hero/gallery/inline content используют текущие shared media helpers.
- First hero image имеет осознанный `priority/loading/fetchPriority`; соседние
  изображения не получают eager/high без измеренной необходимости.
- `contain + blur` сохраняется; переход на `cover` не является performance fix.
- Responsive source и sizes проверяются по фактическому rendered viewport.
- Published media остаётся реальным/licensed/local или photorealistic raster по
  правилам `docs/RULES.md`.

## 6. Bilateral slider/performance gate

Любое изменение slider/details/hero/media/lazy path обязано подтвердить обе
стороны контракта:

```bash
yarn verify:slider
yarn verify:slider-perf
```

Один зелёный результат недостаточен: performance optimization не должна ломать
swipe, а swipe fix не должен незаметно ломать LCP/bundle budgets. Команды
запускаются только после проверки operation gate и через repository
quality-gate lock.

## 7. Regression budgets

Этап 7 считается постоянно действующим regression contract:

- `config/bundle-budget.json` — committed raw/gzip budgets;
- `scripts/guard-bundle-budget.js` — проверка production chunks;
- `scripts/guard-eager-web-bundle.js` — static/analyze guard eager graph;
- `scripts/guard-lighthouse-mobile-budget.js` — Lighthouse budget policy;
- `scripts/guard-eager-web-bundle.js` не допускает возврат
  `react-native-gesture-handler`, `react-native-reanimated`, worklets и Hammer в
  web eager graph через root import.

Пороговые числа не дублируются в этом документе. Источник правды — config и
default constants соответствующего guard. Обновление budget разрешено только
после production build, объяснения причины и сравнения с предыдущим baseline.

## 7.1 Mobile main-thread blocking (#1499)

Блокировка главного потока на `/travels/[slug]` меряется отдельным гейтом
`@perf Travel Details — Main-thread blocking` в
`e2e/travel-details-perf-budget.spec.ts`. Профиль эмуляции — единственный на все
перф-гейты: `MOBILE_THROTTLE_PROFILE` в `e2e/helpers/perfBudget.ts` (CPU ×4,
Slow-4G), там же `applyMobileThrottling`, `measureCpuThrottlingRatio` и `median`.

Контракт замера, любое отклонение делает числа несопоставимыми:

- каждый проход ХОЛОДНЫЙ — свой `browser.newContext()` с мобильным дескриптором.
  Прогретые проходы переживают V8 compilation cache и дешевле в 2–4 раза
  (замер 2026-08-23 на одной сборке: 146–278 мс прогретых против 410–498 мс
  холодных в своём контексте; первый проход в общем контексте доходил до
  493–1175 мс), поэтому
  регрессия в парсе/компиляции на них амортизируется и гейт её проспал бы.
  Lighthouse, чьи числа стоят в Done gate, тоже меряет только холодный старт;
- решение по медиане ≥5 проходов, дисперсия гасится числом проходов, а не
  выбрасыванием холодного;
- `mode: 'serial'` стоит на уровне БЛОКА, а не файла. Файловый serial проверен
  и отвергнут: он превращает падение любого теста файла в скип остальных, и
  прогон обрывается до самого замера (2026-08-23 это воспроизвёл красный
  `Network transfer budget`). Поэтому блок остаётся параллельным соседям, а
  порог калибруется полным прогоном файла — в том режиме, в котором гейт и
  работает;
- «мобильность» задаётся дескриптором устройства, а не `setViewportSize`:
  замер в узком боксе оставляет desktop DPR/touch/UA (класс дефекта #1287);
- обязателен позитивный контроль, что троттлинг доехал до рендерера. Без него
  гейт вырождается в вечнозелёный. Контроль меряет busy-loop через ТУ ЖЕ
  CDP-сессию (отдельная сессия эмуляцию первой не переопределяет и даёт ложное
  отношение ≈1) и не короче 40M итераций (на 4M замер тонет в JIT-разогреве);
- порог ослабить переменной окружения нельзя — `clampCeiling` игнорирует
  послабления и печатает их в отчёте.

Локальный порог — ratchet против регрессии, а НЕ продуктовая цель: стенд
систематически расходится с продом (2026-08-23: локально 416–465 мс против
517 мс на `lighthouse:produrl:travel:mobile`). Калибровать порог нужно ПОЛНЫМ
прогоном файла, а не изолированным `-g`: в штатном режиме соседние блоки
занимают тот же CPU и медиана поднимается с 416–449 до 465 мс. Абсолютный мобильный TBT
снимается только на проде после деплоя: на локальном стенде код приезжает
мгновенно, а hero-кадр тянется с прода, поэтому FCP наступает позже основной
работы и Lighthouse честно отдаёт TBT = 0 при TTI = FCP.

### Что на этом маршруте проверено и НЕ работает

Обе гипотезы закрыты замером на двух прод-сборках, а не рассуждением. Повторять
их без нового механизма не нужно.

1. **Дробление коммитов через `startTransition`.** Транзишенами помечались оба
   тяжёлых монтирования (post-LCP хром в `useTravelDetailsPerformance`,
   `markSectionLoaded`/`setCanRenderHeavy` в `useTravelDeferredSectionsModel`).
   TBT 348 → 340 мс, худшая задержка ввода при тапах 112 → 118 мс — шум.
   Причина: React-scheduler в Chrome не уступает поток, пока `isInputPending()`
   ложно; commit-фаза с layout-эффектами непрерываема; блокирует в основном
   первичная ленивая компиляция (`(program)` 915 мс из 2805 мс занятости).
2. **Вынос офлайн-адаптера из sync-подграфа маршрута.** `travelOfflineAdapter`
   тянет `utils/sanitizeRichText` → sanitize-html + htmlparser2 + postcss +
   entities. Разрыв всех трёх рёбер (`useOfflineTravelCache`, `useTravelDetails`,
   `TravelHeroExtras`) убрал 270 КБ: sync-подграф маршрута 865,3 → 595,3 КБ,
   403 → 335 модулей. TBT при этом не изменился (A/B с чередованием, медианы
   417 против 417 мс), потому что тот же чанк всё равно приезжает для показа
   тела статьи через `StableContent → htmlTransform`, только позже. При этом
   eager-запросов маршрута стало 52 вместо 51, то есть правка пробивает
   `eager.maxRequestsByRoute` — ровно переразбивка чанков из #1393. Откачено;
   патч сохранён в `.codex-temp/1499/offline-defer.patch`.

Диагностическая оговорка на будущее: Lighthouse-аудит `bootup-time` НЕ равен
времени выполнения файла — он суммирует self-time всех функций из этого URL за
прогон. На travel-details реальный `EvaluateScript entry` = 170 мс при 2403 мс,
приписанных `entry` этим аудитом. Проверять надо событием `EvaluateScript` в
трейсе `devtools.timeline`.

## 7.2 Где на проде реально стоит TBT (#1552)

Разбор трёх холодных прогонов прода 2026-08-24 по
`https://metravel.by/travels/tropa-vedm-v-gartse-kak-proiti-hexenstieg`
(`.codex-temp/lh-1479-recheck/mobile.run0{1,2,3}.json`, TBT 2818 / 948 / 837,
медиана 948). Run01 снят при load average ~380 и в атрибуцию брать его нельзя —
цифры ниже из run02/run03.

Хронология главного потока (run03, FCP 1801, LCP 2584, TTI 11885, TBT 837):

| окно | что происходит |
| --- | --- |
| 0 – 1.8 c | первый экран рисуется из SSG-HTML, JS ещё едет |
| 1.8 – 7.8 c | скачиваются 53 eager-скрипта (833 КБ transfer / 3139 КБ decoded) |
| 8.5 – 11.9 c | гидратация: 423 мс + 327 мс + семь задач 52–125 мс |

Ни одна длинная задача не попадает в окно до LCP. Значит **TBT здесь — это
гидратация, отложенная скачиванием eager-набора**, а не парс entry: на весь
прогон `scriptParseCompile` = 318 мс против `scriptEvaluation` = 2830 мс.
Отсюда же ответ, почему обе гипотезы §7.1 не двигали TBT на локальном стенде:
там код приезжает мгновенно и окно скачивания, которое здесь и есть рычаг,
просто не существует.

Покрытие того же прогона (`script-treemap-data`): **3676 КБ загружено, 2156 КБ
(59%) не выполнено ни разу**. Разложение по худшим чанкам:

| чанк | decoded | не использовано | что внутри |
| --- | --- | --- | --- |
| `__shared-7` | 145 КБ | **100%** | слой поездок, `MOCK_TRIP_*`, xmldom/GPX |
| `__shared-57` | 105 КБ | 99% | карта: тайлы, оверлеи, OpenWeather |
| `__shared-5` | 284 КБ | 95% | карта: Overpass/WFS, кластеры, попапы |
| `__shared-20` | 45 КБ | 97% | валидаторы форм |
| `__shared-45` | 44 КБ | 96% | хелперы карточек списка |
| `__shared-6` | 30 КБ | 93% | API квестов |
| `__shared-1` | 454 КБ | 53% | react-query, дизайн-токены, `MOCK_RARE_AWARD*` |
| `entry` | 1027 КБ | 47% | react-dom, expo-router, @react-navigation |

Механизм: Metro относит модуль к `__shared-N` по множеству маршрутов-корней, и
маршрут грузит чанк целиком ради одного нужного модуля. Замерено на dist через
разбор `__d(...)`: `queryKeys` (0 КБ) держит `__shared-3` (175 КБ),
`COVER_WIDTH_LADDER` (3 КБ) держит `__shared-45` (44 КБ), `useTdTrace` (1 КБ)
держит `__shared-102` (41 КБ). Поэтому единица работы здесь — не «убрать
импорт», а «снять чанк с маршрута», то есть разорвать ВСЕ рёбра в него сразу
(#1393) и проверить результат по двум измерениям: brotli худшего маршрута и
`eager.maxRequestsByRoute`.

### Что снято с eager-пути (#1552, замер 2026-08-25)

Разорваны четыре ребра статического импорта; во всех случаях потребитель уже
асинхронный, поэтому `await import(...)` — настоящая граница чанка, а не
условный require:

| файл | вынесено за границу |
| --- | --- |
| `hooks/useBreadcrumbModel.ts` | `@/api/quests`, `@/api/plannedTrips`, `@/api/publicTrips` |
| `hooks/questsListQuery.ts` | `@/api/quests` (`fetchQuestsList`) |
| `hooks/useOfflineTravelCache.ts` | `@/services/offline/offlineCatalog`, `travelOfflineAdapter` |
| `api/achievementsRequests.ts` | `@/api/achievementsMock` (17 обращений) |

Крошки рендерятся в шапке КАЖДОГО маршрута, поэтому выигрыш общий, а не
только на travel-детали. A/B двумя прод-сборками на одном и том же патче
Metro (отпечаток `serializeChunks.js` совпал до и после обоих прогонов):

| маршрут | было | стало | Δ |
| --- | --- | --- | --- |
| `index.html` | 14 скр / 3042.5 КБ | 14 скр / 2887.6 КБ | −154.9 КБ |
| `(tabs)/search.html` | 9 скр / 2845.8 КБ | 9 скр / 2690.9 КБ | −154.9 КБ |
| `(tabs)/map.html` | 14 скр / 3118.8 КБ | 14 скр / 2963.9 КБ | −154.9 КБ |
| `(tabs)/profile.html` | 21 скр / 3548.1 КБ | 21 скр / 3393.2 КБ | −154.9 КБ |
| `(tabs)/travels/[param].html` | 16 скр / 3125.3 КБ | 16 скр / 2970.7 КБ | −154.6 КБ (brotli 697.6 → 662.6) |
| `(tabs)/trips/plan/[id].html` | 24 скр / 3514.1 КБ | 25 скр / 3511.0 КБ | −3.1 КБ, +1 запрос |

Число запросов НЕ выросло нигде, кроме `trips/plan/[id]`, где слой поездок
теперь приезжает отдельным чанком (25 из 51 по бюджету) — ловушка переразбивки
#1393 не сработала. `release total` практически не изменился (+1.7 КБ brotli:
у мок-каталога появился собственный чанк), новых нарушений `guard:bundle-budget`
не добавилось.

Чего эта правка НЕ снимает: слой карты (`offlineCatalog`, Overpass, тайлы)
остаётся eager на travel-детали, потому что в него ведут ещё рёбра из
квестового кода (`useQuestCityCollection`, `QuestForCityCard` → `calculateDistance`),
которые не резались. Это следующий шаг той же линии.

## 8. Проверки

Для production measurement:

```bash
yarn build:web:prod
yarn guard:eager-web:fail
yarn guard:bundle-budget:fail
yarn lighthouse:travel:mobile
yarn lighthouse:travel:desktop
```

Блокировка главного потока (§7.1) снимается на стенде, который отдаёт сборку с
gzip — тем же, что поднимает CI:

```bash
E2E_BUILD_DIR=dist/prod E2E_WEB_PORT=4714 node scripts/serve-web-build.js
E2E_NO_WEBSERVER=1 BASE_URL=http://127.0.0.1:4714 npx playwright test e2e/travel-details-perf-budget.spec.ts -g "Main-thread blocking"
```

После deploy метрики снимаются отдельно по `https://metravel.by` с датой, URL,
form factor и ключевыми LCP/TBT/CLS/network findings. Dev Metro request/chunk
counts не используются как production evidence.

В browser review дополнительно проверяются:

- direct load и SPA navigation;
- hero geometry, blur и slider swipe;
- network duplication и console errors;
- map/comments/related sections после загрузки;
- mobile viewport и iPhone Safari при изменении media reveal/source selection.

## 9. Definition of done

Изменение закрыто, когда одновременно:

1. сохранены SEO/direct-load contracts;
2. slider и performance gates зелёные;
3. first-screen и downstream sections проверены в браузере;
4. production build проходит релевантные bundle guards;
5. новый baseline сравним с предыдущим и не основан на dev server;
6. нет cache-bust/reload/service-worker workaround;
7. любой backend/server blocker вынесен в `area=back`, а не замаскирован
   frontend fallback.

Исторические итерации и моментальные Lighthouse числа удалены: их источник — git
history и task board evidence, а не текущая документация.
