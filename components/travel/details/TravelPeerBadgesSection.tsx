import React, { memo, useMemo } from 'react'
import { View } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useAuth } from '@/context/AuthContext'
import { useTravelPeerBadges } from '@/hooks/useAchievementsApi'
import PeerBadgeGiveButton from '@/components/achievements/PeerBadgeGiveButton'
import PeerBadgeReceivedRow from '@/components/achievements/PeerBadgeReceivedRow'
import type { Travel } from '@/types/types'

import { useTravelDetailsStyles } from './TravelDetailsStyles'
import { translate as i18nT } from '@/i18n'
import { resolveTravelAuthorId } from '@/utils/travelAuthorProfile'


const ROW_SPACING = { marginTop: DESIGN_TOKENS.spacing.md } as const

const TravelPeerBadgesSection: React.FC<{ travel: Travel }> = memo(
  function TravelPeerBadgesSection({ travel }) {
    const styles = useTravelDetailsStyles()
    const { userId: currentUserId } = useAuth()

    const travelId = travel?.id
    const peerBadges = useTravelPeerBadges(travelId)
    const received = peerBadges.data ?? []

    const isOwnTravel = useMemo(() => {
      const ownerId = resolveTravelAuthorId(travel)
      if (currentUserId == null || ownerId == null) return false
      return String(Number(currentUserId)) === String(Number(ownerId))
    }, [currentUserId, travel])

    if (travelId == null) return null
    if (received.length === 0 && isOwnTravel) return null

    return (
      <View
        testID="travel-details-peer-badges"
        role="region"
        accessibilityLabel={i18nT('travel:components.travel.details.TravelPeerBadgesSection.nagrady_ot_soobschestva_8ec3eeb7')}
        style={[styles.sectionContainer, styles.contentStable]}
      >
        <PeerBadgeReceivedRow items={received} title={i18nT('travel:components.travel.details.TravelPeerBadgesSection.nagrady_ot_soobschestva_8ec3eeb7')} />
        {!isOwnTravel && (
          <PeerBadgeGiveButton
            target="travel"
            travelId={travelId}
            received={received}
            label={i18nT('travel:components.travel.details.TravelPeerBadgesSection.nagradit_statyu_3b604dba')}
            pickerTitle={i18nT('travel:components.travel.details.TravelPeerBadgesSection.nagradit_statyu_3b604dba')}
            style={received.length > 0 ? ROW_SPACING : undefined}
          />
        )}
      </View>
    )
  }
)

export default TravelPeerBadgesSection
