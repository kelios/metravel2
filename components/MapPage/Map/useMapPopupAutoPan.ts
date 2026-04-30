import { useCallback, useMemo } from 'react'

type UseMapPopupAutoPanArgs = {
  mapRef: React.MutableRefObject<any>
  mapPaneWidth: number
  popupBottomOffset: number
}

type PopupSafeArea = {
  horizontalPadding: number
  topPadding: number
  bottomPadding: number
}

// Высота верхнего glass-бара над картой (MapQuickFilters):
// top: 16 + minHeight: 40 (≤430: 38, ≤360: 36) + небольшой запас на тень/safe-area.
// Используется как topPadding, чтобы popup не оказался под чипами «Радиус / Что
// посмотреть / Оверлеи» после автоцентрирования Leaflet и кастомного re-pan.
const TOP_QUICK_FILTERS_BAR_HEIGHT = 116

const getPopupSafeArea = ({
  mapWidth,
  mapHeight,
  popupBottomOffset,
}: {
  mapWidth: number
  mapHeight: number
  popupBottomOffset: number
}): PopupSafeArea => {
  const isNarrowMap = mapWidth <= 640
  const isVeryNarrowMap = mapWidth <= 420
  const horizontalPadding = isVeryNarrowMap ? 12 : isNarrowMap ? 16 : 24

  if (!isNarrowMap) {
    // Desktop / tablet: учитываем верхний бар быстрых фильтров, иначе popup
    // может открыться под ним и перекрываться визуально.
    return {
      horizontalPadding,
      topPadding: TOP_QUICK_FILTERS_BAR_HEIGHT,
      bottomPadding: 24,
    }
  }

  return {
    horizontalPadding,
    topPadding: isVeryNarrowMap ? 152 : 144,
    bottomPadding: Math.min(
      Math.max(isVeryNarrowMap ? 72 : 80, popupBottomOffset + (isVeryNarrowMap ? 12 : 16)),
      Math.max(isVeryNarrowMap ? 72 : 80, Math.round(mapHeight * (isVeryNarrowMap ? 0.18 : 0.2)))
    ),
  }
}

export function useMapPopupAutoPan({
  mapRef,
  mapPaneWidth,
  popupBottomOffset,
}: UseMapPopupAutoPanArgs) {
  const handlePopupOpen = useCallback((event: any) => {
    const popup = event?.popup
    const popupEl: HTMLElement | null = popup?.getElement ? popup.getElement() : null
    const map = mapRef.current
    const mapEl: HTMLElement | null = map?.getContainer ? map.getContainer() : null
    if (!popupEl || !mapEl || typeof window === 'undefined') return

    const run = () => {
      try {
        const mapRect = mapEl.getBoundingClientRect()
        const popupRectAbs = popupEl.getBoundingClientRect()
        const safeArea = getPopupSafeArea({
          mapWidth: mapRect.width,
          mapHeight: mapRect.height,
          popupBottomOffset,
        })
        const popupRect = {
          left: popupRectAbs.left - mapRect.left,
          top: popupRectAbs.top - mapRect.top,
          right: popupRectAbs.right - mapRect.left,
          bottom: popupRectAbs.bottom - mapRect.top,
          width: popupRectAbs.width,
          height: popupRectAbs.height,
        }

        const isNarrowMap = mapRect.width <= 640
        let dx = 0
        let dy = 0

        const popupCenterX = popupRect.left + popupRect.width / 2
        const popupCenterY = popupRect.top + popupRect.height / 2
        const safeLeft = safeArea.horizontalPadding
        const safeRight = mapRect.width - safeArea.horizontalPadding
        const safeTop = safeArea.topPadding
        const safeBottom = mapRect.height - safeArea.bottomPadding
        const safeCenterX = (safeLeft + safeRight) / 2
        const safeCenterY = (safeTop + safeBottom) / 2
        const overflowTop = safeTop - popupRect.top
        const overflowBottom = popupRect.bottom - safeBottom

        if (isNarrowMap) {
          // На узком экране всегда центрируем popup в безопасной области,
          // чтобы тапнутая точка была полностью видна вместе с карточкой.
          dx = popupCenterX - safeCenterX
          dy = popupCenterY - safeCenterY
        } else {
          // Desktop/web: pan only when popup overflows the safe area, so opening
          // a popup near the center doesn't visibly jump the map.
          const overflowLeft = safeLeft - popupRect.left
          const overflowRight = popupRect.right - safeRight
          if (overflowLeft > 0 && overflowRight > 0) {
            dx = popupCenterX - safeCenterX
          } else if (overflowLeft > 0) {
            dx = -overflowLeft
          } else if (overflowRight > 0) {
            dx = overflowRight
          }

          if (overflowTop > 0 && overflowBottom > 0) {
            dy = popupCenterY - safeCenterY
          } else if (overflowTop > 0) {
            dy = -overflowTop
          } else if (overflowBottom > 0) {
            dy = overflowBottom
          }
        }

        if (Math.abs(dx) < 8) dx = 0
        if (Math.abs(dy) < 8) dy = 0
        if (!dx && !dy) return

        map?.panBy?.([dx, dy], { animate: true, duration: 0.2 } as any)
      } catch {
        // noop
      }
    }

    let rafId = 0
    const scheduleRun = () => {
      if (rafId) {
        cancelAnimationFrame(rafId)
      }
      rafId = requestAnimationFrame(() => {
        rafId = requestAnimationFrame(run)
      })
    }

    scheduleRun()

    let resizeObserver: ResizeObserver | null = null
    let resizeDebounceTimer: ReturnType<typeof setTimeout> | null = null
    // Игнорируем первый синхронный вызов ResizeObserver, который происходит
    // сразу после observe() и дублирует начальный pan.
    let resizeObserverInitialized = false
    const cleanup = () => {
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = 0
      }
      if (resizeDebounceTimer) {
        clearTimeout(resizeDebounceTimer)
        resizeDebounceTimer = null
      }
      resizeObserver?.disconnect()
      resizeObserver = null
      map?.off?.('popupclose', cleanup)
    }

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        if (!resizeObserverInitialized) {
          resizeObserverInitialized = true
          return
        }
        if (resizeDebounceTimer) {
          clearTimeout(resizeDebounceTimer)
        }
        resizeDebounceTimer = setTimeout(() => {
          resizeDebounceTimer = null
          scheduleRun()
        }, 80)
      })
      resizeObserver.observe(popupEl)
      const popupContentEl = popupEl.querySelector('.leaflet-popup-content')
      if (popupContentEl instanceof HTMLElement) {
        resizeObserver.observe(popupContentEl)
      }
    }

    map?.on?.('popupclose', cleanup)
  }, [mapRef, popupBottomOffset])

  const popupAutoPanPadding = useMemo(() => {
    const effectiveWidth = mapPaneWidth || (typeof window !== 'undefined' ? window.innerWidth : 1024)
    const isNarrowViewport = effectiveWidth <= 768
    const isVeryNarrow = effectiveWidth <= 480
    const useFullscreenMobilePopup = effectiveWidth <= 560
    const effectiveHeight = typeof window !== 'undefined' ? window.innerHeight : 844
    const safeArea = getPopupSafeArea({
      mapWidth: effectiveWidth,
      mapHeight: effectiveHeight,
      popupBottomOffset,
    })
    const maxWidth = isVeryNarrow
      ? Math.min(284, Math.max(240, effectiveWidth - 28))
      : isNarrowViewport
        ? Math.min(320, Math.max(264, effectiveWidth - 32))
        : Math.min(388, Math.max(300, effectiveWidth - 40))
    const minWidth = isVeryNarrow
      ? 220
      : isNarrowViewport
        ? Math.min(260, Math.max(228, maxWidth - 44))
        : Math.min(308, Math.max(256, maxWidth - 72))
    const topPadding = isNarrowViewport ? safeArea.topPadding : TOP_QUICK_FILTERS_BAR_HEIGHT
    const bottomPadding = isNarrowViewport ? safeArea.bottomPadding : 112

    return {
      autoPan: false,
      closeOnClick: false,
      keepInView: false,
      maxWidth,
      minWidth,
      className: useFullscreenMobilePopup
        ? 'metravel-place-popup metravel-place-popup--fullscreen-mobile'
        : 'metravel-place-popup',
      autoPanPaddingTopLeft: isNarrowViewport ? [12, topPadding] : [24, topPadding],
      autoPanPaddingBottomRight: isNarrowViewport ? [12, bottomPadding] : [24, bottomPadding],
      eventHandlers: {
        popupopen: handlePopupOpen,
      },
    }
  }, [handlePopupOpen, mapPaneWidth, popupBottomOffset])

  return { popupAutoPanPadding }
}
