# OpenSpec и Spec-Driven Development в metravel.by

Актуализировано: 2026-08-13. Основная SDD-интеграция — **OpenSpec 1.8.0**,
schema — `spec-driven`, profile — `core`, AI tool — **Codex**.

Этот документ описывает, когда и как использовать Spec-Driven Development (SDD)
в metravel.by. Обязательные технические правила остаются в `docs/RULES.md` и
`AGENTS.md`; OpenSpec их не заменяет, а добавляет версионируемый процесс
согласования изменений.

## 1. Зачем metravel.by нужен SDD

metravel.by — работающий production-проект с реальными пользователями,
проиндексированным контентом и четырьмя активными поверхностями: desktop
web, mobile web, Android и iPhone. Основная цена ошибки здесь не «не
скомпилировалось», а
тихая регрессия: уехавший URL, второй запрос за той же картинкой, разъехавшийся
mobile web/Android/iPhone UX, потерянный `alt` или сломанный редирект.

SDD закрывает четыре повторяющиеся проблемы:

- **Размытый scope.** Non-goals фиксируют границу до первой правки.
- **Непроверяемая приёмка.** Требования и сценарии связываются с конкретными
  командами, URL и наблюдаемым результатом.
- **Требования, придуманные исполнителем.** Поведение согласуется до apply.
- **Потерянный контекст решения.** Proposal, delta specs, design и tasks остаются
  рядом с кодом, а после archive обновляют living specs.

## 2. Когда OpenSpec обязателен

Полный цикл (`proposal` → `specs` → `design` → `tasks` → apply → archive)
обязателен для:

- новых пользовательских функций и экранов;
- изменений API/data-контракта, кодов ошибок, пагинации или формата ответа;
- задач с backend-зависимостью или миграцией БД: OpenSpec фиксирует нужный
  контракт, а backend-работа уходит в `area=back` на MCP task board;
- сложных или повторяющихся багов с неочевидной причиной;
- SEO-чувствительных изменений маршрутов, slug, canonical, sitemap, robots,
  metadata, structured data и prerender/SSG;
- изменений media/image pipeline, hero, галерей, выбора размера, placeholder,
  caching или lazy loading;
- изменений, пересекающих несколько активных платформ или frontend/backend.

Для recurring problem до proposal обязателен history preflight из
`docs/PROBLEM_MEMORY.md`. OpenSpec не заменяет MCP task board: постоянный backlog,
статус, dependencies и Done gate остаются на борде.

## 3. Когда полный change не нужен

Без каталога `openspec/changes/<name>/` допускаются:

- опечатки и грамматические правки;
- небольшая правка существующего текста без нового i18n-контракта;
- замена одной ссылки;
- обычная публикация travel/article content по профильному workflow;
- очевидный локальный CSS-fix без изменения геометрии, layout shift и поведения.

Если изменение может затронуть публичный URL, сетевой запрос, геометрию media,
контракт данных или вторую платформу, нужен полный OpenSpec change независимо от
размера diff.

## 4. Рабочий процесс OpenSpec

OpenSpec CLI выполняется в терминале, а skills вызываются в чате Codex через
`$openspec-*`. Profile `core` устанавливает шесть skills:

| Шаг | Codex skill | Результат |
| --- | --- | --- |
| Исследование | `$openspec-explore` | read-only анализ идеи или проблемы без реализации |
| Планирование | `$openspec-propose` | proposal, delta specs, design и tasks для одного change |
| Уточнение | `$openspec-update-change` | согласованная правка уже существующих artifacts |
| Реализация | `$openspec-apply-change` | выполнение tasks и отметка прогресса |
| Синхронизация | `$openspec-sync-specs` | merge delta specs в `openspec/specs/` без archive |
| Завершение | `$openspec-archive-change` | sync при необходимости и перенос в dated archive |

Порядок работы:

1. Прочитать `AGENTS.md`, `docs/RULES.md`, `docs/CODEX.md`, релевантный feature
   contract и `docs/spec-driven-development-requirements.md`.
2. Для неясной задачи сначала использовать `$openspec-explore`.
3. Создать один change через `$openspec-propose <описание>` и проверить
   proposal, delta specs, design и tasks до реализации.
4. Уточнения вносить через `$openspec-update-change <name>`; не исправлять
   противоречия только в одном artifact.
5. После отдельного запроса на реализацию использовать
   `$openspec-apply-change <name>` и выполнять tasks по порядку.
6. Прогнать все проверки из artifacts и project rules, включая обязательную
   browser/device validation для видимого UI и code-review-and-fix после code
   changes.
7. Валидировать change и только после завершения tasks архивировать его через
   `$openspec-archive-change <name>`.

Быстрые CLI-команды для диагностики:

```bash
openspec list
openspec status --change <name>
openspec validate --all
```

Ничего не коммитится, не пушится, не деплоится и не публикуется без явного
разрешения пользователя.

## 5. Где что лежит

- `openspec/config.yaml` — schema, краткий project context и project-specific
  rules для artifacts/operations.
- `openspec/changes/<name>/` — активный change: `proposal.md`, delta specs,
  `design.md`, `tasks.md`.
- `openspec/specs/<capability>/spec.md` — living specs текущего поведения.
- `openspec/changes/archive/YYYY-MM-DD-<name>/` — завершённые changes.
- `.agents/skills/openspec-*/SKILL.md` — vendor-generated OpenSpec skills для
  Codex; body вручную не редактировать. Текущий Codex compatibility shim удаляет
  только неподдерживаемое поле frontmatter `compatibility`.
- `docs/spec-driven-development-requirements.md` — распределение обязательных
  требований metravel.by по OpenSpec artifacts.

Project rules остаются в `docs/RULES.md`; OpenSpec artifacts не являются вторым
backlog и не заменяют Task Contract на MCP task board.

## 6. Один change — одна логическая задача

Один change описывает одну функцию или один связанный root cause. Несвязанные
проблемы не добавляются «заодно».

- Связанные правки разных frontend-слоёв одной функции — один change.
- Два бага с общим подтверждённым root cause — один change.
- Два соседних симптома без общего root cause — два change.
- Попутный рефакторинг остаётся non-goal или отдельным change.

Имя change — уникальный kebab-case без порядкового номера, например
`fix-search-card-image-cache`. Каталог создаёт только OpenSpec CLI/skill, не
вручную.

## 7. Living specs и archive

Delta spec описывает только изменение: `ADDED`, `MODIFIED`, `REMOVED` или
`RENAMED` requirements. Main spec в `openspec/specs/` описывает уже действующее
поведение и не содержит delta-заголовков.

Перед archive нужно:

1. завершить или явно согласовать все tasks;
2. выполнить validation/Done gate из artifacts и project rules;
3. сравнить delta specs с main specs;
4. синхронизировать их, если change меняет living behavior;
5. выполнить `openspec validate --all`.

Archive не доказывает production rollout. Если target — production, статус
«исправлено на проде» требует реального post-deploy evidence по
`docs/RULES.md`.

## 8. Обслуживание OpenSpec

CLI устанавливается глобально и не входит в runtime-зависимости приложения:

```bash
npm install -g @fission-ai/openspec@1.8.0
openspec --version
```

После обновления CLI vendor-generated skills обновляются из корня репозитория:

```bash
npm install -g @fission-ai/openspec@<reviewed-version>
openspec update
openspec validate --all
```

До установки новой версии сверить changelog; после принятия обновить
закреплённую версию в этом документе. После `openspec update` обязательно
прогнать Codex skill validator для всех `.agents/skills/openspec-*`; OpenSpec
1.8.0 повторно добавляет
неподдерживаемое поле `compatibility`, которое нужно удалить до handoff.
Project-specific правила хранятся только в `openspec/config.yaml` и canonical
docs, а не в generated skills.

## 9. Legacy Spec Kit

Предыдущая интеграция Spec Kit 0.16.0 сохранена только для чтения истории:
`.specify/`, `.github/skills/speckit-*` и черновик
`specs/001-search-card-image-loading/`. Новые specifications там не создаются,
а существующий draft не считается автоматически перенесённым в OpenSpec.

Если работа по legacy draft возобновится, сначала создать новый OpenSpec change,
перенести в него только актуальные подтверждённые требования и оставить ссылку
на прежний draft как provenance. Удаление legacy tooling выполняется отдельной
явно согласованной cleanup-задачей.
