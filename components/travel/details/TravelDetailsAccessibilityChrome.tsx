import React, { Suspense } from 'react'
import { Platform } from 'react-native'

import { withLazy } from '@/components/travel/details/TravelDetailsLazy'

const SkipToContentLink = withLazy(() => import('@/components/accessibility/SkipToContentLink'))
const AccessibilityAnnouncer = withLazy(() => import('@/components/accessibility/AccessibilityAnnouncer'))

type TravelDetailsAccessibilityChromeProps = {
  announcement: string
  announcementPriority: 'polite' | 'assertive'
  showSkipToContentLink: boolean
}

export default function TravelDetailsAccessibilityChrome({
  announcement,
  announcementPriority,
  showSkipToContentLink,
}: TravelDetailsAccessibilityChromeProps) {
  return (
    <>
      {showSkipToContentLink ? (
        <Suspense fallback={null}>
          <SkipToContentLink
            targetId="travel-main-content"
            label="Skip to main content"
            initiallyVisible={Platform.OS === 'web'}
            autoFocusOnMount={Platform.OS === 'web'}
          />
        </Suspense>
      ) : null}

      {announcement ? (
        <Suspense fallback={null}>
          <AccessibilityAnnouncer
            message={announcement}
            priority={announcementPriority}
            id="travel-announcer"
          />
        </Suspense>
      ) : null}
    </>
  )
}
