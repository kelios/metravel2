## Context

#3444 продолжает семейство #1968/#1929. `scripts/lib/questWebProjection.js:253` считает страну через `questCountryHubIndexVerdict`. Клиент в `app/(tabs)/quests/country/[country]/index.tsx` передаёт общему `LazyInstantSEO` title/description, но не robots. Helmet `updateTags` (`node_modules/expo-router/vendor/react-helmet-async/lib/index.js:510–547`) удаляет необъявленные `meta[data-rh]`. В современной SSR-ветке robots также объявлен временным `QuestPublicDocument`; после передачи экрана клиенту он теряет владельца.

## Goals / Non-Goals

Передать robots клиентскому владельцу страны, не вводя нового DOM-патчера и не перенося прозовые пороги городов/деталей на клиент. API/data, error/loading, auth и native без изменений. Тестовые данные не заменяют production acceptance.

## Decisions

- Переиспользовать `questCountryHubIndexVerdict(country)` и prop `robots` у `LazyInstantSEO`. Общий `webHeadManager` уже умеет upsert, дедупликацию и снятие `data-rh`.
- Отклонить дублирование порога и запись robots через `useQuestLandingHeadMeta`: первое создаёт второй источник политики, второе — второго владельца тега.
- У городов/деталей вердикт прозовой когорты по-прежнему принадлежит публикации. `webHeadManager` сохраняет build-owned robots исходного URL при передаче SSR → экран, даже если прежний временный владелец объявлял этот ключ. Другие ключи и переход на другой URL сохраняют прежнее снятие. Отклонить передачу quality через props нескольких экранов: имеющийся контракт exportKeys уже отвечает за этот вердикт.
- Проверять настоящий Helmet на границе Expo Head; отсутствие robots в клиентском экране должно воспроизводить исходный сбой. Проверить также соседний build-owned noindex без `data-rh` и переход между странами.

## Risks / Trade-offs

- Утечка noindex при переходе → проверить смену страны в обе стороны и единственность тега.
- Разный каталог сервера/клиента → сравнить два живых URL после выката; политика остаётся общей, публикация данных не меняется.
- Локализация не меняет правило; страны публикуются на RU, проверка всех языков на unit-уровне достаточна. Вёрстка, accessibility, media, security и analytics не меняются; viewport/device sweep не требуется.

## Validation and rollout

Task-owned paths дополнены `utils/webHeadManager.ts`. Focused Jest с реальным Helmet, `npm run check:fast` по явному manifest путей, независимое code-only review. Commit/push в `kelios/metravel2` main, штатный frontend deploy, сверка SHA и браузерные SSR/DOM-пробы Norway/Spain через 8 секунд. Города и детали с build-owned noindex проверяются тем же DOM-контрактом с передачей SSR → экран и переходом в каталог, а также живым примером при наличии.

## Migration Plan

Миграций и backend-правок нет. Revert task commit и штатный deploy возвращают прежнее поведение; порог хаба и verify-static-quest-seo не изменяются.
