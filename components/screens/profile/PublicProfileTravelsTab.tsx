import { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard';
import type { Travel } from '@/types/types';

const AUTHOR_CARD_BLURHASH = 'LEHL6nWB2yk8pyo0adR*.7kCMdnj';

interface PublicProfileTravelsTabProps {
  travels: Travel[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  isMobile: boolean;
  onOpenTravel: (travel: Travel) => void;
  onLoadMore: () => void;
}

export function PublicProfileTravelsTab({
  travels,
  total,
  isLoading,
  isError,
  isMobile,
  onOpenTravel,
  onLoadMore,
}: PublicProfileTravelsTabProps) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (isLoading) {
    return (
      <View style={styles.state}>
        <ActivityIndicator size="small" color={colors.primaryDark} />
      </View>
    );
  }

  if (isError) {
    return <Text style={styles.stateText}>Не удалось загрузить путешествия автора</Text>;
  }

  if (travels.length === 0) {
    return <Text style={styles.stateText}>У автора пока нет опубликованных путешествий</Text>;
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        {travels.map((travel, index) => {
          const meta = [travel.cityName, travel.countryName]
            .map((v) => String(v ?? '').trim())
            .filter(Boolean)
            .join(' · ');
          return (
            <View key={String(travel.id ?? travel.slug ?? index)} style={styles.cardWrap}>
              <UnifiedTravelCard
                title={travel.name?.trim() || 'Без названия'}
                imageUrl={travel.travel_image_thumb_url || null}
                metaText={meta || null}
                onPress={() => onOpenTravel(travel)}
                mediaFit="contain"
                heroTitleOverlay
                contentPosition="belowMedia"
                imageHeight={180}
                webHoverScale={!isMobile}
                mediaProps={{
                  placeholderBlurhash: AUTHOR_CARD_BLURHASH,
                  blurBackground: true,
                  allowCriticalWebBlur: Platform.OS === 'web',
                  recyclingKey: String(travel.slug || travel.id || index),
                  loading: Platform.OS === 'web' ? (index < 3 ? 'eager' : 'lazy') : 'lazy',
                  priority: Platform.OS === 'web' && index < 3 ? 'high' : 'low',
                }}
              />
            </View>
          );
        })}
      </View>

      {total > travels.length ? (
        <Pressable
          style={[styles.viewAllButton, globalFocusStyles.focusable]}
          onPress={onLoadMore}
          accessibilityRole="button"
          accessibilityLabel="Показать ещё путешествия автора"
          {...Platform.select({ web: { cursor: 'pointer' } })}
        >
          <Text style={styles.viewAllButtonText}>Показать ещё</Text>
          <Feather name="chevron-down" size={16} color={colors.primaryDark} />
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    wrap: {
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      paddingBottom: DESIGN_TOKENS.spacing.md,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
    },
    cardWrap: {
      flexGrow: 1,
      flexBasis: Platform.OS === 'web' ? 300 : '100%',
      maxWidth: Platform.OS === 'web' ? 460 : undefined,
      minWidth: 0,
    },
    state: {
      paddingVertical: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stateText: {
      fontSize: 14,
      color: colors.textMuted,
      paddingVertical: 24,
      textAlign: 'center',
    },
    viewAllButton: {
      marginTop: 16,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.primarySoft,
    },
    viewAllButtonText: {
      fontSize: 14,
      fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
      color: colors.primaryText,
    },
  });
