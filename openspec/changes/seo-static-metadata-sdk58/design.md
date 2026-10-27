# Design: владение head статического HTML после SDK 58

## Контекст (инвентарь 25.10.2026)

Три слоя пишут head сегодня: (1) helmet `<Head>` экранов → экспорт (только через патч),
(2) `app/+html.tsx` — статический каркас + critical-скрипт, (3) SSG-генератор (снят в #2766) —
`injectMeta` переписывает title/description/canonical/og/twitter/robots для ~31 STATIC_PAGES и всех
per-entity страниц. Индексируемый head = выход (3); helmet-вывод (1) важен только для маршрутов вне
генератора (legal `/terms /disclaimer /community-rules /trip-rules`, `/trips/*`, `/app`, `/calendar`,
`/assistant`, `/blocked-users`, `/privacy-settings`, `/security-journal`, `/book-exports/*`, 404) и
как база, которую (3) затем заменяет. Подробно: общие заметки сессии `2740-seo-inventory-sdk57.md`,
`2740-expo-router-58-metadata-api.md`.

API 58 (`@expo/router-server/build/server/metadata.js`, `expo-server/build/cjs/metadata.d.ts`):
`generateMetadata(request, params)` только из листового файла маршрута, без слияния с `_layout`;
`Metadata` покрывает title/description/robots/alternates(canonical, languages)/openGraph(images с
alt/width/height/secureUrl, siteName, locale, type)/twitter/itunes. Не покрывает JSON-LD, `<html lang>`,
preload. Теги пишутся первыми в `headNodes`, без `data-rh`; `+html.tsx` решает, где они стоят.

## Решение: владение по тому, что экспорт может знать

| Слой | Владеет | Источник строк |
| --- | --- | --- |
| `generateMetadata` в каждом web-листе `app/**` | базовый head каждого HTML экспорта: статические маршруты и шаблоны динамических (`[param]`, `[id]`, `[city]/[questId]`…) — noindex-fallback «не найдено» | `utils/seoRoutes/*` |
| SSG-генератор (снят в #2766) | per-entity страницы (travels, quests, города, страны, статьи, locale-пакеты): head + тело; STATIC_PAGES-экстры (breadcrumb, h1, skeleton, preload) | те же `utils/seoRoutes/*` + прод-API |
| `app/+html.tsx` | каркас: charset/viewport/theme/иконки/Organization-JSON-LD/critical-скрипт; `{headNodes}` ставится ДО critical-скрипта, дефолтный `<meta name=description>` снимается (его даёт каждый маршрут) | — |
| `LazyInstantSEO` (клиент) | рантайм-обновление head после гидрации и при SPA-навигации (helmet, как сейчас) + дедуп не-`data-rh` дублей управляемых ключей | props экрана |

Общие модули (plain JS, читаются и Metro, и Node-скриптами, как `utils/seoText.js`):

- `utils/seoRoutes/staticRoutes.js` — единая таблица статических маршрутов
  (`route`, `title`/`titleKey`, `description`/`descriptionKey`, `robots`, `image`, `canonicalRoute`,
  `breadcrumb`, `h1`), значения сегодняшних STATIC_PAGES без изменения текста. `resolveStaticRouteSeo(route, t)`
  принимает функцию перевода: генератор передаёт `readRequiredRuTranslation`, маршрут — `i18nT`.
- `utils/seoRoutes/metadata.js` — `buildRouteMetadata(seo)` переводит проектную форму
  (`title, description, canonical, image, imageAlt, imageWidth, imageHeight, ogType, robots, ogLocale,
  alternates`) в `Metadata` expo-server; набор тегов 1:1 с тем, что рендерит
  `LazyInstantSEO` и пишет `injectMeta`. `routeMetadata.ts`: `staticRouteMetadata(route)`,
  `routeMetadata(props)`, `shellRouteMetadata()` (бренд-head шаблонов динамических маршрутов,
  без robots/canonical — noindex «не найдено» им даёт `patchNoindexFallbackTemplate` генератора),
  `notFoundRouteMetadata()` (404: noindex, без canonical и картинки).

Маршруты с SEO внутри экранов (`screens/tabs/*`, `components/screens/*`, `LegalPage`, `TripsPageSeo`)
получают `generateMetadata` в файле маршрута `app/**` из тех же i18n-ключей/таблицы; экран продолжает
рендерить `InstantSEO` для клиента.

## Почему без `generateStaticParams`

1. Тело per-entity страницы (H1, текст статьи, FAQ, intro квеста, hero preload, bootstrap data)
   экспорт не пререндерит: экраны берут данные в рантайме. Генератор остаётся обязательным, и
   per-entity head в нём строится тем же билдером — значения совпадают по построению.
2. Вход для 1 400+ статей собирается `--collect-inputs` параллельно с `expo export`
   (`build-prod.sh` → `start_seo_input_collection`); сериализация добавила бы ~3 мин к бюджету выката
   (~12 мин), а fetch из `generateMetadata` удвоил бы трафик к прод-API.
3. `exportStaticAsync` рендерит все HTML одним `Promise.all` без лимита; 1 400 стриминговых рендеров
   с `resetReactNavigationContexts` в `globalThis` — непроверенный риск OOM/гонок.
Квесты (~70) тоже не выигрывают: генератор переписал бы те же страницы (варианты cityId/alias,
canonical из serving projection, пороги noindex, locale-пакеты v1).

## Diff-критерий

`seo-signature.mjs` (scratchpad сессии) снимает по каждому `dist/prod/**/*.html` нормализованную
подпись: title, meta по name/property, canonical/alternate, типы ld+json, `html lang` — без учёта
`data-rh`/порядка. Сборка «до» = SDK 58 с патчем, «после» = без патча с `generateMetadata`.
Ожидание: 0 потерь значений; допустимые отличия — только отсутствие дублей description (их снимал
`normalizeMetaDescription`) и порядок тегов.

## Регрессионный контроль

- `guard-html-meta-description.js` расширяется проверкой ровно одного непустого `<title>` на каждом
  HTML — это гейт, который раньше молча закрывал патч.
- проверка статики travel (снята в #2766), проверка статики квестов (снята в #2766), `questSeoPackage`/`expoStaticShell`
  контракты не меняются (их проверки по `data-rh` относятся к helmet-владению robots и остаются
  верными).
- Jest: таблица STATIC_PAGES и паритет robots с экранами читаются из общего модуля, а не текстом
  исходника генератора.

## Риски

- Порядок `{headNodes}` в `+html.tsx`: metadata должны стоять до critical-скрипта (он читает
  description при парсинге) — проверяется diff-критерием и e2e SEO-спеками.
- Дубли после гидрации на маршрутах вне генератора: helmet добавляет `data-rh`-теги рядом с тегами
  экспорта; дедуп-эффект `LazyInstantSEO` снимает не-`data-rh` дубли управляемых ключей.
- `generateMetadata` выполняется в server-бандле вне React — `i18nT` должен быть инициализирован при
  импорте модуля (проверка на первом экспорте).
