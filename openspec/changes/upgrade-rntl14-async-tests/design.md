## Context

См. proposal.md. Инвентарь на 28.10.2026: 785 файлов используют RNTL, около 50 имеют runtime/type imports старого renderer; остальные совпадения — комментарии. Jest setup глобально подключает jest-native и старый compactTestInstanceFormat. Общего renderWithProviders нет: обнаружены локальные renderWith* helpers. Новая host-only модель не предоставляет composite findByType/instance и createNodeMock.

## Goals / Non-Goals

**Goals:** перевести реальных consumers на async API и сохранить бизнес-утверждения и негативные сценарии; полностью убрать прямые imports/dependencies старого renderer; получить полный зелёный Jest без skip.

**Non-Goals:** sync-адаптер поверх RNTL, восстановление composite queries через приватный fiber, изменение production компонентов ради теста, device/build/store проверки, исправление чужого bundle-budget gate.

## Decisions

1. RNTL 14.1.0 + test-renderer 1.3.1 для React 19.3. Jest Expo уже использует совместимую линию test-renderer. Остальные зависимости и runtime selectors сохраняются; одновременное удержание старого renderer отвергнуто как незавершённая миграция.
2. Стандартные async вызовы мигрируются официальным AST codemod; helpers, вложенные callbacks, renamed imports и renderer methods проверяются вручную. Безусловная regex-вставка await отвергнута: она ломает синхронные DOM render и порядок таймеров.
3. Новый renderer/host queries используются напрямую. Старые composite assertions переводятся на host-поведение или существующую mock-границу. Для createNodeMock — forwardRef/useImperativeHandle в тестовом mock; удалять проверку imperative поведения нельзя.
4. Глобальное подключение jest-native заменяется встроенными matchers RNTL. Старый helper прототипа ReactTestInstance удаляется, если native toJSON нового TestInstance уже закрывает его назначение; второй formatter не создаётся.
5. Изменения выполняются пакетами непересекающихся файлов после единственного общего codemod; package/lock/setup остаются у основной сессии. Чужие dirty пути и работающие quality/build процессы сохраняются.

## Risks / Trade-offs

- Async act может скрыть короткий pending state → удерживать promise и проверять состояние до его разрешения, затем отдельно ждать commit; не снимать assertion.
- Synthetic events теперь содержат defaults → проверять значимые поля через objectContaining, сохраняя обязательные аргументы.
- Hidden/accessibility/text validation меняет модель → исправлять тестовый mock/selector по контракту, не расширять глобальные suppressions и не менять product код автоматически.
- Потеря patches при установке → последний install только canonical frozen с обычным postinstall; перед Jest проверить RN/Jest window guard.
- Большой diff → целевые группы после блоков, затем один полный Jest и lint; findings исправляются по owning scope, evidence не объявляется pass при SKIPPED/0 tests.

## Migration Plan

1. Согласовать dependency/quality окно после SSR export #2738, записать baseline manifest и прежние assertions.
2. Выполнить pinned dependency update и canonical postinstall; проверить unchanged runtime selectors.
3. Выполнить codemod и ручную миграцию helpers/setup/host queries/direct renderer/ref mocks.
4. Целевые suites → полный Jest (0 failed/0 skipped) → lint → expo install --check. Изменения только tests/toolchain не назначают native UI QA; будущие реальные изменения runtime потребуют нового выбора слоя.
5. Review-and-fix → code-review-gate → commit явными task paths → push main → testing. Общая публикация сверяется с действующим release gate; известный красный deploy не дублируется.

Откат: вернуть только task-owned dependency/setup/test изменения и восстановить canonical зависимости по прежнему lock; чужие dirty файлы не восстанавливать и не stash. До push миграция должна быть целостной, промежуточные сломанные тестовые группы не публикуются.
