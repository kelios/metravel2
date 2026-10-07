## Context

См. proposal.md и Task Contract #2266. `ThreadList.tsx:132` отдаёт строке имя, дату и счётчик; `ThreadRow.tsx` оставляет имя на первой линии и метаинформацию на второй. Аватар 44 px удерживает компактную высоту. `api/messages.ts:84` ещё не содержит `last_message_preview`; `fetchMessageThreads` возвращает исходный JSON, `useThreads` сохраняет треды без проекции полей. Бэкенд #2265 уже принят; его реализация не входит в работу. Фичевого документа messages в `docs/features` и frontend OpenSpec с превью нет.

## Goals / Non-Goals

Goals: вторая линия с превью, прежняя ширина имени и компактная высота; данные только существующего списка тредов. Non-goals и impacts — в proposal.md. Не добавлять загрузку сообщений, клиентскую пересортировку или новую абстракцию списка.

## Decisions

1. Добавить optional `last_message_preview?: {text: string; sender_id: number; is_deleted: boolean} | null` к `MessageThread`; существующий transport/hook уже сохраняет поле. Проверить реальный JSON→fetch→hook путь тестом, не создавать лишнюю нормализацию. Старое поле отсутствует — пустое превью и прежняя строка; `null` — локализованная подпись пустого диалога.
2. Передавать вычисленное скалярное превью в memo строку. `is_deleted` проверять первым: даже ошибочно непустой серверный text не попадает в DOM или accessibility label. Текущий пользователь определяется существующим `currentUserId`; для его сообщения используется локализованный «Вы: {{text}}».
3. Имя остаётся единственным элементом первой линии; превью занимает свободную часть второй линии рядом с датой и unread badge. `minWidth: 0`, `flex: 1`, `numberOfLines={1}`, end ellipsis; дата и счётчик не вытесняют имя. Сохранить два текстовых ряда в пределах аватара 44 px. Альтернатива — отдельная третья линия — отвергнута: она увеличивает высоту и снижает плотность списка. Перенос даты к имени отвергнут: возвращает #2264.
4. A11y-кнопка строки включает полное превью в дополнение к существующим имени и unread count. Пропы выбора/удаления и callback memo из #2284 сохраняются. Новые app-owned строки через `useTranslation`/ресурсы всех RU/BE/UK/PL/EN; пользовательский текст не переводится.

## Risks / Trade-offs

- Узкая 320 px строка с датой и unread 99+ оставляет меньше места превью → скринридер получает полный текст; name reserve не уменьшается; пиксельная проверка сценария обязательна.
- Старый сервер без поля → optional тип и пустое превью без runtime ошибок.
- Подмена скрытого текста → сначала `is_deleted`, тест на непустой hidden payload.
- Смена языка при memo → использовать реактивный locale hook; тест переключения PL/RU без повторного запроса.

## Migration Plan

После отдельного apply: реализовать только frontend paths, пройти code-level проверки и независимый review. Авторизованный общий запрос пользователя включает commit/push/deploy/testing для готовой задачи, эти операции ведёт parent pipeline. Production приёмка без моков на выделенном e2e-аккаунте; обычные личные сообщения не читаются. Rollback: revert только task-owned frontend diff; API additive поле игнорируется старым фронтом, backend rollback не нужен.

## Validation Matrix

| Surface | Locales | Evidence |
|---|---|---|
| Shared source | RU/BE/UK/PL/EN | Jest preview own/other/deleted/null/absent + real fetch field preservation, i18n, eslint, tsc |
| Desktop web 1440 | RU/BE/UK/PL/EN | Light/dark screenshots, similar names, 200-char ellipsis, row height delta <= 1 px |
| Mobile web 320/390 | RU/BE/UK/PL/EN | Same matrix; no horizontal overflow; name-first layout preserved |
| Android/iOS shared render | RU/BE/UK/PL/EN | Shared Jest layout/a11y regression; platform runtime untouched, device gate none |

Mocked e2e regression допустима, production gate выполняется без моков после review и собственного выката, с console/network evidence. Done требует опубликованного SHA, разных превью у двух похожих имён и скринов desktop/mobile. Open questions: none; отсутствие текста у старого поля и подпись null выбраны выше.
