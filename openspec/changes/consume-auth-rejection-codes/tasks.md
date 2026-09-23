## 1. Причина отказа входа по коду

- [x] 1.1 `utils/authFailure.ts`: `authRejectionCode({ code, detail })` — непустой `code` решает сам (`account_not_activated` → активация, любой другой → общий отказ), разбор текста по маркерам только при пустом `code`; комментарий контракта обновлён под #1993
- [x] 1.2 `api/auth.ts` `loginApi`: из тела отказа читается `code` и переносится в ошибке полем `rejectionCode` рядом с `detail`; ветка `400/401/403` выбирает ключ через `authRejectionCode({ code, detail })`
- [x] 1.3 Тесты: `__tests__/utils/authFailure.test.ts` (приоритет кода, незнакомый код, пустой код → текстовый fallback) и `__tests__/api/travels.auth.test.ts` (inactive+wrong → общий отказ, неизвестный email → общий отказ, inactive+correct → активация, противоречие code/text в обе стороны, незнакомый код, EN-локаль по коду; прежние тесты без `code` — без изменений)

## 2. Нейтральный локализованный ответ сброса

- [x] 2.1 `utils/authFailure.ts`: тип `PasswordResetOutcome = { ok: true; message } | AuthFailure`
- [x] 2.2 `api/auth.ts` `resetPasswordLinkApi`: `2xx` → `api.auth.passwordResetRequested` без чтения тела; `400` → `api.backendErrors.invalidEmail`; `429` → `api.misc.tooManyAttempts`; прочие статусы → `resetInstructionsFailed`; исключение → `authFailureFromError`; пустой email → `rejected` без запроса
- [x] 2.3 `stores/authStore.ts`, `stores/authState.ts`, `context/authContextBase.tsx`: `sendPassword` возвращает `PasswordResetOutcome`; удалена ветка «ответ не строка» и её осиротевший ключ `shared:stores.authStore.chto_to_poshlo_ne_tak_poprobuyte_snova_6b2b849c` во всех пяти локалях
- [x] 2.4 `components/auth/LoginForm.tsx`: стиль ошибки/успеха по `outcome.ok` вместо регулярки по русскому тексту; `components/user/ForgotPasswordScreen.tsx` согласован по типу
- [x] 2.5 Тесты: `__tests__/api/travels.auth.test.ts` (known/unknown → одинаковый нейтральный успех, успех без `code`, `400`, `429`, `5xx`, сеть, пустой email, EN-локаль), `__tests__/stores/authStore.test.ts`, `__tests__/context/AuthContext.test.tsx`, `__tests__/components/login.test.tsx` (отказ без русских слов красится ошибкой, нейтральный успех — нет)

## 3. Локализация

- [x] 3.1 `i18n/locales/{ru,be,uk,pl,en}/static/errors_static.ts`: `api.auth.resetInstructionsSentShort` заменён на `api.auth.passwordResetRequested` с нейтральным текстом во всех пяти локалях
- [x] 3.2 `npm run test:i18n` зелёный
- [x] 3.3 `docs/features/auth.md`: раздел «Email: причина отказа входа и сброс пароля (#2042)»

## 4. Проверки до ревью

- [x] 4.1 Новые тесты падают на коде до change (код откатывался к `HEAD` без правки тестов) и проходят с ним
- [x] 4.2 `npx eslint` по изменённым файлам, `npx tsc --noEmit`, `npm run guard:file-complexity:changed`
- [x] 4.3 `openspec validate consume-auth-rejection-codes --strict`

## 5. Ревью и приёмка

- [ ] 5.1 Независимый code-only review-and-fix полного diff (`review-auditor` / `code-review-gate`), повтор code-level проверок после правок
- [ ] 5.2 После коммита явными путями, push и выката — приёмка на `https://metravel.by` на desktop web и mobile web: общий отказ и подсказка активации по коду, одинаковая нейтральная строка сброса для известного и неизвестного email, локализованная ошибка `400`; проверка хотя бы одной нерусской локали
- [ ] 5.3 После зелёной приёмки — `openspec archive consume-auth-rejection-codes` с синхронизацией `specs/email-auth-feedback`
