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
        const horizontalPadding = mapRect.width <= 420 ? 12 : isNarrowMap ? 16 : 24
        const verticalPadding = isNarrowMap ? 18 : 24
        const bottomSafePadding = isNarrowMap
          ? Math.min(
              Math.max(verticalPadding, popupBottomOffset + 20),
              Math.max(verticalPadding, Math.round(mapRect.height * 0.4))
            )
          : verticalPadding
        let dx = 0
        let dy = 0

        const popupCenterX = popupRect.left + popupRect.width / 2
        const popupCenterY = popupRect.top + popupRect.height / 2
        const safeLeft = horizontalPadding
        const safeRight = mapRect.width - horizontalPadding
        const safeTop = verticalPadding
        const safeBottom = mapRect.height - bottomSafePadding
        const safeCenterX = (safeLeft + safeRight) / 2
        const safeCenterY = (safeTop + safeBottom) / 2
        const overflowLeft = horizontalPadding - popupRect.left
        const overflowRight = popupRect.right - (mapRect.width - horizontalPadding)
        const overflowTop = verticalPadding - popupRect.top
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
    let cleanupTimer: ReturnType<typeof setTimeout> | null = null
    const cleanup = () => {
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = 0
      }
      resizeObserver?.disconnect()
      resizeObserver = null
      if (cleanupTimer) {
        clearTimeout(cleanupTimer)
        cleanupTimer = null
      }
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
    cleanupTimer = setTimeout(cleanup, 1000)
  }, [mapRef, popupBottomOffset])

  const popupAutoPanPadding = useMemo(() => {
    const effectiveWidth = mapPaneWidth || (typeof window !== 'undefined' ? window.innerWidth : 1024)
    const isNarrowViewport = effectiveWidth <= 768
    const isVeryNarrow = effectiveWidth <= 480
    const maxWidth = isVeryNarrow
      ? Math.min(300, Math.max(248, effectiveWidth - 28))
      : isNarrowViewport
        ? Math.min(348, Math.max(280, effectiveWidth - 32))
        : Math.min(436, Math.max(320, effectiveWidth - 40))
    const minWidth = isVeryNarrow
      ? 228
      : isNarrowViewport
        ? Math.min(280, Math.max(240, maxWidth - 56))
        : Math.min(336, Math.max(280, maxWidth - 88))
    const bottomPadding = isNarrowViewport
      ? Math.min(
          Math.max(72, popupBottomOffset + 20),
          Math.max(72, Math.round((typeof window !== 'undefined' ? window.innerHeight : 844) * 0.32))
        )
      : 140

    return {
      autoPan: true,
      keepInView: true,
      maxWidth,
      minWidth,
      className: 'metravel-place-popup',
      autoPanPaddingTopLeft: isNarrowViewport ? [12, 72] : [24, 140],
      autoPanPaddingBottomRight: isNarrowViewport ? [12, bottomPadding] : [24, 140],
      eventHandlers: {
        popupopen: handlePopupOpen,
      },
    }
  }, [handlePopupOpen, mapPaneWidth, popupBottomOffset])

  return { popupAutoPanPadding }
}
