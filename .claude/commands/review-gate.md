---
description: Код-ревью гейт перед `testing`: агент code-review-gate читает diff готовой задачи, ищет дубли/неоптимальность/противоречия правилам и либо пропускает тикет в `testing`, либо возвращает в `in_progress` с findings. Аргумент — id тикета на борде (или пусто = текущий diff без борда).
---

Запусти субагента **code-review-gate** (`Agent` tool, `subagent_type: "code-review-gate"`) для
приёмочного ревью перед QA.

`$ARGUMENTS`:
- число / `[FE-…]` — id тикета на борде: агент возьмёт `Task Contract`, отревьюит diff и сам
  подвинет статус (`testing` при `pass`, `in_progress` + findings при `changes_requested`);
- пусто — ревью текущего diff (`git diff origin/main` + untracked) без записи вердикта и без борда.

Передай агенту в промпте: id тикета, scope изменений (файлы/фича), platform impact и то, что
уже проверялось. Порог возврата: любой P1/P2 → `changes_requested`; только P3 → `pass`.

Проверить состояние гейта по тикету можно напрямую:

```bash
node .claude/hooks/review-gate.mjs show --task <id>
```

Гейт принудительный: PreToolUse hook `.claude/hooks/review-gate.mjs` блокирует
`metravel_task_update(status="testing")`, пока для тикета нет свежего вердикта `pass`, поэтому
вручную «протащить» задачу в QA мимо ревью нельзя (аварийный обход — только
`REVIEW_GATE_BYPASS=1`, и он попадает в лог сессии).

Аргументы: `$ARGUMENTS`
