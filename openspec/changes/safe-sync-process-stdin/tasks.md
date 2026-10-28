## 1. Общий механизм

- [x] 1.1 Реализовать файловый stdin и cleanup для spawnSync/execFileSync.
- [x] 1.2 Перевести шесть scripts и runCli, ограничить check-ignore и проверить ошибочные статусы.

## 2. Проверки и приёмка

- [x] 2.1 Добавить реальные unit-процессы и policy-тест scripts/**; выполнить тесты потребителей и lint.
- [x] 2.2 Обновить problem registry только своим фрагментом; пройти независимое code review и code-review-gate.
- [ ] 2.3 Коммит явными путями и push main; testing и стресс 8×150 × 200 КБ на macOS.
- [ ] 2.4 Зафиксировать evidence/Done gate #2844, проверить openspec validate.
