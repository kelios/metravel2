// Jest module resolver: reanimated 4.7 / worklets 0.13 (Expo SDK 58, #2727) поверх
// резолвера @react-native/jest-preset.
//
// Reanimated 4.7 ссылается на нативный UI-рантайм прямо при импорте
// (`initializers.native.ts` → `setCSSEventHandler`), и под Jest такой импорт роняет
// даже `react-native-reanimated/mock`: «setCSSEventHandler is not available in
// JSReanimated». Библиотека решает это своим резолвером — для перечисленных в нём
// модулей Jest читает web-вариант без суффикса `.native`, а для
// `react-native-worklets` снимает нативные расширения целиком. Резолвер
// jest-expo/RN-пресета остаётся «дефолтным» уровнем, чтобы не потерять его
// обработку exports-карты react-native.
const reactNativeResolver = require('@react-native/jest-preset/jest/resolver')
const reanimatedResolver = require('react-native-reanimated/jest/resolver')

/** @type {import('jest-resolve').SyncResolver} */
module.exports = (request, options) =>
  reanimatedResolver(request, {
    ...options,
    defaultResolver: (innerRequest, innerOptions) =>
      reactNativeResolver(innerRequest, {
        ...innerOptions,
        defaultResolver: options.defaultResolver,
      }),
  })
