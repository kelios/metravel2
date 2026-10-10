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
| `halloween` | 15.10 — 01.11 | тыквенный primary, фиолетовый accent, силуэты летучих мышей |
| `christmas` | 01.12 — 14.01 | хвойный primary, клюквенный accent, снег |

## Декоративный слой

Один `position: fixed` псевдоэлемент `body::after` на весь вьюпорт с запасом
480 px по обеим осям; фон — повторяющийся SVG data-URI, анимируется только
`transform` (композитор, без перерисовки), цикл кратен тайлу — шов не виден.
`pointer-events: none`, `z-index: 9` (над потоком страницы, под portal-модалками).
`prefers-reduced-motion: reduce` останавливает анимацию, `@media print` скрывает слой.

## Как добавить тему

1. `constants/seasonalThemes.ts`: добавить id в `SeasonalThemeId` и запись в
   `SEASONAL_THEMES` (иконка `MaterialCommunityIcons`, окно).
2. `app/global.css`: два блока — `html[data-season="<id>"]` (светлая) и
   `html[data-season="<id>"][data-theme="dark"]`; задать `--season-decor-image`,
   `--season-decor-size`, `--season-decor-opacity`, `--season-decor-animation`
   (или не задавать декор — тогда слой пустой).
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
