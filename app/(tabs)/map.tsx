import React, { Suspense, useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { usePathname } from 'expo-router'
import { useIsFocused } from '@react-navigation/native'
import { MapPageSkeleton } from '@/components/MapPage/MapPageSkeleton'
import InstantSEO from '@/components/seo/LazyInstantSEO'
import { ensureLeafletCss } from '@/utils/ensureLeafletCss'
import { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo'
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

// Keep the tab route module tiny so it doesn't pull map dependencies into the entry bundle.
const MapScreenImpl = React.lazy(() => import('@/screens/tabs/MapScreen'))

export default function MapScreen() {
  const pathname = usePathname()
  const isFocused = useIsFocused()
  const [hydrated, setHydrated] = useState(Platform.OS !== 'web')
  const title = MAP_SEO_TITLE
  const description = MAP_SEO_DESCRIPTION
  const canonical = buildCanonicalUrl(pathname || '/map')
  const ogImage = buildOgImageUrl(DEFAULT_OG_IMAGE_PATH)

  useEffect(() => {
    if (Platform.OS !== 'web') return
    ensureLeafletCss()
    setHydrated(true)
  }, [])

  const seoBlock = Platform.OS === 'web' && isFocused ? (
    <InstantSEO
      headKey="map"
      title={title}
      description={description}
      canonical={canonical}
      image={ogImage}
      ogType="website"
    />
  ) : null

  const srH1 = Platform.OS === 'web' ? (
    <h1 style={WEB_SR_ONLY_STYLE as any}>{title}</h1>
  ) : null

  if (!hydrated) {
    return (
      <>
        {seoBlock}
        {srH1}
        <MapPageSkeleton />
      </>
    )
  }

  return (
    <>
      {seoBlock}
      {srH1}
      <Suspense fallback={<MapPageSkeleton />}>
        <MapScreenImpl />
      </Suspense>
    </>
  )
}
