// Адрес подборки партнёра belkraj.by (→ tripvenue) для точки маршрута. Один
// источник для web-iframe (`BelkrajWidget.tsx`) и native-ссылки во внешний
// браузер (`BelkrajWidget.native.tsx`): партнёрский id и набор параметров не
// расходятся между платформами. Почему в URL всегда уходит реальный `country` —
// `belkrajAvailability.ts`.

export const BELKRAJ_ORIGIN = 'https://belkraj.by'

/** Постоянный id площадки metravel у партнёра — один для всех пользователей. */
export const BELKRAJ_PARTNER_ID = 'u180793'

export type BelkrajWidgetUrlInput = {
  coord: { lat: number; lng: number }
  countryCode?: string
  cardsCount: number
  /** Только для iframe: адресат `postMessage` высоты виджета (`widget-iframe.js`). */
  widgetId?: string
}

export function buildBelkrajWidgetUrl({ coord, countryCode, cardsCount, widgetId }: BelkrajWidgetUrlInput): string {
  const params = new URLSearchParams({
    lat: String(coord.lat),
    lng: String(coord.lng),
    term: 'place',
    theme: 'cards',
    partner: BELKRAJ_PARTNER_ID,
    size: String(cardsCount),
  })
  if (countryCode) params.set('country', countryCode)
  if (widgetId) params.set('widgetId', widgetId)
  return `${BELKRAJ_ORIGIN}/partner/widget?${params.toString()}`
}
