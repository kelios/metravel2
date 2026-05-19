import React, { useCallback, useMemo, useState } from 'react'
import type { Point } from './types'

const DEFERRED_PLACEHOLDER_STYLE = { minHeight: 50, minWidth: 200 } as const

const PopupContentWithClose: React.FC<{
  point: Point
  PopupContent: React.ComponentType<{ point: Point; closePopup?: () => void }>
  useMap?: () => any
}> = ({ point, PopupContent, useMap: useMapHook }) => {
  const map = useMapHook?.()
  const closePopup = useCallback(() => {
    map?.closePopup()
  }, [map])
  return <PopupContent point={point} closePopup={closePopup} />
}

interface MarkerPopupProps {
  point: Point
  Popup: React.ComponentType<any>
  PopupContent: React.ComponentType<{ point: Point; closePopup?: () => void }>
  popupProps?: Record<string, unknown>
  useMap?: () => any
}

/**
 * Defers rendering the (heavy) popup card until the popup is opened for the
 * first time. Avoids mounting hundreds of PlacePopupCard trees for off-screen
 * / never-opened markers. Merges with any caller-supplied popup eventHandlers.
 */
const MarkerPopup: React.FC<MarkerPopupProps> = ({
  point,
  Popup,
  PopupContent,
  popupProps,
  useMap: useMapHook,
}) => {
  const [opened, setOpened] = useState(false)
  const userHandlers = (popupProps as any)?.eventHandlers as
    | Record<string, (e: any) => void>
    | undefined

  const eventHandlers = useMemo(
    () => {
      const handleOpen = (e: any) => {
        setOpened(true)
        const popup = e?.popup ?? e?.target
        userHandlers?.popupopen?.(popup ? { ...e, popup } : e)
      }

      return {
        ...(userHandlers || {}),
        add: (e: any) => {
          userHandlers?.add?.(e)
          handleOpen(e)
        },
        popupopen: handleOpen,
      }
    },
    [userHandlers],
  )

  return (
    <Popup {...(popupProps || {})} eventHandlers={eventHandlers}>
      {opened ? (
        <PopupContentWithClose
          point={point}
          PopupContent={PopupContent}
          useMap={useMapHook}
        />
      ) : (
        <div style={DEFERRED_PLACEHOLDER_STYLE} />
      )}
    </Popup>
  )
}

export default React.memo(MarkerPopup)
