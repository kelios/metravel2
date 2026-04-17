# 0001. Запрет прямого `Linking.openURL` и `window.open`

- **Статус:** Accepted
- **Дата:** 2026-04-17
- **Авторы:** team

## Контекст

Приложение работает на iOS, Android и Web. Открытие внешних ссылок на каждой платформе имеет разные нюансы:

- На iOS/Android нужно корректно обрабатывать deeplink-схемы, universal links, in-app browser (SFSafariViewController / Custom Tabs).
- На web — `window.open` с `noopener,noreferrer`, плюс аналитика кликов и обработка blocked popups.
- Нужна централизованная точка для логирования, телеметрии, white/blacklist доменов.

Прямой вызов `Linking.openURL` или `window.open` по кодовой базе размазывает эту логику и делает невозможным централизованные изменения.

## Решение

Все внешние переходы идут через `@/utils/externalLinks.openExternalUrl`.

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
