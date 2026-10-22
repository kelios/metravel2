## Why

В #2693 ожидающая проверки статья отображается как черновик, а обычное сохранение снимает её с модерации: мастер использует неоднозначные legacy-флаги. Цель — показывать фактическое состояние и сохранять его при любой правке содержимого.

## What Changes

- Канонический `publication_status` определяет состояние мастера; legacy fallback допустим только при отсутствии поля.
- Обычное сохранение сохраняет состояние, текстовый autosave не передаёт команд модерации.
- Submit, approve и reject становятся явными командами; причина отклонения передаётся только с reject.
- Неизвестный канонический статус даёт видимую ошибку и блокирует опасную запись.
- Существующая компоновка панели, валидация причины и восстановление формы при ошибке сохраняются.
- Общая Save-кнопка обрабатывает отклонённый Promise после показа ошибки, сохраняя повтор и семантику ошибок команд.

## Capabilities

### New Capabilities

- `wizard-publication-state`: чтение состояния публикации, его сохранность и явные переходы в мастере.

### Modified Capabilities

Нет.

## Impact

- User-visible result: ожидающая проверки статья сразу имеет правильный чип и доступные роли действия; правки не убирают статью из очереди.
- Platform impact: shared; обязательны desktop web 1440px и mobile web 390px. Platform-specific runtime не затронут.
- Localization impact: all current locales RU/BE/UK/PL/EN; существующие ключи переиспользуются, новая ошибка переводится во всех локалях.
- Data/API: существующие GET/PUT/PATCH; полный save передаёт canonical без `publish/moderation`, content PATCH содержит только текст. Backend read-only, контракт #910 уже доступен, жёстких blockers нет.
- Fallback/mock policy: legacy fallback только при отсутствии canonical; null/пустое/неизвестное поле не превращается в draft. Моки только для unit; приёмка на живом API.
- Accessibility: сохранить semantics/focus/keyboard/touch штатных controls. Performance: новых запросов autosave и тяжёлых зависимостей не добавлять.
- Security: роли проверяет сервер; причина trim 1–2000, санитизация контента сохраняется; secrets не логировать.
- SEO/analytics: URL/метаданные/события не меняются, эти контракты вне scope.
- Task-owned paths: types/types.ts, utils/travelPublicationStatus.ts, utils/travelFormUtils.ts, api/misc.ts, hooks/useTravelFormPersistence.ts, связанные вызовы сохранения, components/travel/useTravelPublishModeration.ts, TravelWizardStepPublish.tsx, тесты, локали при необходимости, docs/TRAVEL_SAVE_MODERATION_CONTRACT.md и запись постоянного контроля в docs/PROBLEM_MEMORY.md.
- Non-goals: backend, очередь/списки #911, показ moderation_decision #2669, права #2686, редакторский контент, новый дизайн и protected config.
- Existing behavior to preserve: save без проверки полноты, явная validation submit, route save новой точки, восстановление текста и причины после ошибки, отсутствие повторного решения из GET.
- Open questions: нет; источник истины — Task Contract #2693.
