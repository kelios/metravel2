# Playwright E2E

`e2e/` содержит browser smoke, regression и performance сценарии. Общие правила,
quality-gate lock и troubleshooting находятся в `docs/TESTING.md`.

## Запуск

Полный поддерживаемый entrypoint:

```bash
yarn e2e
```

Проверка изменившегося scope:

```bash
yarn check:e2e:changed:dry
yarn check:e2e:changed
```

Не запускайте второй Playwright/full gate, если в workspace уже идёт такая
операция. Прямой `playwright test` допустим только через согласованный
quality-gate wrapper или repository script, который уже владеет lock.

## Авторизация

- credentials берутся только из `.env.e2e`;
- session создаёт `e2e/global-setup.ts` и переиспользуют fixtures;
- значения email/password/token не печатаются, не попадают в screenshots,
  traces или committed files;
- authenticated QA выполняется только обратимыми действиями тестового аккаунта.

## Структура

- `fixtures.ts` — общий test fixture и auth/session wiring;
- `global-setup.ts` — программный login/storage state;
- `helpers/` — navigation/API/diagnostic helpers;
- `*.spec.ts` — feature/browser contracts;
- `maestro/` — отдельные device flows, см. `e2e/maestro/README.md`.

Точные spec-файлы и проекты меняются; не поддерживайте вручную список «всех
существующих тестов» в этом README. Для поиска используйте `rg --files e2e`.

## Артефакты

Screenshots, traces, videos и reports должны оставаться в ignored папках
`test-results/`, `playwright-report/`, `.codex-temp/` или `.codex-debug/`.
После фикса перезапустите затронутый сценарий и не оставляйте `.skip`.
