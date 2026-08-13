# Обязательные требования к OpenSpec artifacts metravel.by

Актуализировано: 2026-08-13. Дополняет `docs/spec-driven-development.md` и
`openspec/config.yaml`.

## Почему требования распределены по artifacts

OpenSpec разделяет intent, observable behavior, implementation design и work
breakdown между `proposal.md`, delta specs, `design.md` и `tasks.md`. Поэтому
проектные требования не копируются целиком в каждый файл: каждое решение имеет
один канонический artifact, а связанные artifacts остаются согласованными.

Vendor-generated body `.agents/skills/openspec-*` и built-in templates вручную
не редактируются. Единственный текущий compatibility shim — удаление
неподдерживаемого Codex-полем frontmatter `compatibility` после генерации.
Короткие обязательные ограничения инжектируются через `openspec/config.yaml`,
подробный contract живёт здесь.

## Proposal: зачем и где границы

`proposal.md` обязан зафиксировать:

- **Problem** — наблюдаемый факт или воспроизведение, а не предполагаемое решение;
- **Goal** — проверяемое целевое состояние;
- **User-visible result** — что изменится для пользователя;
- **Platform impact** — `desktop web | mobile web | Android | iOS | shared | none`;
- **Localization impact** — `all current locales | selected locales | none`;
- **Dependencies** — API/backend/owner/external dependencies и точный blocker;
- **Fallback/mock policy** — допустим ли fallback; missing backend contract не
  маскируется mock-only поведением;
- **Impact summary** — data/API, SEO, accessibility, performance, security и
  analytics; для неприменимого пункта указывается причина;
- **Existing behavior to preserve** — ключевые соседние сценарии без изменений;
- **Out of scope / Non-goals** — содержательный список, не пустой placeholder;
- **Open questions** — вопросы, которые материально меняют scope или acceptance.

Один proposal описывает один change. Нерешённый материальный вопрос блокирует
переход к apply, но не требует угадывать ответ.

## Delta specs: наблюдаемое поведение

Каждый `openspec/changes/<name>/specs/<capability>/spec.md` обязан:

- использовать только OpenSpec delta sections: `ADDED`, `MODIFIED`, `REMOVED`
  и `RENAMED Requirements`;
- описывать одну capability на один spec path;
- формулировать requirement через `SHALL` или `MUST`;
- содержать минимум один независимо проверяемый scenario на изменяемое
  requirement;
- использовать `WHEN` / `THEN`, а `GIVEN` добавлять для существенного precondition;
- включать success, error/empty/offline/slow-network scenarios, когда они
  относятся к capability;
- сохранять действующие scenarios, которые change не отменяет;
- не упоминать файлы, компоненты, hooks, библиотеки или конкретную реализацию.

Acceptance считается проверяемым, только если scenario можно закрыть командой,
URL/API probe, browser/device observation или измеримым budget. Формулировки
«работает корректно», «быстро» и «удобно» без метрики недопустимы.

## Design: как реализовать безопасно

`design.md` обязан содержать только применимые разделы и явно отмечать
неприменимые риск-зоны:

- существующие компоненты, hooks, services, adapters и utilities для reuse;
- затронутые frontend paths и ownership boundaries;
- data/API contract, auth/platform split и error handling;
- технические решения и отклонённые альтернативы с причинами;
- migration, compatibility, rollback/recovery strategy;
- SEO: URL, canonical, redirect, sitemap/robots, metadata, structured data,
  prerender/SSG;
- accessibility: semantics, focus, keyboard, `alt`, contrast, headings и touch
  targets;
- performance: Core Web Vitals, requests/bytes, one-slot-one-URL, media geometry,
  bundle impact и источник baseline;
- security: input validation, sanitization, URL/redirect safety, tokens/secrets,
  WebView/deep-link boundaries;
- analytics: события, параметры, цели и допустимые удаления;
- validation matrix для каждого impacted platform/locale и соседних consumers.

Backend/Django/server design из этого workspace остаётся read-only dependency и
маршрутизируется в `area=back`; `../metravel-backend` не включается в список
редактируемых paths.

Любое изменение в `components/travel/sliderParts/**`,
`components/travel/details/**`, `ImageCardMedia` или hero geometry включает
`yarn verify:slider` и `yarn verify:slider-perf` в validation plan.

## Tasks: проверяемая реализация

`tasks.md` обязан:

- разбивать работу на небольшие упорядоченные шаги с конкретным результатом;
- связывать implementation tasks с requirements/scenarios;
- включать тесты на ближайшем надёжном уровне без `.skip`;
- включать browser evidence для desktop/mobile web, USB Android evidence и
  iPhone simulator/physical/TestFlight layer по риску видимого shared/mobile UI;
- включать i18n validation для localization impact;
- включать соседние consumer/regression probes для shared changes;
- включать обязательный code-review-and-fix после code changes;
- включать `openspec validate --all` перед archive;
- не включать commit, push, deploy, publish или board state change без явного
  разрешения пользователя.

Performance/production task закрывается только real before/after evidence по
правилам `docs/RULES.md`; локальный build не заменяет post-deploy probe.

## Чеклист перед apply

- [ ] Все обязательные artifacts из `openspec status --change <name>` готовы.
- [ ] Proposal содержит impacts, dependencies, fallback policy и non-goals.
- [ ] Delta specs валидны и описывают observable behavior.
- [ ] Design опирается на существующую реализацию и содержит validation matrix.
- [ ] Tasks покрывают requirements, regression, review и Done gate.
- [ ] Нет нерешённых вопросов, которые материально меняют scope или behavior.
- [ ] Change описывает одну логическую задачу.
- [ ] `openspec validate <name> --type change --strict` проходит.
