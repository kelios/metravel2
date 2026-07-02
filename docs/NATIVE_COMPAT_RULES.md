# Правила native-совместимости (web-first проект → Android/iOS)

Кодекс, рождённый первым запуском native-приложения (2026-06-11), пополняется по мере
новых native-багов (правила 8-10 — из device-QA 2026-06-22). Каждый пункт —
реальный баг, стоивший EAS-сборки или часа отладки. Нарушения ловит
`__tests__/config/native-compat-governance.test.ts` (механические правила) и
skill `android-native-audit` (семантические).

## 0. ГЛАВНОЕ: web — прод, его не ломаем. Несовместимо → отдельные файлы

- Web — работающий продукт с трафиком; native догоняет. **Запрещено** чинить
  native ценой изменения поведения web.
- Mobile UX parity is mandatory: mobile web, Android and iOS should present the
  same layout and interaction model. Use platform files for technical
  incompatibilities, not for alternate visual hierarchy, action order, or tap
  semantics. Держится это **общими компонентами**, а не совпадением реализаций:
  расхождение лечится общим компонентом/хуком, платформенный файл меняет только
  движок/инсеты/тени. Проверяется не автогвардом, а глазами при правке — web в
  браузере (mobile) + native device-verify; сквозной аудит — skill
  `metravel-design-audit` (ось «устройство-эталон»). Контракт карты/карточки места
  (эталон структуры и порядка действий) — `docs/features/map.md` §Mobile parity
  contract; владелец — агент `map-expert`.
- Если платформы несовместимы — **не перекраивать общий компонент условиями**,
  а разводить по файлам: `Component.web.tsx` + `Component.native.tsx`
  (или `.android.tsx`/`.ios.tsx`) — Metro сам выберет нужный. Примеры в репо:
  `Map.web.tsx`/`Map.android.tsx`, `usePushNotifications.web.ts`/`.native.ts`,
  `LazyYouTubeSection.tsx`/`.native.tsx`.
- Порог выбора: расходится **одно свойство/строка** → точечный
  `Platform.OS === 'web'`-гейт допустим; расходится **структура, поведение или
  зависимости** → отдельные платформенные файлы, общую логику — в общий хук/утиль.
- Любая правка ОБЩЕГО (не платформенного) файла ради native обязана пройти
  web-проверку до сдачи: прод-бандл в браузере, консоль без ошибок
  (`npm run build:web` + smoke главной/карты/путешествия) — не только typecheck.

## 1. Платформенные трансформы сборки — только под свою платформу

- `babel-plugin-react-native-web` применяется **только при `platform === 'web'`**
  (через `api.caller(c => c?.platform)` в `babel.config.js`). В native-бандле он
  подменяет React Native web-реализацией → `TurboModuleRegistry`/`EventEmitter`
  = undefined → рантайм мёртв.
- Любой новый babel/metro трансформ обязан отвечать на вопрос «а что он сделает
  с чужой платформой?» до включения.

## 2. Нативные модули — только из blessed-списка Expo SDK

- Каждый `expo-*` пакет обязан существовать в `expo/bundledNativeModules.json`
  текущего SDK и стоять ровно blessed-версии. «Зомби» из прошлого SDK
  (пример: `expo-av` после перехода на SDK 56) компилируются, но убивают
  регистрацию модулей при старте (`NoClassDefFoundError`).
- После любого `expo install` / миграции SDK: прогнать зомби-проверку
  (она в governance-тесте).
- Кросс-проверка совместимости анимаций: `react-native-reanimated` ↔ RN ↔
  `react-native-worklets` по `node_modules/react-native-reanimated/compatibility.json`.

## 3. Динамический `import()` — никогда не чейнить напрямую

- Metro (SDK 56) возвращает для синхронно-доступных модулей «голый» thenable
  (web prod: только `.then`) или сам объект модуля (native prod: вообще не
  thenable). Прямые `import(...).then/.catch/.finally` падают.
- **Правило:** `Promise.resolve(import('...'))` всегда, когда результат
  чейнится, сохраняется в Promise-переменную или возвращается из функции.
  Безопасны без обёртки: `await import(...)`, `React.lazy(() => import(...))`
  без чейнов, элементы `Promise.all([...])`.

## 4. Web-роли доступности не существуют на Android

- `role="listitem"` (и другие ARIA-роли без маппинга в RN) на native View →
  `JSApplicationIllegalArgumentException` при создании view → красный экран.
- **Правило:** web-роль передавать только под гейтом:
  `{...(Platform.OS === 'web' ? ({ role: 'listitem' } as any) : {})}`.
  Валидные на native значения — см. `AccessibilityRole` в типах RN.

## 5. Постоянные патчи node_modules (postinstall) — главный подозреваемый

- Скрипты вида `fix-react-native-compat.js` переживают миграции SDK и бьют
  только по native (web их не исполняет). История: no-op подмена
  `@react-native/babel-plugin-codegen` валила New Architecture на старте.
- **Правило:** при «web работает, телефон падает» первым делом читать
  `package.json → postinstall` и каждый патч-скрипт: для какой связки версий он
  писался и что делает с native. Патчи обязаны быть минимальными и
  самодокументированными (комментарий: зачем, для какой версии, когда удалять).

## 6. Web-API только под guard (классика)

- `window`, `document`, `localStorage`, `navigator`, observers, DOM-события —
  только в `.web.tsx` или под `Platform.OS === 'web'` / `typeof window !== 'undefined'`
  **на уровне эффекта/функции**. Систематический поиск — skill `android-native-audit`.

## 7. Отладка на устройстве — дёшево, сборки — дорого

- Бесплатный лимит EAS ограничен. JS-фиксы проверяются через **dev-client +
  adb + Metro по кабелю** (ноль сборок). Новая сборка нужна только при смене
  НАТИВНОГО набора (добавили/убрали нативный модуль, правка app.json-плагинов).
- Перед любой сборкой — предполётный чеклист: зомби-проверка, reanimated-таблица,
  expo-doctor 20/20, typecheck, полный Jest, оба `expo export`.
- Снять причину краша: `adb logcat -d | grep -E "FATAL|ReactNativeJS"` — дословный
  стек вместо догадок. Лог EAS-сборки: brotli (`content-encoding: br`), не gzip.
- **Device-verify обязателен, если устройство подключено.** Native-фикс НЕ
  сдавать как «verify pending», когда adb видит девайс — прогнать сценарий на нём.
- **Грабля стейл-бандла:** Fast Refresh часто НЕ подхватывает НОВЫЕ файлы/импорты —
  на устройстве остаётся старый код, и баг «не исправлен». После правки делать
  **явный Reload**: `adb shell input keyevent 82` (dev-меню Expo) → «Reload»,
  подождать ~12с пересборки, и убедиться, что НОВЫЙ UI реально появился (а не
  старый), прежде чем тестировать.

## 8. Legacy-методы expo-модулей, которые THROW в рантайме (а не deprecation-warn)

- `expo-file-system` (SDK 56) выкинул из ГЛАВНОГО экспорта legacy-методы
  (`writeAsStringAsync`, `readAsStringAsync`, `cacheDirectory`, `documentDirectory`,
  `makeDirectoryAsync`, `deleteAsync`, `getInfoAsync`…): они помечены
  `@deprecated … will throw in runtime` и в теле делают `throw` — typecheck и web
  проходят, а native падает в `catch` (история: офлайн-точки квеста, KML-экспорт,
  GPX-скачивание маршрута — всё ловилось одним и тем же throw).
- **Правило:** импортировать ТОЛЬКО из `'expo-file-system/legacy'` (тот же API,
  рабочая нативная реализация, 0 throw) — либо перейти на новый `File`/`Paths` API
  (осторожно: его типы в .d.ts неполные, `File` шадоуит DOM `File` на web).
  Bare-импорт `from 'expo-file-system'` запрещён (governance-тест, правило 8).
- Общий принцип: при миграции SDK любой `@deprecated`-метод expo-модуля,
  у которого в теле `throw` — это не «потом починим», а native-краш СЕЙЧАС.

## 9. Web-семантика навигации/URL не работает на native

- `router.push('/x/y#anchor')` — хеш-якорь это web-only scroll-to-id. На native
  хеш игнорируется → попадаешь на КОРЕНЬ роута (история: «Посмотреть отзывы»
  открывала старт квеста вместо отзывов). То же про `<Link href="…#…">`.
- **Правило:** не навигировать к секции через `#id`. Передавать `params` и
  обрабатывать в самом экране (скролл/таб/состояние) или открывать модалку.
  Хеш в `router.push/replace/navigate` запрещён (governance-тест, правило 9).

## 10. Native-карта требует ДОСТИЖИМЫЙ origin тайлов

- WebView-Leaflet берёт tile-URL из `EXPO_PUBLIC_API_URL`
  (`config/mapWebLayers.ts` → `getOsmNativeTileUrl()` →
  `{origin}/proxy/tiles/osm/{z}/{x}/{y}.png`). В dev `EXPO_PUBLIC_API_URL` — LAN
  (`http://192.168.50.36`), у которого tile-прокси НЕТ → все тайлы 404 → серая
  карта. Прод `https://metravel.by/proxy/tiles/...` = 200 (в проде карта рабочая).
- **Правило:** для native-тайлов LAN/loopback-origin фолбэчить на прод-домен
  (`https://metravel.by`), т.к. tile-прокси живёт только на проде; гарантировать
  `https`. Серая карта в dev на устройстве ≠ прод-баг — сперва проверить tile-URL
  (`adb logcat | grep proxy/tiles` / прямой GET тайла).

## Где закреплено

| Слой | Файл |
|---|---|
| Автостраж (CI) | `__tests__/config/native-compat-governance.test.ts` |
| Codex Android developer | `.codex/skills/metravel-android-developer/SKILL.md` |
| Codex mobile tester | `.codex/skills/metravel-mobile-tester/SKILL.md` |
| Legacy Claude агент-эксперт | `.claude/agents/android-expert.md` |
| Legacy Claude скилл-аудит | `.claude/skills/android-native-audit/SKILL.md` |
| Карта проекта | `CLAUDE.md` → «Android / native» |
