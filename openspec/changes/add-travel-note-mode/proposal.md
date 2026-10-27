## Why

Problem: рассказать о поездке можно только через шестишаговый мастер с обязательными категориями точек и статьи, странами и обложкой. За 30 дней (GA4, 19.09–18.10.2026) мастер открыли 6 раз, создание маршрута началось один раз. Задача #2666.

Goal / User-visible result: по `/travel/new?mode=note` автор за два экрана — «Фото» и «Место и рассказ» — отправляет короткую заметку на модерацию; полный мастер на `/travel/new` работает как раньше.

## What Changes

- Типизированное поле формы `publication_format: 'full' | 'note'` (серверный контракт #2699) в allowlist сохранения; новая заметка отправляет `note`, существующая запись хранит свой формат.
- Двухэкранный редактор заметки поверх того же контроллера, автосейва, черновика и команды `intent='submit'`.
- Черновик создаётся по первому выбранному фото: галереи web и native принимают `resolveTravelId`.
- Готовность заметки повторяет серверную (одна точка со страной, 50 видимых символов, 1–10 фото галереи); чек-лист и проверки модератора в полном мастере для заметки используют её же.
- Параметр `mode` у событий создания маршрута; тексты RU/BE/UK/PL/EN.

## Capabilities

### New Capabilities

- `travel-note`: короткая заметка о поездке, её готовность к модерации и выбор редактора.

### Modified Capabilities

Нет.

## Impact

Frontend: `components/travel/note/*`, `components/travel/upsert/*`, `components/travel/useTravelPublishChecklist.ts`, `components/travel/useTravelPublishModeration.ts`, галереи, `utils/travelNote.ts`, `utils/travelWizardValidation.ts`, `utils/growthFunnelAnalytics.ts`, `types/types.ts`, `i18n`. Backend не меняется (контракт поставлен #2699). Platform impact: shared (desktop/mobile web, Android, iOS).
