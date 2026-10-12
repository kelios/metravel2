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

## Статический пакет SSG — #2365 (B)

Сборка пакета включается только явно. Режим `QUEST_SEO_MODE=legacy` в
`build-prod.sh` выпускает прежний RU-only dist (prefixed-страниц, слотов и
манифеста нет, раздача и sitemap не меняются). V1-режимы E описаны ниже.

1. `generate-seo-pages.js --quest-seo-candidate <файл вне dist>
   --quest-seo-receipt-command "<cmd>"` (или `$QUEST_SEO_RECEIPT_COMMAND`):
   квитанция C R1 до первого чтения контента, сверка каталога с квитанцией,
   RU-детали со слотами `QUEST_LOCALE_HEAD_V1`/`LINKS_V1`/`BOOTSTRAP_V1`,
   точные `?lang=` чтения только опубликованных и полных переводов, отбор по
   `content_locale` и `available_locales`, глубина ≥300 слов / ≥30 % своих
   5-грамм в когорте своего языка (`questPageDepth`, пороги прежние), RU-якорь
   обязан быть индексируемым. Подписи страницы — из каталогов i18n
   (SSG-only `seoSsg:questDetail.*` из `i18n/locales/<locale>/ssg/`, в клиентские
   чанки не попадает, #2399; справка точки, «Квесты в соседних городах»
   и «Все городские квесты» — общие ключи городской страницы
   `quests:app.tabs.quests.city.index.*`), RU-значения равны прежним литералам.
2. После постобработки HTML: `finalize-quest-seo-package.js --dist <dist>
   --candidate <файл>` берёт R2, требует R1 ≡ R2, считает checksum хранимых
   байт, проверяет весь пакет и последним пишет `quest-seo-manifest.v1.json`.
3. `verify-static-quest-seo.js --quest-seo-package-only` перепроверяет пакет с
   диска; в обычном режиме prefixed-артефакты без манифеста — ошибка (флаг
   `--quest-seo-candidate-pending` — только между шагами 1 и 2).

Fail-closed: сбой/таймаут квитанции, неполный или неудачный fetch бандла,
расхождение каталога и квитанции или R1 ≠ R2 отвергают кандидата целиком — нет
манифеста, прежний активный пакет остаётся. Отсутствие перевода выводится
только из квитанции и точного ответа API, не из транспортной ошибки.

Активация и exposure — E #2366 / D: публиковать пакет только через
`quest_seo_activate`; rsync пакета в legacy `static/dist` недопустим —
закреплённый legacy nginx отдаёт `/{locale}/quests/...` по `try_files $uri.html`.

## Release integration — E #2366

The normal release entrypoint supports full RU-only and translated v1 packages,
private full R1/R2 fencing, pinned bounded overlay before sealing, immutable
staging, exact receipts, CAS activation and rollback. Legacy writers refuse
managed roots. See [release/maintenance/recovery runbook](../ops/quest-locale-release.md).
Backend C/D owns initial conversion, Nginx and exposure; production acceptance
remains required for A–E.
