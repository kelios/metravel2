# PERF-014 — Точный аудит eager-бандла (`entry` + `__common`)

Создан: 2026-06-02. Закрывает tooling-блокер PERF-014 и фиксирует крупнейший рычаг
ускорения во всём perf-бэклоге.

## 1. Что было заблокировано

PERF-014 ранее упёрся в инструментальный блокер: Expo 55 web static export не
эмитит usable source maps, поэтому `source-map-explorer` не давал per-module разбор
`__common`/`entry`. Было известно только агрегатно: на каждой странице грузится
~1.14 MB shared JS (gz), но *из чего* он состоит — нет.

## 2. Как разблокировали (воспроизводимо)

Без изменения emitted output, через Metro serializer hook (gated env):

1. `metro.config.js` — `config.serializer.experimentalSerializerHook` под
   `process.env.ANALYZE_BUNDLE === '1'`. Hook только **читает** module graph и пишет
   `{entry, count, mods:[[path, transformedSize, syncDepEdges]]}` в `os.tmpdir()`.
   Zero-cost, output бандла не меняется.
2. `.codex-temp/bundle/aggregate-eager.mjs` — offline-аггрегатор: BFS от entry points
   по **синхронным** dep-edges → реконструирует eager-набор (всё, что грузится до
   первого dynamic import = `entry` + `__common`) → группирует transformed-байты по
   пакету (`node_modules/<pkg>`) и первопартийным top-dir.
3. `.codex-temp/bundle/trace-path.mjs` — трассировка кратчайшего sync-пути от entry до
   пакета (кто тянет вендор в eager).

Команды:

```bash
# снять граф
ANALYZE_BUNDLE=1 node ./node_modules/expo/bin/cli export -p web -c --output-dir .tmp/x
# разобрать eager-набор
node .codex-temp/bundle/aggregate-eager.mjs 40
# кто тянет пакет в eager
node .codex-temp/bundle/trace-path.mjs node_modules/react-native-reanimated 3
```

> Примечание: `os.tmpdir()` на macOS = `$TMPDIR`, не `/tmp`.

## 3. Результат разбора (baseline, до фикса)

Eager-набор: **1119 модулей, 1918.3 KB transformed** (≈ pre-gz; gz ~2.6× меньше).
Почти целиком вендор-рантайм:

| # | Пакет | KB | % eager |
|---|---|---|---|
| 1 | **react-native-reanimated** | **668.5** | **34.9%** |
| 2 | react-native-web | 290.2 | 15.1% |
| 3 | react-native-gesture-handler | 201.9 | 10.5% |
| 4 | expo-router | 184.8 | 9.6% |
| 5 | react-dom | 177.8 | 9.3% |
| 6–11 | @react-navigation/* | ~200 | ~10% |

Первопартийного кода в eager — лишь **~8 KB**. Это окончательно подтверждает вывод
из PERF-008/006: route-level first-party defers не двигают `__common` — вес целиком
вендорный.

## 4. Крупнейший рычаг

`trace-path` показал: на web в eager-наборе
- **gesture-handler** тянет **только `entry.js`** (`require('react-native-gesture-handler')`),
- **reanimated** тянет **только** gesture-handler (`handlers/gestures/reanimatedWrapper.js`).

Больше никто (ни навигация, ни первопартийный код) их в eager не тянет. При этом
`entry.js` require **guard-нут** `navigator.product === 'ReactNative'` → на web он
**никогда не исполняется**. То есть **870 KB (45% eager) на web — мёртвый груз**,
включённый в `__common` лишь из-за статической резолюции require'а в entry.js.

## 5. Фикс

Web-resolver в `metro.config.js` резолвит bare `react-native-gesture-handler` →
существующий `metro-stubs/react-native-gesture-handler.js` (полный no-op-стаб всех
используемых экспортов: `GestureHandlerRootView`, `Swipeable`, `GestureDetector`,
`Gesture`, `PinchGestureHandler`, `State`). Default-on для web; opt-out
`DISABLE_GH_STUB=1`.

- reanimated-using web-компоненты (`UnifiedSlider`, `UnifiedTravelCard`, скелетоны и
  т.д.) импортируют `react-native-reanimated` **напрямую** → получают реальный
  reanimated в своих lazy-чанках. Поведение не меняется.
- `SwipeablePanel` уже имеет `.web.tsx` вариант на DOM-событиях (без gesture-handler).

## 6. Измеренный эффект (повторная ANALYZE-сборка с фиксом)

| eager-набор | модулей | transformed |
|---|---|---|
| baseline | 1119 | 1918.3 KB |
| + web-стаб | 704 | 1008.4 KB |
| **Δ** | **−415** | **−909.9 KB (−47.4%)** |

reanimated / gesture-handler / @egjs-hammerjs / worklets полностью ушли из eager на
**каждой** странице. Это ~350 KB gz, снятых с critical path всех маршрутов.

## 7. Верификация

- Browser ✅ (dev-сборка со стабом, порт 8083): Home (desktop) — карточки на
  reanimated рендерятся, 0 console-errors; Map (desktop + mobile) — панель списка со
  `SwipeableListItem` открывается, 0 errors; Quests (mobile) — полный рендер, 0 errors.
- Guards ✅: `check:image-architecture`, `guard:external-links`; `metro.config.js` грузится.

## 8. Известная деградация (минорная, mobile-web)

- swipe-actions в map-списке (`SwipeableListItem`) и pinch-zoom в
  `questWizardStepCard` → стаб-passthrough (без жеста). Краша нет; контент и
  action-кнопки доступны напрямую. Root layout и так не оборачивает дерево в
  `GestureHandlerRootView` → web-жесты gesture-handler и ранее были частично нерабочими.

## 9. Гейт

- **map-expert ✅** (2026-06-02): реальной потери web-функциональности нет.
  `SwipeablePanel.tsx/.web.tsx` — мёртвый код (0 импортёров); `SwipeableListItem`
  на web — passthrough + рендерится только на native (гард `!IS_WEB && isMobile`),
  swipe-действия на web заменены кнопками; `GestureHandlerRootView` в
  `MapMobileLayout`/`QuestWizard` — структурные View; map drag/swipe — отдельные
  web-реализации (`MapBottomSheet.web.tsx`, `SwipeablePanel.web.tsx`). Единственная
  потеря — pinch-zoom в `questWizardStepCard` (публичный просмотр), но фолбэк —
  полноэкранный `contain` Modal, и pinch на web и так не работал (нет root
  `GestureHandlerRootView`). Применена микроправка: подсказка «двумя пальцами»
  скрыта на web.
- **reviewer ✅**: 0 correctness-findings; стаб покрывает все first-party
  named-импорты; навигация gesture-handler в eager не тянет → краш-риска нет.
- **sprint sign-off (Approver)** → только тогда `Done`. ⏳ ожидается.

## 10. Остаточный резерв eager (после фикса)

`react-native-web` (290) + `expo-router` (185) + `react-dom` (178) +
`@react-navigation/*` (~200) — это foundational runtime Expo Router + React Navigation
web-приложения; безопасного quick-win там нет. `react-native-web` — кандидат на
slim-barrel tree-shake (уже есть opt-in `EXPO_PUBLIC_RNW_SLIM=1` в `metro.config.js`,
требует отдельной валидации).
