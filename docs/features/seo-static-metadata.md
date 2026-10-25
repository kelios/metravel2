# SEO статического web: владение head (Expo SDK 58, #2740)

Источник истины для head экспортированного HTML. Детали инвентаря и API 58 — в OpenSpec
`openspec/changes/seo-static-metadata-sdk58/`.

## Кто пишет что

| Слой | Владеет | Источник строк |
| --- | --- | --- |
| `export function generateMetadata()` в каждом web-листе `app/**` | базовый head каждого HTML экспорта: title, description, robots, canonical, og:*, twitter:* | `utils/seoRoutes/routeMetadata.ts` → `staticRouteMetadata(route)` (таблица `utils/seoRoutes/staticRoutes.js`), `routeMetadata(props)` (те же i18n-ключи, что у `InstantSEO` экрана), `shellRouteMetadata()` (шаблоны динамических маршрутов) |
| `scripts/generate-seo-pages.js` | per-entity страницы (travels, quests, города, страны, статьи, locale-пакеты): head + тело; для статических маршрутов — только экстры (breadcrumb JSON-LD, скрытый H1, skeleton, hero preload) | та же таблица `staticRoutes.js` + прод-API |
| `app/+html.tsx` | каркас документа: charset/viewport/theme-color/иконки/Organization-JSON-LD/critical-скрипт; `{headNodes}` экспорта стоят ДО critical-скрипта | — |
| `components/seo/LazyInstantSEO.tsx` → `utils/webHeadManager.ts` (клиент, #2756) | SEO-теги head после гидрации и при SPA-навигации: экран в фокусе пишет title/description/robots/canonical/og:*/twitter:* upsert'ом в единственный узел ключа (узлы экспорта перенимаются, копии снимаются), ключи прежнего владельца, не объявленные текущим, удаляются. Теги экспорта необъявленных ключей живут только на первом URL документа (снимок — `captureExportHead()` в `app/_layout.web.tsx`); первая же страница с другим путём их снимает. Helmet (`expo-router/head`) остался только для JSON-LD/`<script>` (`additionalTags`, `BreadcrumbsJsonLd`, `TravelDetailsSeoBlock`) | props экрана |

Правила:

- Новый web-маршрут обязан экспортировать `generateMetadata` (чистая функция, без хуков и сети);
  `_layout` в метаданных не участвует, слияния нет. Гейт — `scripts/guard-html-meta-description.js`:
  ровно один непустой `<title>` и одна `meta[name=description]` на каждом HTML (noindex-страница
  может быть без них).
- Статический маршрут с SSG-экстрами добавляется в `utils/seoRoutes/staticRoutes.js`, не в
  генератор; строки таблицы — исторические литералы и RU-ключи `seoStatic:*`. Правка SEO-текста
  требует отдельного «да» владельца.
- JSON-LD, `<html lang>`, preload и `apple-itunes-app` через `Metadata` 58 не выражаются — они
  остаются в `+html.tsx`, компонентах (`jsonLdScript`) и генераторе.
- `data-rh="true"` на тегах генератора — историческая заявка helmet на владение тегом (#1929/#1930);
  менеджер head (#2756) ключи узнаёт по name/property/rel без оглядки на метку. Build-owned `robots`
  без объявления экраном переживает гидрацию: на первом URL необъявленный ключ экспорта не трогается.
- Точечные писатели head деталей статьи (`useTravelDetailsHeadSync`) и квеста (`patchQuestHead`)
  работают по тому же правилу «один узел на ключ» и с менеджером совместимы.
- Helmet-моста в `patches/@expo+router-server+58.0.17.patch` нет и быть не должно: потеря
  helmet-вывода в экспорте — штатное поведение SDK 58, а не дефект. Оставшийся хунк патча —
  полный RNW-стиль после рендера (#2727, `SSG-EXPORT-PARITY-001`), к head он не относится.
- Шаблоны динамических маршрутов (`travels/[param]`, `article/[id]`, `user/[id]`,
  `quests/[city]`, `quests/[city]/[questId]`, `quests/country/[country]`), экспортный 404
  `+not-found.html` и служебный `_sitemap.html` получают noindex-head «не найдено» в генераторе
  (`patchNoindexFallbackTemplate`: title/description/og/twitter в одном тексте, без canonical и
  og:url). Экспортный `+not-found` рендерится вне `generateMetadata` маршрута `[...missing]`.

## Почему без `generateStaticParams`

Экспорт не пререндерит тело статьи/квеста (данные экранов приходят в рантайме), SEO-входы для
1 400+ статей собираются параллельно с `expo export`, а `exportStaticAsync` рендерит все HTML одним
`Promise.all` без лимита. Per-entity страницы остаются за генератором; пересмотр — отдельной
карточкой, если появится loader-пререндер тела.

## Проверки

`npm run build:web:prod` → `verify-static-travel-seo`, `verify-static-quest-seo`,
`guard-html-meta-description`; diff подписей head до/после (`title/description/robots/canonical/
og/twitter/hreflang/ld+json`) при изменении слоя; jest `__tests__/utils/seoRoutes/*`,
`__tests__/components/seo/*`, `__tests__/scripts/generate-seo-pages.test.ts`.
