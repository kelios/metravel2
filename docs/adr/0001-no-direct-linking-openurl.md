# 0001. Запрет прямого `Linking.openURL` и `window.open`

- **Статус:** Accepted
- **Дата:** 2026-04-17
- **Авторы:** team

## Контекст

Активные поверхности приложения — desktop/mobile Web, Android и iPhone.
Открытие внешних ссылок на активных платформах имеет разные нюансы:

- На Android и iPhone нужно корректно обрабатывать deeplink/app-link/
  Universal Link schemes и in-app browser lifecycle (Custom Tabs / Safari view).
- На web — `window.open` с `noopener,noreferrer`, плюс аналитика кликов и обработка ошибок отправки запроса.
- Нужна централизованная точка для логирования, телеметрии, white/blacklist доменов.

Прямой вызов `Linking.openURL` или `window.open` по кодовой базе размазывает эту логику и делает невозможным централизованные изменения.

## Решение

Все внешние переходы идут через `@/utils/externalLinks.openExternalUrl`.

### Результат открытия web-вкладки

`openExternalUrlInNewTab` и `dispatchWebWindow` возвращают факт отправки
запроса без исключения, а не подтверждение открытия или загрузки страницы.
При `noopener`/`noreferrer` браузер возвращает `null` и после успешного открытия;
тот же результат возможен при блокировке popup. Поэтому отсутствие handle
не вызывает ложную ошибку приложения. Защита `noopener` сохраняется, блокировку
показывает сам браузер. Недоступный API или исключение по-прежнему дают
`false`. `openExternalUrlInNewTab` также отклоняет недопустимые URL.
`dispatchWebWindow` не валидирует адрес: это API для доверенного источника,
например локально созданного Blob; внешние данные проходят через
`openExternalUrlInNewTab`. `openWebWindow` сохраняет отдельный контракт
`Window | null` для кода, которому нужна ссылка на окно.

Основание: [MDN Window.open](https://developer.mozilla.org/en-US/docs/Web/API/Window/open).

Соблюдение обеспечивается двумя уровнями:

1. **ESLint-правило** — запрещает `Linking.openURL` и `window.open` в исходниках.
2. **Guard-скрипты** `scripts/guard-no-direct-linking-openurl.js`, `scripts/guard-no-direct-window-open.js` — дублируют проверку в CI и pre-commit.
3. **Governance-тесты** `__tests__/scripts/guard-no-direct-*` — гарантируют, что сами guard-скрипты не регрессируют.

## Последствия

### Положительные

- Единая точка для телеметрии, in-app browser, deeplink-обработки.
- ИИ-инструменты и разработчики получают чёткое правило без обсуждения.

### Отрицательные / риски

- Новый контрибьютор может не знать про правило → получит ошибку в pre-commit. Решение: правило явно прописано в CLAUDE.md и ESLint-сообщении.

## Альтернативы, которые отвергли

- **Просто договориться** — не работает, размывается со временем.
- **Только ESLint** — не страхует против bypass через dynamic require или eval.

## Связанные

- `utils/externalLinks.ts`
- `scripts/guard-no-direct-linking-openurl.js`, `scripts/guard-no-direct-window-open.js`
- `docs/EXTERNAL_LINK_GOVERNANCE_PR_BODY.md`
