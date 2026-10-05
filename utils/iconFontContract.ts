/**
 * Контракт узла web-иконки (#2170): имя гарнитуры и метка, по которой
 * критический CSS прячет иконку до загрузки шрифта. Отдельный модуль без
 * кода — его импортирует сама иконка, то есть он попадает в критический
 * бандл; сборщики скриптов оболочки живут в `utils/iconFontShell.ts` и на
 * клиент не уходят.
 */

/** Имя гарнитуры — то же, под которым её знает `@expo/vector-icons` на native. */
export const ICON_FONT_FAMILY = 'feather'

/** Класс на `<html>`: шрифт иконок загружен, глифы можно показывать. */
export const ICON_FONT_READY_CLASS = 'icon-font-ready'

/** Метка узла иконки; `dataSet` RN-Web разворачивает её в `data-icon-font`. */
export const ICON_FONT_ATTR = 'data-icon-font'
export const ICON_FONT_DATASET = { iconFont: ICON_FONT_FAMILY } as const
