# Codex workflow

Этот файл связывает корневые инструкции, проектную документацию и skills Codex.

## Источники правил

- `AGENTS.md` - короткий обязательный чеклист для любого AI-агента.
- `docs/RULES.md` - основной источник проектных правил.
- `docs/README.md` - карта документации и API-справка.
- `.codex/skills/*/SKILL.md` - специализированные рабочие маршруты Codex.

## Как выбирать skill

- `$metravel-feature-builder`: используй для фич, багфиксов, рефакторинга, API-логики, hooks, services и SEO.
- `$metravel-ui-guardrails`: добавляй при любых видимых UI-изменениях, работе с media, icons, placeholders, tokens или external links.
- `$metravel-release-checks`: используй при выборе проверок, подготовке PR, release/deploy и production web validation.
- `$metravel-docs-maintainer`: используй при изменении `docs/`, `AGENTS.md`, `.codex/skills` или правил работы Codex.

Подключай только те skills, которые реально нужны задаче. Если skill требует дополнительные docs, читай только релевантные файлы.

## Быстрый triage задачи

Перед чтением большого контекста определи тип задачи и риск:

| Тип задачи | Минимальный контекст | Обязательные акценты |
| --- | --- | --- |
| Feature, bugfix, refactor | `AGENTS.md`, `docs/RULES.md`, `docs/README.md`, профильный feature-doc при наличии | переиспользование существующих компонентов, hooks, utils; минимальный diff |
| Видимый UI, media, icons, tokens | всё из feature-контекста + `$metravel-ui-guardrails` | проверка в браузере на web, screenshot, отсутствие новых console errors |
| External links | `docs/RULES.md`, `docs/TESTING.md`, `utils/externalLinks.ts` | никаких direct `window.open(...)` и `Linking.openURL(...)` вне chokepoint |
| SEO / route pages | `docs/DEVELOPMENT.md` SEO-раздел | `buildCanonicalUrl`, `buildOgImageUrl`, `LazyInstantSEO` |
| Release / deploy / performance | `docs/RELEASE.md`, `docs/PRODUCTION_CHECKLIST.md`, `$metravel-release-checks` | production build/export, реальные URL для post-deploy проверок |
| Docs / skills | `AGENTS.md`, `docs/RULES.md`, `docs/README.md`, этот файл | обновляй существующие canonical docs, не создавай одноразовые отчеты |

Если задача затрагивает несколько строк таблицы, бери объединение контекста, но не загружай справки, которые не помогают текущему решению.

## Рабочий цикл AI-инженера

1. Сначала зафиксируй scope: какие user-facing сценарии, файлы и project rules могут быть затронуты.
2. Найди существующий путь реализации через поиск по компонентам, hooks, services, utils и тестам.
3. Перед правкой проверь `git status --short`; чужие изменения не откатывай и не смешивай с задачей без необходимости.
4. Вноси маленький diff, который решает задачу без побочных рефакторингов.
5. После законченного логического блока запускай scope-проверку.
6. В финале перечисли измененные файлы, выполненные проверки и любые остаточные риски.

Полезный шаблон для внутреннего self-check перед кодом:

```text
Тип задачи:
Skills:
Прочитанные docs:
Вероятные файлы:
Риск-зона:
Проверки:
Нужна UI/browser проверка:
Затронуты external links:
```

## Матрица проверок

Выбирай самый узкий надежный набор проверок, который покрывает изменение:

| Scope изменения | Рекомендуемая проверка |
| --- | --- |
| Docs-only без изменения команд/политик | структурно перечитать затронутые Markdown/YAML файлы |
| Малый законченный блок кода | `npm run check:fast` |
| Нужно понять scope без запуска | `npm run check:fast:dry` или `npm run check:changed:dry` |
| Среднее изменение перед PR | `npm run check:preflight` |
| Изменения в web UI | relevant targeted checks + browser preview + screenshot + console check |
| External-link policy | `npm run guard:external-links` или `npm run governance:verify` |
| Крупное или сквозное изменение | `npm run lint` и `npm run test:run` |
| Release/performance | `npm run build:web:prod` + релевантные Lighthouse/performance scripts из `docs/RULES.md` |

Для e2e-авторизации используй `.env.e2e`, если значения уже заданы, и никогда не выводи секреты.

## Быстрая карта поиска

- Routes/pages: `app/`, `screens/`.
- Reusable UI: `components/ui`, затем feature-компоненты в `components/`.
- Business logic: `hooks/`, `services/`, `api/`, `utils/`.
- Design tokens: `constants/designSystem.ts`, web CSS variables in `app/global.css`.
- External navigation chokepoint: `utils/externalLinks.ts`.
- Tests: `__tests__/` for Jest, `e2e/` for Playwright.
- Governance scripts: `scripts/`, command details in `docs/TESTING.md`.
- Feature maps: `docs/features/`.

## Кодировка документации

Документация хранится в UTF-8. Если PowerShell показывает кириллицу как `Ð...`/`Ñ...`, сначала перечитай файл с `Get-Content -Encoding UTF8`; не переписывай файл только из-за некорректного отображения консоли.

## Правила обновления skills

- Каждый skill хранится в `.codex/skills/<skill-name>/`.
- Обязательный файл: `SKILL.md` с YAML frontmatter `name` и `description`.
- Рекомендуемый UI metadata-файл: `agents/openai.yaml`.
- Не добавляй README/CHANGELOG внутри папки skill: инструкции должны быть в `SKILL.md`, а длинные справки - в `references/` только при реальной необходимости.
- Описывай в `description`, когда skill должен срабатывать. Тело `SKILL.md` должно быть коротким и операционным.
- После изменения skill проверяй структуру валидатором `skill-creator`, если он доступен.

## Правила обновления документации

- Сначала обновляй существующие канонические файлы: `docs/RULES.md`, `docs/README.md`, `docs/DEVELOPMENT.md`, `docs/TESTING.md`, `docs/RELEASE.md`.
- Новый документ добавляй только если существующий файл станет слишком шумным или тема действительно самостоятельная.
- После добавления нового документа обнови `docs/INDEX.md`.
- Не создавай одноразовые отчеты без необходимости.

## Завершение задачи

- Для docs-only и skill-only изменений достаточно структурной проверки затронутых markdown/yaml файлов.
- Если правила затронули команды проверки, external links, release или UI contracts, дополнительно сверяйся с `docs/RULES.md` и запускай релевантные проверки.
