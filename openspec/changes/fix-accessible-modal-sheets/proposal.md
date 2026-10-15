## Why

#2434: VoiceOver видит в листе жалобы только «Закрыть», потому что доступный
фон оборачивает всё содержимое. Ещё семь модальных панелей используют тот же
source-паттерн. Цель — раскрыть элементы отдельно и предотвратить повторение.

## What Changes

- Перевести семь нижних листов на общий presentation shell, сохранить
  центрированный paywall через sibling backdrop/card.
- Сохранить scroll, клавиатуру, вложенные модалки, фокус и modal-level feedback.
- Запретить wrapper/noop паттерн структурным guard, сохранить feedback guard.

User-visible result: причины жалобы, комментарий, submit и close доступны
раздельно; отправка достижима при клавиатуре. Existing behavior to preserve:
touch, действия/ошибки/пустые состояния, share, modal lifecycle, centered paywall.

## Capabilities

### New Capabilities

- `accessible-modal-panels`: отдельная доступность элементов, достижимость при
  клавиатуре, вложенный фокус и feedback существующих модальных панелей.

### Modified Capabilities

None.

## Impact

Platform impact: shared — desktop web, mobile web, Android, iOS.
Localization impact: none; существующие RU/BE/UK/PL/EN ключи сохраняются.
Affected paths: восемь компонентов Task Contract, общий BottomSheet, guards,
package.json и targeted tests; точная матрица в design evidence.

Data/API: none; payloads/reports/awards/share не меняются. Dependencies: none,
связанные #2133/#2137 не блокируют. Fallback/mock policy: runtime acceptance
на реальном UI/API, unit mocks допустимы; accessible=false не заменяет migration.
Accessibility: основной результат. Performance: новых запросов/пакетов нет.
Security: auth/storage/URL boundaries неизменны. SEO: маршруты/метаданные не
затронуты. Analytics: события не меняются.

Non-goals: новые тексты, backend, release/signing, redesign paywall,
TravelSectionsSheet, произвольная переделка общего shell. Open questions: none.
