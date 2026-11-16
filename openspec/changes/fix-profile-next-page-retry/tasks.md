## 1. Planning

- [x] 1.1 Установить механизм #3441 и границы, записать нормативные UI-состояния в feature doc.
- [x] 1.2 Проверить OpenSpec до apply.

## 2. Implementation

- [x] 2.1 Добавить scoped nextPageError/retryNextPage с существующими async/auth guards.
- [x] 2.2 Подключить выбранный источник вкладки к одному web footer без изменения native-разметки.
- [x] 2.3 Добавить две подписи RU/BE/UK/PL/EN и focused hook/adapter/DOM/e2e regression controls.

## 3. Validation and delivery

- [x] 3.1 В выделенном слоте выполнить focused Jest, i18n и требуемые source checks.
- [ ] 3.2 Пройти независимые review-auditor и code-review-gate по точному task diff.
- [ ] 3.3 После coordinator lease закоммитить явные пути, push main и testing.
- [ ] 3.4 На local API8000 пройти mobile web, затем desktop: 503 page2, footer >4s, repeated503, retry→40 cards, empty-list control; screenshots/console/network.
- [ ] 3.5 Выполнить обычный web deploy и узкий production identity/profile smoke без fault injection.
- [ ] 3.6 Передать PROBLEM_MEMORY entry координатору; после acceptance синхронизировать living spec, validate и archive.
