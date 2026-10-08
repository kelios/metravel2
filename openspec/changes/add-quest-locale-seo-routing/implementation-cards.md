# Черновики карточек реализации #2208

Статус: **DRAFT, не заведены на борде**. Канонический план — `add-quest-locale-seo-routing`, требования — `specs/quest-locale-seo-routing/spec.md`, решения — `design.md`. Все карточки зависят от решения владельца по D1–D5 и отдельного apply-запроса. Этот документ не разрешает backend/Nginx-работу, изменение API или выкаты. После принятия `ticket-board` обновляет Problem Memory по всем статусам, переиспользует совпадения, создаёт только отсутствующие карточки и записывает их номера сюда и в #2208. FE и BE выполняются разными владельцами; поезд фронта не берёт бэк по общему поручению.

Порядок без циклических implementation dependencies: сначала backend owner и FE фиксируют интерфейсы A/B/C/D — immutable package/schema, private builder revision receipt, per-response snapshot boundary, anonymous serving projection и activation receipt. Это prerequisite 1.2, а не ожидание готового кода B/C друг от друга. После согласования A/B и C/D реализуются с общими fixtures независимо; E интегрирует готовые реализации. C/D не требуют выпуска E для code-level review, но совместная production-приёмка A–E обязательна до Done. На момент создания runnable-карточек сюда и в них записывают точные backend-owned modules и согласованные схемы: generic gateway названия без такого handoff недостаточны.

## A — [FE-QUESTS][QUEST-L10N] URL-локаль детали: единый роут, загрузка и языковые ссылки

Problem key: SEO-LOCALE-ROUTING-001/route-boot
Historical matches: #2208 — план; #2197 — locale-aware reads; #1332 — общий контракт сайта.
Verdict: draft-create-linked; перед созданием повторить поиск всех статусов.
Canonical task: #2208 — контракт; будущий номер A — реализация route/boot.
Root-cause delta: язык запроса сейчас берётся из глобального preference, а prefixed адресу требуется язык URL до первого mount.

Scope: общий canonical/locale/version-link model, web prefixed adapter и reuse экрана детали; web-only boot/provider интеграция; единые метаданные/JSON-LD и явные language links. Файлы: route детали и новый web adapter, web i18n boot/provider, существующий language control, questSeo/structured-data helpers, exact-locale hook inputs, ресурсы RU/BE/UK/PL/EN и targeted tests. Не входит: генерация release manifest, backend, native, новый текст квестов.
User-visible result: `/pl/quests/{id}/{slug}` открывается по-польски при сохранённом EN, а доступные версии переключаются настоящими адресными ссылками.
Data/API contract: #2193 `lang`, `content_locale`, `available_locales` неизменны; exact-language gameplay reads остаются live. Initial head/anchors/bootstrap E берутся из serving projection C; свежая revalidation управляет SEO/links, не available_locales напрямую. Withdraw/change показывает localized noindex unavailable под тем же prefix, не RU fallback; offline gameplay сохраняет отдельную пометку actual locale. RU established preference/fallback gameplay сохраняется.
Platform impact: desktop web, mobile web; web adapter не меняет Android/iOS preference/provider/deep links.
Localization impact: RU/BE/UK/PL/EN; API контент не переводить на клиенте, новые UI/a11y/error keys сразу во всех локалях.
Dependencies: принятое #2208; #2193/#2201/#2197; контракт E из C/D; production acceptance после B–E. Исходники можно разрабатывать после согласования интерфейса, выпускать — только согласованным пакетом.
Fallback/mock policy: нет русской индексируемой страницы под PL; нет восстановления старых alternates при гидрации. Моки допустимы в unit, runtime pass требует фактических опубликованных данных.
Validation: targeted route/query/boot/head tests с conflicting preference, slow/fail resources, unsupported prefix, print/query и offline notice; `npm run test:i18n`, lint/typecheck по scope; independent review-and-fix. В testing после согласованного релиза — desktop/mobile screenshots+console+network для RU и каждого доступного BE/UK/PL/EN, keyboard/touch links, direct/refresh/SPA, один view event.
Regression control: существующие RU numeric canonical и city aliases, query locale isolation, quest identity/progress/consent, non-quest locale lifecycle; постоянные тесты под shared model.
Done gate: code review и code-review gate pass, все mandatory checks pass, реально выкаченный SHA и production browser evidence всех доступных локалей; нет source/runtime изменения native.

## B — [FE-SEO][QUEST-L10N] SSG переводов и проверяемый immutable SEO-пакет

Problem key: SEO-LOCALE-ROUTING-001/static-package
Historical matches: #2208 — план; #1930 — качество страницы; #2193 — переводной контент.
Verdict: draft-create-linked; перед созданием повторить поиск.
Canonical task: #2208 — контракт; будущий номер B — генерация/верификация.
Root-cause delta: SSG сейчас читает только RU и не выпускает проверяемый locale/revision manifest для production serving.

Scope: `scripts/generate-seo-pages.js`, `scripts/verify-static-quest-seo.js`, shared quest manifest/eligibility helpers и tests. Exact-lang опубликованные бандлы, same-locale depth cohorts, immutable HTML/checksum/revision manifest, безопасный abort ошибок, static head parity. Не менять `scripts/generate-sitemap.js` как способ публикации prod sitemap; не менять robots или gameplay.
User-visible result: робот получает полностью локализованное тело детали без JavaScript по стабильному prefixed адресу.
Data/API contract: #2193 reads; available membership + content_locale exact + complete publication + ≥300 слов / ≥30% own 5-grams; RU indexable anchor. Agreed private builder receipt C fences content/source revisions without a new #2193 field; changed source/revision во время сборки отвергает candidate. Stored base HTML checksum не checksum final response: head/visible anchors/bootstrap — bounded slots, final projection проверяется отдельно.
Platform impact: desktop web, mobile web SSG; native none.
Localization impact: RU/BE/UK/PL/EN; локализованные existing questSeo resources, публичный API контент без новых переводов/creative copy.
Dependencies: принятое #2208, A shared URL/head model, C manifest schema/internal revision contract, #2193/#2201. Пакет не активируется до D/E.
Fallback/mock policy: fallback RU не даёт переводу eligibility; timeout/partial fetch не считается отсутствием и не выпускает частичный release; оставляется предыдущий целостный пакет.
Validation: unit fixtures exact/mismatch/partial/quality/timeout/source race, identical reciprocal clusters, one canonical, spoilers and media URL geometry; static verifier всех prefixed artifacts и checksums; `npm run test:i18n`, relevant lint/guards, independent review. Production no-JS/status/sitemap доказательства в testing после E.
Regression control: неизменённые thresholds/algorithm, RU numeric/alias fixtures, RU city/country/catalogue/scenario static pages, noindex тонких RU страниц; transport failure исключает массовый withdrawal.
Done gate: manifest валиден, все перечисленные HTML существуют и совпадают, candidate fail-closed сценарии доказаны, независимое review pass, testing доказывает реально served content, а не один dist.

## C — [BE-SEO][QUEST-L10N] Live eligibility и gateway снятия переводных static-страниц

Problem key: SEO-LOCALE-ROUTING-001/live-revocation
Historical matches: #2208 — новый serving contract; #2193 — immediate publication/fallback reads.
Verdict: draft-create-linked, backend owner only; перед созданием повторить поиск.
Canonical task: #2208 — контракт; будущий номер C — backend live serving.
Root-cause delta: manifest snapshot не умеет отозвать HTML при immediate снятии перевода; фильтрация только sitemap оставляет старую индексируемую страницу и alternates.

Scope: только backend owner проектирует/реализует статический gateway для canonical/alias RU quest details и prefixed details, внутренние content revisions, effective cluster E и cache/conditional response safety. Перед кодом сверяет реальную topology и выносит изменение контракта владельцу; frontend workspace backend не редактирует.
User-visible result: online response со snapshot после writer commit уже не выдаёт снятый/изменённый перевод; русская версия не рекламирует его как доступную альтернативу и сохраняет established body/status при RU source drift.
Data/API contract: public #2193 `lang` reads и writers/gameplay semantics неизменны. E = built eligible manifest ∩ live complete published matching revisions, с matching RU anchor; package pinned once, authoritative DB snapshot per response. Head/visible anchors/bootstrap берутся из одного E; anonymous revalidation projection и private builder revision receipt согласованы заранее. RU revision mismatch очищает translated E, не превращает RU в 404. In-flight старый snapshot допустим, distributed DB/filesystem/cache barrier не требуется. Нет user-specific payload.
Platform impact: server SEO delivery desktop/mobile web; без client device gate.
Localization impact: RU/BE/UK/PL/EN eligibility/head language; backend не пишет переводы.
Dependencies: принятое #2208 D5 и отдельное поручение backend owner, B manifest/schema, A consumer contract. Prefix exposure disabled до D/E.
Fallback/mock policy: absent/withdrawn/stale/thin перевод — real 404/noindex, не RU и не Expo shell; live read failure — retryable 503/noindex для prefix/sitemap, RU released body без translated slots. Старый full-response cache не обходит live check; gameplay fallback/offline semantics сохраняются.
Validation: backend source/unit tests matching revision, all writers, RU source drift, publish/withdraw/change, in-flight snapshots, projection slots, resolver outage, missing artifact and anonymous-only payload; old ETag revoked prefix даёт 404, changed RU E даёт updated representation, validators include package/body/E. Warm/conditional/shared caches не bypass resolver; relevant API/config probes только после backend code review в testing. Параметры и доказательства D5 согласуются с D.
Regression control: #2193 API publication остаётся немедленной; old RU canonical aliases; cache by immutable body hash не кэширует бесконечно eligibility; rollback не воскрешает withdrawal.
Done gate: backend owner подтвердил topology и review; live gateway на production доказывает real 404 и согласованные effective head/version projections после withdrawal и warm/304 probes; источники/следы проверки записаны в карточку.

## D — [BE-SEO][QUEST-L10N] Production sitemap, Nginx и atomic serving-root activation

Problem key: SEO-LOCALE-ROUTING-001/production-discovery
Historical matches: #2208 — routing contract; existing backend sitemap и production Nginx ownership.
Verdict: draft-create-linked, backend owner only; перед созданием повторить поиск.
Canonical task: #2208 — контракт; будущий номер D — production routing/discovery.
Root-cause delta: Django sitemap и Nginx могут публиковать/обслуживать URLs независимо от SSG-пакета и live eligibility.

Scope: backend-owned Django sitemap подключает C effective cluster; production Nginx route family направляется на gateway и не использует SPA fallback для отсутствующих prefix URLs; реальный общий serving root, atomic package activation и rollback/runbook. Источник Nginx — backend `deploy/prod/nginx/nginx.conf`; frontend Nginx не изменять.
User-visible result: каждый новый язык из sitemap открывается 200 с нужным содержимым, а отсутствующий URL возвращает настоящий 404.
Data/API contract: sitemap `<loc>` переводов и static serving используют один active physical manifest+E; никаких independent DB available_locales URLs; immutable release identity и integrity schema B/C. Существующие другие разделы sitemap и RU legacy listing policy сохранены; HTML — единый hreflang метод.
Platform impact: server configuration для desktop/mobile web; native/device none.
Localization impact: RU/BE/UK/PL/EN path allowlist, unknown prefix/prefixed landing 404.
Dependencies: принятое #2208 D5, backend-owner поручение, B package, C resolver/gateway, E deployment handoff; release sequence согласуется до exposure.
Fallback/mock policy: stale copied manifest или arbitrary JSON read «в nginx» не pass; отсутствующий файл/версия/root mismatch блокирует activation. Ошибка проверки сохраняет прежний coherent release.
Validation: backend source/unit/config checks и package integrity fixtures до code review; staging/runtime только в testing — full prefixed sitemap↔effective-route parity within a stable snapshot, real 200/404/503/noindex, single canonical, same release root, concurrent activation/withdrawal with pinned in-flight package retention, RU numeric+alias/city/country/catalogue/scenario/travel regression probes и rollback.
Regression control: authoritative same physical active root; allowlisted routes/path safety; default app shell никогда не обслуживает несуществующий перевод; package fallback сохраняет live revocation C.
Done gate: конфигурация и actual production behavior подтверждены backend owner; sitemap не опережает обслуживаемые переводы и снятые версии исключаются из всех discovery surfaces; rollback проверен.

## E — [FE-SEO][QUEST-L10N] Release handoff и production gate языковых страниц

Problem key: SEO-LOCALE-ROUTING-001/release-parity
Historical matches: #2208; existing frontend deploy pipeline and static quest verifier.
Verdict: draft-create-linked; перед созданием повторить поиск.
Canonical task: #2208 — контракт; будущий номер E — activation handoff/guard.
Root-cause delta: штатный frontend dist deploy не доказывает совместимость backend manifest/gateway/sitemap; нужна конкретная fail-closed интеграция нормального pipeline.

Scope: frontend `scripts/deploy-prod.sh`/shared verifier integration и tests в точном scope handoff, feature/localization rule documentation. Staging и activation только по согласованному C/D протоколу, общий operation lock. Контрактная проверка SHA/package/root/eligibility; новый независимый deploy канал не создавать.
User-visible result: переводные адреса выходят согласованным релизом, рядом с ними не ломаются русские адреса, stale release не получает языковой sitemap.
Data/API contract: immutable B package + C/D activation receipt/effective projection; отсутствие backend contract/release identity останавливает prefix exposure, а не имитирует успех.
Platform impact: desktop web, mobile web release; native/store none.
Localization impact: RU/BE/UK/PL/EN release matrices; новых creative/UI keys в этой карточке нет.
Dependencies: принятое #2208; A–D reviewed contracts и готовые реализации; normal frontend-deployer и backend-owned release operations по их gates. Production QA начинается только в testing после review.
Fallback/mock policy: SKIPPED quality gate не pass; local build и mock sitemap не заменяют actual production release. Rollback не воскрешает withdrawn translation.
Validation: static/unit handoff failure/mismatch tests и mandatory independent review/code-review gate; после coordinated production release — `.build-source.json`, exact release root, no-JS/status/head/sitemap probes, A desktop/mobile screenshots/console/network, controlled authorized test withdrawal/republish с warm/conditional cache, matched TTFB/LCP/CLS и build duration/request/bytes baseline.
Regression control: release guard проверяет prefixed effective set, RU canonical/alias fixtures и unrelated routes; existing 300/30 quality and one-slot-one-URL/media geometry rules; >10% RU latency/LCP regression расследуется, CLS ≤0.1.
Done gate: все A–D production dependencies и testing evidence pass, feature/runbook documented, no hidden backend/static cache bypass. 28-day GSC follow-up полезен, но не маскирует функциональную неприёмку и не обещает рост индекса.
