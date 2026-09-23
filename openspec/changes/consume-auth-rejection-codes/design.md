## Context

Мотивация — `proposal.md` → Why; требования — `specs/email-auth-feedback/spec.md`.

Текущее состояние (main до change):

- `api/auth.ts` `loginApi`: внутри `retry` тело отказа читается до `throw`, в ошибку кладётся только текст `detail || error || message`; в `catch` для `400/401/403` ключ выбирает `authRejectionCode(detail)` — разбор строки по маркерам «не активирован» (`utils/authFailure.ts`).
- `api/auth.ts` `resetPasswordLinkApi`: возвращает строку — на `2xx` сырой `json.message` сервера, на ошибку сырой `json.email[0]`/`json.message`, на исключение — `resetInstructionsFailed`; пустой email — `throw`.
- `stores/authStore.ts` `sendPassword` пробрасывает строку; `components/auth/LoginForm.tsx` решает «ошибка или успех» регуляркой `/ошиб|не удалось/i` по этой строке.

Контракт бэкенда (read-only, `../metravel-backend/users/views.py`, прод `de08e8f`):

- `POST /api/user/login/`: `401 {"code": "invalid_credentials", "error": "Неверная почта или пароль"}` для неверного пароля и неизвестного email; `401 {"code": "account_not_activated", "error": <подсказка>}` только для неактивного аккаунта с верным паролем; `400` — ошибки сериализатора; `200` без изменений.
- `POST /api/user/reset-password-link/`: любой корректный email → `200 {"code": "password_reset_requested", "message": "Если аккаунт с такой почтой существует, письмо отправлено."}`; некорректный → `400 {"email": [...]}`; throttle scope `auth_password_reset` → `429`.

## Goals / Non-Goals

**Goals:**

- Один источник решения о причине отказа входа — `code`, текстовый разбор только как fallback без `code`.
- Результат сброса — значение с признаком успеха по статусу ответа; форма перестаёт угадывать ошибку по тексту.
- Ни одна ветка входа и сброса не показывает строку сервера.

**Non-Goals:**

- Удалять текстовый fallback (бэкенд сохраняет `error`/`message` без даты удаления).
- Трогать соц-входы, регистрацию, активацию, `setNewPasswordApi` и мёртвый `sendPasswordApi`.
- Менять вёрстку формы входа.

## Decisions

1. **`authRejectionCode({ code, detail })` с приоритетом кода.** Непустой `code` решает сам: `account_not_activated` → подсказка активации, любой другой → общий отказ; `detail` разбирается маркерами только при пустом `code`. Сигнатура объектом делает приоритет видимым на месте вызова. Альтернатива — второй позиционный параметр `authRejectionCode(detail, code)`: обратно совместимо, но порядок аргументов противоречит приоритету и читается как «код — довесок к тексту». Альтернатива — отдельная функция для кода рядом с текстовой: два источника решения в двух местах, ровно то, от чего уходим.
2. **Код переносится в ошибке отдельным полем `rejectionCode`.** `loginApi` бросает `Error('Login failed: <status>')` из `retry`; к нему добавляется `rejectionCode` рядом с `detail`. Имя не `code`: `utils/networkErrorHandler.ts` читает `error.code` как транспортный код (`ECONNREFUSED`, NSURLError), и совпадение имён смешало бы бизнес-код с сетевой диагностикой.
3. **`resetPasswordLinkApi` возвращает `PasswordResetOutcome = { ok: true; message } | AuthFailure`.** Тип живёт в лист-модуле `utils/authFailure.ts` рядом с `AuthOutcome` и переиспользует таксономию `AuthFailure` (#1944): `2xx` → нейтральная строка `errorsStatic:api.auth.passwordResetRequested` без чтения тела; `400` → `rejected` + `errorsStatic:api.backendErrors.invalidEmail` (существующий ключ для DRF «Enter a valid email address.»); `429` → `server` + `errorsStatic:api.misc.tooManyAttempts`; прочие статусы → причина по `authFailureReasonFromStatus` + `resetInstructionsFailed`; исключение → `authFailureFromError` (сеть получает дружелюбный текст с диагностическим тегом #1943); пустой email → `rejected` + `emptyEmail` вместо `throw`. Альтернатива — оставить строковый контракт и искать ошибку по тексту: на EN/BE/UK/PL это невозможно без списка слов на каждую локаль, именно так сломана нынешняя регулярка. Альтернатива — `localizeBackendFieldError` для `400`: для незнакомой формулировки он возвращает сырую строку сервера (в том числе русскую локализацию DRF), что нарушает #1946.
4. **Стор и контекст пробрасывают результат как есть.** `sendPassword` возвращает `PasswordResetOutcome`; исключение слоя api → `unknown` с прежним текстом «Произошла ошибка…». Ветка «ответ не строка» и её ключ `shared:stores.authStore.chto_to_poshlo_ne_tak_poprobuyte_snova_6b2b849c` удаляются — тип её исключает, ключ становится сиротой. Fallback контекста без провайдера — `{ ok: false, reason: 'unknown', message: '' }`, как у `login`.
5. **Ключ `api.auth.resetInstructionsSentShort` («Инструкции по восстановлению отправлены.») заменяется на `api.auth.passwordResetRequested`.** Старый текст утверждает отправку и вводит в заблуждение владельца неизвестного адреса; старое имя ключа описывало бы другой смысл. Других потребителей у ключа нет.

## Risks / Trade-offs

- [Старый бэкенд без `code`] → текстовый fallback сохранён без изменений; тест «ответ без code» фиксирует прежнее поведение.
- [Новый код бэкенда, например блокировка аккаунта, покажется общим отказом] → осознанно: подсказку активации даёт только `account_not_activated`; новый код потребует отдельного ключа и change.
- [Тело `2xx` сброса больше не читается] → по контракту #1993 оно одинаково для всех адресов; при расхождении пользователь всё равно видит нейтральный текст, а не ложное «отправлено».
- [Внутренний контракт `sendPassword` меняется со строки на результат] → потребители найдены поиском: `LoginForm` и мёртвый `ForgotPasswordScreen`; тестовые моки обновлены там, где они проходят через сброс.

## Migration Plan

Обычный выкат web-фронтенда (`scripts/deploy-prod.sh <sha>`); миграций данных нет. Нативные сборки получат изменение со следующим релизом общего JS. Откат — revert коммита: бэкенд сохраняет `error`/`message`, поэтому прежний клиент продолжает работать с тем же API.

## Validation Matrix

| Поверхность / локаль | Проверка |
| --- | --- |
| unit (все поверхности, общий JS) | jest: `__tests__/utils/authFailure.test.ts`, `__tests__/api/travels.auth.test.ts`, `__tests__/stores/authStore.test.ts`, `__tests__/context/AuthContext.test.tsx`, `__tests__/components/login.test.tsx`; новые тесты падают на коде до change |
| RU/BE/UK/PL/EN | `npm run test:i18n`; unit-тесты RU и EN для входа и сброса |
| desktop web (прод, testing) | `/login`: неверный пароль → общий отказ; неактивный + верный пароль → подсказка активации; «Забыли пароль?» с известным и неизвестным email → одна и та же нейтральная строка в стиле успеха; некорректный email на сервере → локализованная ошибка |
| mobile web (прод, testing) | тот же сценарий на ширине 375 px |
| Android / iOS | общий JS без нативного кода — device gate не требуется |
