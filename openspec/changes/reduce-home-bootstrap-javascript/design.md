## Context

Мотивация и границы — `proposal.md`. Production baseline: `a72dee47e88400ee4f98625845be78269d9a294a`, `.build-source.json` recordedAt `2026-10-08T14:16:22.539Z`. Оба мобильных прогона: cold guest, пустое согласие, 412×823, DPR 1,75, Lighthouse 12.8.2, Moto G Power UA, slow 4G, CPU ×4. Версия LH исходного PSI — 13.5; сравнение разных версий не считается до/после.

| Production probe | Performance | FCP | LCP | TBT | CLS | Requests / transfer / status |
|---|---:|---:|---:|---:|---:|---|
| mobile simulate | 50 | 4,40 с | 9,57 с | 408 мс | 0 | 73 / 2 022 596 B / все 200 |
| mobile devtools (applied) | 79 | 1,55 с | 2,19 с | 748 мс | 0 | 72 / 1 897 677 B / все 200 |
| desktop simulate | 98 | — | 1,01 с | — | — | полный JSON сохранён |

Applied main-thread evaluation — 1599 мс, parsing/compilation — 362 мс. Entry получает 1386 мс script evaluation; самая длинная задача — 382 мс (6013–6395 мс после начала navigation). Trace не содержит компонентного CPU profile: привязка этих 382 мс к форме подписки **не установлена**.

В simulate LCP — runtime IMG, observed LCP 3391 мс. Ранние Paint записи SSG имеются около 1319 мс, но presented/contentful кадра до 3391 мс нет. В applied final LCP — SSG IMG30 на 2187 мс: ранний shell работает. Из этих данных нельзя выводить обязательную замену DOM-узла изображения либо отсутствие preload.

Source evidence:

- `components/home/Home.tsx:18` — eager импорт формы; `:348–350` — её low-priority visibility-only секция. Неиспользуемый до прокрутки код входит в route dependency graph раньше UI.
- `components/common/EmailSubscriptionForm.tsx:13` импортирует `subscribeEmail` из `api/misc`; `api/misc.ts:2–23` импортирует helpers/validation путешествий. Объём retained модулей именно через этот путь пока не измерен.
- `components/home/homeDeferredSections.web.tsx:1–10` — существующий владелец lazy web exports; одноимённый общий adapter — eager native exports.
- `components/layout/RootWebDeferredChrome.tsx:49–51` запускает общие ветви, но их CPU contribution не выделен. Reanimated NetworkStatus уже заменён webstub в `metro.config.js:206+`, поэтому его импорт не доказывает большой payload.

## Goals / Non-Goals

**Goals:** убрать доказанное несовпадение загрузки кода и видимости формы, проверить реальный выигрыш графом/trace, сохранить hydration/SSG и работоспособность всех потребителей подписки. Бюджет TBT семьи APP-SHELL-BOOT — 400 мс; достигнутое уменьшение, остаток и соответствие этому бюджету записываются отдельно.

**Non-Goals:** изменение SSG removal, boot script gating, геометрии hero, root chrome или исторических mount triggers без новой компонентной атрибуции. Локальное улучшение формы не считается доказательством решения всего bootstrap TBT.

## Decisions

1. **Расширить имеющийся adapter, а не вводить новый scheduler.** `Home` получает форму из `homeDeferredSections`, web export — lazy, native — прямой. Существующий Suspense внутри DeferredSection, low priority, minHeight=240, source/pageUrl/clientOnly остаются. Альтернатива: таймер общего bootstrap; отвергнута, поскольку переносит работу и меняет готовность интерфейса вместо удаления ненужной загрузки.
2. **Изоляция API допускается только после анализа графа.** Если `misc` остаётся eager по другим нужным импортам, простое разделение файла не уменьшает startup и не входит в diff. Если retained editor/travel helpers уходят, сделать отдельный subscription transport и совместимые type/value re-exports. Альтернатива: копия fetch в форме; отвергнута как дублирование безопасности/ошибок/таймаутов.
3. **SSG считается контролем, не объектом speculative fix.** Сохранить early preload, contain, текущую фотографию, route hydration gate и существующий handoff. DOM adoption и timer reveal не подкреплены applied trace.
4. **Бюджеты не расширяются.** Получить CPU profile доминирующей задачи перед любым дополнительным изменением root/provider/bootstrap. Если после bounded diff TBT остаётся выше 400 мс, карточка не закрывается как исправленный PageSpeed: следующая source причина и необходимый scope фиксируются с evidence, а не маскируются score.

### Data/API contract

Сохранить `POST /api/subscribe/`: `email: string`, `source: SubscribeSource`, optional `page_url: string`, `consent: true`, `consent_version: string`. Ответы 201 created, 200 exists/sent, 400 field errors, 429 остаются обработанными прежним способом. Auth, error localization, canonical URL, timeout и analytics не меняются; backend изменений нет.

### Validation matrix

| Surface | Code-level before testing | Acceptance in testing |
|---|---|---|
| desktop web | Home tests, adapter import boundary, lint/tsc, bundle/eager guards на production build | live home, прежняя видимость формы и consent, console, cold desktop LH тем же профилем |
| mobile web | те же tests; preserve placeholders/mount triggers | live 412×823 DPR1,75 cold guest; applied + simulate; scroll to form; быстрый scroll до загрузки чанка; network/console/screenshots; consent и API errors |
| Android/iOS | общий adapter typecheck и native exports | none: observable native behavior/config не меняется |
| RU/BE/UK/PL/EN | существующие ключи не меняются | сохранить locale выбранного браузера; RU полный flow, остальные — отображение формы/ошибок без новых строк |

Моки допустимы в unit тестах import/mount, но не заменяют production граф и live transport в acceptance. До первого локального browser/API gate обновить backend штатно по WORKFLOW_OPERATIONS §3.0; runtime не проводится во время review.

## Risks / Trade-offs

- [Первое быстрое прокручивание ждёт чанк] → существующий резерв 240px и Suspense fallback, проверка быстрого scroll и отрицательного ответа chunk; не добавлять вечную скрытую секцию.
- [Другие пути удерживают misc] → graph proof до выделения транспорта; лишний API refactor отклонить.
- [Основная React задача остаётся] → CPU profile, измерение остатка, TBT gate не считать пройденным по одному source fix.
- [Shared main меняется другими сессиями] → координация owned paths; baseline повторить при новом production sha до before/after сравнения.
- [Разница версий/моделей Lighthouse] → фиксировать версию, профиль, SHA и холодное состояние; сравнивать одинаковый инструмент, оба режима записывать отдельно.

## Migration Plan

После отдельного apply: source graph/CPU attribution → минимальный diff → targeted checks → независимый review-auditor и code-review-gate → явные task paths commit/push main → testing → isolated build-only committed SHA и отдельные bundle/eager guards → frontend-deployer `DEPLOY_QUIET=1 scripts/deploy-prod.sh <sha>` → live acceptance. Обычный deploy сам эти два guards не вызывает: отдельный receipt до выкладки обязателен. При обязательном in-scope красном результате rollout остановить и вернуть in_progress с точным владельцем/unblock; не парковать testing. Каждый тяжёлый gate проходит operation lock; SKIPPED не является pass.

Откат: вернуть только task-owned diff формы/adapter/условного транспорта и штатно выкатить проверенный SHA. Shared scripts, backend и чужие изменения не откатывать.

## Evidence commands

Фактические before команды (оба wrapper процесса завершились exit 0):

```sh
node scripts/run-with-quality-gate-lock.js psi-home-baseline --shell 'npx lighthouse https://metravel.by/ --only-categories=performance --throttling-method=simulate --output=json --output-path=.codex-temp/pagespeed-home/before.mobile.json --save-assets --quiet --chrome-flags="--headless --no-sandbox" && node scripts/lighthouse-produrl.js --url https://metravel.by/ --formFactor desktop --throttlingMethod simulate --output .codex-temp/pagespeed-home/before.desktop.json'
node scripts/run-with-quality-gate-lock.js psi-home-applied-baseline -- npx lighthouse https://metravel.by/ --only-categories=performance --throttling-method=devtools --output=json --output-path=.codex-temp/pagespeed-home/before.applied.mobile.json --save-assets --quiet --chrome-flags='--headless --no-sandbox'
```

Временные JSON/trace/devtoolslog находятся только в ignored `.codex-temp/pagespeed-home/`; этот документ хранит устойчивое резюме. Before/after применять ту же версию Lighthouse 12.8.2 (pin при повторе), без параллельного CPU-intensive gate. Исходный PSI: https://pagespeed.web.dev/analysis/https-metravel-by/ftwjpz7w06?form_factor=mobile .

## Apply evidence 08.10.2026

Задача борда #2345, `create-linked` к APP-SHELL-BOOT-001/#1643. Сверка production SHA перед apply совпала с baseline. Before production export текущего main в ignored temp завершён exit 0, качество/сборка освобождены для соседнего поезда; его несохранённые изменения не выкачиваются этой операцией.

Web Metro graph (3888 modules): sync union entry + root layout + tabs layout + home route = 1189 modules / 1 861 710 transformed B. Удаление единственного Email edge в этом before-графе даёт 1176 modules / 1 809 846 B: 13 modules / 51 864 B. Это оценка по исходным связям, не фактический after export и не network transfer. Home closure отдельно исключает 21 modules / 74 135 B; разные суммы не складываются.

Уходят форма/ConsentCheckbox/actionConsent/emailSubscription (13 061 B) и misc/filterDictionaries/aiValidation/travelWizardValidation/travelFormNormalization/htmlUtils/faqDisclosureMarkup/security (38 803 B). api/client и errorHelpers остаются нужны остальным startup paths. Изоляция subscribe transport не нужна: весь misc уже выходит из ранней цепочки от изменения adapter.

Точный live entry frame `247:129057` — React 19.2.3 `scheduleImmediateRootScheduleTask` microtask (Metro module247), вызывающий `processRootScheduleInMicrotask`/синхронную root работу. `259:1292` — scheduler `performWorkUntilDeadline`. Это атрибуция владельца callback, а не доказательство времени отдельного компонента: работа потомков включена.

Actual after Metro graph: 1176 modules / 1 810 005 transformed B, 13 removed / no added startup modules. Initial Home scripts 14→13: raw 2 707 494→2 690 881 B, gzip 765 253→759 275 B, brotli 601 208→596 069 B. Aggregate compressed delta около 5–6 KB относится к общему поезду: между export менялись geometry/dock/profile/photo modules, поэтому эта сумма не является изолированной экономией Home. Transformed source bytes не являются network savings. Оба export содержат соседние несохранённые изменения main и служат preview diagnostics; live after измеряется только после isolated SHA deploy.

Фактический gate `psi-home-after-checks` PID12764: Home 4 suites / 25 tests PASS; scoped ESLint, production export, eager-web guard, strict OpenSpec и audit:prompts exit 0. Temporary production output подготовлен штатными prepare-dist-prod/generate-seo-pages. Финальный bundle guard exit 1: 11 breaches (quests, trips, sidebar, locales, TOTAL gzip, search requests). Home chunk и worst eager bytes проходят; search содержит 12 scripts в before, after и generated output. Это release blocker, а не pass или разрешение расширить бюджеты; source ownership/baseline сверяется с владельцами параллельных задач.

CPU attribution на неизменённом live SHA получена Lighthouse 12.8.2 с `--throttling-method=devtools --additional-trace-categories=disabled-by-default-v8.cpu_profiler`. Sampled первые 16 s: Metro initializer self125.7 ms/inclusive276.2 ms, React root microtask inclusive554.4 ms, renderWithHooks inclusive697.3 ms, RNW StyleSheet.create inclusive120.4 ms, HomeHero style factory inclusive25.3 ms. Inclusive интервалы пересекаются; sampling overhead не позволяет сравнивать score/TBT с baseline. Отдельной app-задачи на все 382 ms не обнаружено.

App-owned callback `ImageCardMediaWebHelpers.tsx:281` делает geometry reads до проверки completed identity на строке298 (sampled self30.4 ms). Профиль не записал состояние конкретного изображения, поэтому не доказывает, что этот вызов можно было пропустить; потенциальный early-exit требует cached/pending/recycled identity proof и bilateral slider/performance gate. В текущий Home diff эта гипотеза не включена. Основные подтверждённые остаточные расходы распределены между module initialization, React render/commit и RNW style compilation; одной lazy формой достижение TBT≤400 ms не доказано.

### Baseline classification и regression proof

Операция `psi-home-final-proofs` PID42496 проверила существующий before export штатным bundle guard (exit1), затем временно восстановила только прежний eager import Home. Новый loading test дал точный RED: initial module loads expected0/received1, один failed / один passed. `finally` вернул исходные bytes Home (SHA256 `54a172b4e67d8ef40e4dc8e8f7b3e29ec858cdcdc49d1f2336054a8907046c41`); повтор загрузочного suite дал GREEN2/2. Временные helper/receipts остались ignored.

| Breach (KB, округление штатного guard) | Before | After | Scope |
|---|---:|---:|---|
| quests gzip / brotli | 15.4 / 13 | 15.4 / 13 | existing quests owner, Home не меняет source |
| trips raw / gzip / brotli | 13.1 / 4.8 / 4 | 13.1 / 4.8 / 4 | foreign dirty PublicTripsCatalog/SSR change; не включается в Home commit |
| TravelDetailsSidebarSection gzip | 4 | 4 | existing sidebar owner |
| locale BE / UK / EN raw | 883.2 / 882.3 / 705.1 | 883.2 / 882.3 / 705.1 | existing locale source, Home не меняет строки |
| TOTAL gzip (limit3284.9) | 3321.5 | 3322.1 | already red; aggregate train delta+0.6KB, не Home-exclusive attribution |
| search early requests (count, limit11) | 12 | 12 | already red; clean published a72 содержит13 |

Итого до и после одинаковые11 violations; новых crossings нет. Это не превращает global guard в PASS. Home-owned chunk проходит в обеих сборках: raw75.6→75.7/gzip20.6→20.6/brotli17.5→17.7 KB, все внутри прежних потолков. Own startup edge исключён, ранние Home scripts14→13. По RULES (in-scope validation/ownership) source verdict относится к Home patch и отсутствию новых crossings, а не исправлению чужих baseline flags. TOTAL+0.6KB и Home brotli+0.2KB записаны явно: zero growth не заявляется. Бюджеты, guard и full release report сохраняются; global red не скрывается. Отдельные release receipts на isolated committed SHA обязательны до штатного deploy; source PASS не заменяет release/Done gate.
