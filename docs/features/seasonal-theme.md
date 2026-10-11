# Сезонное (праздничное) оформление

Карточка: #2376. Сайт «переодевается» к Хэллоуину и к Рождеству/Новому году:
меняются акцентные токены и появляется декоративный слой. Человек выбирает
«по календарю / выключено / конкретная тема», выбор хранится локально.

## Платформы

- **Web (desktop и mobile)** — полный визуал и переключатель.
- **Android / iOS** — осознанно без визуала и без переключателя: токены там —
  литералы `StyleSheet.create`, а не CSS-переменные (`constants/designSystem.ts`),
  поэтому сезонная палитра на native потребовала бы отдельного механизма.
  Настройка при этом хранится в AsyncStorage тем же ключом — native подхватит
  её, когда появится карточка на нативную палитру.

## Механизм

| слой | файл | роль |
| --- | --- | --- |
| реестр | `constants/seasonalThemes.ts` | `SEASONAL_THEMES`: id, иконка, календарное окно; `resolveSeasonalTheme(pref, date)` |
| состояние | `hooks/useTheme.ts` | `seasonalTheme` (настройка), `activeSeasonalTheme` (что применено), `setSeasonalTheme`; ключ хранилища `seasonal-theme`; ставит `data-season` на `<html>` |
| визуал | `app/global.css` → блок «Сезонное (праздничное) оформление» | `html[data-season="<id>"]` и `html[data-season="<id>"][data-theme="dark"]` переопределяют `--color-*`/`--gradient-*`; `body::after` — декор |
| без мигания | `utils/seasonalThemeBootScript.ts` → `app/+html.tsx` | ES5-сниппет ставит `data-season` до гидратации по тем же окнам |
| контролы | `components/layout/SeasonalThemeToggle.tsx`, `components/layout/seasonalThemeOptions.tsx`, `components/settings/ThemeSection.tsx` | ряд в меню аккаунта (гость и авторизованный), в мобильном меню шапки и карточка в настройках |

Настройка `seasonalTheme`:

- `auto` (дефолт) — тема включается, когда текущая дата попадает в окно реестра;
- `off` — обычный вид круглый год;
- `<id>` — тема включена принудительно, независимо от даты.

Окна включают обе границы и могут переходить через Новый год (`to < from`).
Окна тем не пересекаются — это проверяет `__tests__/constants/seasonalThemes.test.ts`.

| тема | окно | акценты |
| --- | --- | --- |
| `halloween` | 15.10 — 01.11 | тыквенный primary, фиолетовый accent, луна и янтарные фонари |
| `christmas` | 01.12 — 14.01 | хвойный primary, клюквенный accent, хвоя и тёплая гирлянда |

## Декоративный слой

Статичный `body::after` подсвечивает только верхние края (160 px на desktop,
100 px на mobile). В шапке `::before` рисует небольшие фонари/луну либо хвойную
гирлянду через SVG data-URI; центральная область чтения свободна от частиц.
Подсветка лежит на видимой бренд-строке, а гирлянда выше непрозрачной обёртки
шапки, чтобы фон обёртки не закрывал огни.
Никаких тайлов на весь экран, анимаций и `will-change` нет; reduced motion
получает тот же неподвижный вид. Все слои `pointer-events: none`, print их скрывает.

`Logo.tsx` сохраняет фирменную птицу, её адрес/preload и размеры 32/26 px.
`dataSet`-метки рамки и словесного знака дают CSS ореол и маленькую луну/звезду.
Цвет Travel локальный: семантический `success` не переопределяется.
До гидратации CSS уменьшает рамку на том же breakpoint 1280 px, что и изображение.

Иконки переключателя — типизированный Feather (`calendar`, `x-circle`, `moon`,
`star`). MaterialCommunityIcons на web подменяется Feather-стабом, поэтому
имена из MCI для этого переключателя не подходят.

## Как добавить тему

1. `constants/seasonalThemes.ts`: добавить id в `SeasonalThemeId` и запись в
   `SEASONAL_THEMES` (иконка `Feather`, окно).
2. `app/global.css`: два блока — `html[data-season="<id>"]` (светлая) и
   `html[data-season="<id>"][data-theme="dark"]`; задать `--season-canopy-image`,
   `--season-header-glow`, `--season-edge-glow` и `--season-logo-*`.
3. `components/layout/seasonalThemeOptions.tsx`: пара ключей в `OPTION_COPY`
   (typecheck не даст забыть — `Record` по союзу id).
4. `i18n/locales/<locale>/static/navigation_static.ts` во всех пяти локалях:
   `seasonalTheme.option.<id>` и `seasonalTheme.option.<id>.description`.
5. Дописать таблицу выше; тесты реестра и стартового скрипта проверят окно сами.

Переключатель, хранение, стартовый скрипт и `data-season` менять не нужно.

## Проверки

- `npx jest __tests__/constants/seasonalThemes.test.ts __tests__/utils/seasonalThemeBootScript.test.ts __tests__/hooks/useTheme.test.tsx`
- `npm run test:i18n`
- браузер: меню аккаунта → «Праздничное оформление» → четыре состояния;
  `document.documentElement.dataset.season`; перезагрузка без мигания; тёмная
  тема; `prefers-reduced-motion`.
