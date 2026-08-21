## 1. Consent contract

- [x] 1.1 Добавить в существующий action-consent module immutable descriptor с type, стабильным version-id и typed i18n label-key для email-подписки; зафиксировать правило bump при изменении любой RU/BE/UK/PL/EN формулировки.
- [x] 1.2 Расширить email-subscription adapter optional shape `{ granted: true, version: string }` и сериализовать оба wire-поля только для `granted === true` с непустой trimmed version; missing/false/blank input должен опускать оба поля.

## 2. Form integration and regression coverage

- [x] 2.1 Перевести `EmailSubscriptionForm` на единый descriptor для label, action-consent version и subscription payload, передавая consent option только из ветки после explicit checkbox gate.
- [x] 2.2 Обновить adapter Jest coverage: positive JSON payload, missing/false/blank negative paths, сохранённые `created`/`exists`, error behavior и неизменный auth/CSRF request init.
- [x] 2.3 Обновить component Jest coverage: unchecked/Enter не вызывает API, checked submit передаёт explicit consent descriptor и `recordActionConsent(email_subscribe)` получает ту же версию.
- [x] 2.4 Добавить regression control, связывающий version-id с точным набором существующих RU/BE/UK/PL/EN consent labels без изменения пользовательского текста.

## 3. Validation and review

- [x] 3.1 Запустить targeted Jest suites для `EmailSubscriptionForm`, email adapter и action-consent/i18n regression control; исправить все in-scope failures без `.skip`.
- [x] 3.2 Запустить `npm run test:i18n` и `npm run check:fast` с соблюдением operation gate; `SKIPPED` не считать зелёным evidence.
- [x] 3.3 Передать полный task diff и результаты проверок независимому `$metravel-code-reviewer` в review-and-fix mode, применить подтверждённые исправления и повторить затронутые проверки.
- [x] 3.4 Запустить `openspec validate send-explicit-email-consent --type change --strict` и `openspec validate --all`.

## 4. Integrated acceptance

- [ ] 4.1 После отдельно подтверждённых backend deploy и frontend rollout проверить тот же target: guest submit создаёт email-linked consent version/timestamp, authenticated `email_subscribe` не получает 400, ответы `created`/`exists` и analytics event не регрессировали; evidence записать в #1522 и связанную #1502.
