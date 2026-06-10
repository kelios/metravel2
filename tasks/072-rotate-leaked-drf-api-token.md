# TASK-20260610-072: Ротация утёкшего DRF API-токена (закоммичен в settings.local.json)

Status: Backlog
Owner: Owner
Support: Backend
Created: 2026-06-10
Updated: 2026-06-10

## Goal

Отозвать и перевыпустить DRF-токен `689350095df6f652fccac854a0f52c27820fb21f`, который попал в git-историю публичного репозитория metravel2.

## Context

Токен был захардкожен в curl-permissions внутри `.claude/settings.local.json`, а сам файл был закоммичен и запушен на GitHub (kelios/metravel2, коммит 5fd5f0c4 и ранее). Токен считается утёкшим: даже после удаления из рабочего дерева он остаётся в git-истории.

2026-06-10 файл вычищен (токен удалён), снят с git-трекинга (`git rm --cached`) и добавлен в `.gitignore`. Осталась ротация на стороне бэкенда.

## Acceptance Criteria

- [ ] Старый токен `6893...b21f` отозван (удалена строка в `authtoken_token` / через админку DRF).
- [ ] Проверено: запрос с старым токеном возвращает 401.
- [ ] Пользователь, которому принадлежал токен, получил новый токен (повторный логин).
- [ ] (Опционально) История git очищена от токена или принято решение оставить (токен мёртв после ротации).

## Assignment

Primary owner: Owner (Sergey/Codex — бэкенд)
Support agents: backend-expert (диагностика при необходимости)

## Likely Files Or Areas

- БД бэкенда: таблица `authtoken_token` (DRF TokenAuthentication)

## Plan

1. Определить владельца токена: `SELECT user_id FROM authtoken_token WHERE key='6893...'`.
2. Удалить токен (Django admin или shell: `Token.objects.filter(key='...').delete()`).
3. Проверить 401 со старым токеном: `curl -H "Authorization: Token 6893..." https://metravel.by/api/...`.

## Validation

`curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Token <старый>" https://metravel.by/api/travels/517/` → 401.

## Release Checklist

- [ ] Changed files are listed in `## Results`.
- [ ] New files created by this task are identified.
- [ ] Generated/cache/secret/local files are excluded.
- [ ] Task-scope files are staged when the user asks to prepare git.
- [ ] Skipped files and release blockers are recorded.

## Progress Log

- 2026-06-10: Created. Файл settings.local.json вычищен, снят с трекинга, добавлен в .gitignore (фронт-репо).

## Results

Changed files:

Validation evidence:

Reviewer findings:

Release notes:

Blockers:
