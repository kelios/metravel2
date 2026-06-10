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
устройстве.

## Что ищем

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
