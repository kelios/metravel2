# #2434 — доступные нижние листы

Дата: 2026-10-15. Design evidence до реализации; runtime не запускался.
Источник: [Task Contract #2434](https://metravel.by/board#task-2434),
Problem key `A11Y-IOS-SHEET-BACKDROP-WRAPPER`.
OpenSpec: `openspec/changes/fix-accessible-modal-sheets/`.

## Preflight и результат

- Task type: исправление семейства a11y-дефектов; цель — отдельные элементы
  VoiceOver/TalkBack и достижимая отправка жалобы при клавиатуре.
- Task-owned paths: восемь компонентов ниже, `components/ui/BottomSheet.tsx`,
  regression guard в `scripts/`, `scripts/guard-modal-feedback.js`, их тесты,
  подключение guard в `package.json`; этот документ и OpenSpec.
- Platform impact: shared — desktop web, mobile web, Android, iOS.
- Localization impact: none; подписи из существующих ключей RU/BE/UK/PL/EN.
- Risk/operation gates: shared modal lifecycle, клавиатура, toast ownership;
  runtime только в `testing` после независимого code review.
- Validation: targeted Jest/guard tests, lint, typecheck; затем web 390/1440,
  iPhone Accessibility Inspector/клавиатура, Android TalkBack по Task Contract.

## Подтверждённые кандидаты

Строки ниже зафиксированы до правок. Для всех восьми source подтверждает
`Pressable`-фон, который оборачивает панель с `onPress={() => {}}`.
Runtime-дефект подтверждён карточкой только для жалобы; для остальных source
доказывает механизм, но не заменяет проверку доступности после миграции.

| Компонент | Evidence | Решение и контроль |
| --- | --- | --- |
| `components/safety/ReportReasonSheet.tsx` | 68–74; поле 122, submit 140 | BottomSheet; keyboard-aware; причины, комментарий, submit и close доступны раздельно; сохранить reset и success-close |
| `components/quests/ShareQuestResultSheet.tsx` | 360–371; поле 404, toast 444 | BottomSheet; keyboard-aware; heroName/onBlur, preview/channels и toast сохраняются |
| `components/achievements/ShareBadgeSheet.tsx` | 266–268; toast 332 | BottomSheet; сохранить loading/error/retry, disabled channels и modal-level toast |
| `components/achievements/AchievementsGalleryModal.tsx` | 151–153; detail 188 | BottomSheet; detail остаётся внутри presentation родителя; scroll и категории сохраняются |
| `components/achievements/AdminGrantRareAward.tsx` | 96–98; поле 161 | BottomSheet; keyboard-aware; success/loading/error, причины и submit сохраняются |
| `components/achievements/BadgeDetailSheet.tsx` | 191–204; share 292 | BottomSheet; earned/locked/progress и допустимость share по userBadgeId сохраняются |
| `components/achievements/PeerBadgePickerSheet.tsx` | 63–65; toast 145 | BottomSheet; loading/empty/toggle/count и modal-level toast сохраняются |
| `components/export/ThemePreview.tsx` | 423–430; centered styles 698–705 | Обоснованное исключение: это центрированный PaywallSheet. Сохранить centered dialog; sibling backdrop + неинтерактивный View card, удалить noop |

`TravelSectionsSheet` вне scope: карточка явно исключает его.

## Решение и границы reuse

Семь настоящих нижних листов используют единственный `BottomSheet`: его
`Modal`, sibling backdrop, header/close, touch boundary, свайп и общие insets.
Не оставлять вторую шапку/кнопку закрытия внутри тела. Использовать существующие
заголовки и accessibility labels. Название API badge остаётся API-контентом.

Узкие backward-compatible опции общего компонента:

- `keyboardAware?: boolean`: opt-in для жалобы, admin и quest share;
  keyboard avoidance внутри Modal, чтобы измеряться в его viewport. iOS —
  KeyboardAvoidingView с padding; Android — штатный adjustResize нативного
  Modal без дополнительного KeyboardAvoidingView и двойного отступа IME. Scroll остаётся shrinkable и
  `keyboardShouldPersistTaps="handled"`; комментарий не перекрывается,
  submit достижим при открытой клавиатуре. Не менять focus owner при появлении IME.
- `panelStyle?: StyleProp<Pick<ViewStyle, 'maxHeight'>>`: сохранить нужную исходную высоту
  (report/admin 85%, gallery 90%, peer 80%) вместо безусловного перехода на
  текущий общий предел 72%. Не переносить дублирующие insets и шапки.
- `modalContent?: ReactNode`: modal-level slot для toast overlay, полноэкранный sibling панели внутри
  того же Modal. `ModalToastHost` нельзя перенести в координаты панели:
  `ToastHost.tsx` использует absolute-fill layer.

Сохранить Gallery → Detail → Share presentation hierarchy и обратное закрытие:
не переносить child Modal из Gallery наружу только ради упрощения JSX. Закрытие
верхнего листа не должно закрывать родителя; проверить повторное открытие.

`scripts/guard-modal-feedback.js` (#2440) структурно распознаёт прямой Modal.
Миграция должна научить его распознавать импорт BottomSheet, включая alias,
и retained host в modal-level slot. Сохраняются policies:
share/peer/quest имеют ровно один host с matching visible; ReportReasonSheet
остаётся transient `report-parent`, успех закрывает лист и toast принадлежит
retained родителю/app root. Не вводить exemption по имени файла.

Web использует RNW Modal focus trap/active modal stack/restore и
`onRequestClose` для Escape. Source:
`node_modules/react-native-web/dist/exports/Modal/ModalFocusTrap.js` и
`ModalContent.js`. Не добавлять конкурирующий global trap; проверить Tab,
Shift+Tab, возврат фокуса, Escape и backdrop у вложенных листов на runtime.
Компенсация viewport-width из quest share (`e7794e549`) переносится в общий
root BottomSheet: `useWindowDimensions` обновляет web-ширину при resize, native
ширину не переопределяет; SSR width=0 оставляет естественный размер. Существующий
`e2e/quest-finale-share-sheet.spec.ts` проверяет центр кластера каналов на desktop
1280 с погрешностью не более 2px; выполнить его в `testing` при classic scrollbar.

Новый guard проверяет JSX/AST ancestry и именно пустой onPress у вложенного
Pressable, с импортами/alias. Удаление noop без удаления wrapper не является
исправлением. Positive/negative fixtures должны доказывать sibling layout,
alias, вложенный wrapper и непустые обработчики. Guard входит в lint.

## Варианты, риски и откат

Выбран общий shell, потому что он уже держит touch/inset/swipe contracts
(#2231, #2153). Отклонены `accessible={false}` в восьми местах и отдельный
новый sheet primitive: они сохраняют дублирование и риск повторения механизма.
Для centered paywall отклонён перенос вниз: меняет имеющийся UX без требования.

Главные риски: обрезка длинного тела новым пределом высоты; двойной keyboard
inset; исчезновение/ошибочное позиционирование toast; одновременные sibling
native Modal; регресс scroll/touch boundary; двойной web focus trap.
Контроль — перечисленные ниже проверки. Откат: revert полного согласованного
task diff, включая guard integration и wrapper props; без data migration.

API/data/backend dependencies: none; `POST /api/reports/`, award и share
контракты неизменны. Apple capabilities/portal/legal actions: none.
Privacy/signing/build numbers/entitlements: none. URL/SEO, analytics и
security boundaries не меняются; новых requests, media URL и пакетов нет.
Сохранить external link helpers и обработку ошибок исходных consumers.

## Slices, owners и Done gate

1. Executor: общий shell/keyboard/overlay + targeted regression tests;
   achievements и остальные consumers могут иметь отдельных владельцев файлов.
2. Executor: migration семи листов, centered exception и два согласованных
   AST guards; не править чужие изменения общего checkout.
3. Независимый `review-auditor`/`ios-reviewer`: полный diff и static/unit/guard
   checks; затем `code-review-gate` перед `testing`.
4. Tester: runtime evidence ниже. Release operator нужен только для отдельно
   разрешённого store stage; текущая задача store build не требует.

| Поверхность/слой | Проверка |
| --- | --- |
| Code-level | Targeted Jest листов/BottomSheet/guards, `npm run lint`, typecheck; позитивные и негативные guard fixtures |
| iPhone simulator | iPhone 17 Pro, iOS 26.5: причины (минимум 6), комментарий, submit/close раздельно в Inspector; keyboard-on submit; каждый мигрированный лист; gallery/detail/share назад |
| iPad simulator (optional risk check) | При доступности — длинное тело, scroll и keyboard-on в portrait/landscape; не обязательный Task Contract gate |
| Android | TalkBack report causes/comment/submit/close; keyboard/scroll контроль затронутого shell; физический/эмуляторный слой явно указать в evidence |
| Web 390 и 1440 | На проде task SHA: Tab/Shift+Tab, Escape/backdrop, повторное открытие и фокус; share/peer toasts, длинные тела и centered paywall |
| Locales | Новых текстов нет; существующие i18n labels сохраняются, `test:i18n` по Task Contract не требуется |

Done gate карточки: зелёные code-level checks/review, commit в origin/main,
web deploy и production acceptance; iOS Inspector на локальном стеке
localhost:8000. Android TalkBack указан в Platform impact/Validation карточки,
поэтому его evidence не терять из-за краткой формулировки Done gate.
Physical Apple/TestFlight hardware proof неприменим: hardware/signing API нет.
Этот документ не утверждает runtime pass.
