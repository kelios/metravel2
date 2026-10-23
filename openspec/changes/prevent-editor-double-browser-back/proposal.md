## Why

#2702: после настоящего browser Back из своего редактора первый popstate возвращает список, затем приложение вызывает ещё один `history.go(-1)` и может покинуть сайт. Нужно установить callback и исправить его владельца, сохранив одну запись на одно действие и текущий документ.

## What Changes

- Установить точный callback/ветку на закреплённом bundle с безопасным полным path/state/cursor trace; старые pathname-only traces не доказывают причину.
- Исправить общий web history owner после attribution и добавить meaningful source/browser regressions.
- Проверить native browser и app Back/Forward, прямой вход/returnTo и ненулевую позицию памяти, сохранить изменения #2703.

## Capabilities

### New Capabilities

- `editor-browser-history-traversal`: одно действие browser Back из собственного редактора даёт один возврат без второго traversal и утраты документа.

### Modified Capabilities

Существующая living spec этого editor инварианта отсутствует; публичная история #2703 остаётся отдельной capability.

## Impact

- User-visible result: возврат в исходный список за одно действие, Forward восстанавливает редактор без приватного остатка или сохранения статьи.
- Platform impact: desktop web1440×900 и mobile web390×844, cold/warm, step1/no-sheet и step6/long-reason. Native только source boundary, device gate не требуется.
- Localization impact: none, app-owned текст не добавляется.
- Dependencies: pinned expo-router57.0.28, hard dependencies нет; общий patch #2703 сохраняется. Backend только читается.
- Data/API: формы API/права/данные не меняются. Реальные cookie-сессии и editor GET для своих расходных fixture; navigation article writes0, fixture setup/cleanup записываются отдельно.
- Fallback/mock policy: unit fixtures допустимы; production реальные Edit/cookie/API/browser Back и controlled fixtures. Нельзя подменять browser Back другой кнопкой, делать synthetic history, маскировать go/SSR, подавлять ошибки или скрывать InfoSheet.
- SEO: URL и metadata редактора/public pages не меняются.
- Accessibility: существующие Edit/Back/InfoSheet controls и layout сохраняются.
- Performance: сохраняется документ/timeOrigin, лишних переходов и повторных запросов не добавляется.
- Security: private residue0, traces содержат только разрешённые path/query/hash/state поля; credentials/cookies/tokens не выводятся. Cleanup только собственных тестовых данных с readback.
- Analytics: схемы событий неизменны.
- Existing behavior: Forward, app Back, returnTo, direct-entry fallback, последующий push/replace после browser Back, public A/B/C.
- Non-goals: backend/auth/permissions, #2701 document404 hydration, feedback UI, native navigation, произвольный dependency bump.
- Open questions: точный вызывающий callback ещё не пойман. Fork не sync closure cursor при external popstate и timeout settlement, но одна safety-clamp правка не доказывает single-Back на ненулевом cursor. Функциональный fix следует после attribution, а не по гипотезе.
