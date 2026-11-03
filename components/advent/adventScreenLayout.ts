import { HEADER_LAYOUT_BREAKPOINTS } from '@/components/layout/headerLayoutContract'
import { defineBreakpointLayout } from '@/utils/breakpointLayout'

/**
 * Раскладка `/advent`: дом занимает экран целиком, вся служебная информация —
 * в док-панели. Порог — брейкпоинт шапки: уже него шапка показывает заголовок экрана
 * (h1), и панель свёрнута в полосу под домом с листом; шире — шапка без заголовка,
 * и панель стоит колонкой справа от дома со своим h1. Один реестр для React и первого кадра статического HTML
 * (`utils/criticalCSSBuilder.ts`), чтобы широкий экран не перекладывался после гидратации.
 */
export const ADVENT_DOCK_MIN_WIDTH = HEADER_LAYOUT_BREAKPOINTS.mobileContext
export const ADVENT_DOCK_WIDTH = 320

export const ADVENT_SCREEN_LAYOUT = defineBreakpointLayout({
  scope: 'advent-screen',
  minWidth: ADVENT_DOCK_MIN_WIDTH,
  blocks: {
    body: { narrow: { flexDirection: 'column' }, wide: { flexDirection: 'row' } },
    dock: { narrow: { display: 'none' }, wide: { display: 'flex' } },
    dockBar: { narrow: { display: 'flex' }, wide: { display: 'none' } },
  },
})
