import { useCallback, useMemo } from 'react'

type UseMapPopupAutoPanArgs = {
  mapRef: React.MutableRefObject<any>
  mapPaneWidth: number
  popupBottomOffset: number
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
        const popupRect = {
          left: popupRectAbs.left - mapRect.left,
          top: popupRectAbs.top - mapRect.top,
          right: popupRectAbs.right - mapRect.left,
          bottom: popupRectAbs.bottom - mapRect.top,
          width: popupRectAbs.width,
          height: popupRectAbs.height,
        }

        const isNarrowMap = mapRect.width <= 640
        const isVeryNarrowMap = mapRect.width <= 420
        const horizontalPadding = isVeryNarrowMap ? 12 : isNarrowMap ? 16 : 24
        const verticalPadding = isVeryNarrowMap ? 22 : isNarrowMap ? 18 : 24
        const topSafePadding = isVeryNarrowMap ? 110 : isNarrowMap ? 92 : verticalPadding
        const bottomSafePadding = isNarrowMap
          ? Math.min(
              Math.max(124, popupBottomOffset + 28),
              Math.max(124, Math.round(mapRect.height * 0.42))
            )
          : verticalPadding
        let dx = 0
        let dy = 0

        const popupCenterX = popupRect.left + popupRect.width / 2
        const popupCenterY = popupRect.top + popupRect.height / 2
        const safeLeft = horizontalPadding
        const safeRight = mapRect.width - horizontalPadding
        const safeTop = topSafePadding
        const safeBottom = mapRect.height - bottomSafePadding
        const safeCenterX = (safeLeft + safeRight) / 2
        const safeCenterY = (safeTop + safeBottom) / 2
        const overflowLeft = horizontalPadding - popupRect.left
        const overflowRight = popupRect.right - (mapRect.width - horizontalPadding)
        const overflowTop = safeTop - popupRect.top
        const overflowBottom = popupRect.bottom - safeBottom

        if (overflowLeft > 0 && overflowRight > 0) {
          dx = popupCenterX - safeCenterX
        } else if (overflowLeft > 0) {
          dx = -overflowLeft
        } else if (overflowRight > 0) {
          dx = overflowRight
        } else if (isNarrowMap) {
          const centerDeltaX = popupCenterX - safeCenterX
          if (Math.abs(centerDeltaX) > 18) {
            dx = centerDeltaX
          }
        }

        if (overflowTop > 0 && overflowBottom > 0) {
          dy = popupCenterY - safeCenterY
        } else if (overflowTop > 0) {
          dy = -overflowTop
        } else if (overflowBottom > 0) {
          dy = overflowBottom
        } else if (isNarrowMap) {
          const centerDeltaY = popupCenterY - safeCenterY
          if (Math.abs(centerDeltaY) > 24) {
            dy = centerDeltaY
          }
        }

        if (Math.abs(dx) < 6) dx = 0
        if (Math.abs(dy) < 6) dy = 0
        if (!dx && !dy) return

        map?.panBy?.([dx, dy], { animate: true, duration: 0.35 } as any)
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
    const cleanup = () => {
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = 0
      }
      resizeObserver?.disconnect()
      resizeObserver = null
      map?.off?.('popupclose', cleanup)
    }

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        scheduleRun()
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
    const topPadding = isVeryNarrow
      ? 110
      : isNarrowViewport
        ? 92
        : 140
    const bottomPadding = isNarrowViewport
      ? Math.min(
          Math.max(124, popupBottomOffset + 28),
          Math.max(124, Math.round((typeof window !== 'undefined' ? window.innerHeight : 844) * 0.36))
        )
      : 140

    return {
      autoPan: true,
      keepInView: true,
      maxWidth,
      minWidth,
      className: 'metravel-place-popup',
      autoPanPaddingTopLeft: isNarrowViewport ? [12, topPadding] : [24, 140],
      autoPanPaddingBottomRight: isNarrowViewport ? [12, bottomPadding] : [24, 140],
      eventHandlers: {
        popupopen: handlePopupOpen,
      },
    }
  }, [handlePopupOpen, mapPaneWidth, popupBottomOffset])

  return { popupAutoPanPadding }
}
