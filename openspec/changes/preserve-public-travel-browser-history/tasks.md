## 1. Диагностика и реализация

- [x] 1.1 Проверить контракт #2703, историю семьи и независимый анализ вариантов до кода.
- [x] 1.2 Исправить pinned fullHistory params-dedup и выбрать fullHistory только на web.
- [x] 1.3 Добавить regression настоящего reducer и layout/platform boundary; подтвердить red/green и clean patch apply.
- [x] 1.4 Добавить real-card browser/CDP regression в стандартный production-smoke и запись семьи в Problem Memory.

## 2. Code review

- [x] 2.1 Выполнить узкие unit/static/guards и OpenSpec validation.
- [x] 2.2 Независимый review-auditor review-and-fix, затем отдельный code-review-gate pass по всему task diff.
- [x] 2.3 По разрешённому AGENTS.md пайплайну: commit явных task paths и push main, записать SHA и перевести #2703 в testing.
- [x] 2.4 После RAW03: закрепить actual memory/linking red regression потери state snapshots и исправить подтверждённый общий owner, сохранив первый TabRouter fix и native boundary. RED 7FAIL/6PASS → 13PASS; с прежним router/native suite 25PASS; lint/strict test TS/guards и clean pinned tarball apply/reverse/reapply PASS. Отдельная #2702 lag-гипотеза сохранена без изменения assertions в ignored evidence, её RED не входит в #2703 verdict.
- [ ] 2.5 Source-check и повторные независимые review-auditor/code-review-gate по исправленному train, explicit commit/push и новый штатный выкат до повторной приёмки.

## 3. Testing

- [x] 3.1 Выполнить штатный production deploy через frontend-deployer и проверить exact SHA.
- [ ] 3.2 Desktop/mobile read-only production regression: A/B/C Back/Forward, CDP entries/index/state/timeOrigin, metadata, screenshots, errors/writes0, controls.
- [ ] 3.3 Выполнить existing card-link semantics test локально после обязательного backend sync/ready guard.
- [ ] 3.4 Независимая приёмка Done gate, запись evidence в #2703, финальная OpenSpec validation и archive после всех выполненных tasks.
