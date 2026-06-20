import { memo, useMemo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import {
  useMyPlaceFirstBadges,
  useUserPlaceFirstBadges,
} from '@/hooks/useGamification';
import PlaceFirstBadgeCard from '@/components/achievements/PlaceFirstBadgeCard';

interface Props {
  /** userId — публичный профиль; не задан — собственный профиль. */
  userId?: string | number | null;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** Секция бейджей первооткрывателя места в профиле. FE-place-first-badge. */
function PlaceFirstBadgesSection({ userId, testID, style }: Props) {
  const colors = useThemedColors();
  const isOwn = userId == null;
  const ownQuery = useMyPlaceFirstBadges();
  const userQuery = useUserPlaceFirstBadges(isOwn ? null : userId);
  const { data, isLoading, isError } = isOwn ? ownQuery : userQuery;

  const styles = useMemo(() => getStyles(colors), [colors]);

  if (isError) return null;
  if (!isLoading && (!data || data.length === 0)) return null;

  return (
    <View style={[styles.wrap, style]} testID={testID}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Открытые места</Text>
        {data && data.length > 0 ? (
          <Text style={styles.count}>{data.length}</Text>
        ) : null}
      </View>

      {isLoading || !data ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <View style={styles.list}>
          {data.map((item) => (
            <PlaceFirstBadgeCard key={item.id} item={item} />
          ))}
        </View>
      )}
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    wrap: { gap: DESIGN_TOKENS.spacing.sm },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.sm },
    heading: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: '800',
      color: colors.text,
    },
    count: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      fontWeight: '800',
      color: colors.textOnPrimary,
      backgroundColor: colors.primary,
      borderRadius: 999,
      minWidth: 22,
      textAlign: 'center',
      paddingHorizontal: 7,
      paddingVertical: 2,
      overflow: 'hidden',
    },
    list: { gap: DESIGN_TOKENS.spacing.sm },
    loading: { paddingVertical: DESIGN_TOKENS.spacing.lg, alignItems: 'center' },
  });

export default memo(PlaceFirstBadgesSection);
