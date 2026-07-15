import { Suspense } from 'react';
import { Platform } from 'react-native'

import { withLazy } from '@/components/travel/details/TravelDetailsLazy'
import { translate as i18nT } from '@/i18n'


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
  if (Platform.OS !== 'web') return null

  return (
    <>
      {showSkipToContentLink ? (
        <Suspense fallback={null}>
          <SkipToContentLink
            targetId="travel-main-content"
            label={i18nT('travel:components.travel.details.TravelDetailsAccessibilityChrome.skip_to_main_content_e6d1fd91')}
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
