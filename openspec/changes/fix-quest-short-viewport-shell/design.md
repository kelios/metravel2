## Context

Мотивация и границы — `proposal.md`; поведение — `specs/quest-responsive-shell/spec.md`; парный макет и состояния — `docs/features/quest-short-viewport-shell-design.md`.

Механизм подтверждён чтением: `QuestWizard.tsx:860` монтирует `QuestHeaderPanel` перед единственным `ScrollView:894`; `questWizardShell.tsx:683–690` содержит status и route/locale sibling. `useQuestWizardResponsiveModel.ts:63–79` уже получает высоту, но compactNav определяется только width<600. `headerStyles.ts` резервирует 52 px, `shellStyles.ts` ещё 16 px до содержимого. Историческая независимая production-приёмка: 122/162 px, 28 коротких FAIL и 28 обычных PASS. Источник: карточка #2198 и `.codex-temp/publish-20261007/cls-following-first/acceptance/2198-contract-conflict-handoff.md`.

Problem Memory: полный board прочитан 08.10 (2335 уникальных задач, все 8 статусов); competing open shell-height карточки нет. Решение reuse #2198, связанные #2147/#2148/#2298. До этого planning change отдельной записи QUEST-CONTENT-L10N-001 в registry не было; новая подтверждённая причина фиксируется с этой цепочкой, а планируемый control не объявляется уже выполненным.

## Goals / Non-Goals

**Goals:** единая доменная политика короткой высоты, одна панель и прежняя прокрутка; неизменные budgets, полная доступность маршрута/языка и устойчивость ввода.

**Non-Goals:** менять глобальные header/dock/viewport providers, локализацию текста, API/offline queue, native-specific ветки или геометрию unrelated screens. Desktop/tall placement остаётся прежним.

## Decisions

1. **Продуктовая граница 840 CSS px.** `compactNav && headerInScreenRow && layoutHeight < 840` выбирает flow. Высота без клавиатуры берётся из уже существующего layout snapshot (`useResponsive`, `viewportMetrics`), не из visualViewport keyboard overlap. 840 оставляет обычному закреплённому варианту читаемую область около 678 px при известных 162 px chrome и сохраняет контроль 844. UI не импортирует бюджеты/QA selectors. Существующий бюджетный минимум 640 остаётся обязательным; ниже него проверяется достижимость действий, а не выдуманный PASS ratios.
2. **Перенос единственного доменного header.** В short flow панель — первый ребёнок прежнего ScrollView, с нулевыми внешними вертикальными отступами и нулевым entrance padding. Горизонтальные16px и внутренние отступы карточки сохраняются. В tall остаётся нынешняя композиция. Не дублировать ScrollView, mainContent или header; не менять contentScrollRef, keyboard handlers и reset только при смене точки.
3. **Безопасный переход вместо потери transient state.** `QuestRouteStrip.tsx:33` владеет sheetOpen: перемещение между родителями перемонтирует strip даже с key. Поэтому короткую/tall смену откладывать при открытом route sheet и активном вводе/клавиатуре, а также во время scroll gesture. Это правило действует для высоты, ширины (599↔600) и ориентации. Минимальная доменная связь сообщает родителю busy state; wrapper существующих focus/blur/scroll handlers не должен поглощать их вызовы. После close/blur/scroll-idle применить последнее актуальное решение, не промежуточную очередь, и компенсировать anchor читаемого mainContent. Фокус route trigger после закрытия также сохраняется при необходимости переноса. Это не перенос состояния API и не новый глобальный provider.
4. **Статусы и язык сохраняют смысл.** Одна statusSlot-панель перед route; pending/photo не смешиваются с localeSlot. Locale остаётся пассивным sibling Pressable. Без языка существующая RU/translated route branch неизменна. Офлайн использует уже сохранённый contentLocale, без нового запроса.
5. **Отвергнутые варианты.** Padding-only оставляет минимум54+44+56=154px pinned против126.08px на640. Скрытие/уменьшение targets и повышение порогов нарушают контракт. Исключение только320px лечит ширину вместо высоты. Always-inside sticky header меняет tall-scroll композицию и collector lineage. Дублирование двух header/scroll веток теряет фокус и создаёт два владельца действий.

### Ownership и reuse

Apply-owned paths: `components/quests/hooks/useQuestWizardResponsiveModel.ts`, `components/quests/QuestWizard.tsx`, `components/quests/questWizardShell.tsx`, `components/quests/questWizardStyles/{headerStyles,shellStyles}.ts`; минимальные busy-state связи в `QuestRouteStrip.tsx` и существующем keyboard hook при необходимости; соответствующие responsiveModel/route/header/keyboard/offline tests; `docs/features/{quests,mobile-screen-shell-mock,quest-short-viewport-shell-design}.md`. Уточнение старого status-комментария locale notice допустимо без поведения. API/auth/global chrome paths не owned.

Data/API contract: optional доменный placement/busy props, существующие ReactNode contentLocaleSlot/statusSlot и RouteModel; сетевые request/response types не меняются. Guest/auth route producers, shared offline wizard и existing screen header используют те же данные. Backend #2193 done; его прежний blocker снят, геометрия остаётся scope #2198; translated fixture проверяется реально, отсутствие переводов нельзя выдавать за успех такого контроля.

### Accessibility, performance и смежные риски

Сохранить полные a11y labels, headings, 44px targets и modal semantics. При resize никакого потерянного focus, закрытия листа или невидимой клавиатурой формы. Новых fetch/media dependencies нет; отсутствие перемонтирования mainContent доказывается meaningful mounted-state test и runtime trace. SEO/URL/SSG, sanitization/external-link/auth boundaries, analytics events и print/search/share producers не меняются; сравнить точные producer hashes с историческим evidence. Если реально пересечены — повторить соответствующий сценарий, а не ссылаться на старый PASS.

## Risks / Trade-offs

- First98px лишь на1.2px ниже640-бюджета → фактический marker/бордер/отступ доказываются после выката, не на основании макета.
- Перенос header remounts его локальный sheet → defer перехода; отдельный regression на resize открытого листа.
- Browser toolbar пересекает breakpoint при scroll → отложить до idle, применить один последний mode с anchor compensation; не превращать visual keyboard в height trigger.
- Поддерево mainContent сдвигается по позиции children → стабильная идентичность/ключ и mounted-state check; один ScrollView host обязателен.
- Pending/photo увеличивает высоту → отдельная реальная проверка видимости и действий; безstatus budget не приписывается этим состояниям.
- Future shared source затронет native размеры → platform boundary source review обязателен; native runtime PASS не заявляется контрактом web-only приёмки.

## Validation matrix

Бюджетные helpers/limits и существующие producers `data-screen-content="first"` не входят в apply-owned paths. Маркер остаётся на прежнем содержимом интро/шага/финала, не переносится на маршрут ради 98 px. Сохраняются исходные 14 cases/56 rows и семантика обоих collectors; проверяется реальная геометрия того же контентного блока.

| Этап / поверхность | Обязательное доказательство |
|---|---|
| Code-level | meaningful regression RED→GREEN: short/tall boundary839/840, 599/600, одно mainContent/ScrollView/ref, defer sheet/input/scroll и anchor, route action/full locale, offline и keyboard state; targeted Jest, lint/typecheck/guards, test:i18n |
| Review | независимый review-auditor repair+полный diff; затем независимый code-review-gate. Без runtime на review |
| Production320×640/390×844 | исходные14 cases/56rows light/dark×RU/реальные translated/foreignBE/UK/PL/EN, прежние budgets, screenshot/console/network/source pin |
| Productionboundary/interaction | 390×640, 839/840, resize640↔844 и width599↔600, scroll-out/back, route sheet + current row, input value/focus/keyboard, orientation/browser toolbar, intro/step/finale |
| Productiondesktop1440 / offline | прежнее tall/completion размещение; настоящая saved foreign copy без сети; естественные pending/photo controls; loading/error/retry без ложного progress write |
| Producers | актуальные fingerprints печати/поиска/шаринга/пилотов и provenance; пересечение — точный повтор реальных исходных сценариев; старый Luxembourg PL fixture сначала проверить |

## Migration Plan

Отдельный apply-запрос владельца получен 08.10.2026 после предъявления planning artifacts. Для применения: зафиксировать согласованный короткий контракт на борде/docs, выполнить tasks. По standing AGENTS task pipeline: source review/gate → явный task-path commit/push → testing → единственный canonical exact-SHA deploy → production acceptance → done. Rollback — revert только task-owned commit и canonical deploy прежнего SHA, без отката чужих данных/переводов. Никакой миграции данных, store или backend write.
