# Языковые адреса деталей квестов — #2364

Реализация A принятого `add-quest-locale-seo-routing` (#2208). Выпуск и
production-приёмка выполняются совместно с #2365/#2366 и backend C/D;
наличие route-кода само по себе не разрешает prefix exposure.

## Маршрут и язык

Детали BE/UK/PL/EN: `/{locale}/quests/{numericCityId}/{questSlug}`.
RU сохраняет `/quests/{numericCityId}/{questSlug}` и существующие alias URLs.
Городские/страновые страницы языковых prefix не получают.

### Хабы каталога и навигация с языковой страницы — #3217 (расширение D1)

Решение владельца 09.11.2026 расширяет D1 из #2208: у каталога есть
языковые хабы `/{be,uk,pl,en}/quests`. Хаб — тот же экран каталога
(`QuestsScreen`, проп `localeHub`) в catch-all `app/[...missing].web.tsx`.
В нём только квесты, у которых `available_locales` содержит эту локаль, и
карточки ведут на деталь того же языка. Canonical — путь хаба.

Какой адрес владеет языком интерфейса, решает одно правило
`parseQuestUrlLocale` (`utils/questLocaleRouting.js`): деталь или хаб.
Его используют `LocaleProvider.web`, boot (`bootLocale.web`, head-скрипт
`localeBootShell`), SSR (`utils/ssr/requestLocale.js`) и `documentView`.

Уход со страницы, привязанной к языку, не сбрасывает язык. Локаль адреса
становится языком сессии для страниц без префикса (`/map`, `/search`,
`/quests/<city>`). В хранилище она не пишется и действует до явного выбора
языка или перезагрузки. Раньше `LocaleProvider` при уходе возвращался к
сохранённому предпочтению (ru) и приостанавливал дерево в том же рендере,
где корневой Stack впервые монтирует `(tabs)`. Навигатор терял вложенное
состояние, и адрес сбрасывался на `/` по-русски. Явный выбор версии
(`QuestVersionLinks`) теперь меняет язык до перехода, поэтому цель
монтируется сразу в своём языке. Если пока выбор загружался, открылся другой
языковой адрес, его локаль сохраняется.

«Квесты» в доке, шапке и подвале, крошка и «Назад» языковой детали идут через
одно правило `localizeQuestCatalogHref` (`utils/questLocaleHubs.ts`). Ссылки
на хаб включаются флагом сборки `EXPO_PUBLIC_QUEST_LOCALE_HUBS=true`, только
web. Порядок выпуска тот же, что у деталей (#2364): сначала бэкенд отдаёт
хаб (gateway, Nginx location, loader, sitemap), затем включается флаг. До
этого nginx отвечает на `/{locale}/quests` 404, и ссылок туда нет. Бэкенд
выкачен (#3261, #3349), поэтому `build-prod.sh` ставит флаг по умолчанию для
prod; значение из окружения или `.env.prod` сильнее. Состав хаба —
`served_locales` элемента списка (`selectQuestHubMembers`,
`utils/questLocaleHubs.ts`): страницы, которые сервер отдаёт, а не просто
опубликованные переводы (noindex-перевод дал бы ссылку на 404). Элемент без
поля (старый кэш, старый бэкенд) в хаб не попадает; русский `/quests` не
фильтруется. Серверный HTML хаба (#3360) несёт его участников на его языке:
loader catch-all для `/{locale}/quests` зовёт `loadQuestDiscovery(request,
'catalog', locale)` → `GET /api/quests/web/discovery/?view=catalog&lang=<locale>`
(бэк #3359; `home`/`scenario` на этих языках — 404), `validateQuestDiscovery`
принимает конверт языка хаба и требует от каждой строки `served_locales` с этим
языком и `content_locale` = язык хаба (оба поля сохраняются; форма русских
строк не меняется). Хаб обёрнут в `QuestDiscoveryLoaderBoundary` внутри ленивого
`components/quests/runtime/QuestLocaleHubCatalog.web.tsx` (статический импорт
границы в catch-all переносил FAQ каталога в `__shared:quests-catalog`): каталог стартует
с этих строк, указатель `QuestsCatalogDirectory` ссылается на каждого участника
(`/{locale}/quests/<cityId>/<slug>`), JSON-LD — на те же адреса. Клиентский
перезапрос `/api/quests/?lang=` только сужает состав: `selectQuestHubMembers`
получает множество опубликованных id и не добавляет квест, которого нет в HTML.
Head хаба (title, description)
берётся из записи `/quests` в `utils/seoRoutes/staticRoutes.js` на языке адреса.
Общий `utils/questLocaleRouting.js` проверяет locale, положительный безопасный
числовой ID и slug; canonical исключает query/print параметры.

`app/[...missing].web.tsx` адаптирует существующий catch-all и переиспользует
экран детали. Его `.tsx` fallback сохраняет native graph: новый универсальный
`[locale]`-маршрут не создаётся. Web boot загружает ресурсы и применяет язык
URL до mount; SPA-переход ждёт правильной локали. Сохранённое предпочтение
при входе/выходе не переписывается, вне prefix действует прежний lifecycle.
Переведённый статический body остаётся читаемым при slow/fail boot.

## Публикация и SEO

Хлебная крошка детали (#2466): `/{lang}/quests/<city>/<slug>` разбирается
`parseQuestLocaleRoute` тем же правилом, что RU — «Главная › Квесты ›
название квеста» на языке адреса; название — из `?lang=` бандла экрана (своего
запроса крошка не делает, бандл другого `content_locale` не именует). На
странице один `BreadcrumbList` — в графе экрана, без « | Metravel»; шапка его
не дублирует, статическая SSG-копия снимается при передаче графа.

Начальные canonical/alternates/version links берутся только из проверенного
`script#quest-serving-v1[type="application/json"]`. Отдельный анонимный
`GET /api/quests/serving/{city}/{slug}/?lang={locale}` ревалидирует проекцию
без credentials и без кэширования. RU-деталь — только ревалидатор: она
спрашивает API и при SPA-входе без bootstrap (иначе выпущенный квест потеряет
языковые ссылки), но после ответа «identity пакета не установлена» (503,
`release_id: null`: до релиза — каждый запрос, после — повторяемый сбой)
делает паузу 5 минут, кроме документа с bootstrap этого квеста (#2364). Свежий ответ заменяет bootstrap;
`available_locales` gameplay-бандла и offline-копия не восстанавливают E.

V1 поля: `schema_version`, `release_id`, `city_id`, `quest_slug`, `locale`,
`state`, `canonical_path`, `ru_source_path`, `versions[{locale,path}]`.
Все пути сверяются с той же identity. `available` соответствует 200;
`unavailable` — 404, `temporary_failure` — 503. В ошибке canonical=null,
versions=[]; RU source link только при подтверждённой identity. Неизвестный
source предлагает ссылку на существующий каталог.

Переводной online-бандл с другим `contentLocale` не показывается как
опубликованная языковая страница. Offline-снимок сохраняет фактическую
языковую пометку, а online SEO/links остаются исключёнными. Print сохраняет
noindex. Полная eligible cluster содержит себя, RU и RU x-default; RU-only
не получает alternates. JSON-LD и отложенные head patches используют тот же
canonical/locale, снятая версия не получает прежний head обратно.

## Design evidence и проверки

Существующие header и экран квеста сохраняют иерархию. Языковые версии —
обычные адресные ссылки с полными названиями языка и текущей отметкой.
Недоступная версия — один заголовок, пояснение, retry и RU source/catalog link;
проверяются desktop/mobile, loading/available/withdrawn/temporary/offline,
keyboard и touch, все RU/BE/UK/PL/EN. Native/provider/config вне scope.

Code-level: route/projection/anonymous transport/query/boot/detail/link tests,
`npm run test:i18n`, scope lint/typecheck/guards и независимое review-and-fix.
Runtime: только после review/push и общего B–E выпуска — actual SHA,
no-JS/head/статусы, desktop/mobile screenshots/console/network, предпочтение
EN при URL PL, прямой вход/refresh/SPA, withdrawal/retry, один quest view.

## Серверный рендер локалей (SSR, #2766)

С 27.10.2026 детальные страницы квестов на всех пяти языках, посадочные
городов и стран рендерит сервер Expo Router (SSR loaders) из проекции
публикации `scripts/lib/questWebProjection.js` (бэкенд строит её сборщиком
`scripts/package-quest-web-builder.js`): деталь каждой опубликованной
и полной локали, RU-посадочные, вердикт глубины ≥300 слов / ≥30 % своих
5-грамм в когорте своего языка (`questPageDepth`) и проверка раскрытия
заданий (`questSpoilerGuard`). Подписи страницы — из каталогов i18n
(SSG-only `seoSsg:questDetail.*` из `i18n/locales/<locale>/ssg/`, в
клиентские чанки не попадает, #2399; справка точки, «Квесты в соседних
городах» и «Все городские квесты» — общие ключи городской страницы
`quests:app.tabs.quests.city.index.*`).

Выкат публикует только SSR-пару (`scripts/deploy-prod.sh` →
`build-prod.sh prod` → `scripts/web-ssr-publication.sh
stage/publish-code/finalize-code`, откат `rollback-code`); живую выдачу
квеста перед финализацией проверяет `scripts/verify-live-quest-ssr.js`.

## История: статический пакет SSG — #2365 (B) и release integration — E #2366

До #2766 переводные страницы квестов собирались статическим пакетом v1:
бывший SSG-генератор строил RU-детали со слотами
`QUEST_LOCALE_HEAD_V1`/`LINKS_V1`/`BOOTSTRAP_V1` и языковых участников из
RU-экспорта под квитанциями R1/R2, манифест `quest-seo-manifest.v1.json`
финализировался после постобработки HTML, а релиз шёл режимами
`ru-only`/`translations` с CAS-активацией и откатом. Весь этот конвейер
(генерация, захват входов, проверка статики, квитанции, режимы релиза) снят в
#2766; помощники аварийного восстановления статического корня описаны в
[runbook](../ops/quest-locale-release.md).
