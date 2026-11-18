## Why
Native-приёмка #3452 остановлена: tracked yarn.lock фиксирует @expo/log-box58.0.14, а ios/Podfile.lock содержит ExpoLogBox58.0.13. CocoaPods deployment install закономерно отказывает. Исходный presence guard #1504 этот version drift не обнаруживает; исправление #3453.

## What Changes
Штатно регенерировать только native dependency lock по уже выбранному JS lock и доказать повторяемость строгой установкой. Версии JS-зависимостей не обновляются.

## Capabilities
### New Capabilities
- `ios-native-dependency-parity`: согласованность зафиксированных JS и CocoaPods версий перед native QA.

## Impact
Platform impact: iOS. Localization impact: none — UI, locale resources и usage strings не меняются.
Data/API, SEO, accessibility, performance, security, analytics: без изменений; меняется воспроизводимость существующей native-сборки, продуктового поведения не добавляется.
Dependencies: frozen yarn.lock уже в main; related #1504, prerequisite #3452.
Fallback/mock policy: старый бинарник и обход native stamp/--deployment не принимаются.
Existing behavior to preserve: native settings, localized resources и все product3452 исходники.
Non-goals: dependency upgrades, config/plugins/prebuild changes, signed build/upload/store release.
Open questions: нет.
