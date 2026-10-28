## 1. Общий механизм

- [x] 1.1 Реализовать файловый stdin и cleanup для spawnSync/execFileSync.
- [x] 1.2 Перевести шесть scripts и runCli, ограничить check-ignore и проверить ошибочные статусы.

## 2. Проверки и приёмка

- [x] 2.1 Добавить реальные unit-процессы и policy-тест scripts/**; выполнить тесты потребителей и lint.
- [x] 2.2 Обновить problem registry только своим фрагментом; пройти независимое code review и code-review-gate.
- [x] 2.3 Коммит явными путями и push main; testing и стресс 8×150 × 200 КБ на macOS.
- [x] 2.4 Зафиксировать evidence/Done gate #2844, проверить openspec validate.

Итог 28.10.2026: commit 1828c402d в origin/main, два независимых code-review pass; 14 suites / 430 tests / 0 skipped, scoped lint и precommit check:fast зелёные. Стресс на macOS Node22: 1200/1200 запусков по200000байт, 0 ошибок/зависаний; сырые evidence .codex-temp/task2844/final-targeted.json и stress.json, постоянная запись — карточка #2844. Web/app bundle не затронут, деплой не нужен.
