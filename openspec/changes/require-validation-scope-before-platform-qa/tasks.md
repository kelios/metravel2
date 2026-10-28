## 1. Подтверждение механизма и контракт

- [x] 1.1 Проверить canonical skills/roles/adapters и отличить активные причины #2829 от латентных конфликтов.
- [x] 1.2 Согласовать один selection gate с независимым архитектором и зафиксировать сценарии, риск и откат.
- [x] 1.3 Добавить canonical gate в TESTING и согласовать board/router/OpenSpec context.

## 2. Refactor источников

- [x] 2.1 Удалить blanket native-требования и квалифицировать старый Task Contract в затронутых skills.
- [x] 2.2 Исправить producers/executors role prompts и минимальные adapters до native readiness.
- [x] 2.3 Добавить проверку instruction drift и mutation regression fixtures в существующий prompt audit.
- [x] 2.4 Синхронизировать generated skill/agent mirrors из canonical sources.

## 3. Проверка и handoff

- [x] 3.1 Выполнить focused guard regressions, audit:prompts и валидаторы каждого изменённого skill в согласованном quality окне.
- [x] 3.2 Независимо проверить весь task diff и смысловую матрицу шести сценариев; устранить находки.
- [x] 3.3 Повторить только инвалидированные source checks и strict OpenSpec validation; записать итог без app/runtime/deploy прогонов.

Итог: 36 Node tests PASS, 0 fail/skip; audit:prompts PASS; 9 canonical skill
validators PASS; generated mirrors PASS; OpenSpec strict PASS. Independent
review-and-fix PASS после устранения дополнительного blanket web-требования.
Проверки выполнялись после финальных source fixes; повтор без инвалидирования
не запускался. Статический guard ограничен известным instruction drift.
