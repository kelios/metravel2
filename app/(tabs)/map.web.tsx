import React, { Suspense, useEffect } from 'react'
import { View } from 'react-native'
import { usePathname } from 'expo-router'
import { useIsFocused } from 'expo-router'
import { MapPageSkeleton } from '@/components/MapPage/MapPageSkeleton'
import InstantSEO from '@/components/seo/LazyInstantSEO'
import { ensureLeafletCss } from '@/utils/ensureLeafletCss'
import { buildCanonicalUrl, buildOgImageUrl, MAP_OG_IMAGE_PATH } from '@/utils/seo'
import { getMapSeoDescription, getMapSeoTitle } from '@/constants/mapSeo'
import { useWebHydrationGate } from '@/hooks/useWebHydrationGate'

const WEB_SR_ONLY_STYLE = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  borderWidth: 0,
} as const

const mapScreenImport = Promise.resolve(import('@/screens/tabs/MapScreen'))
const MapScreenImpl = React.lazy(() => mapScreenImport)
const MAP_ROUTE_READY_ATTRIBUTE = 'data-map-route-ready'
const LOADED_LEAFLET_TILE_SELECTOR = 'img.leaflet-tile.leaflet-tile-loaded'

function isLoadedLeafletTile(tile: HTMLImageElement): boolean {
  return (
    tile.matches(LOADED_LEAFLET_TILE_SELECTOR) &&
    tile.complete &&
    tile.naturalWidth > 0
  )
}

function MapHydrationFallback() {
  return <View style={{ flex: 1 }} />
}

export default function MapScreen() {
  const hydrationReady = useWebHydrationGate()
  const pathname = usePathname()
  const isFocused = useIsFocused()
  const title = getMapSeoTitle()
  const description = getMapSeoDescription()
  const canonical = buildCanonicalUrl(pathname || '/map')
  const ogImage = buildOgImageUrl(MAP_OG_IMAGE_PATH)

  useEffect(() => {
    ensureLeafletCss()
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.getElementById('root')
    if (!root) return

    root.removeAttribute(MAP_ROUTE_READY_ATTRIBUTE)

    if (!hydrationReady) {
      return () => {
        root.removeAttribute(MAP_ROUTE_READY_ATTRIBUTE)
      }
    }

    let cancelled = false
    let handoffScheduled = false
    let rafOne: number | null = null
    let rafTwo: number | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const pendingTiles = new WeakSet<HTMLImageElement>()
    let inspectLoadedTiles: () => void = () => undefined
    let handleTileLoad: EventListener = () => undefined
    let observer: MutationObserver | null = null

    const markReadyAfterPaint = (tile: HTMLImageElement) => {
      if (cancelled || handoffScheduled) return
      handoffScheduled = true

      const markReady = () => {
        if (cancelled || !root.contains(tile) || !isLoadedLeafletTile(tile)) {
          handoffScheduled = false
          inspectLoadedTiles()
          return
        }
        root.setAttribute(MAP_ROUTE_READY_ATTRIBUTE, 'true')
        observer?.disconnect()
        root.removeEventListener('load', handleTileLoad, true)
      }

      if (typeof window.requestAnimationFrame === 'function') {
        rafOne = window.requestAnimationFrame(() => {
          rafTwo = window.requestAnimationFrame(markReady)
        })
      } else {
        timeoutId = setTimeout(markReady, 0)
      }
    }

    const inspectTile = (tile: HTMLImageElement) => {
      if (
        cancelled ||
        !root.contains(tile) ||
        pendingTiles.has(tile) ||
        !isLoadedLeafletTile(tile)
      ) return
      pendingTiles.add(tile)
      const decodedSource = tile.currentSrc || tile.src
      const decodedSrcAttribute = tile.getAttribute('src')
      const sourceChanged = () =>
        tile.getAttribute('src') !== decodedSrcAttribute ||
        (tile.currentSrc || tile.src) !== decodedSource

      let decodeResult: Promise<void>
      try {
        decodeResult = typeof tile.decode === 'function' ? tile.decode() : Promise.resolve()
      } catch {
        pendingTiles.delete(tile)
        return
      }

      decodeResult
        .then(() => {
          pendingTiles.delete(tile)
          if (sourceChanged()) {
            inspectTile(tile)
            return
          }
          if (cancelled || !isLoadedLeafletTile(tile)) return
          markReadyAfterPaint(tile)
        })
        .catch(() => {
          pendingTiles.delete(tile)
          if (sourceChanged()) inspectTile(tile)
        })
    }

    inspectLoadedTiles = () => {
      root
        .querySelectorAll<HTMLImageElement>(LOADED_LEAFLET_TILE_SELECTOR)
        .forEach(inspectTile)
    }

    handleTileLoad = (event: Event) => {
      if (!(event.target instanceof HTMLImageElement)) return
      const tile = event.target
      Promise.resolve().then(() => inspectTile(tile))
    }

    root.addEventListener('load', handleTileLoad, true)
    observer = new MutationObserver(inspectLoadedTiles)
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'src'],
    })
    inspectLoadedTiles()

    return () => {
      cancelled = true
      observer?.disconnect()
      root.removeEventListener('load', handleTileLoad, true)
      if (rafOne !== null) window.cancelAnimationFrame(rafOne)
      if (rafTwo !== null) window.cancelAnimationFrame(rafTwo)
      if (timeoutId !== null) clearTimeout(timeoutId)
      root.removeAttribute(MAP_ROUTE_READY_ATTRIBUTE)
    }
  }, [hydrationReady])

  const seoBlock = hydrationReady && isFocused ? (
    <InstantSEO
      headKey="map"
      title={title}
      description={description}
      canonical={canonical}
      image={ogImage}
      imageWidth={1200}
      imageHeight={630}
      ogType="website"
    />
  ) : null

  return (
    <>
      {seoBlock}
      {hydrationReady ? <h1 style={WEB_SR_ONLY_STYLE as any}>{title}</h1> : null}
      {hydrationReady ? (
        <Suspense fallback={<MapPageSkeleton />}>
          <MapScreenImpl />
        </Suspense>
      ) : (
        <MapHydrationFallback />
      )}
    </>
  )
}
