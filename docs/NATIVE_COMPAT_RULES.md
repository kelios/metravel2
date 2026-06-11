# Правила native-совместимости (web-first проект → Android/iOS)

Кодекс, рождённый первым запуском native-приложения (2026-06-11). Каждый пункт —
реальный баг, стоивший EAS-сборки или часа отладки. Нарушения ловит
`__tests__/config/native-compat-governance.test.ts` (механические правила) и
skill `android-native-audit` (семантические).

## 0. ГЛАВНОЕ: web — прод, его не ломаем. Несовместимо → отдельные файлы

- Web — работающий продукт с трафиком; native догоняет. **Запрещено** чинить
  native ценой изменения поведения web.
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

## Где закреплено

| Слой | Файл |
|---|---|
| Автостраж (CI) | `__tests__/config/native-compat-governance.test.ts` |
| Агент-эксперт | `.claude/agents/android-expert.md` |
| Скилл-аудит | `.claude/skills/android-native-audit/SKILL.md` |
| Карта проекта | `CLAUDE.md` → «Android / native» |
