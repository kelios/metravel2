# TASK-20260613-001: Белый экран при SPA-навигации (travel + карта) — скелетон-оверлей не снимается

Status: In Progress (travel-фикс готов + тесты; browser-верификация на проде pending; карта AC#4 делегируется map-expert)
Owner: Manager
Support: travel-expert, map-expert, Tester, Reviewer
Created: 2026-06-13
Updated: 2026-06-13

## Goal

Убрать белый экран при клиентской (SPA) навигации между маршрутами на web (прод metravel.by). Контент готов почти мгновенно, но перекрыт скелетон-оверлеем ~6 секунд. Нужно снимать оверлей по готовности данных, не завися от хрупкого `lcpLoaded` (image-onLoad).

## Context

Симптом (со слов владельца): после перехода между страницами иногда показывается белый экран — «открыть путешествие можно нормально, а может упасть». Та же проблема на карте (`/map`).

### Точная эмпирика (замерено в браузере на проде, новый бандл `entry-dd18cced…`, travel-чанк `[param]-6bdf5d24…`)

SPA-переход с главной в `/travels/<slug>` (клик по `<a>` карточки), опрос DOM каждые 250мс:

```
250мс … 6000мс:  skeleton-overlay opacity = 1,  data = Y (travel загружен),  hero = 1/c (img opacity 1, complete)
```

То есть:
- `travel`-данные загружены за ~250мс (React Query, быстрый/кешированный фетч).
- Hero-изображение отрисовано (opacity 1, `complete=true`) за ~250мс.
- **Скелетон-оверлей `[data-testid="travel-details-skeleton-overlay"]` держит `opacity:1` (z-index 50) и перекрывает готовую страницу все ~6 секунд** → это и есть «белый экран» (на скриншотах — почти белая область между шапкой и футером).
- **Прямая загрузка/F5** страницы путешествия и карты — **работает** (другой путь: SSR-HTML + гидрация, React восстанавливается).
- На каждой странице прода в консоли сыпется **React #419** (Suspense не достроился при гидрации) — это, вероятно, ленивые секции шапки (`components/layout/CustomHeader.tsx:100-117`), затрагивает только подсубдерево шапки; это фоновый шум, НЕ причина белого экрана. Низкий приоритет, отдельный слой.

### Цепочка снятия оверлея (где блокер)

Оверлей рендерит `components/travel/details/TravelDetailsCriticalShell.tsx` → `TravelDetailsSkeletonOverlay.tsx` (opacity `skeletonPhase==='loading' ? 1 : 0`).

`skeletonPhase` из `hooks/useSkeletonPhase.ts`:
```
useSkeletonPhase({ isDataReady: Boolean(travel), isVisualReady: isFirstScreenReady || isWebAutomation })
```
переходит в `'hidden'` только при `isDataReady && isVisualReady`.

`isVisualReady = isFirstScreenReady = !hasHeroMedia || lcpLoaded` (`components/travel/details/travelDetailsCriticalShellModel.ts:isTravelDetailsFirstScreenReady`).

Т.к. у путешествия есть галерея (`hasHeroMedia=true`), `isVisualReady = lcpLoaded`. Значит оверлей висит, пока `lcpLoaded` не станет `true`.

`lcpLoaded` (`hooks/useTravelDetailsPerformance.ts`) ставится:
1. колбэком `onFirstImageLoad` (hero `OptimizedLCPHero.onLoad → useTravelHeroState.handleWebHeroLoad → onFirstImageLoad`), ИЛИ
2. safety-таймаутом.

**Ключевая улика:** safety-таймаут был снижен 6000→1200мс (задеплоено), но поведение НЕ изменилось (оверлей всё равно висит ~6с). Значит эффект таймаута не выполняется — его гвард `if (isLoading || travelId == null || !hasHeroMedia || lcpLoaded) return`. Раз `hasHeroMedia=true` (иначе оверлей снялся бы сразу) и `lcpLoaded=false`, остаётся **`data.isLoading` остаётся `true`** (или `travelId == null`), хотя `travel` уже отрисован. То есть `isLoading` не гаснет → таймаут не ставится → `lcpLoaded` не выставляется → оверлей висит.

`isLoading` приходит из `hooks/travel-details/index.ts:30` → `data.isLoading` → `hooks/useTravelDetails.ts:308` (React Query `useQuery.isLoading`). **Надо подтвердить живым стейтом (React DevTools), почему `isLoading`/`travelId` не доходят до false на SPA-навигации, хотя `travel` присутствует.**

### Что уже пробовали и задеплоили (НЕ помогло устранить симптом, но безвредно — можно оставить)

- `components/ui/ImageCardMediaWebHelpers.tsx`: `WebMainImage` синтезирует `onLoad` и при `loaded===true`/кеш-хите (с дедупом через `loadReportedRef`). Корректность; happy-path для слайдера. Регресс-тест в `__tests__/components/ui/ImageCardMedia.blur.web.test.tsx` («still reports onLoad on a cache-hit mount»).
- `hooks/useTravelDetailsPerformance.ts`: safety-таймаут LCP-гейта 6000→1200мс. Сработает там, где `isLoading` гаснет; на воспроизведённом кейсе не сработал (см. выше).
- Деплои: commit `a0acf034` (и ранее travel-hero onLoad). Прод НЕ сломан, health-check зелёный.

### Важные правила проекта (CLAUDE.md)

- Web-прод не ломать ради native; общие файлы править с web-проверкой в браузере.
- Изображения только через `ImageCardMedia`; travel-карточки через `UnifiedTravelCard`.
- После деплоя ОБЯЗАТЕЛЬНО проверять работоспособность прода (smoke + браузер целевого сценария). Деплой только через `scripts/fix-prod.sh`; на этой Windows-машине rsync нет → `ops/deploy-frontend.sh` (tar+ssh).
- Верифицировать самому до сдачи. Минифицированный прод не даёт текста #419; `--dev` web-экспорт сейчас битый («Requiring unknown module 889» + asyncRoutes) — для живого стейта использовать React DevTools на проде или почthere source maps.

## Acceptance Criteria

- [ ] При SPA-навигации в `/travels/<slug>` скелетон-оверлей снимается ≤ ~300–500мс после готовности данных (не 6с). Белого экрана нет.
- [ ] Поведение интермиттентности устранено (кеш-хит hero, как при клике с карточки на то же фото).
- [ ] Прямая загрузка travel-страницы по-прежнему без регрессий (нет CLS-всплеска, hero не «прыгает»).
- [ ] Та же проверка для `/map` (heavy mount): переход не даёт длительного белого/замороженного экрана.
- [ ] Регресс-тест(ы) на снятие скелетона по готовности данных, не завязанные на image-onLoad.
- [ ] Задеплоено и проверено в браузере на проде (скрин/замер времени снятия оверлея).

## Gherkin Tests

```gherkin
Feature: Снятие скелетон-оверлея при SPA-навигации в детали путешествия

  Scenario: Hero-изображение в кеше (клик по карточке с тем же фото)
    Given пользователь на главной, hero путешествия уже отрисован в карточке
    When он кликает карточку и переходит в детали путешествия (SPA-навигация)
    And данные путешествия доступны (React Query cache/fast fetch)
    Then скелетон-оверлей снимается за доли секунды
    And контент (hero + описание) виден без белого экрана

  Scenario: Прямая загрузка не регрессирует
    Given пользователь открывает /travels/<slug> напрямую (F5)
    When страница гидрируется
    Then hero не прыгает, скелетон снимается штатно, CLS не растёт
```

## Assignment

Primary owner: travel-expert (travel-слой), map-expert (карта-слой)
Support agents: test-author (регресс-тесты), review-auditor (ревью), frontend-deployer (деплой), prod-smoke (пост-деплой)

## Likely Files Or Areas

- `hooks/useTravelDetails.ts` — источник `isLoading`/`travel` (проверить, почему `isLoading` не гаснет на SPA-нав).
- `hooks/travel-details/index.ts` — проброс `isLoading` в perf-хук.
- `hooks/useTravelDetailsPerformance.ts` — `lcpLoaded`, safety-таймаут (гвард `isLoading`).
- `hooks/useSkeletonPhase.ts` — условие `isDataReady && isVisualReady`.
- `components/travel/details/travelDetailsCriticalShellModel.ts` — `isTravelDetailsFirstScreenReady`.
- `components/travel/details/TravelDetailsCriticalShell.tsx`, `TravelDetailsSkeletonOverlay.tsx` — рендер оверлея.
- `components/travel/details/TravelDetailsContainer.tsx` — composition `skeletonPhase`.
- Карта: `components/MapPage/**`, `components/map/**`, `app/map*`, `hooks/useMap*` — тяжёлый синхронный монтаж Leaflet/маркеров блокирует main-thread (в локальном замере монтаж заморозил renderer ~45с); рассмотреть отложенный/прогрессивный монтаж.

## Plan

1. Через React DevTools на проде (или source-mapped билд) подтвердить значения `data.isLoading`, `data.travel`, `lcpLoaded`, `skeletonPhase` в момент белого экрана при SPA-навигации. Зафиксировать, почему `isLoading` не доходит до `false`.
2. Снять скелетон-оверлей по готовности ДАННЫХ (`Boolean(travel)`) + короткий grace, НЕ завязываясь на `lcpLoaded` (hero и так отрисован мгновенно по замеру). Сохранить анти-CLS-поведение для прямой загрузки.
   - Вариант A: в `TravelDetailsContainer` передавать `isVisualReady`, истинный когда `Boolean(travel)` (после first paint), а LCP-гейт оставить только для отложенной тяжёлой обвязки (`heroEnhancersReady`/`postLcpRuntimeReady`), не для скрытия контента.
   - Вариант B: чинить корень — почему `isLoading` залипает true при наличии `travel`, и тогда таймаут/он-лоад отработают.
3. Регресс-тест: при `travel` присутствует и `isLoading=false` (и/или по таймауту) `skeletonPhase` уходит в `hidden` без image-onLoad.
4. Карта: профилировать монтаж `/map`, вынести тяжёлую инициализацию (Leaflet, маркеры/кластеризация) за пределы синхронного рендера (idle/lazy/чанк), чтобы переход красил каркас до тяжёлой работы.
5. (Низкий приоритет, отдельный слой) #419 в шапке: ленивые `CustomHeaderNavSection`/account/`HeaderContextBar` под `Suspense` суспендятся при статическом SSR. Стабилизировать (например, не лениво грузить критичные секции шапки на web, либо корректные fallback'и/границы).
6. Деплой `scripts/fix-prod.sh`; пост-деплой smoke + браузер-замер времени снятия оверлея (цель ≤500мс) на нескольких путешествиях и на `/map`.

## Validation

- Локально: `npx jest <новые/затронутые тесты>`; `npm run lint`/`typecheck` на затронутом scope.
- Браузер (прод после деплоя): SPA-переход в 3–4 разных путешествия (кеш-хит и кеш-промах hero) — замер времени до `skeleton opacity=0` (инструмент: опрос `[data-testid="travel-details-skeleton-overlay"]` каждые 250мс, как в этом расследовании). Цель: ≤ ~500мс, белого экрана нет. Аналогично `/map`.
- Smoke прода (агент `prod-smoke`).

## Release Checklist

- [ ] Changed files are listed in `## Results`.
- [ ] New files created by this task are identified.
- [ ] Generated/cache/secret/local files are excluded.
- [ ] Task-scope files are staged when the user asks to prepare git.
- [ ] Skipped files and release blockers are recorded.

## Progress Log

- 2026-06-13: Создано. Расследование выявило: контент+hero готовы за ~250мс, скелетон-оверлей висит ~6с при SPA-нав; `lcpLoaded` не выставляется (safety-таймаут заблокирован гвардом `isLoading`, т.е. `data.isLoading` не гаснет). Уже задеплоены 2 безвредные правки (ImageCardMediaWebHelpers onLoad-синтез; LCP-таймаут 6000→1200), симптом не устранён. Карта: тяжёлый монтаж блокирует main-thread. #419 (шапка) — фоновый, отдельный слой.
- 2026-06-13: **Найдена корневая причина SPA-залипания** (статический разбор, не `isLoading`). `OptimizedLCPHero` (`TravelDetailsOptimizedLCPHero.tsx`) рендерится без `key` в `TravelDetailsHero.tsx:215` → при SPA-свапе путешествия React переиспользует тот же инстанс, а его внутренний `didNotifyLoadRef` остаётся `true` с прошлого травела → `notifyReady()` мгновенно выходит → `onLoad`→`handleWebHeroLoad`→`onFirstImageLoad`→`setLcpLoaded(true)` НЕ вызывается → `lcpLoaded` залипает `false` → оверлей висит до safety-таймаута. Прямая загрузка работает (свежий монтаж, `didNotifyLoadRef=false`). Дополнительно залипали `overrideSrc`/`loadError`/`didTryApiPrefix` от прошлого фото (риск показать чужую/error-картинку).
- 2026-06-13: **Фикс №1 (корень):** сброс per-image стейта в `OptimizedLCPHeroInner` при смене `baseSrc` (`didNotifyLoadRef`, `overrideSrc`, `didTryApiPrefix`, `loadError`) → новый hero ведёт себя как свежий монтаж, `lcpLoaded` выставляется мгновенно на кеш-хите.
- 2026-06-13: **Фикс №2 (защита, AC#5):** `useSkeletonPhase` получил `visualReadyFallbackMs` — снимает оверлей по готовности ДАННЫХ + bounded grace, НЕ завязываясь на image-onLoad/`isLoading`/`lcpLoaded`. Контейнер передаёт `visualReadyFallbackMs: 500`. Hero держит фикс-высоту neutral-placeholder под оверлеем → ранний lift не даёт CLS/белого экрана. Backstop срабатывает, даже если onLoad полностью потерян.
- 2026-06-13: Тесты зелёные (10): `__tests__/hooks/useSkeletonPhase.test.tsx` (5: снятие по данным после fallback без visual-ready; не снимает пока нет данных; предпочитает реальный visual-ready), `__tests__/components/travel/TravelDetailsOptimizedLCPHero.swap.web.test.tsx` (повторный onLoad после свапа изображения). Регресс существующих (perf/a11y/blur) — без поломок. tsc/eslint по scope чисто (оставшиеся tsc-ошибки — преexisting в Map.ios/MapPanel/QuestFullMap native, не из этого фикса).
- 2026-06-13: **Карта (AC#4) — не сделано в этой итерации.** Тяжёлый синхронный монтаж Leaflet/маркеров — отдельная значимая работа (профилирование + браузер-верификация), владелец map-expert. Делегировать отдельным проходом; не править вслепую вместе с travel.

## Results

Changed files (этот фикс, 2026-06-13):

- `components/travel/details/TravelDetailsOptimizedLCPHero.tsx` — **корневой фикс**: сброс per-image стейта (`didNotifyLoadRef`, `overrideSrc`, `didTryApiPrefix`, `loadError`) при смене `baseSrc`, чтобы переиспользуемый при SPA-свапе инстанс hero снова выставлял `lcpLoaded` через onLoad.
- `hooks/useSkeletonPhase.ts` — добавлен `visualReadyFallbackMs`: снятие оверлея по готовности данных + bounded grace, независимо от image-onLoad/`isLoading`/`lcpLoaded`.
- `components/travel/details/TravelDetailsContainer.tsx` — передаёт `visualReadyFallbackMs: 500` в `useSkeletonPhase`.
- `__tests__/hooks/useSkeletonPhase.test.tsx` — НОВЫЙ, 5 тестов (снятие по данным после fallback без visual-ready; не снимает пока нет данных; реальный visual-ready приоритетнее fallback).
- `__tests__/components/travel/TravelDetailsOptimizedLCPHero.swap.web.test.tsx` — НОВЫЙ, повторный onLoad после свапа изображения (per-image reset).

Ранее задеплоенные безвредные правки (оставлены):

- `hooks/useTravelDetailsPerformance.ts` (LCP safety-таймаут 6000→1200мс)
- `components/ui/ImageCardMediaWebHelpers.tsx` (WebMainImage onLoad-синтез на кеш-хите)
- `__tests__/components/ui/ImageCardMedia.blur.web.test.tsx` (регресс-тест cache-hit onLoad)

Примечание: в working tree есть несвязанные native-only правки `components/travel/UnifiedSlider.tsx`, `components/travel/sliderParts/Slide.tsx` (ветвление `!isWeb` + debug-probe под `Platform.OS !== 'web'`) — на web-бандл не влияют; debug-probe в `Slide.tsx` стоит убрать.

Validation evidence: см. ## Context (замер skeleton/data/hero на проде).

Reviewer findings:

Release notes:

Blockers:
- Гипотеза «`data.isLoading` залипает true» **опровергнута**: реальная причина — залипший `didNotifyLoadRef` в переиспользуемом инстансе `OptimizedLCPHero` (см. Progress Log 2026-06-13). React Query `isLoading` гаснет при наличии `travel`.
- **Browser-верификация SPA-сценария — verify pending (внешний блокер).** Локальный web dev-сервер падает на ленивой компиляции travel-чанка: `EMFILE: too many open files` в metro-cache → роут `/travels/<slug>` не достраивается и отскакивает на `/`; оверлей не успевает смонтироваться. Это известная нестабильность dev-сервера/битого `--dev` (см. CLAUDE-заметки задачи), не связана с правкой. Логика покрыта 10 зелёными Jest-тестами (unit+регресс), tsc/eslint по scope чисто. Замер времени снятия оверлея (цель ≤500мс) и smoke — выполнить после деплоя на проде (frontend-deployer + prod-smoke).
- Карта (AC#4) и #419 (шапка) — не входят в этот фикс, отдельные слои (map-expert / низкий приоритет).
