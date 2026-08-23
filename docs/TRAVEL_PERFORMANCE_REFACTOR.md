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
