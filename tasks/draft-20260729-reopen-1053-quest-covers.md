# BOARD UPDATE DRAFT: reopen #1053 — `/quests` oversized/eager cover recurrence

Status: Testing
Owner: Developer
Support: Performance Analyst, Reviewer, Releaser
Created: 2026-07-29
Updated: 2026-07-29

> Временный fallback-черновик. MCP task board не стартует: `.mcp.json` ссылается
> на отсутствующий backend checkout и `tools/mcp_server`; прямые board writes
> через `curl` запрещены. После восстановления MCP применить этот update к
> существующей карточке `#1053`, не создавать новый competing ticket, затем
> удалить файл.

## Board payload

- action: `reopen/update #1053`
- area: `front`
- kind: `bug`
- status: `testing`
- sprint_id: `2` (сохранить sprint канонической карточки)
- related_to_ids: `1052`, `857`, `1101`, `1111`, `1113`, `1137`
- problem key: `MEDIA-001`
- problem-memory verdict: `reopen` — тот же `/quests` surface и тот же нарушенный
  invariant, несмотря на новый shared Safari cause.

## Goal

Вернуть `/quests` в bounded loading contract: карточка около 420 CSS px не
просит `w=1280`, а Safari не превращает все offscreen covers в eager. Карточка
может считаться исправленной только после повторного измерения живого prod URL.

## Recurrence Log — 2026-07-29

- Prior canonical task: `#1053`, закрыта 2026-07-23.
- Failed invariant: только две above-the-fold covers eager; выбранный proxy
  variant соответствует реальному CSS slot и page-wide byte/request budget.
- Production evidence: 137 quest cover `<img>` в DOM; 2 eager и 135 lazy в
  desktop Chrome, но `currentSrc` у каталога — `w=1280` в слоте около 420×287.
  Первые десять cover assets уже стартуют на initial viewport. В коде production
  сборки iPhone Safari promoted lazy shared-blur covers to eager.
- Cause comparison: `266a43bf` добавил DPR до 2 и ladder до 1280, а тест проверял
  только DPR 1; `29418f3f` позже удалил узкий Safari lazy opt-in и тестом закрепил
  глобальный eager fallback. Это новый shared regression внутри той же FE
  invariant/surface.
- Previous Done-gate gap: final evidence называлось `production-backed preview`;
  не было одинакового live URL probe для DPR 2 и iPhone Safari, page-wide byte
  budget и regression guard против общего lazy→eager promotion.
- Corrective layer: `QuestCard` + shared Safari loading policy + route-level
  production network budget.

## Acceptance Criteria

- [x] В текущем `main` web catalog игнорирует device DPR для cover budget и
      выбирает из `[320, 480, 640, 800]`; 420 px card → `w=480` даже при DPR 2/3.
- [x] Quest catalog cover не использует blur backdrop; offscreen iPhone Safari
      card сохраняет `loading=lazy`.
- [x] Unit regression покрывает DPR 2/3, `w=480`, отсутствие `w=1280`, no-blur
      Safari lazy и Android bounded `w=800`.
- [ ] После deploy живой `https://metravel.by/quests` на desktop Chrome DPR 2:
      первые две covers eager, остальные lazy; card 420 px получает `w<=480`.
- [ ] На реальном iPhone Safari initial load не стартует все 137 covers, cards
      не остаются blur-only, а scroll догружает их постепенно.
- [ ] Initial cover transfer bytes и число started covers приложены before/after;
      zero quest-cover 4xx/5xx и zero `capacity-rejected` для начавшихся requests.

## Gherkin Tests

```gherkin
Feature: Bounded quest catalogue covers

  Scenario: Retina desktop does not request a hero-sized cover
    Given a 420 CSS pixel quest card on a DPR 2 display
    When /quests renders on production
    Then the selected cover width is at most 480 pixels
    And only the first two cards are eager

  Scenario: iPhone Safari keeps offscreen cards lazy
    Given the full 137 quest catalogue on iPhone Safari
    When the page opens without scrolling
    Then offscreen covers do not all initiate requests
    And every visible card reveals a sharp cover
```

## Task Contract

Scope: `screens/tabs/QuestCard.tsx`, Safari loading behavior in
`components/ui/ImageCardMedia.tsx`, focused tests, live `/quests` network probe.

User-visible result: каталог быстро открывается, не создаёт cover burst и не
оставляет карточки размытыми.

Data/API contract: без изменений; существующие quest cover URLs проходят через
поддерживаемые proxy widths.

Platform impact: desktop web и mobile web; shared/native code требует paired
Android smoke, но Android cover DPR contract остаётся bounded до 800.

Localization impact: none.

Dependencies: production deploy нужен только для финального live verification;
это не `blocked_by`, задача остаётся `testing`.

Fallback/mock policy: no mock/fallback as Done evidence; test mock дополняется
реальным live DOM/network probe.

Validation: focused Jest, desktop Chrome DPR 2, mobile web, iPhone Safari,
Android paired quest list flow, cold/warm request and byte measurements.

Regression control: route budget должен падать при `w=1280` для 420 px quest
card или при eager count >2 до scroll; unit guard фиксирует DPR/Safari branches.

Done gate: только после deploy и повторного live-URL before/after evidence. До
этого формулировка результата — `local fix ready; production verification pending`.

## Progress Log

- 2026-07-29: production recurrence reproduced; current `main` contains the
  bounded DPR/Safari fix and focused tests, but production still serves old
  behavior. Prepared board reopen payload; status must be `testing`, not `done`.

