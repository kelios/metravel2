# TASK-20260610-073: Усилить хранение auth-токена на web (XOR со статичным ключом)

Status: Backlog
Owner: Frontend
Support: Reviewer, Tester
Created: 2026-06-10
Updated: 2026-06-10

## Goal

Заменить XOR-«шифрование» auth-токена в localStorage со статичным ключом на
схему, которую нельзя тривиально расшифровать из DevTools, не разлогинив при
этом существующих пользователей.

## Context

Security-ревью 2026-06-10 (skill `/review-security`). `utils/secureStorage.ts`
хранит токен в localStorage, «шифруя» его XOR-шифром с захардкоженной константой
`ENCRYPTION_KEY = 'metravel_encryption_key_v1'` (одинаковой для всех). Это
обфускация, а не шифрование: атакующий с доступом к localStorage/DevTools
расшифровывает токен известным ключом и угоняет сессию. Комментарий в коде уже
признаёт непригодность для прод.

Риск изменения: смена схемы инвалидирует уже сохранённые токены → массовый
разлогин. Нужна обратная совместимость (миграция при чтении) либо осознанный
разлогин с уведомлением.

Source task:

- Source id: review-security 2026-06-10
- Source path: (этот сеанс ревью)

## Acceptance Criteria

- [ ] Токен в localStorage нельзя расшифровать без значения, недоступного из
      статического кода фронтенда (per-user серверный секрет / Web Crypto с
      несохраняемым ключом / переход на sessionStorage).
- [ ] Существующие пользователи не разлогинены массово: чтение старого формата
      либо мигрирует, либо контролируемо завершает сессию с понятным UX.
- [ ] Токен не попадает в логи (grep по `console.*` рядом с token/secret чист).
- [ ] Регрессионный тест на сохранение/чтение/инвалидацию токена.

## Gherkin Tests

```gherkin
Feature: Secure web token storage

  Scenario: Token is not trivially recoverable from localStorage
    Given a logged-in user on web
    When an attacker reads the raw localStorage value with the public source code
    Then the plaintext auth token cannot be reconstructed without a non-static secret

  Scenario: Existing sessions survive the migration
    Given a user with a token stored in the previous XOR format
    When the app loads after the storage change ships
    Then the user is either silently migrated or cleanly informed, not left in a broken state
```

## Assignment

Primary owner: Frontend
Support agents: Reviewer, Tester

## Likely Files Or Areas

- `utils/secureStorage.ts`
- `context/` (auth context, потребитель токена)
- `api/` (где токен подставляется в `Authorization: Token <...>`)

## Plan

1. Выбрать схему: (a) per-user секрет, выдаваемый бэком при логине, в
   sessionStorage; (b) Web Crypto (PBKDF2 + AES-GCM) с ключом, не сохраняемым в
   постоянное хранилище; (c) перенос токена в sessionStorage (волатильно).
   Если нужен серверный секрет — отдельный TASK Owner: Backend.
2. Реализовать миграцию: при чтении старого формата — переупаковать или
   контролируемо завершить сессию.
3. Тесты: сохранение/чтение/миграция/инвалидация; проверка отсутствия токена в логах.

## Validation

`npm run typecheck`, целевые Jest по secureStorage/auth, ручная проверка
логин→reload→logout на web в preview.

## Release Checklist

- [ ] Changed files are listed in `## Results`.
- [ ] New files created by this task are identified.
- [ ] Generated/cache/secret/local files are excluded.
- [ ] Task-scope files are staged when the user asks to prepare git.
- [ ] Skipped files and release blockers are recorded.

## Progress Log

- 2026-06-10: Created из security-ревью (P2).

## Results

Changed files:

Validation evidence:

Reviewer findings:

Release notes:

Blockers:
