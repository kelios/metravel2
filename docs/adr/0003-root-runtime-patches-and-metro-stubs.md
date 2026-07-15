# 0003. Root runtime, postinstall patches и Metro stubs

- **Статус:** Accepted
- **Дата:** 2026-07-14
- **Авторы:** frontend platform
- **Board:** #933

## Контекст

Запуск приложения зависит не только от Expo Router, но и от ранних web/native guards,
кастомного HTML shell, provider order, Metro resolver и изменений `node_modules` после
установки. Они появились как точечные обходы регрессий, но до этого ADR не имели общего
owner, версии и критерия удаления. Это делало обновление Expo/React Native рискованным.

Зафиксированный baseline: Expo `57.0.4`, Expo Router `57.0.4`, React Native `0.86.0`,
React `19.2.3`, `@expo/metro` `56.0.0`, `@expo/metro-config` `57.0.3`. Owner всех записей —
frontend platform; изменение protected root/build файлов выполняется отдельной задачей.

## Решение

Root runtime и активные compatibility patches считаются load-bearing до прохождения их
removal gate. Новые обходы нельзя добавлять без строки в этом ADR или superseding ADR,
точного package/version, воспроизводимого invariant и автоматической проверки. Исторический
комментарий или успешный dev-start сами по себе не являются доказательством.

### Root runtime inventory

| Surface | Reason и invariant | Upstream / removal criterion | Validation |
| --- | --- | --- | --- |
| `entry.js` | До первого import ставит узкий web guard повторного `default` export, Safari polyfills, native RNGH/Reanimated globals и FontFaceObserver hardening; последним передаёт управление `expo-router/entry`. | [Expo Router](https://github.com/expo/expo/tree/main/packages/expo-router). Удалять workaround отдельно, когда поддерживаемые браузеры/Expo воспроизводимо не требуют его и negative regression test проходит без него. | `npm run guard:eager-web:fail`; production web build; Safari smoke; Android/iOS startup smoke для native bootstrap. |
| `app/+html.tsx` | Формирует pre-hydration HTML: storage hardening первым script, legacy redirect, route SEO/canonical/theme, critical CSS, resource hints, hero preload и consent-gated web analytics. Порядок head scripts и отсутствие duplicate title/canonical — invariant. | [Expo Router HTML](https://docs.expo.dev/router/advanced/root-html/). Удалять отдельный script только после эквивалентного framework/server path и static-export evidence. | `__tests__/app/html.head-fallback.test.ts`, `html.storage-hardening.test.ts`, `leafletCssLink.test.ts`, `html.analytics.test.ts`; production SEO/build checks. |
| `app/_layout.tsx` | Владеет provider order, QueryClient lifetime, theme/error boundary, fonts/splash, web hydration chrome и native footer/runtime. Один provider tree и отсутствие native black screen — invariant. | [Expo Router root layout](https://docs.expo.dev/router/basics/layout/). Менять только с provider-order contract test и web/native runtime evidence. | `npm run typecheck`; affected layout/provider Jest; web route smoke; installed Android build smoke и iOS simulator/device для platform changes. |
| `metro.config.js` | Сохраняет Expo defaults, блокирует generated dirs, включает inline requires, задаёт platform resolver/stubs, dev API/static middleware и opt-in bundle probe. Native resolution и production output не должны меняться от web aliases. | [Expo Metro config](https://github.com/expo/expo/tree/main/packages/%40expo/metro-config), [Metro](https://github.com/facebook/metro). Удалять ветку только после upgrade comparison и platform-specific build evidence. | `node scripts/verify-react-leaflet-setup.js`; `npm run guard:eager-web:fail`; production web build; native smoke при resolver changes. |

### Postinstall patch inventory

Baseline в каждой строке — Expo `57.0.4` / RN `0.86.0`.

| Patch unit / current dependency | Reason и invariant | Upstream / removal criterion | Validation |
| --- | --- | --- | --- |
| `fix-lightningcss.js`: macOS loader; nested `lightningcss 1.31.1` (`1.32.0` root) | На macOS предпочитает доступный arm64 binary, чтобы CSS transformer не падал при architecture mismatch. Сейчас marker применён к nested Expo copy. | [lightningcss](https://github.com/parcel-bundler/lightningcss). Удалить после clean install/build на Apple Silicon и x64/Rosetta без копирования/loader rewrite. | Clean install на macOS; require обеих resolved copies; production web build. |
| `fix-lightningcss.js`: `react-native-svg 15.15.4` web touch helper | Исторически страхует отсутствие `hasTouchableProperty`; web SVG должен загружаться без import/runtime ошибки. Текущий ESM artifact содержит drift (`_hasTouchableProperty` fallback при старом import), а Metro направляет web на CommonJS: patch **не считается verified**. | [react-native-svg](https://github.com/react-native-community/react-native-svg). Кандидат на удаление: clean package `15.15.4+` должен пройти SVG web smoke без transform; иначе script надо чинить отдельной protected-scope задачей. | Clean-install artifact scan; direct ESM/CJS import smoke; production web build; SVG screen tests. |
| `fix-react-native-compat.js`: RN `0.86.0` `StyleSheet.absoluteFillObject` | Возвращает runtime/type alias; в app остаётся 56 ссылок, поэтому удаление сейчас сломает styles/typecheck. | [React Native](https://github.com/facebook/react-native). Удалить после миграции всех first-party ссылок на `absoluteFill` и проверки зависимостей либо после upstream alias restoration. | `rg "StyleSheet\\.absoluteFillObject"`; `npm run typecheck`; web + installed native visual smoke. |
| `fix-expo-metro-terminal-reporter.js`: `@expo/metro 56.0.0` | Создаёт extensionless CJS shim для absolute ESM import `TerminalReporter`; tooling import не должен падать. Shim присутствует в текущем install. | [Expo Metro](https://github.com/expo/expo-metro). Удалить, когда вызывающий tool импортирует `.js`/package export или upstream содержит extensionless target. | Clean install; import exact extensionless path; Metro dev start. |
| `fix-brace-expansion.js`: nested `brace-expansion 5.0.4` | Не допускает zero-step infinite loop; guard применён к nested glob/fingerprint/typescript-estree copies, root `2.1.0` не совпадает с patch pattern. | [brace-expansion](https://github.com/juliangruber/brace-expansion). Удалить, когда все reachable copies upstream обрабатывают `{1..3..0}` и lockfile больше не содержит уязвимой реализации. | Clean-install version/marker scan; timeout-bounded zero-step unit probe; affected CLI smoke. |
| `patch-package`: `react-native-render-html 6.3.4` | Заменяет function `defaultProps`, удалённые React 19, на explicit defaults; native rich text/image не должен стать пустым или упасть. `patch-package 8.0.1` запускается с `|| true`, поэтому marker verification обязателен. | [react-native-render-html](https://github.com/meliorence/react-native-render-html). Удалить после upstream React 19 release и comparison всех пяти patched files на clean install. | Patch marker scan; native `StableContent` tests; article/travel rich-text smoke on installed native build. |

### Metro stub inventory

| Stub / baseline dependency | Wiring, reason и invariant | Upstream / removal criterion | Validation |
| --- | --- | --- | --- |
| `react-native-maps.js`; package absent | Resolver-wired on web; не допускает native maps в Leaflet bundle. Сейчас first-party imports отсутствуют, поэтому это legacy guard. | [react-native-maps](https://github.com/react-native-maps/react-native-maps). Удалить вместе с resolver branch после static import scan и отдельного protected Metro change. | `verify-react-leaflet-setup.js`; map web build/smoke. |
| `react-native-web-slim.js`; RNW `0.21.2` | Resolver-wired при `EXPO_PUBLIC_RNW_SLIM=1` (production build включает): экспортируемая RN surface должна покрывать все web imports. | [React Native Web](https://github.com/necolas/react-native-web). Удалить, когда upstream tree shaking даёт не хуже bundle и full route smoke проходит с normal barrel. | Production web build; bundle guards; multi-route browser smoke. |
| `react-native-gesture-handler.js`; RNGH `2.32.0` | Resolver-wired web no-op; убирает native gesture runtime из eager bundle, сохраняя passthrough components. | [RNGH](https://github.com/software-mansion/react-native-gesture-handler). Удалить, когда web реально требует gestures либо upstream/bundler исключает eager cost. | `__tests__/scripts/perf014-gh-stub-guard.test.ts`; `npm run guard:eager-web:fail`; interaction smoke. |
| `react-native-reanimated.js`; Reanimated `4.5.0` | Resolver-wired web no-op с мгновенными final values; native использует upstream. UI не должен зависеть на web от frame-by-frame semantics. | [Reanimated](https://github.com/software-mansion/react-native-reanimated). Удалить, когда production bundle/perf принимает upstream и web animation contract проверен. | Production bundle comparison; web interaction/visual tests; native smoke. |
| `empty.js` | Resolver-wired для CSS, кроме global/quill; не даёт Metro разбирать package CSS, Leaflet styles грузятся отдельно. | [Expo Metro config](https://github.com/expo/expo/tree/main/packages/%40expo/metro-config). Удалить после native/web CSS support без parse/build regression. | `check-leaflet.js`; `verify-react-leaflet-setup.js`; production web build. |
| `Map.ios.js` | **Orphan:** resolver/import не найден; историческая web fallback card, current invariant отсутствует. | Project-local. Удалить отдельной cleanup задачей после clean static scan и map build. | `rg` wiring; map tests/build. |
| `MaterialCommunityIcons.js`; vector-icons `15.1.1` | **Orphan:** resolver не подключён; Feather substitution нарушила бы имена MCI glyphs. Не активировать. | [Expo vector icons](https://github.com/expo/vector-icons). Удалить после исправления исторической docs-ссылки и icon web smoke. | `rg` wiring; `MapIcon` web/native tests. |
| `html2canvas.js`; html2canvas `1.4.1` | **Orphan:** resolver не подключён; real package используется map snapshot flow, поэтому stub не является fallback. | [html2canvas](https://github.com/niklasvh/html2canvas). Удалить после static scan и map snapshot tests. | `__tests__/utils/mapImageGenerator.test.ts`; production export smoke. |
| `react-native-webview.js`; WebView `13.16.1` | **Orphan:** resolver не подключён; native platform files используют real WebView. | [React Native WebView](https://github.com/react-native-webview/react-native-webview). Удалить после static scan и подтверждения platform resolution. | Article/map/quest native tests; installed device smoke. |

## Upgrade и removal gate

1. Сделать clean install и записать resolved versions; postinstall не должен молча скрывать failed patch.
2. Сначала добавить executable regression для named invariant, затем временно убрать один patch/stub.
3. Для web resolver/root HTML — production export и browser/SEO/bundle checks; dev Metro недостаточен.
4. Для native bootstrap/resolution/rich text — локальная установленная Android сборка; iOS evidence при iOS scope.
5. Удалять один workaround за изменение. При неуспехе вернуть его и сохранить evidence/upstream blocker.

## Последствия

- Upgrade review получает полный список скрытых runtime dependencies и критерии удаления.
- Orphan stubs и drift SVG patch явно не считаются рабочими гарантиями.
- Документ не разрешает переписывать protected root/build files и не доказывает, что patch obsolete:
  любое удаление требует отдельного implementation scope и указанной runtime evidence.
