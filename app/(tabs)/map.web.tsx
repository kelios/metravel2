import React, { Suspense, useCallback, useEffect } from 'react'
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

    return () => {
      root.removeAttribute(MAP_ROUTE_READY_ATTRIBUTE)
    }
  }, [])

  const markRouteReady = useCallback(() => {
    if (typeof document === 'undefined') return
    document.getElementById('root')?.setAttribute(MAP_ROUTE_READY_ATTRIBUTE, 'true')
  }, [])

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
          <MapScreenImpl onFirstWebFrame={markRouteReady} />
        </Suspense>
      ) : (
        <MapHydrationFallback />
      )}
    </>
  )
}
