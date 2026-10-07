## Why

Карточка #2266: диалоги с похожими именами в `/messages` различаются только после открытия. Бэкенд #2265 и новая строка #2264 приняты; теперь нужно показать имеющееся превью в списке.

## What Changes

- Добавить необязательное `last_message_preview` в frontend `MessageThread`; существующий transport сохраняет поле без новой нормализации.
- Показать превью последнего сообщения рядом с метаданными на второй линии строки: собственное сообщение с локализованным префиксом, удалённое с нейтральной подписью, пустой диалог с подписью «Нет сообщений».
- Сохранить отдельную первую линию имени и высоту строки при длинных сообщениях; дать скринридеру полное превью.
- Добавить проверки RU/BE/UK/PL/EN, старого ответа без поля и responsive геометрии.

## Capabilities

### New Capabilities

- `message-thread-preview-row`: отображение безопасного превью в строке списка диалогов.

### Modified Capabilities

Нет существующих frontend specs с этим контрактом.

## Impact

Platform impact: shared `ThreadList`/`ThreadRow`; desktop web 1440 и mobile web 320/390. Android/iOS используют ту же строку; platform-specific runtime не меняется, device gate не требуется.
Localization impact: RU/BE/UK/PL/EN для собственных подписей и доступности; пользовательские сообщения не переводятся.
Paths: `api/messages.ts`, `components/messages/{ThreadList,ThreadRow}.tsx`, соответствующие `i18n/locales/*/` ресурсы, API/ThreadList jest, `e2e/messages.spec.ts`.
Data/API: существующий backend `GET /api/message-threads/` отдаёт `{text: string, sender_id: number, is_deleted: boolean} | null`; поле optional на клиенте для совместимости. Dependencies #2264/#2265 = done; backend не меняется.
Accessibility: полное превью в подписи кнопки диалога; selected/unread/delete semantics сохраняются. Performance: без запросов сообщений по каждому диалогу и без нарушения memo строки. Security: скрытый текст никогда не рендерится при `is_deleted=true`.
SEO/analytics: none, закрытый аккаунтный экран; новых событий нет. Non-goals: ширина панели, чат, поиск по сообщениям, сортировка, backend, store/release.
Fallback/mock policy: jest/e2e fixtures допустимы для регрессии; production приёмка e2e-аккаунтом без моков и без чтения чужих личных сообщений.

Это planning-only proposal. Реализация начинается после отдельного запроса apply; текущее выполнение #2284/#2296 не применяет эту функцию.

Existing behavior to preserve: имя на отдельной первой линии, дата/unread, выбор, подтверждение удаления, name-only поиск, существующий порядок списка. Open questions: none; пустой диалог показывает подпись, старый ответ без поля оставляет превью пустым.
