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
  В request SSR (#2766) тот же хунк ждёт `allReady` до отправки ответа: холодный документ
  получает стили, вставленные RNW во время рендера, и ошибку рендера нельзя закешировать как 200.
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

## Подготовка рендера на запрос (#2766)

Выбрана модель A из `openspec/changes/web-entity-pages-router-loaders/`: тело страницы путешествия,
квеста, города и страны рендерит штатный loader Expo Router; выпуск кода отделяется от редакции
контента. До готовности backend-инфраструктуры #2769/#2771 и фактической приёмки миграция не
считается включённой в production.

Серверный артефакт собирается отдельно с согласованной парой
`METRAVEL_WEB_OUTPUT=server` и `EXPO_PUBLIC_WEB_RUNTIME_SSR=true`. Это один экспорт с каталогами
`client/` и `server/`; нельзя смешивать клиентские пакеты независимых static/server сборок.
Runner восстанавливает `EXPO_PUBLIC_*` из приватного артефакта: эти значения совпадают с уже
скомпилированным клиентом и имеют приоритет над окружением процесса. Для локального API
используется только `SSR_API_ORIGIN`; он не попадает в артефакт и не меняет клиентский API URL.
В статическом режиме web-экран статьи не подписывается на loader: JSON для новых slug отсутствует
до следующего экспорта, и переход должен сохранять существующий API-путь.

SSR QueryClient принадлежит одному рендеру, не создаёт GC-таймеров даже при явном `gcTime`
в хуке и не сохраняется в глобальный `activeQueryClient` (#2767). Loader и `generateMetadata`
разделяют публичный ответ API только внутри одного запроса, по общему `AbortSignal`.
Описание статьи использует backend `safe_html`; FAQ JSON-LD имеет общий билдер
`utils/travelFaq.js` с генератором, редакционные строки не меняются. Формула description общая
для прежнего генератора, metadata loader и клиентской головы — `utils/travelSeoDescription.js`.
Язык Article JSON-LD задаёт вызывающий код из языка редакционного материала, а не языка интерфейса.

Переключение требует настоящих HTTP-проверок 200/301/404/503, SEO-паритета, гидрации
390/768/1440, перехода к новой статье и совпадения server/client SHA. До переноса non-RU
квестов дополнительно требуется изоляция локали между конкурентными запросами: клиентский
`BootLocaleGate` нельзя использовать для ожидания server effects.
Runner устанавливает request-local `AsyncLocalStorage`, middleware загружает конечный каталог
локали до metadata, а i18n и provider читают язык текущего запроса (#2770). Это основа для
миграции локализованных квестов. Публичная проекция квеста не содержит заданий, подсказок, ответов
или прогресса; полный игровой бандл не сериализуется в loader.

Capability v1 включает только статьи. Capability v2 дополнительно подтверждает схему публичных
данных квестов, схему закреплённого builder и выбранную владельцем свежесть не более 30 секунд
после сохранения. Только после этого deploy выставляет `EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR=true`.
Сборка в этом режиме не читает тела путешествий/квестов и не берёт квитанции R1/R2. Сохраняются
конечные route shells и постобработка метаданных существующих `noindex` страниц `/article/<id>`;
их тело генератор и раньше не создавал. Квитанция первого переключения сохраняет прежний
статический релиз; последующие откаты возвращают предыдущее согласованное серверное поколение.

Один серверный экспорт содержит сервер и окончательно обработанный `client/` с теми же assets.
В приватный `runtime/` упаковывается самостоятельный builder безопасной проекции с каталогами
пяти языков, контрольной суммой и лимитами ввода/вывода; контент в него не входит. Backend отдельно
обновляет и атомарно активирует поколения данных. Переключение или откат кода не откатывает
снятие публикации или новую редакцию контента.

Кодовая публикация v2 использует backend-owned `publish-code`/`rollback-code`/`finalize-code`.
Один указатель поколения выбирает согласованные сервер и клиент; в активный клиент переносятся
старые hashed JS/CSS по прежним ограничениям возраста и места, чтобы открытые вкладки работали.
До finalize проверяются живая статья и выбранный backend публичный квест: SHA источника SSR,
H1, тело, canonical, JSON-LD и попадание HTML в гостевой кеш. Ошибка возвращает обе части кода.
Один `/health` этот гейт не заменяет. Без актуального кеша и сохранённой статической страницы
недоступный renderer отвечает честным 503, а не обещает универсальный статический fallback.

## Проверки

`npm run build:web:prod` → `verify-static-travel-seo`, `verify-static-quest-seo`,
`guard-html-meta-description`; diff подписей head до/после (`title/description/robots/canonical/
og/twitter/hreflang/ld+json`) при изменении слоя; jest `__tests__/utils/seoRoutes/*`,
`__tests__/components/seo/*`, `__tests__/scripts/generate-seo-pages.test.ts`.
