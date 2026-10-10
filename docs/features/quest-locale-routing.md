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

Начальные canonical/alternates/version links берутся только из проверенного
`script#quest-serving-v1[type="application/json"]`. Отдельный анонимный
`GET /api/quests/serving/{city}/{slug}/?lang={locale}` ревалидирует проекцию
без credentials и без кэширования. Свежий ответ заменяет bootstrap;
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
