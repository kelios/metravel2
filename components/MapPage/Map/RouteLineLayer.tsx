import React, { useEffect, useRef } from 'react'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { ThemedColors } from '@/hooks/useTheme'

import {
  ROUTE_PANE_NAME,
  ROUTE_PANE_Z_INDEX,
  ignoreTravelMapRuntimeError,
  isValidLatLng,
} from './travelMapGeometry'

interface RouteLineLayerProps {
  routeLineCoords: [number, number][]
  routeColor?: string
  colors: ThemedColors
  useMap: () => any
  L: any
}

const RouteLineLayer: React.FC<RouteLineLayerProps> = ({
  routeLineCoords,
  routeColor,
  colors,
  useMap,
  L,
}) => {
  const map = useMap()
  const polylineRef = useRef<any>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const removeExisting = () => {
      if (polylineRef.current && map) {
        try {
          map.removeLayer(polylineRef.current)
        } catch {
          ignoreTravelMapRuntimeError()
        }
        polylineRef.current = null
      }
    }

    if (!map || !L || routeLineCoords.length < 2) {
      removeExisting()
      return
    }

    removeExisting()

    let pane: HTMLElement | null = null
    try {
      pane = typeof map.getPane === 'function' ? map.getPane(ROUTE_PANE_NAME) : null
      if (!pane && typeof map.createPane === 'function') {
        pane = map.createPane(ROUTE_PANE_NAME)
      }
      if (pane?.style) {
        pane.style.zIndex = ROUTE_PANE_Z_INDEX
        pane.style.pointerEvents = 'none'
      }
    } catch {
      ignoreTravelMapRuntimeError()
    }

    const latlngs = routeLineCoords
      .filter(([lat, lng]) => isValidLatLng(lat, lng))
      .map(([lat, lng]) => L.latLng(lat, lng))
    if (latlngs.length < 2) return

    const addPolyline = () => {
      if (!mountedRef.current) return

      const hasRoutePane = !!pane
      const renderer =
        typeof L.svg === 'function'
          ? L.svg(hasRoutePane ? { pane: ROUTE_PANE_NAME } : undefined)
          : undefined

      const baseOpts = {
        weight: 8,
        opacity: 0.95,
        lineJoin: 'round',
        lineCap: 'round',
        interactive: false,
        renderer,
        pane: hasRoutePane ? ROUTE_PANE_NAME : 'overlayPane',
      }

      const halo = L.polyline(latlngs, {
        ...baseOpts,
        color: colors.surface || DESIGN_TOKENS.colors.surface,
        className: 'metravel-route-line-halo',
      })

      const line = L.polyline(latlngs, {
        ...baseOpts,
        weight: 5,
        opacity: 1,
        color: routeColor || colors.info || colors.primary || DESIGN_TOKENS.colors.primary,
        className: 'metravel-route-line',
      })

      try {
        const routeLayer = L.layerGroup([halo, line])
        routeLayer.addTo(map)
        line.bringToFront?.()
        polylineRef.current = routeLayer
      } catch (error) {
        console.error('[TravelMap] RouteLineLayer: failed to add polyline', error)
        try {
          line.remove?.()
        } catch {
          ignoreTravelMapRuntimeError()
        }
      }
    }

    const timer = setTimeout(addPolyline, 10)

    return () => {
      clearTimeout(timer)
      removeExisting()
    }
  }, [map, L, routeLineCoords, routeColor, colors.info, colors.primary, colors.surface])

  return null
}

export default RouteLineLayer
