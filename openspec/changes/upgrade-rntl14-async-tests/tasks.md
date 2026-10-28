## 1. Подготовка

- [x] 1.1 Проверить peer/engine матрицу RNTL 14.1.0, test-renderer 1.3.1 и текущих React/RN/Jest/Node.
- [x] 1.2 Зафиксировать инвентарь imports, helpers, удалённых API и createNodeMock; выбрать source-level проверки без device QA.
- [x] 1.3 Завершить независимую проверку плана и согласовать одно dependency/quality окно с владельцем #2738.

## 2. Миграция

- [x] 2.1 Обновить зависимости и lock, убрать прямые old renderer/types/jest-native; сохранить остальные runtime selectors и canonical patches.
- [x] 2.2 Перевести стандартные RNTL вызовы официальным codemod, затем вручную обработать локальные helpers и callbacks.
- [x] 2.3 Перевести direct renderer consumers на createRoot/act/container и host queries без приватного fiber.
- [x] 2.4 Мигрировать удалённые запросы/опции и ref mocks, сохраняя каждое смысловое утверждение и негативный сценарий.
- [x] 2.5 Удалить устаревший глобальный formatter и jest-native setup, проверить встроенные matchers и async cleanup.

## 3. Проверки и завершение

- [x] 3.1 Прогнать целевые группы изменённых тестов, исправить подтверждённые migration failures без skip/allowlist/снижения ожиданий.
- [ ] 3.2 Получить полный Jest: 0 failed, 0 skipped; lint и expo install --check; проверить отсутствие прямых imports старого renderer.
- [ ] 3.3 Пройти независимый review-and-fix и code-review-gate, включая проверку сохранения бизнес-assertions.
- [ ] 3.4 По авторизованному task workflow закоммитить явные task paths, push main, записать sha и выполнить релевантную приёмку; не дублировать известный красный общий deploy.
- [ ] 3.5 Валидировать и архивировать OpenSpec после полного исполнения in-scope Done gate.
