---
description: Полная preflight-проверка перед push
allowed-tools: Bash(npm run check:preflight), Bash(git status:*), Bash(git log:*)
---

Прогон `npm run check:preflight` — эквивалент pre-push хука.

1. `git status` — убедись, что working tree чистый.
2. `npm run check:preflight` — lint + typecheck + tests + smoke.
3. Если упало — пофикси root cause, не заглушай. Не используй `--no-verify` для обхода.

По завершении кратко отчитайся: что прошло, что упало, что починил.
