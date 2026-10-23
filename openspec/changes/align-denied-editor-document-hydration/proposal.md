## Why

#2701: сервер корректно возвращает общий документ 404 для чужого приватного `/travel/<id>`, а первый клиентский кадр выбирает дерево редактора. React сообщает #418. Нужно сохранить отказ и согласовать документ с первым деревом приложения без изменения URL или прав.

## What Changes

- Выбрать и реализовать общую frontend boundary между серверным типом документа и первым клиентским деревом, сохранив существующие NotFound/editor компоненты.
- Добавить SSR/first-client regression и реальные cold/warm privacy/browser controls.
- Закрепить подтверждённый механизм и постоянные controls семьи в Problem Memory.
- Сохранить настоящий SceneView и headless-регистрацию Tabs; обеспечить загрузку layout/dependencies до entry в canonical404 через существующий владелец boot scripts.

## Capabilities

### New Capabilities

- `denied-editor-document-hydration`: совпадающий первый кадр intentional404 редактора при сохранении серверного отказа и разрешённого доступа владельца.

### Modified Capabilities

Существующая living spec этого document boundary отсутствует. Publication/moderation policy не меняется.

## Impact

- User-visible result: честная страница отказа без React418; owner/admin видят прежний редактор.
- Platform impact: desktop web1440×900, mobile web390×844, cold/warm direct entry и reload. Native none: HTML hydration не является native runtime.
- Localization impact: none; существующие RU/BE/UK/PL/EN подписи сохраняются.
- Dependencies: действующий backend контракт #1932/#1524, hard blockers нет; backend/config только читаются.
- Data/API: GET document owner/admin200 editor/no-store/noindex,nofollow; B/guest private/unknown404 private,no-store; чужой public301 canonical; GET detail owner/admin200, B/guest404. Credentials, DTO и права неизменны; private decision/reason/date не раскрываются, navigation writes0.
- Fallback/mock policy: unit/SSR fixtures разрешены; production только реальные cookie-сессии/API/расходные данные с cleanup. Ни fake auth, ни document interception, ни всеобщего200, ни prehydration history.replaceState, ни подавления418.
- SEO: HTTP/cache/robots/canonical/public301 сохраняются, editorial text/SEO renderer не редактируются.
- Accessibility: существующие NotFound/editor layout, focus и кнопки сохраняются; новый дизайн не вводится.
- Performance: не загружать тяжёлый редактор для серверного отказа; media/геометрия нормального редактора не меняются.
- Security: отказ сервера остаётся источником прав; client boundary не даёт доступа, не хранит приватных данных в marker/storage.
- Analytics: событий/параметров не добавляется.
- Existing behavior: owner/admin editor200, `/travel/new`, unknown404, public301, штатная SPA correction и обычный NotFound.
- Non-goals: backend/nginx/auth rewrite, #1299/#2695, изменение feedback UI, скрытие ошибок, protected entry.js.
- Architecture: root Stack screenLayout выбирает существующий NotFound и chrome, сохраняя SceneView и headless Tabs.layout для регистрации состояния. SSR08 отверг вариант с удалением SceneView: URL превращался в `/?id=42`. Холодный layout заранее регистрируется authoritative pre-entry boot scripts. Защищённые entry.js и +html не меняются.
