#!/usr/bin/env bash

set -euo pipefail

# Tracked `ios/` — результат `expo prebuild --clean --platform ios` + `pod install`
# (#2742): все iOS-кастомизации живут в `plugins/withIosNativeProject.js` и
# `app.json`. Этот скрипт ничего не генерирует, а сверяет tracked-проект с
# генерацией (`ios:native:parity`) и релизным контрактом. Изменение iOS-конфига:
# `npx expo prebuild --clean --platform ios && (cd ios && pod install)`, затем
# коммит перегенерированного `ios/`.
#
# `pod install` (#1504) — не деструктивная операция и запускать её можно:
# CocoaPods пере-сериализует `ios/metravel.xcodeproj/project.pbxproj` целиком и
# переставляет секции в свой канонический порядок, но ничего не удаляет.
# Локализованная `PBXVariantGroup` с `InfoPlist.strings` (en/ru/be/uk/pl)
# переживает установку подов вместе со ссылкой в Resources и `knownRegions`.
# Tracked-файлы уже приведены к этой канонической сериализации, поэтому
# повторный `pod install` не даёт diff'а; если diff всё же появился — это
# реальное изменение состава зависимостей, а не потеря локализации.
# На этой машине CocoaPods требует `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`.
node scripts/ios-environment-preflight.js
node scripts/ios-native-parity.js
node scripts/ios-release-guard.js
echo 'Tracked iOS release configuration is ready; no native files were regenerated.'
