# MeTravel в GitHub Copilot

Если `AGENTS.md` ещё не загружен, прочитай его в корне проекта. В нём определены границы работы, выбор проверок и порядок ревью. Для конкретной задачи открой нужный раздел `docs/CODEX.md` и документ затронутой функции.

## Скилы для GitHub Copilot

- `$metravel-feature-builder` — фичи, багфиксы, рефакторинг, API, services, SEO.
- `$metravel-hook-builder` — вынос и проектирование focused hooks, упрощение компонентов через локальную hook-логику, работа с `hooks/` без новых `any`.
- `$metravel-ui-guardrails` — видимый UI, media, placeholders, icons, tokens, external links.
- `$metravel-i18n-guardrails` — UI copy, RU/BE/UK/PL/EN resources, locale
  state/storage, Intl/plurals, accessibility, SEO locale и web/native lifecycle.
- `$metravel-quality-fixer` — полный цикл lint + Jest + Playwright, исправление падений и повторная валидация до зелёного baseline.
- `$metravel-test-runner` — выбор и запуск минимально достаточных Jest/integration/governance checks.
- `$metravel-test-writer` — написание/обновление unit, integration и governance тестов без `.skip`.
- `$metravel-e2e-runner` — Playwright, browser smoke, trace/screenshot evidence, `.env.e2e`.
- `$metravel-performance-analyst` — Lighthouse, bundle/perf budgets, baseline comparison только по production build или real URL.
- `$metravel-code-reviewer` — review diff, поиск рисков, проверка project-rule compliance и validation gaps перед handoff.

Актуальные копии скилов для Copilot находятся в `.github/skills/`. Источники и порядок синхронизации описаны в `docs/CODEX_SKILLS.md`.

Для изменений в `scripts/` действуют полномочия задачи и правила `docs/RULES.md` → «Development workflow». Для проверки UI до ревью доступны статические и модульные проверки. Браузерная приёмка выполняется на стадии `testing` по `docs/TESTING.md`.
