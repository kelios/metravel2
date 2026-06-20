import React, { memo, useMemo } from 'react'
import { View } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useAuth } from '@/context/AuthContext'
import { useTravelPeerBadges } from '@/hooks/useAchievementsApi'
import PeerBadgeGiveButton from '@/components/achievements/PeerBadgeGiveButton'
import PeerBadgeReceivedRow from '@/components/achievements/PeerBadgeReceivedRow'
import type { Travel } from '@/types/types'

import { useTravelDetailsStyles } from './TravelDetailsStyles'

const ROW_SPACING = { marginTop: DESIGN_TOKENS.spacing.md } as const

function resolveOwnerId(travel: Travel): number | string | null {
  const direct = travel?.user?.id
  if (direct != null) return direct

  const raw = travel?.userIds
  if (typeof raw === 'string' && raw.trim()) {
    const n = Number(raw.split(',')[0].trim())
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}

const TravelPeerBadgesSection: React.FC<{ travel: Travel }> = memo(
  function TravelPeerBadgesSection({ travel }) {
    const styles = useTravelDetailsStyles()
    const { userId: currentUserId } = useAuth()

    const travelId = travel?.id
    const peerBadges = useTravelPeerBadges(travelId)
    const received = peerBadges.data ?? []

    const isOwnTravel = useMemo(() => {
      const ownerId = resolveOwnerId(travel)
      if (currentUserId == null || ownerId == null) return false
      return String(Number(currentUserId)) === String(Number(ownerId))
    }, [currentUserId, travel])

    if (travelId == null) return null
    if (received.length === 0 && isOwnTravel) return null

    return (
      <View
        testID="travel-details-peer-badges"
        role="region"
        accessibilityLabel="Награды от сообщества"
        style={[styles.sectionContainer, styles.contentStable]}
      >
        <PeerBadgeReceivedRow items={received} title="Награды от сообщества" />
        {!isOwnTravel && (
          <PeerBadgeGiveButton
            target="travel"
            travelId={travelId}
            received={received}
            label="Наградить статью"
            style={received.length > 0 ? ROW_SPACING : undefined}
          />
        )}
      </View>
    )
  }
)

export default TravelPeerBadgesSection
