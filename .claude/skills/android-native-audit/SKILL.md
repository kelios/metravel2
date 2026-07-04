---
name: android-native-audit
description: >-
  Аудит native-совместимости фронтенда MeTravel перед Android/iOS-сборкой:
  web-API (window/document/localStorage/navigator) без Platform-guard в общих
  компонентах, web-only импорты (leaflet/DOM) в native-бандле, проверка обоих
  бандлов; подтверждённые краши чинятся. Триггеры: «проверь native-совместимость»,
  «почему крашит на Android», «аудит перед сборкой приложения».
---

# android-native-audit

Системный поиск кода, который работает на web, но падает или ломается на
native (Android/iOS). Цель — закрыть краши **до** dev-билда, а не ловить их на
устройстве. Полный кодекс правил — `docs/NATIVE_COMPAT_RULES.md`; механическую
часть сторожит `__tests__/config/native-compat-governance.test.ts` (прогнать его —
первый шаг аудита).

## Что ищем

0. **Механика из governance-теста** (зомби expo-модули вне bundledNativeModules,
   прямые `.then/.catch/.finally` на `import()`, react-native-web в babel без
   платформенного гейта, `role="listitem"` без Platform-гейта) — просто прогнать
   `npx jest __tests__/config/native-compat-governance.test.ts`.
0a. **Postinstall-патчи node_modules** (`package.json → postinstall`): прочитать
   каждый патч-скрипт — для какой версии писался, что делает с native. История:
   no-op codegen-плагина валил New Architecture на старте.
0b. **Web-роли a11y** сверх listitem: любые `role=`/`accessibilityRole=` значения,
   которых нет в RN `AccessibilityRole`, на не-web View.

1. **Web-API без guard** в общих (не-`.web`) файлах `components/`, `hooks/`,
   `utils/`, `stores/`, `context/`, `app/`:
   `window.`, `document.`, `localStorage`, `sessionStorage`, `navigator.`,
   `requestIdleCallback`, `matchMedia`, DOM-события (`addEventListener` на
   window/document), `IntersectionObserver`/`ResizeObserver`/`MutationObserver`.
2. **Web-only импорты в native-бандл**: `leaflet`, `react-leaflet`,
   `leaflet.markercluster`, любые DOM-завязанные либы — в файлах без суффикса
   `.web` и без Platform-разводки.
3. **Native-модули в web-бандл**: `react-native-maps` и пр. native-only — не
   должны импортироваться в `.web.tsx`.

## Как отличить реальный риск от ложного (ОБЯЗАТЕЛЬНО)

Грубый grep врёт. Для **каждого** хита прочитай весь эффект/функцию и проверь,
есть ли guard выше места вызова. Безопасно, если:

- файл имеет суффикс `.web.tsx`/`.web.ts` (в native-бандл не попадает);
- в начале `useEffect`/функции стоит `if (Platform.OS !== 'web') return`;
- стоит `if (typeof window === 'undefined') return` или `'x' in window`-проверка;
- доступ обёрнут в `Platform.OS === 'web' && ...` / тернар по флагу `IS_WEB`.

Пример уже-защищённых (НЕ репортить как баг): `FavoriteButton.tsx`
(`Platform.OS !== 'web'` в начале эффекта), `AppProviders.tsx`
(`shouldLoadDeferredRuntime = Platform.OS === 'web'` + early-return).

Реальный риск — только когда guard'а нет ни на уровне строки, ни эффекта, ни
файла.

## Шаги

1. Grep по паттернам из «Что ищем», исключая `*.web.tsx`/`*.web.ts`.
2. По каждому хиту — прочитать контекст, классифицировать: `guarded` / `риск` /
   `web-only-файл`. Ложные срабатывания отбросить.
3. Подтверждённые риски чинит `android-expert`: добавить guard
   (`Platform.OS !== 'web'`/`typeof window`), либо вынести web-код в `.web.tsx`
   и сделать `.native.tsx`-вариант.
4. Проверка: `npm run typecheck`, `npm run lint`; убедиться, что **оба** бандла
   (web и native) собираются — web-only импорт не утёк в native и наоборот.
5. Реальные краши, не видимые статикой, ловятся прогоном dev-client на
   устройстве (через `android-release` / `android-builder`).

## Формат отчёта

Таблица: `файл:строка` → паттерн → вердикт (`guarded`/`риск`/`web-only`) →
фикс/действие. Сначала подтверждённые риски (что реально упадёт), затем сводка
guarded/ложных. Не раздувать список ложными срабатываниями.

## Паритет mobile web ↔ устройство (обязательное правило)

«Мобильная версия» = mobile web (~390px, `isMobile`) + Android + iOS ОДНОВРЕМЕННО: пользователь на всех трёх должен видеть один и тот же дизайн. Когда в задаче сказано «мобильный/mobile» — это всегда все три платформы сразу, не только web.

- **Эталон — устройство.** Android/iOS-приложение оттестировано и принято как образец: при любом расхождении mobile web правится под устройство, НЕ наоборот.
- **Верификация UI-правок — на обеих платформах со скринами:** web-превью 390px (`preview_resize` + `preview_screenshot`) И устройство/эмулятор (`adb exec-out screencap -p`; dev-client сидит на том же Metro — HMR обновляет обе стороны).
- **Запрещены web-only визуальные ветвления в мобильном вьюпорте:** serif-шрифты и hover-only элементы — только desktop (`!isMobile`); контент-элементы (чипы, бейджи, кнопки) не скрывать через `Platform.OS === 'web'`, если на устройстве они видны.
- **Темизация:** для тематических поверхностей только `useThemedColors()` — `DESIGN_TOKENS.colors.*` на native это статичный светлый fallback, на web — живые CSS-переменные.
- **Попапы/карточки точек на картах** — один общий компонент на всех страницах и платформах (различия — только добавочный функционал), компактный, вся информация видна без обрезания по X и Y.
