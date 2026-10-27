# Proposal: статический SEO web на `generateMetadata` Expo SDK 58 (#2740)

## Problem

Head экспортированного HTML (title, description, robots, canonical, og:*, twitter:*) сейчас
рождается из `<Head>` react-helmet-async (`expo-router/head`) внутри экранов. В SDK 58 экспорт
собирает helmet-состояние, но не пишет его в HTML (`@expo/router-server` → `renderStreamingContent`),
поэтому #2727 держит мост `patches/@expo+router-server+58.0.17.patch`. Поверх этого
SSG-генератор (снят в #2766) держит собственную таблицу `STATIC_PAGES` с литералами, которые уже
расходятся с рантайм-строками экранов (`/about`, `/search`, `/articles`), а описания по умолчанию из
`app/+html.tsx` дедупятся постобработкой по маркеру `data-rh`.

## Goal

Метаданные каждого web-маршрута объявляются штатным API роутера — `export function generateMetadata`
в файле маршрута — из одного общего источника строк, который читают и экран, и генератор SSG.
Патч router-server снимается; итоговый HTML всех маршрутов содержит те же метаданные, что до
миграции (diff по title/description/robots/canonical/og/twitter/ld+json = без потерь).

## Non-goals

- `web.output: "server"` / SSR на запрос — отдельное инфраструктурное решение.
- `generateStaticParams` для `/travels/[param]`, `/quests/[city]`, `/quests/[city]/[questId]`:
  экспорт не умеет пререндерить тело статьи/квеста (данные приходят в рантайме), SEO-входы для
  1 400+ статей собираются параллельно с экспортом, а `exportStaticAsync` рендерит все страницы
  одним `Promise.all` без лимита. Per-entity страницы остаются за генератором, который теперь
  строит head тем же общим билдером. Решение зафиксировано в design.md, пересмотр — отдельной
  карточкой, если появится loader-пререндер тела.
- Замена helmet на клиенте (рантайм-обновление head при SPA-навигации) — следующая карточка;
  здесь только дедуп уже существующих тегов после гидрации.
- Правка текстов SEO (расхождения литералов генератора и i18n) — требует отдельного «да» владельца.

## Impact

- Platform impact: desktop web + mobile web (статический HTML). Android/iOS: `generateMetadata`
  вырезается из клиентских бандлов babel-плагином, native не затронут.
- Localization impact: all current locales — `og:locale`/`html lang` остаются ru на сборке, как
  сейчас; hreflang квестов (пакет v1 `questSeoContract`) не меняется. Новых app-owned строк нет.
- User-visible: нет визуальных изменений. SEO: head до JS на каждом маршруте без патча рендерера.
- API/data: backend не меняется; генератор читает прод-API как раньше.
- Accessibility/performance/security/analytics: не применимо (только head-теги статического HTML).

## Dependencies

#2727 (Expo SDK 58) в `main`.

## Fallback/mock policy

Генерация из реального прод-API, как сейчас; без моков в выкате. `generateMetadata` чистые функции
без сетевых вызовов — fallback не нужен.
