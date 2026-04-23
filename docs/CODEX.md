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
