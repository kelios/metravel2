import React, { Suspense, useEffect } from 'react'
import { usePathname } from 'expo-router'
import { useIsFocused } from 'expo-router'
import { MapPageSkeleton } from '@/components/MapPage/MapPageSkeleton'
import InstantSEO from '@/components/seo/LazyInstantSEO'
import { ensureLeafletCss } from '@/utils/ensureLeafletCss'
import { buildCanonicalUrl, buildOgImageUrl, MAP_OG_IMAGE_PATH } from '@/utils/seo'
import { MAP_SEO_TITLE, MAP_SEO_DESCRIPTION } from '@/constants/mapSeo'

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

ensureLeafletCss()

export default function MapScreen() {
  const pathname = usePathname()
  const isFocused = useIsFocused()
  const title = MAP_SEO_TITLE
  const description = MAP_SEO_DESCRIPTION
  const canonical = buildCanonicalUrl(pathname || '/map')
  const ogImage = buildOgImageUrl(MAP_OG_IMAGE_PATH)

  useEffect(() => {
    ensureLeafletCss()
  }, [])

  const seoBlock = isFocused ? (
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
      <h1 style={WEB_SR_ONLY_STYLE as any}>{title}</h1>
      <Suspense fallback={<MapPageSkeleton />}>
        <MapScreenImpl />
      </Suspense>
    </>
  )
}
