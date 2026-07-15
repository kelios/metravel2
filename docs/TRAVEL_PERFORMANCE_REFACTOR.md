# Travel details performance contract

Актуализировано: 2026-07-15.

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

## 8. Проверки

Для production measurement:

```bash
yarn build:web:prod
yarn guard:eager-web:fail
yarn guard:bundle-budget:fail
yarn lighthouse:travel:mobile
yarn lighthouse:travel:desktop
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
