# Git hooks

Установка: `npm run hooks:install` — устанавливает `core.hooksPath=githooks`.
Проверить установку: `git config core.hooksPath` (должно вывести `githooks`).

## Хуки

- `pre-commit` → `npm run check:fast` (selective: lint+typecheck+tests только по изменённому scope, `scripts/run-fast-scope-checks.js`).
- `pre-push` → `npm run check:preflight -- --base-ref <upstream>` (`scripts/run-preflight-checks.js`).

## Байпас

`SKIP_HOOKS=1 git commit ...` пока не поддерживается — если нужен байпас, используй `git commit --no-verify` только в экстренных случаях.
