## Why

Форма подписки уже требует явной отметки согласия, но `POST /api/subscribe/` получает только email, источник и URL страницы. Поэтому для гостя сервер не может связать подписку с конкретной версией показанной формулировки, а отдельная запись `email_subscribe` для авторизованного пользователя использует общий неявный version-id `1`.

Цель — передавать серверу доказательство именно того согласия, которое пользователь явно отметил, сохранив обратную совместимость существующей подписки.

## What Changes

- Ввести один стабильный version-id для локализованного набора формулировок email-согласия RU/BE/UK/PL/EN; при изменении любой формулировки version-id должен меняться вместе с ней.
- Расширить frontend-адаптер подписки optional-объектом явного согласия и отправлять `consent: true` вместе с непустым `consent_version` только при его наличии.
- Передавать этот объект из `EmailSubscriptionForm` только после действия пользователя на обязательном checkbox.
- Использовать тот же version-id при `recordActionConsent(email_subscribe)` для локального и авторизованного серверного учёта.
- Добавить регрессионные тесты positive/negative payload path и сохранить обработку ответов `created`/`exists` без изменений.

## Capabilities

### New Capabilities

- `email-subscription-consent`: явное версионированное согласие в frontend email-subscription flow и его безопасная передача в совместимый backend API.

### Modified Capabilities

Нет существующих living specs: capability добавляется впервые.

## Impact

- **User-visible result:** вид формы, обязательность checkbox, success/error states и тексты не меняются; сервер получает аудируемую версию явно принятой формулировки.
- **Platform impact:** `shared` — общий adapter/component path для desktop web, mobile web, Android и iPhone. Platform-specific UI, конфигурация и runtime не меняются, поэтому отдельный Android/iPhone device gate не требуется.
- **Localization impact:** `all current locales` — существующие RU/BE/UK/PL/EN формулировки не переписываются, но единый version-id представляет весь локализованный набор и обязан меняться при правке любой версии текста.
- **Data/API:** optional request fields `consent: true` и `consent_version: string`; при отсутствующем, ложном или неполном явном согласии оба поля отсутствуют. Ответы `201 created` и `200 exists` остаются прежними.
- **Dependencies:** backend-задача #1502 добавляет optional-поля и authenticated `email_subscribe`; её deploy нужен для интеграционной приёмки, но не блокирует frontend implementation и unit coverage. Связанный исходный flow — #1476.
- **Fallback/mock policy:** mock/fallback не подменяет отсутствующий backend-контракт. Старые backend/client paths совместимы только благодаря optional-полям; rollout frontend выполняется после подтверждения target API.
- **SEO:** не затрагивается — URL, metadata, prerender и индексируемый контент не меняются.
- **Accessibility:** не затрагивается — checkbox semantics, label, keyboard/Enter flow и tap target остаются прежними.
- **Performance:** два небольших JSON-поля добавляются только в submit request; новых запросов, media или bundle-зависимостей нет.
- **Security/privacy:** `false` не отправляется и согласие не синтезируется без явного checkbox action; version-id не содержит персональных данных.
- **Analytics:** событие `email_subscribe` и параметры `{source, status}` сохраняются без изменений.
- **Existing behavior to preserve:** email validation, CSRF/native auth split публичного POST, `created`/`exists`, localized errors, consent-required negative path и non-blocking action-consent record.
- **Out of scope / Non-goals:** backend/Django изменения, миграции, double opt-in, изменение текста согласия, UI-редизайн, deploy/publish и production data cleanup.
- **Open questions:** материальных вопросов нет; backend shape и acceptance определены связанными задачами #1502/#1522.
