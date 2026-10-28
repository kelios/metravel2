## Why

Карточка #2737 переводит тесты с RNTL 13 на поддерживаемую асинхронную модель RNTL 14 и заменяет deprecated React Test Renderer. Jest 30 уже внедрён (#2735); текущие Node 22.13.1, React 19.3 и React Native 0.88 удовлетворяют опубликованной матрице RNTL 14.

## What Changes

- **BREAKING:** тестовые render/renderHook/fireEvent/act и методы rerender/unmount ожидаются через async API; helpers возвращают обещанный результат явно.
- RNTL закрепляется на 14.1.0, test-renderer — на совместимой с React 19.3 линии 1.3.x; прямые зависимости react-test-renderer, его types и jest-native удаляются.
- Удалённые запросы/опции заменяются поддерживаемыми проверками того же поведения. Утверждения и негативные сценарии сохраняются; skip, снижение порогов и production-правки не входят в миграцию.
- Общий Jest setup использует встроенные матчеры RNTL и новый renderer; прежний helper форматирования fiber-графа пересматривается по фактическому API нового renderer.

## Capabilities

### New Capabilities

Нет: это миграция внутреннего тестового инструмента. `skip_specs: true` явно исключает искусственные product specs.

### Modified Capabilities

Нет изменений требований продукта.

## Impact

- Paths: package.json, yarn.lock, jest.config.js, __tests__ с затронутыми imports/helpers/assertions, устаревшая ambient declaration types/react-test-renderer.d.ts; данный OpenSpec change.
- Platform impact: none — меняется тестовая инфраструктура, не web/native runtime. Localization impact: none — тексты и locale contracts не меняются.
- User-visible/API/data/SEO/accessibility/performance/security/analytics: production-контракты не меняются; существующие тесты этих контрактов сохраняют свою проверочную силу.
- Dependencies: завершённый #2735, согласованное окно установки/quality gate, совместимые renderer/React версии. Fallback/mock policy: тестовые platform-моки сохраняют контракт, общий sync-compat shim и mock RNTL не допускаются.
- Non-goals: Babel/Expo/React upgrade, исправление bundle budget #2738, UI/device/store QA, изменение кода приложения.
- Validation: целевые suites по блокам, затем полный Jest без failed/skipped, lint и expo install --check; повтор одного и того же app flow на устройствах не требуется.
