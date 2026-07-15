# MeTravel

Кроссплатформенное travel-приложение на Expo: web, Android и iOS из одного
React Native codebase. Репозиторий содержит frontend/app и проектную
документацию; backend находится в отдельном сервисе. Production UI
поддерживает RU/BE/UK/PL/EN через общий i18n-слой.

## Стек

- Expo SDK 57, Expo Router 57
- React 19.2, React Native 0.86, React Native Web
- TypeScript 6 в strict mode
- TanStack Query для server state, Zustand для client state
- Leaflet на web и Leaflet в WebView для основных native-карт
- Jest и Playwright

Точные версии закреплены в `package.json` и lockfile.

## Быстрый старт

Требуется Node `>=22.13.1` (`.nvmrc`) и Yarn `1.22.22`.

```bash
nvm use
corepack enable
corepack prepare yarn@1.22.22 --activate
yarn install --frozen-lockfile
yarn start
```

Web:

```bash
yarn web
```

Основные локальные проверки:

```bash
yarn check:fast
yarn lint
yarn test:run
```

Production web export:

```bash
yarn build:web:prod
```

Все test/build/deploy операции запускаются с учётом общего operation gate и
quality-gate lock; подробности находятся в проектной документации.

## Конфигурация

Клиент получает API origin из `EXPO_PUBLIC_API_URL`; секреты и локальные ключи
не коммитятся. Не копируйте значения из `.env*` или `.secrets/` в issue, лог или
документацию.

OpenRouteService и другие внешние интеграции опциональны и настраиваются через
поддерживаемые `EXPO_PUBLIC_*` переменные. Актуальные имена проверяйте в
runtime-config и `.env*.example`, а не в старых инструкциях.

## Native

Android/iOS EAS builds и submits расходуют квоту и выполняются только по явному
запросу на конкретное действие. Обычная Android-проверка использует локальную
Gradle-сборку, установленную на USB-устройство.

- [Native compatibility](./docs/NATIVE_COMPAT_RULES.md)
- [Android owner guide](./docs/ANDROID_OWNER_GUIDE.md)
- [Manual test cases](./docs/MANUAL_TEST_CASES.md)

## Документация

- [Карта документации](./docs/INDEX.md)
- [Архитектура и функциональность](./docs/ARCHITECTURE.md)
- [Обязательные правила](./docs/RULES.md)
- [Разработка](./docs/DEVELOPMENT.md)
- [Тестирование](./docs/TESTING.md)
- [Релиз и деплой](./docs/RELEASE.md)
- [Codex workflow](./docs/CODEX.md)

Перед любыми изменениями следуйте [AGENTS.md](./AGENTS.md).
