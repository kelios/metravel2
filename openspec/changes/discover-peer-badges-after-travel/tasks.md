## 1. Разведка и planning

- [x] 1.1 Зафиксировать исходный local browser baseline guest/reader/owner на 390/1440 до кода; отделить source facts от гипотезы низкой активности.
- [x] 1.2 Согласовать BA, UI geometry и architecture; создать proposal/design/spec и проверить change строго.

## 2. Приглашение и выдача

- [x] 2.1 Добавить shared prompt после полного текста, auth/owner/recipient eligibility и responsive UI.
- [x] 2.2 Reuse существующего picker/giver target user, public peerReceived, безопасного guest login/registration return.
- [x] 2.3 Добавить truthful loading/error/retry и production 400 grant rejection после освобождения API-файла владельцем #2697.
- [x] 2.4 Добавить пять локалей и impression/click с travel_id через существующие exposure/analytics helpers.
- [x] 2.5 Исправить user/travel personalized reads, viewer-scoped keys, auth readiness barrier, optimistic target keys и existing initial-data consumers без параллельных запросов.

## 3. Проверки и review

- [x] 3.1 Покрыть условия показа, return query/hash, user-target grant, ошибки/retry, смену статьи/сессии и события поведенческими тестами.
- [x] 3.2 Выполнить focused peer regression, i18n, lint/typecheck и применимые guards с координацией quality gate.
- [ ] 3.3 Пройти independent review-and-fix всего task diff, затем code-review-gate; review только code-level.

## 4. Приёмка и завершение

- [ ] 4.1 Зафиксировать/запушить явные пути задачи, перевести в testing и выполнить штатный production deploy.
- [ ] 4.2 Принять production 390/1440, guest/reader/owner, пять локалей, themes/keyboard, screenshots/console/network и оба события.
- [ ] 4.3 Доказать вход/регистрацию с возвратом, реальный user-target POST и persisted GET; сохранить отдельные travel awards.
- [ ] 4.4 Записать Done evidence в #2678 и окончательно validate change; архивировать только после всех обязательных проверок.
