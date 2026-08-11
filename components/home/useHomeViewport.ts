import { useEffect, useMemo, useState } from 'react'
import { Platform, useWindowDimensions } from 'react-native'

import { METRICS } from '@/constants/layout'

const IS_WEB = Platform.OS === 'web'

type HomeViewportOptions = {
  /**
   * `true` — консьюмер монтируется уже ПОСЛЕ гидратации: `app/(tabs)/index.tsx`
   * рендерит `Home` только при `hydrated === true`, поэтому его разметки нет в
   * SSR HTML и mismatch невозможен. Такому консьюмеру ширина нужна на первом же
   * кадре: иначе он рисуется «нулевой» веткой (мобильная раскладка, без
   * бокового слайдера), а следующий кадр перекладывает hero — это и есть весь
   * CLS главной (#1282: 0,2374 из 0,2431 на desktop и 0,1473 из 0,1481 на
   * mobile одним кадром).
   *
   * `false` (по умолчанию) — консьюмер может участвовать в гидратации, поэтому
   * до собственного commit обязан отдавать тот же 0×0, что и статический
   * экспорт, иначе React получает hydration mismatch (#418). Прежняя
   * формулировка ссылалась на «`HomePageSkeleton` есть в SSR HTML» — это
   * неверно: на web ветка скелетона недостижима (см. `shouldShowSkeleton` в
   * `app/(tabs)/index.tsx`), в экспортированном `index.html` его нет.
   */
  clientOnly?: boolean
}

export function useHomeViewport({ clientOnly = false }: HomeViewportOptions = {}) {
  const { width: rawWidth, height: rawHeight } = useWindowDimensions()
  const [isHydrated, setIsHydrated] = useState(!IS_WEB || clientOnly)

  useEffect(() => {
    if (!IS_WEB || isHydrated) return
    setIsHydrated(true)
  }, [isHydrated])

  const width = isHydrated ? rawWidth : 0
  const height = isHydrated ? rawHeight : 0

  const isSmallPhone = width > 0 && width < METRICS.breakpoints.phone
  const isPhone = width >= METRICS.breakpoints.phone && width < METRICS.breakpoints.largePhone
  const isLargePhone = width >= METRICS.breakpoints.largePhone && width < METRICS.breakpoints.tablet
  const isTablet = width >= METRICS.breakpoints.tablet && width < METRICS.breakpoints.largeTablet
  const isDesktop = width >= METRICS.breakpoints.desktop
  const isMobile = width > 0 && width < METRICS.breakpoints.tablet
  const isPortrait = height >= width

  return useMemo(
    () => ({
      height,
      isDesktop,
      isHydrated,
      isLargePhone,
      isMobile,
      isPhone,
      isPortrait,
      isSmallPhone,
      isTablet,
      width,
    }),
    [height, isDesktop, isHydrated, isLargePhone, isMobile, isPhone, isPortrait, isSmallPhone, isTablet, width],
  )
}

