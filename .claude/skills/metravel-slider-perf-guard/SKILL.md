---
name: metravel-slider-perf-guard
description: >-
  Двусторонняя верификация «свайп hero-галереи travel ↔ web-перформанс
  travel-details»: любая перф-оптимизация проверяется на живой свайп, любой фикс
  свайпа — на LCP/TBT/бандл. Оба стража зелёные = done. Триггеры: «оптимизировал
  travel — проверь слайдер», «почини свайп галереи не уронив перформанс»,
  «слайдер опять не листается после оптимизаций», «перф-правка travel-details».
---

# metravel-slider-perf-guard

Свайп hero-галереи travel и web-перформанс страницы travel-details **хронически
ломают друг друга**: перф-оптимизация (lazy/priority/overlay/бандл/декод-гейты)
молча убивает свайп на mobile web, а фикс свайпа рискует уронить LCP/TBT. Стражи
живут врозь и порознь ловят только свою сторону — поэтому одну сторону чинят,
вторую роняют, и так по кругу. Этот скилл заставляет **проверять обе стороны
перед сдачей**.

Контекст-корни мёртвого свайпа и все стражи — memory `[[gallery-dead-swipe]]`.
Load-bearing правило — `CLAUDE.md` → «Архитектурные правила (web-перформанс)» п.3.

## Когда обязателен

Любая правка, трогающая:
- `components/travel/sliderParts/**` (особенно `useSliderPointerDrag.ts`,
  `Slide.tsx`, `useWebScrollInteraction.ts`, `useSliderTrack.ts`);
- `components/travel/details/**`, hero-композицию/оверлеи/декод-гейты
  (`hooks/useTravelHeroState.ts`, `useTravelDetailsHeroCompositionModel.ts`);
- `components/ui/ImageCardMedia*`;
- бандл/lazy/`content-visibility`/priority/prefetch на travel-details;
- responsive-images / srcset / `utils/richTextImageLayout.ts` /
  `components/travel/stableContent/htmlTransform.ts` (меняют раскладку → ширину слайда).

## Красные линии (нарушать нельзя — из реальных регрессий)

- **НЕ** добавлять на web hero-слайдер `content-visibility`, offscreen/lazy-скип
  кадров, `IntersectionObserver`-разгрузку — track/ширина слайда должны быть
  посчитаны с первого кадра, иначе свайп мажет.
- **НЕ** показывать `<img>` до `onLoad` на iOS (`shouldShowWebImageImmediately`).
- **НЕ** сбрасывать drag в `handleLostPointerCapture` для touch-драгов
  (`TOUCH_POINTER_ID`): implicit pointer capture шлёт `lostpointercapture`
  раньше `touchend` → snap назад = «мёртвый свайп».
- **НЕ** оставлять LCP-оверлей поверх слайдера без unmount-бэкстопа
  (`OVERLAY_FALLBACK_UNMOUNT_MS`) — оверлей с `pointerEvents` глотает жесты.
- Живой `backdrop-filter: blur()` на мобильных fixed/sticky барах запрещён
  (статичный фрост) — иначе GPU-просадка.

## Процедура (обе стороны, до «done»)

1. **Свайп-страж (лёгкий, ~15с, мок-фикстура, всегда):**
   ```
   npm run verify:slider            # e2e/travel-gallery-swipe-mobile.spec.ts @smoke (CDP-touch)
   npx jest __tests__/components/travel/sliderPointerDrag.touch.test.tsx
   ```
   Ожидание: счётчик 1/N → 2/N → 3/N вперёд/назад; вертикальный жест скроллит
   страницу; тап открывает fullscreen, драг — нет.

2. **Живой браузер (mobile 390, честная проба своими руками — не перекладывать):**
   dev-сервер (`Api Proxy 4620` + `Expo Web ProxyApi 8089`), `preview_resize` mobile,
   открыть реальный `/travels/<slug>`. Свайп проверять **pointer-drag на реальном
   верхнем узле** через `document.elementFromPoint(cx, cy)` (обычно `slider-slide-0`),
   а НЕ на контейнере-предке `travel-details-hero-slider-container` — события не идут
   вниз к детям, диспатч на предок даёт ложный «не листается». Ждать роста счётчика.

3. **Перф-страж (тяжёлый, нужен prod-build):**
   ```
   npm run verify:slider-perf       # swipe + travel-details + pages perf-budget одним билдом
   # либо по отдельности: npm run e2e:perf-budget ; npm run e2e:perf-budget:pages
   ```
   Пороги — `e2e/travel-details-perf-budget.spec.ts` (LCP/TBT/CLS/FCP, JS/img/total
   transfer, requests, long tasks). CI-пороги строже (env `PERF_*_MAX_*`).

4. **Сдача только когда обе стороны зелёные.** Если чинил свайп — приложи числа
   перф-стража; если оптимизировал — приложи прогон свайп-стража. Красная любая
   сторона = не done.

## Диагностика мёртвого свайпа

Chromium + CDP `Input.dispatchTouchEvent` (Playwright webkit touch-move и
`new Touch()` в WebKit не работают). Полный таймлайн `pointerdown → pointermove →
pointerup → lostpointercapture → touchend` + MutationObserver на `transform` у
track. Сигнатура бага: track следует за пальцем, на отпускании snap к текущему
слайду с transition 200ms (endTouch не дошёл до scrollTo).

## Что не делать

- Не «проверил только свою сторону и сдал» — это и есть источник цикла.
- Не просить пользователя листать/присылать скрин вместо своей пробы.
- Не трогать native-путь при web-фиксе (правки под `isMobile`/web-гейтом).
