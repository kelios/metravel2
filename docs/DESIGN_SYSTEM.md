# Design system

This document records product-level design-token decisions that are too broad for
one component but too specific for `docs/RULES.md`.

## Orange accents

Status: accepted, 2026-07-02.

The project keeps one orange family with explicit semantic roles instead of
collapsing all orange values into a single token. The values are intentionally
close, but they are not interchangeable:

| Token | Value | Role |
| --- | --- | --- |
| `brand` | `#f5842c` | Primary warm orange for brand marks, logo-adjacent accents, and non-text visual emphasis. |
| `brandDark` | `#e07020` | Hover/active depth for brand accents. |
| `brandText` | `#b35900` | Orange text on light surfaces; use instead of `brand` for readable text and icons. |
| `brandLight` | `#fff8f3` | Warm brand-tinted background. |
| `brandSoft` | `rgba(245, 132, 44, 0.10)` | Soft brand highlight. |
| `bookPageAccent` | `#b35900` | Static accent for always-light book-page surfaces. |
| `travelPoint` | `#ff922b` | Travel-point/category marker accent. |
| `mapPin` | `#ff8a00` | Map pin accent that must remain legible against OSM/Leaflet tiles. |

Decision:

- Keep `travelPoint` and `mapPin` as separate semantic tokens. They represent
  map/travel affordances, not general brand CTAs.
- Do not use raw Tailwind amber/orange hex values in app components. New orange
  UI should choose an existing semantic token first.
- Use `brandText` or `bookPageAccent` for orange text on light surfaces. Do not
  use `brand` as text on light backgrounds.
- If a future screen needs a new orange role, add a named token with a documented
  semantic purpose instead of adding an ad-hoc hex literal.

Sources:

- Runtime tokens: `constants/designSystem.ts`
- Palette values: `constants/modernMattePalette.ts`
- Web CSS variables: `app/global.css`

## Primary foreground contrast

Status: accepted, 2026-07-02.

The light-theme `primary` token (`#7a9d8f`) is kept unchanged as a brand/UI
surface accent. It is not the default foreground color for text or icons on
light surfaces because its contrast against white is below the project target
for foreground UI.

Use these roles instead:

| Role | Token | Contrast target |
| --- | --- | --- |
| Text and links on light surfaces | `primaryText` (`#547769`) | WCAG AA for normal text. |
| Icons, active glyphs, and small foreground UI | `primaryDark` (`#6a8d7f`) | At least 3:1 for non-text UI. |
| Backgrounds, fills, progress, and soft accent surfaces | `primary`, `primaryLight`, `primarySoft` | Not foreground text. |

Decision:

- Do not darken `primary` globally without an explicit owner decision; it is a
  broad brand-token change.
- New text-style declarations should use `primaryText`, not `primary`.
- New icon/glyph props should use `primaryDark`, not `primary`, unless the icon
  sits on a dark surface where the themed runtime color already provides enough
  contrast.

## Mobile pattern: secondary tool actions (`ui/ToolActionsRow`)

Status: accepted, 2026-07-25.

Вспомогательные инструменты рядом с полем или секцией (диктовка, импорт текста,
вставка из буфера, копирование, экспорт) на телефоне не должны быть рядом
полноразмерных кнопок с подписями: три таких кнопки переносятся «лестницей» и
съедают больше экрана, чем само поле.

Канонический шаблон — `components/ui/ToolActionsRow.tsx`:

| Поверхность | Вид |
| --- | --- |
| desktop web | иконка + подпись (`ui/Button` c `icon` + `label`) |
| mobile web, Android и iPhone | icon-only 44/48dp в ОДНУ строку, подпись уходит в `accessibilityLabel` |

Правила:

- Режим берётся из вьюпорта (`useResponsive`), а не из `Platform.OS`: mobile web,
  Android и iPhone обязаны получить один и тот же ряд (mobile parity в
  `docs/RULES.md`).
- `label` обязателен всегда и должен быть осмысленным: на телефоне он остаётся
  единственным доступным именем кнопки для screen reader.
- Иконка обязана быть «говорящей» из набора Feather (`mic`, `upload`,
  `clipboard`, `download`, `copy`), иначе действию нужна подпись и оно не
  подходит для этого ряда.
- Когда одна иконка обслуживает несколько соседних действий (три `download`:
  GPX, KML, исходный файл), различить их в icon-only виде нельзя — такому
  действию задаётся `compactLabel`: короткое слово остаётся видимым и на
  телефоне, а полное название уходит в `accessibilityLabel`. Ряд при этом
  по-прежнему одна строка, поэтому `compactLabel` — одно слово или аббревиатура
  формата, а не фраза. Пример —
  `components/trips/planning/TripRouteDownloadButtons.tsx` (TestFlight 1.0.5 (8),
  «иконки непонятные что они значат»).
- Первичное действие шага/экрана (Сохранить, Далее, Опубликовать) в этот ряд не
  кладём: у него подпись обязательна на любой ширине.
- Недоступное на платформе действие не рендерим как навсегда `disabled`-кнопку:
  такой контрол занимает место и выглядит как баг. Пример — диктовка через Web
  Speech API: она есть только в браузере, поэтому в приложении кнопки нет, а
  вместо неё остаётся подсказка про микрофон системной клавиатуры
  (`components/travel/ContentUpsertSection.tsx`).

## Mobile pattern: rich-text toolbar docked below the editor

Status: accepted, 2026-07-25.

Панель форматирования rich-text редактора на телефоне пристёгнута СНИЗУ
(док-бар над клавиатурой), а не над текстом.

Причина: системное меню выделения Android и iOS («Вырезать / Копировать / …»)
рисуется поверх выделенного текста и перекрывало верхнюю панель — в момент, когда
пользователь выделил слово, чтобы поставить ссылку или вставить картинку, кнопки
оказывались недоступны.

Контракт держат обе поверхности:

- Android/iPhone native: `components/article/articleEditorNativeHtml.ts` — `#toolbar`
  идёт после `#editor`, `border-top`, у `.ql-editor` нижний запас 72px.
- mobile web: `components/article/QuillEditor.web.tsx`, блок
  `@media (max-width: 767px)` — `order: 2` у `.ql-toolbar`, `order: 1` у
  `.ql-container`, тот же нижний запас.

Desktop web оставляет панель сверху: там нет системного меню выделения поверх
контента.

## Intentional exceptions to the canonical `ui/Button`

Status: accepted, 2026-07-19.

`components/ui/Button.tsx` is the canonical button primitive. It exposes only
**semantic** variant colors (`primary`, `secondary`, `ghost`, `danger`,
`outline`, `soft`, `danger-outline`) and a single icon slot (`icon` +
`iconPosition`). This is by design: the primitive intentionally does not carry
per-brand colors outside the semantic palette, and does not carry transient
self-toggling states. New buttons should use the primitive unless they are
listed below as a documented exception.

### `components/travel/ShareButtons.tsx`

Status: accepted exception, task #1013 (FE-BTN-1).

`ShareButtons` stays a context-specific component and is **not** migrated to
`ui/Button`. Rationale, grounded in the current implementation:

- **Per-brand icon color, not a semantic variant.** Each share action paints its
  `Feather` icon with a brand-specific color drawn from a `palette` `useMemo`
  (`export` → warning/accent, `telegram` → accent, `vk` → info, `whatsapp` →
  success) on a shared neutral surface. These are brand affordances, not the
  semantic role colors the canonical `Button` exposes, so they fall outside the
  primitive's palette by design.
- **Transient success toggle.** The copy action carries an ephemeral "copied"
  state (`copied` flag + a timer that clears it after ~2s), swapping the tile to
  the `buttonCopied` style (`colors.successSoft` background) and rendering a
  `Feather name="check"` glyph. The canonical `Button` deliberately has no
  self-toggling success state.
- **Multi-mode composition.** The component renders in two layouts — a `sticky`
  icon-only round variant and a grouped icon+label variant with sections
  (including a dedicated PDF-export group) — plus a collapsed mode on mobile and
  a lazily loaded PDF-export bridge. This layout/state machinery is specific to
  the share affordance and is not something the single-shape primitive models.

Because these requirements sit outside the canonical `Button`'s semantic,
single-icon, stateless contract, `ShareButtons` is kept as a deliberate
exception rather than forced onto the primitive. If the primitive later grows a
brand-color or transient-state contract, revisit this entry.

New exceptions should be added here with the same shape — component path, the
specific contract it needs that the primitive does not provide, and the task
reference — so that "why isn't this a `ui/Button`?" always has a documented
answer.

## Резерв места под плавающей нижней панелью (`--mt-dock-h`, `--mt-consent-h`)

Load-bearing web-контракт. На мобильном web поверх контента висят два класса
плавающих панелей — постоянный `BottomDock` и временные плашки (consent-баннер,
`AppInstallBar`). Оба резерва живут в CSS-переменных, потому что контент
скроллится под ними, а не рядом.

**Кто пишет переменные**

- `--mt-dock-h` — статически в `app/global.css:477`: `0px` на desktop и
  `calc(56px + env(safe-area-inset-bottom, 0px))` при `max-width: 1023px`.
  Ничего в рантайме её не выставляет.
- `--mt-consent-h` — динамически, через `utils/bottomChromeReserve.ts`.
  Владельцы регистрируются по имени (`setBottomChromeReserve(owner, px)` /
  `releaseBottomChromeReserve(owner)`), в CSS уходит **максимум** по всем
  владельцам. Сегодня владельцев двое: `components/layout/ConsentBanner.tsx` и
  `components/layout/AppInstallBar.tsx`. Именно поэтому там реестр, а не одна
  запись: панель, скрывшаяся последней, иначе стирала бы резерв ещё видимой
  соседки.

**Кто читает**

Любой скролл-контейнер или нижняя закреплённая панель, которую иначе закроет
плашка: `components/home/Home.tsx`, `components/listTravel/useRightColumnStyles.ts`,
`components/travel/details/TravelStickyActions.tsx`, `components/auth/LoginForm.tsx`,
`screens/tabs/PlacesScreen.styles.ts`, `components/MapPage/MapMobileLayout.styles.ts`,
`components/quests/QuestConsentGate.tsx`, `components/trips/planning/plannedTripScreen.styles.ts`,
`app/(tabs)/trips/[id].tsx`, `app/(tabs)/trips/plan/create.tsx`.

**Как читать правильно**

- Всегда через `max()` с базовым отступом и всегда с fallback `0px`:
  `calc(max(var(--mt-dock-h, 0px), var(--mt-consent-h, 0px)) + 10px)`. Голая
  переменная без `max()` уменьшает существующий отступ на desktop, где она `0px`.
- Резерв — только web. На native тот же зазор считается из
  `useSafeAreaInsets()` + `LAYOUT.tabBarHeight`; CSS-переменных там нет.
  В RN-стилях значение уходит через `Platform.select({ web: ..., default: ... })`
  и приводится `as unknown as number`.
- На Android padding у `contentContainer` не всегда даёт дотянуться до
  последнего CTA — там вместо отступа ставится отдельный пустой `View`
  (`app/(tabs)/trips/[id].native.tsx`, `testID="trip-detail-bottom-reserve"`).

**Как проверяется**

Мобильный вьюпорт (≤560px) со **сброшенным** согласием: последний CTA страницы
и нижние закреплённые кнопки не перекрыты плашкой, при этом на desktop нижний
отступ не вырос. Регрессии закрыты `__tests__/app/tripDetailScreen.dockReserve.test.tsx`,
`__tests__/components/MapPage/MapMobileLayout.test.tsx` и
`__tests__/app/mapAttributionCss.test.ts`.
