import { defineBreakpointLayout } from '@/utils/breakpointLayout'

/**
 * Раскладка /app по брейкпоинту 900 px (#2258, механизм #2112): единственный
 * источник значений, меняющихся между узким и широким видом. React берёт их по
 * `isWide`, critical CSS — для первого кадра до гидратации
 * (`utils/criticalCSSBuilder.ts`): карточки возможностей на desktop стоят в две
 * колонки с первого кадра, гидратация их не перекладывает.
 */
export const APP_DOWNLOAD_WIDE_MIN_WIDTH = 900

export const APP_DOWNLOAD_LAYOUT = defineBreakpointLayout({
  scope: 'app-download',
  minWidth: APP_DOWNLOAD_WIDE_MIN_WIDTH,
  blocks: {
    featureCard: { narrow: { width: '100%' }, wide: { width: '46%' } },
  },
})
