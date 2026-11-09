# Design system

This document records product-level design-token decisions that are too broad for
one component but too specific for `docs/RULES.md`.

## Быстрый выбор токенов и компонентов

| Что нужно | Источник | Как применять |
| --- | --- | --- |
| Цвет текста, фона, границы и состояния | `hooks/useTheme.ts` → `useThemedColors()` | Выбирать семантическую роль. Палитра живёт в `constants/modernMattePalette.ts`, токены — в `constants/designSystem.ts`, веб-переменные — в `app/global.css`. |
| Раскладка, отступы, ширина контейнеров | `constants/layout.ts` → `METRICS` | Для новых правил раскладки опираться на эту шкалу. Ключи `METRICS.spacing` и `DESIGN_TOKENS.spacing` имеют разные значения, например `xs` равен 4 и 8 соответственно. При миграции сверять роль и значение. |
| Радиусы и тени | `METRICS.borderRadius`, `DESIGN_TOKENS.radii`, `shadows` и `shadowsNative` | Переиспользовать оформление выбранного компонента. Для нового паттерна определить одну семантическую роль и проверить светлую и тёмную темы. |
| Заголовок и подпись | `components/ui/Typography.tsx` | `Heading` задаёт уровень, `Body`, `Caption`, `Label` и `Eyebrow` задают роль текста. Для адаптивного первого кадра следовать реестру `headingLayout.ts`. |
| Точки переключения режима | `METRICS.breakpoints` и `utils/breakpointLayout.ts` | Проверять первый кадр до гидратации и тот же режим после неё. |

### Действующие компоненты

| Назначение | Компонент | Основной контракт |
| --- | --- | --- |
| Действие с подписью | `ui/Button` | `label`, `variant`, `size`, `loading`, `disabled`. Подпись переносится. |
| Действие с иконкой | `ui/IconButton` | Иконка из Feather и доступное название. Размеры целей `sm` и `md` — 44 и 48. |
| Внутренний переход | `ui/LinkPressable`, `ui/NavigationLink` для строки меню | `href` сохраняет адрес на вебе. Обычный клик — переход приложения, модифицированный клик — штатное поведение браузера. |
| Внешний переход | `utils/externalLinks.ts`, для отдельной карточки `ui/ExternalContentLinkCard` | Проверка назначения и политика открытия в общем слое. Оформление карточки выбирается по контексту. |
| Фильтр или выбор | `ui/Chip`, `ui/SelectionGroup` | Видимое состояние выбора и доступная семантика группы. |
| Группа инструментов | `ui/ToolActionsRow` | Текстовые кнопки или компактные иконки по ширине. Подробности ниже. |
| Карточка путешествия и фото | `ui/UnifiedTravelCard`, `ui/ImageCardMedia` | Фото сохраняет пропорции. Свободная область заполняется цветом из манифеста на вебе и слоем Expo Image на native. |
| Пустота, загрузка, ошибка | `ui/EmptyState`, `ui/SectionSkeleton`, `ui/SkeletonLoader`, `ui/ErrorDisplay` | Для пустоты задать `density`. Каркас сохраняет ожидаемые размеры, ошибка предлагает повтор там, где он возможен. |
| Меню действий и подтверждение | `ui/ActionListSheet`, `ui/ConfirmDialog` | У опасного действия своя семантика. Переход между листом и диалогом учитывает закрытие первого. |
| Панель фильтров веб-каталога | `layout/CatalogFilterPanel`, `layout/catalogFilterPanelGeometry`, `layout/CatalogFilterCloseButton` | Общие отступы, заголовок и адаптивная геометрия. Поиск и места используют модальное окно, квесты сохраняют каркас с выдвижной панелью. Контроллеры разделов ведут выбор и сброс. |
| Контейнер и общая навигация | `layout/ResponsiveContainer`, `layout/ResponsiveStack`, `layout/CustomHeader`, `layout/BottomDock` | Раскладка экрана и навигация сайта с учётом мобильных резервов. |

Веб-панели разделов, оформление ссылок и порядок их миграции описаны в
[веб-эталоне и таблице охвата](design/web-ui-foundations.md).

### Интерактивный каталог

Запуск из корня проекта: `npm run design:catalog`. Откройте
`http://localhost:8084` и переключите тему или ширину колонки.
Для проверки мобильных брейкпоинтов меняйте ширину окна браузера.
Примеры используют общие компоненты, отдельный Expo Router и локальные данные.
На широком экране видна встроенная панель, в узкой колонке доступна кнопка
её открытия. Строка оглавления позволяет проверить выбранное состояние и фокус.
Вход в каталог находится в `tools/ui-catalog`, отдельно от маршрутов сайта.

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

## Base artistic web appearance

The ordinary web appearance uses an atlas motif: warm daylight, contour lines,
an evergreen evening palette in the decorative backgrounds, and amber logo light.
Its `--base-atlas-*` variables belong to `app/global.css`; semantic `--color-*`
roles and their shared/native/critical fallbacks stay canonical. Art is confined
to the header, logo and home hero background and excludes every active seasonal
appearance with `html:not([data-season])`. See `docs/features/base-theme.md`.

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

## Подписи кнопок

- Текстовая кнопка использует `ui/Button` и показывает полное название действия.
  При нехватке ширины подпись переносится, а кнопка растёт по высоте.
- В группах основных действий кнопки обычно занимают ширину по содержимому.
  Если места мало, группа переносит кнопки на следующие строки. На телефоне
  их можно сразу расположить вертикально на всю ширину. Равная ширина допустима,
  если все подписи остаются читаемыми.
- Для текстовых кнопок задавайте минимальную высоту, чтобы подпись помещалась
  при увеличении шрифта и во всех локалях RU/BE/UK/PL/EN. Явный
  `labelNumberOfLines` допустим в согласованных компактных паттернах, например
  в `ToolActionsRow` с короткой видимой подписью и полным доступным названием.

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

Подпись не сжимается, ряд переносится (с 2026-09-23, #2053). Кнопка с видимой
подписью — обычной или `compactLabel` — не бывает уже своей подписи: не хватает
ширины — ряд переносит кнопку на следующую строку, а подпись длиннее всего ряда
встаёт в две строки. Многоточие и сжатие до нуля запрещены: до правила ряд
держался одной строкой за счёт `flexShrink: 1`, и на проде «GPX»/«KML» на 320 px
были пустыми кнопками с одной иконкой. Одной строкой остаётся только icon-only
ряд. Инвариант держат jest `__tests__/components/ui/ToolActionsRow.test.tsx` и
e2e `e2e/planned-trip-route-tab-labels.spec.ts` (все кнопки вкладки «Маршрут»
на 320/390/1440).

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
  телефоне, а полное название уходит в `accessibilityLabel`. `compactLabel` —
  одно слово или аббревиатура формата, а не фраза: так подписанный ряд реже
  переносится. Пример — `components/trips/planning/TripRouteDownloadButtons.tsx`
  во вкладке «Экспорт» (TestFlight 1.0.5 (8), «иконки непонятные что они
  значат»).
- Первичное действие шага/экрана (Сохранить, Далее, Опубликовать) в этот ряд не
  кладём: у него подпись обязательна на любой ширине.
- Блок, где файловые действия — главное содержимое, а не инструменты при поле,
  ставит ряд с `compact={false}` и `fill`: подписи полные на любой ширине, одна
  кнопка занимает ряд целиком, две делят его поровну. Пример — блок «Файл
  маршрута» вкладки «Маршрут» (`TripRouteImportPanel`, `TripRouteDownloadButtons`
  с `fill`): импорт во всю ширину, GPX и KML поровну, «Скачать»/«Удалить» в
  карточке каждого оригинала (по карточке на файл, #2069). Раскладка «стопка» — вариант A макета
  `docs/features/trips-plan-route-tab-mock.md` §1, выбранный UI/UX-разбором по
  поручению владельца 23.09.2026 (#2053). Правило `docs/RULES.md` про icon-only
  ряд на телефоне на такой блок не распространяется: здесь файловые действия —
  главные действия шага, а им правило оставляет подписи на любой ширине.
  Исключение — только этот блок владельца поездки: у участника блока нет, и его
  GPX/KML во вкладке «Маршрут» остаются обычным компактным рядом.
- Недоступное на платформе действие не рендерим как навсегда `disabled`-кнопку:
  такой контрол занимает место и выглядит как баг. Пример — диктовка через Web
  Speech API: она есть только в браузере, поэтому в приложении кнопки нет, а
  вместо неё остаётся подсказка про микрофон системной клавиатуры
  (`components/travel/ContentUpsertSection.tsx`).

## Mobile pattern: screen actions of a details screen (`useScreenHeader` + «⋯»)

Status: accepted, 2026-10-02 (#2101, family MOBILE-ACTION-LABELS-001).

Действия над объектом, который показывает экран (поездка, точка, запись
календаря), не живут полноширинными кнопками в теле экрана: шесть точечных
починок (#1774, #1776, #1779, #1780, #1783, #1789) чинили подписи на одном
экране, а ряд «Редактировать» + розовое «Удалить» возвращался на следующем.

| Действие | Телефон (mobile web, Android, iPhone) | Desktop |
| --- | --- | --- |
| правка владельца | иконка в строке экрана (`primaryAction`), a11y-label «Редактировать поездку» | кнопка с подписью в теле |
| печать, экспорт, «Поделиться» | подписанные пункты «⋯» (`overflow` → `ActionListSheet`) | как раньше |
| удаление | последний пункт «⋯», `destructive: true` (красный, разделитель), `ConfirmDialog` | кнопка `danger` с подписью |

Состав и порядок «⋯» поездки: «Распечатать план» (на native скрыт до #2102, не
`disabled`), «Экспорт GPX / KML», «Поделиться», разделитель, «Удалить поездку».
Не-владелец не видит карандаш и «Удалить».

Вкладки рабочего экрана (поездка): на телефоне иконка над короткой подписью у
КАЖДОЙ вкладки (11 px, одна строка, помещается в четверть 320 px); вкладка
называется по содержимому («Отчёт» у завершённой, «Подготовка» у остальных), а не
«Ещё».

Эталон — `components/trips/planning/TripPlanScreenHeader.tsx` (декларация) и
`app/(tabs)/trips/plan/[id].tsx` (desktop-блок кнопок с `SCREEN_HEADER_DESKTOP_PROPS`).
Guard — `scripts/guard-screen-actions.js`; метрика «иконки без доступного имени = 0»
— `e2e/mobile-screen-budget.spec.ts`.

Поверхности удаления вне экрана деталей (#2115). Guard сканирует все `app`,
`components`, `screens`: корзина или `variant="danger"` допустимы либо на экране из
`ACTION_SCREENS` (правило выше), либо поимённо в `DELETE_SURFACES` с видом —
`row` (строка списка: подпись + подтверждение у строки), `bulk` (массовое действие),
`editor` (кнопка в открытом редакторе), `sheet` (пункт уже открытого меню или
попапа), `settings` (раздел данных/аккаунта с пояснением), `dialog` (кнопка самого
диалога) — и причиной. Новая корзина без решения и устаревшая запись роняют guard.
Пункт «⋯», открывающий `ConfirmDialog`, `ActionListSheet` на iOS выполняет после
закрытия листа (`onDismiss`): второй Modal поверх закрывающегося UIKit не покажет.

## Empty states (`ui/EmptyState`, `density`)

Status: accepted, 2026-10-03 (#2104, family MOBILE-EMPTY-STATE-001).

Вид «пусто» рисует только `components/ui/EmptyState.tsx`. Проп `density`
обязателен — выбор делается на месте вызова, а не угадывается контекстом:

| `density` | Где | Вид |
| --- | --- | --- |
| `compact` | пустота внутри вкладки, списка (`ListEmptyComponent`), панели карты, секции, листа | круг 56, иконка 28, без `flex`/`minHeight`, отступы вдвое меньше, заголовок 18; кнопки узко (< 768) столбиком до 360 px — CTA в первом экране над доком, шире — в ряд; раскладка кнопок — реестр `components/ui/emptyStateLayout.ts` (механизм #2112, верна с первого кадра) |
| `full` | самостоятельный пустой экран: auth-gate, «избранное пусто», экспорт, офлайн, «не найдено» | прежний крупный вид |

Действия: `action` (primary), `secondaryAction` (ghost), `moreActions[]` (ghost) —
у каждого `icon`, `loading`, `disabled`, `testID`. Корень — `testID`
(по умолчанию `empty-state`, кнопки `empty-state-action` / `-secondary-action`).
Текстовая строка «ничего не найдено» внутри выпадающего списка, пикера или чата
заглушкой не считается и остаётся строкой.

Guard — `__tests__/config/empty-state-governance.test.ts`: вне владельца
запрещены ключи `empty*Icon*`/`empty*Circle*` и собственные компоненты
`*EmptyState*`, исключения поимённо с причиной. Метрика «CTA пустой вкладки
профиля над доком без прокрутки» — `e2e/mobile-screen-budget.spec.ts`.
Макет — `docs/features/mobile-screen-shell-mock.md` §6.

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
`outline`, `soft`, `danger-outline`, `tonal`), the `icon` slot with
`iconPosition`, and an optional `trailingIcon`. Use the primitive for new
buttons and document each context-specific exception below.

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
stateless contract, `ShareButtons` is kept as a deliberate
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

- `--mt-dock-h` — статически в `app/global.css`: `0px` на desktop и
  `calc(56px + env(safe-area-inset-bottom, 0px))` при `max-width: 1023px`.
  На экранах с `data-mt-dock="off"` CSS обнуляет резерв. Ничего в рантайме её не выставляет.
- `--mt-consent-h` — динамически, через `utils/bottomChromeReserve.ts`.
  Владельцы регистрируются по имени (`setBottomChromeReserve(owner, px)` /
  `releaseBottomChromeReserve(owner)`), в CSS уходит **максимум** по всем
  владельцам. Сегодня владельцев двое: `components/layout/ConsentBanner.tsx` и
  `components/layout/AppInstallBar.tsx`. Именно поэтому там реестр, а не одна
  запись: панель, скрывшаяся последней, иначе стирала бы резерв ещё видимой
  соседки.
- Страница квеста (`isQuestDetailHeaderPath`: деталь RU и `/{locale}/…`)
  плавающую плашку приложения не показывает (#3220). На шаге она закрывала
  задание и поле ответа. Приложение предлагает сама страница, в потоке:
  `components/quests/QuestAppOffer.tsx` на старте и на финале (источники
  витрины `quest_intro` и `quest_finale`). Сигнал `quest_start` (#2907)
  по-прежнему отправляется, и плашка появляется уже на следующих страницах.

**Кто читает**

Любой скролл-контейнер или нижняя закреплённая панель, которую иначе закроет
плашка: `components/home/Home.tsx`, `components/listTravel/useRightColumnStyles.ts`,
`components/travel/details/TravelStickyActions.tsx`, `components/auth/LoginForm.tsx`,
`screens/tabs/PlacesScreen.styles.ts`, `components/MapPage/MapMobileLayout.styles.ts`,
`components/quests/QuestConsentGate.tsx`, `components/trips/planning/plannedTripScreen.styles.ts`,
`app/(tabs)/trips/[id].tsx`, `app/(tabs)/trips/plan/create.tsx`.

**Как читать правильно**

- Единственный способ — хуки из `components/layout/bottomChromeInset.tsx`
  (#2097): `useBottomChromeInset()`, `useScrollBottomPadding(extra)`,
  `useDockReservePx()` для числового резерва самой плашки. На web он измеряет
  тот же `--mt-dock-h` общим CSS-пробником, подписанным на смену dock-маркера и
  размер окна; до SSR-коммита — 0. Для web-позиции consent/install/toast используйте
  `webDockReserve(extra)` (dock-only, без собственного `--mt-consent-h`). `LAYOUT.tabBarHeight` и
  `BOTTOM_DOCK_HEIGHT` снаружи модуля дока не читаются (`npm run guard:bottom-chrome-inset`).
- На web хук возвращает `calc(max(var(--mt-dock-h, 0px), var(--mt-consent-h, 0px)))`.
  Голая переменная без `max()` уменьшает существующий отступ на desktop, где она `0px`.
- На native хук возвращает измеренную высоту дока (она уже включает safe-area).
  Пока замера нет — `BOTTOM_DOCK_HEIGHT + insets.bottom`. `0` значит, что док скрыт.
- Корневой web-спейсер `bottom-gutter` на 56px убран: он был вторым определением
  той же высоты и удваивал отступ. Один механизм на обеих платформах — хук.
- На Android padding у `contentContainer` не всегда даёт дотянуться до
  последнего CTA — там вместо отступа ставится отдельный пустой `View`
  (`app/(tabs)/trips/[id].native.tsx`, `testID="trip-detail-bottom-reserve"`),
  высота которого берётся из `useScrollBottomPadding`.

**Как проверяется**

Мобильный вьюпорт (≤560px) со **сброшенным** согласием: последний CTA страницы
и нижние закреплённые кнопки не перекрыты плашкой, при этом на desktop нижний
отступ не вырос. Регрессии закрыты `__tests__/app/tripDetailScreen.dockReserve.test.tsx`,
`__tests__/components/MapPage/MapMobileLayout.test.tsx` и
`__tests__/app/mapAttributionCss.test.ts`.
