## Context

См. proposal.md и #2703. Подтверждённый source-механизм expo-router57.0.28: `global-state/getNavigationAction.js:45–46` превращает PUSH таба в NAVIGATE; `react-navigation/routers/TabRouter.js:201–204` оставляет ключ при отсутствии getId; `changeIndex:62–86` не сохраняет предыдущие params при history. `fork/useLinking.js:323–359` видит historyDelta0 и вызывает replace. Это source-цепочка; callback старого production bundle не захвачен и не выдаётся за runtime stack.

Независимый travel-expert до кода провёл анализ контракта, UX и архитектуры. Вызов настоящего pinned reducer подтвердил дефект и варианты исправления без runtime QA.

## Goals / Non-Goals

См. proposal.md. Граница реализации — web tabs history; сохранить прежние ключи/жизненный цикл экранов и native history. Не менять callsites карточек и back helpers.

## Decisions

1. На web использовать существующий `fullHistory`, на Android/iOS оставить `history` в `app/(tabs)/_layout.tsx`. Этот режим уже хранит params на каждой записи и восстанавливает их в GO_BACK.
2. Воспроизводимым `patches/expo-router+57.0.28.patch` исправить fullHistory дедуп: удалить последнюю запись только при совпадении key **и** глубоком равенстве params; начальная запись тоже хранит params. Использовать уже установленный `fast-deep-equal` (зависимость Expo Router). В том же режиме REPLACE заменяет последнее посещение: штатная ветка ошибочно удаляет запись по индексу таба, что после A/B/C сохраняет C вместо исходного search. При REPLACE всегда меняется navigator key, чтобы linking сделал replace даже для таба0. Native ветка REPLACE сохранена. JS — исполняемый источник; source map не подделывается. Postinstall уже применяет patch-package с error-on-fail.
3. Отвергнуты: getId/dangerouslySingular с history (старые ключи исчезают из routes, GO_BACK возвращает null); fullHistory без исправления (same key заменяется независимо от params); ручной pushState (рассинхронизирует владельцев истории); nested Stack/UNSTABLE_router (меняет дерево маршрутов либо дублирует алгоритм владельца).
4. Unit проверяет настоящий pinned TabRouter через проектную конфигурацию: A/B/C, same-current, GO_BACK, params, native-контроль. Browser regression использует реальные near cards и CDP entries в штатном production-smoke пути.

## Boundaries and impact

Task-owned: tabs layout, pinned patch, unit/integration и e2e regression, строка production-smoke selection, Problem Memory, этот OpenSpec change. API/DTO/auth остаются прежними, writes=0. Обработку ошибок и offline UI не меняем, потому отдельные offline/error сценарии неприменимы.

SEO: реальные hydrated title/canonical/main/OG/Twitter descriptions после Back/Forward сравниваются с исходными snapshots. URL/SSG/robots/sitemap/renderer не меняются. Accessibility: существующие anchors и keyboard/modifier/middle semantics сохраняются. Media/performance: геометрия и URL ресурсов не меняются, документ/timeOrigin сохраняются; полная история намеренно растёт с переходами. Security/sanitization/auth/analytics schemas не затронуты.

## Risks / Trade-offs

- Полная web-история сохраняет повторные посещения разных табов → это browser-семантика, проверяется cross-tab и каталогом.
- Привязка patch к57.0.28 → чистая проверка apply, postinstall error-on-fail и integration tests защищают обновление.
- Непредсказуемые production рекомендации → выбирать C из настоящих карточек, исключая A/B; не вставлять тестовые ссылки.
- #2702 не считается закрытой этим изменением; отдельный editor runtime не входит.

## Migration Plan

Миграции данных нет. После review-auditor и code-review-gate: явные task paths commit/push main → testing → frontend-deployer штатным deploy-prod.sh → exact SHA и browser acceptance → done. Это разрешено прямым поручением #2703 и AGENTS.md. Откат — только task commit штатным rollout; backend и контент неизменны.

## Validation matrix

| Surface | До review/testing | В testing после deploy |
|---|---|---|
| Desktop1440×900, guestRU | pinned reducer, layout/platform tests, lint/typecheck/guards | real A480→B672→C, Back/Forward, direct/same-current, cross-tab/catalog, modifier/middle, CDP history/state IDs/timeOrigin, metadata, screenshots, errors/writes0 |
| Mobile390×844, touch/DPR3, guestRU | те же static/unit | та же история и controls; реальный app Back при доступности, screenshots/errors/writes0 |
| Android/iOS | layout props остаются history, reducer native control | device gate отсутствует: native-specific runtime не меняется |
| RU/BE/UK/PL/EN | localization impact none, новых строк нет | новая языковая матрица не требуется |

Новый тест включён в `PRODUCTION_SMOKE_SPECS`, стандартный smoke путь. Текущий `travel-card-link-semantics.spec.ts` дополнительно выполняется локально в testing с живым local backend после обязательного sync. Ни browser, ни API QA не запускаются в code review.
