## 1. Подтверждение и контракт

- [x] 1.1 Замерить API и холодный SSR при 4/8/12, подтвердить reused ECONNRESET и исключить недоказанное повышение timeout.
- [x] 1.2 Проверить архитектуру, границы платформ и создать backend-зависимость #2819 на finalized rollback.

## 2. Реализация

- [x] 2.1 Реализовать Bounded recovery: один fresh GET после reused reset до ответа, прежний signal и дедлайн.
- [x] 2.2 Покрыть recovery и Genuine failures remain visible реальными HTTP socket regressions и существующими loader checks.
- [x] 2.3 Записать подтверждённую семью и постоянный контроль в Problem Memory.
- [ ] 2.4 Выполнить targeted Jest/static checks, независимый review-and-fix и code-review-gate полного task diff.

## 3. Testing на проде

- [ ] 3.1 По разрешённому AGENTS.md пайплайну зафиксировать явные пути, push main и выкатить reviewed SHA штатным frontend-deployer.
- [ ] 3.2 Подтвердить deployed SHA, повторить direct renderer 4/8/12 без nginx cache и full post-deploy SEO scan: 0x503; 429 учитывать отдельно.
- [ ] 3.3 Зафиксировать frontend evidence на #2818 и точный оставшийся backend gate #2819; не объявлять полный Done до его production drill.
- [ ] 3.4 Выполнить OpenSpec strict validation и проверить итоговый diff; перед archive — openspec validate --all.
