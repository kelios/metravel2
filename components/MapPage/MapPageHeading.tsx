import React, { memo, useLayoutEffect } from 'react'
import { Platform, View } from 'react-native'

import { Heading } from '@/components/ui/Typography'
import { getMapSeoTitle } from '@/constants/mapSeo'

/**
 * Where the map page heading is currently mounted.
 *
 * - `panel-head` — a heading line inside the desktop side panel header, above
 *   the tab row. Only available while the panel is expanded.
 * - `map-corner` — a compact capsule pinned inside the map area, used whenever
 *   the panel header does not exist: desktop with a collapsed panel, mobile web
 *   and the desktop data-error screen.
 */
export type MapPageHeadingAnchor = 'panel-head' | 'map-corner'

const SSG_HEADING_SELECTOR = 'h1[data-ssg-travel-h1="true"]'
const SITE_NAME_SUFFIX = /\s*\|\s*MeTravel\s*$/i

const IS_WEB = Platform.OS === 'web'

/**
 * Drop the static pre-hydration heading injected into the raw HTML by
 * `scripts/generate-seo-pages.js`.
 *
 * Deliberately owned by the runtime heading rather than by the route: the
 * static node must survive until a runtime heading actually exists, not merely
 * until hydration is ready. Route-level removal keyed on hydration left `/map`
 * with zero `<h1>` for as long as a deferred chunk took to resolve — and
 * forever if it failed to load. `useLayoutEffect` keeps the removal inside the
 * same commit as the insertion, so no observer can sample two headings (#1640).
 */
function useAdoptStaticHeading() {
  useLayoutEffect(() => {
    if (!IS_WEB || typeof document === 'undefined') return
    document.querySelectorAll(SSG_HEADING_SELECTOR).forEach((heading) => heading.remove())
  }, [])
}

type MapPageHeadingProps = {
  anchor: MapPageHeadingAnchor
  styles: any
}

/**
 * The single page-level `<h1>` of the map route.
 *
 * Exactly one instance is mounted at a time; the caller picks the anchor from
 * the same state that already picks the chrome, so the swap happens inside one
 * React commit and the document never observably holds two headings.
 *
 * Web-only: `<h1>` is a DOM/SEO concept and the native map route re-exports the
 * same screen without it, so this renders nothing outside web rather than
 * forking the native layout.
 *
 * `Heading level={1}` is the project chokepoint for heading semantics — it owns
 * the `aria-level` that makes react-native-web emit a real `h1` tag (#1617).
 * The typography below it comes from map tokens, not from the Heading scale,
 * because a 24px heading in a 320-360px panel column costs three lines.
 */
function MapPageHeadingImpl({ anchor, styles }: MapPageHeadingProps) {
  useAdoptStaticHeading()

  if (!IS_WEB) return null

  const text = getMapSeoTitle().replace(SITE_NAME_SUFFIX, '')

  if (anchor === 'panel-head') {
    return (
      <Heading
        level={1}
        style={styles.pageHeadingInPanel}
        {...({ dataSet: { mapPageHeading: 'panel-head' } } as any)}
      >
        {text}
      </Heading>
    )
  }

  return (
    <View
      style={styles.pageHeadingCapsule}
      pointerEvents="none"
      {...({ dataSet: { mapPageHeading: 'map-corner' } } as any)}
    >
      <Heading level={1} style={styles.pageHeadingCapsuleText}>
        {text}
      </Heading>
    </View>
  )
}

export const MapPageHeading = memo(MapPageHeadingImpl)

export default MapPageHeading
