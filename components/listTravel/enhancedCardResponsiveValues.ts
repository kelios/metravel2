import { METRICS } from '@/constants/layout'

// Адаптивные размеры карточки по ширине экрана. Вынесено из старого
// enhancedTravelCardStyles: это единственная реально используемая часть
// того файла (TravelListItem берёт отсюда borderRadius). Модуль намеренно
// без StyleSheet и без side-effect CSS-инъекции — только чистая функция.

type ResponsiveCacheKey = 'mobile' | 'desktop'

function calculateResponsiveValues(width: number) {
  const isMobile = width < METRICS.breakpoints.tablet
  return {
    borderRadius: isMobile ? 16 : 20,
    marginBottom: isMobile ? 20 : 24,
    imagePadding: isMobile ? 12 : 24,
    imagePaddingTop: isMobile ? 10 : 21,
    imageGap: isMobile ? 8 : 15,
    titleFontSize: isMobile ? 16 : 20,
    titleLineHeight: isMobile ? 22 : 28,
    titleMarginBottom: isMobile ? 2 : 6,
    titleMinHeight: isMobile ? 44 : 56,
    metaFontSize: isMobile ? 12 : 14,
    metaLineHeight: isMobile ? 16 : 20,
    tagFontSize: isMobile ? 11 : 13,
    tagLineHeight: isMobile ? 15 : 18,
  }
}

const responsiveValuesCache = new Map<ResponsiveCacheKey, ReturnType<typeof calculateResponsiveValues>>()

export function getResponsiveCardValues(width: number) {
  const cacheKey: ResponsiveCacheKey = width < METRICS.breakpoints.tablet ? 'mobile' : 'desktop'
  const cached = responsiveValuesCache.get(cacheKey)
  if (cached) return cached

  const values = calculateResponsiveValues(width)
  responsiveValuesCache.set(cacheKey, values)
  return values
}
