# Языковые адреса деталей квестов — #2364

Реализация A принятого `add-quest-locale-seo-routing` (#2208). Выпуск и
production-приёмка выполняются совместно с #2365/#2366 и backend C/D;
наличие route-кода само по себе не разрешает prefix exposure.

## Маршрут и язык

Только детали BE/UK/PL/EN: `/{locale}/quests/{numericCityId}/{questSlug}`.
RU сохраняет `/quests/{numericCityId}/{questSlug}` и существующие alias URLs.
Городские/страновые/каталожные страницы не получают языковых prefix.
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
