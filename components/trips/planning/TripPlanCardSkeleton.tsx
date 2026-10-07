import { memo, useMemo } from 'react';
import { Platform, Text, View, type StyleProp, type TextStyle } from 'react-native';

import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { useThemedColors } from '@/hooks/useTheme';
import { createTripPlanCardStyles, TRIP_PLAN_CARD_MEDIA_HEIGHT } from './TripPlanCard.styles';

const NOOP = () => undefined;

/** Uses the same real card frame/media/content styles; it has no trip actions or data. */
function TripPlanCardSkeleton() {
  const colors = useThemedColors();
  const styles = useMemo(() => createTripPlanCardStyles(colors), [colors]);
  const line = (style: StyleProp<TextStyle>, width: number | `${number}%` = '80%') => (
    <View style={{ width }}><Text style={[style, { color: 'transparent', backgroundColor: colors.surfaceLight }]} accessible={false}>{'\u00a0'}</Text></View>
  );
  const content = (
    <View style={styles.contentStack}>
      <View style={styles.headerRow}>
        <View style={styles.statusBadge}>{line(styles.badgeText, 74)}</View>
        <View style={styles.visibilityBadge}>{line(styles.visibilityText, 88)}</View>
      </View>
      {line(styles.title)}
      <View style={styles.metaRow}>{line(styles.meta)}</View>
      {line(styles.route)}
      <View style={styles.footer}>
        <View style={styles.occupancyRow}>
          {line(styles.footerText, 150)}
          {line(styles.participantsHint, 100)}
        </View>
        <View style={styles.cardActions}>
          <View style={styles.manageButton}>{line(styles.manageButtonText, 92)}</View>
        </View>
      </View>
    </View>
  );
  return (
    <View testID="trip-plan-card-skeleton" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
      <UnifiedTravelCard
        title=""
        imageUrl={null}
        imageHeight={TRIP_PLAN_CARD_MEDIA_HEIGHT}
        heroTitleOverlay={false}
        contentPosition="belowMedia"
        contentSlot={content}
        contentContainerStyle={styles.contentContainer}
        mediaPlaceholderSlot={<SkeletonLoader width="100%" height="100%" borderRadius={0} />}
        style={styles.card}
        onPress={NOOP}
        webNavigationOwner="external"
        webAsView={Platform.OS === 'web'}
        testID="trip-plan-card-skeleton-frame"
      />
    </View>
  );
}

export default memo(TripPlanCardSkeleton);
