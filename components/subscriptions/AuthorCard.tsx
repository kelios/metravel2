// components/subscriptions/AuthorCard.tsx
// D1: Extracted from subscriptions.tsx

import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Platform, Image, ScrollView, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import type { AuthorWithTravels } from '@/hooks/useSubscriptionsData';
import TabTravelCard from '@/components/listTravel/TabTravelCard';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { optimizeImageUrl } from '@/utils/imageOptimization';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import { resolveTravelUrl } from '@/utils/subscriptionsHelpers';

const WEB_HORIZONTAL_SCROLL_STYLE = {
  WebkitOverflowScrolling: 'touch' as const,
  overflowX: 'auto' as const,
  overflowY: 'hidden' as const,
  overscrollBehaviorX: 'contain' as const,
  touchAction: 'pan-x pan-y' as const,
};
const WEB_CARD_SHADOW_STYLE = { boxShadow: DESIGN_TOKENS.shadows.card };
const WEB_CURSOR_POINTER_STYLE = { cursor: 'pointer' as const };

interface AuthorCardProps {
  author: AuthorWithTravels;
  onUnsubscribe: (userId: number) => void;
  onMessage: (userId: number) => void;
  onOpenTravel: (url: string) => void;
  onOpenProfile: (userId: number) => void;
}

function AuthorCard({ author, onUnsubscribe, onMessage, onOpenTravel, onOpenProfile }: AuthorCardProps) {
  const colors = useThemedColors();
  const { isMobile, width } = useResponsive();
  const isCompact = isMobile || width < 640;
  const styles = useMemo(() => createStyles(colors, isCompact), [colors, isCompact]);
  const { profile, travels, travelsTotal, isLoadingTravels } = author;
  const [avatarError, setAvatarError] = useState(false);

  const fullName = useMemo(() => {
    const first = String(profile.first_name ?? '').trim();
    const last = String(profile.last_name ?? '').trim();
    return `${first} ${last}`.trim() || 'Пользователь';
  }, [profile.first_name, profile.last_name]);

  const initials = useMemo(() => {
    const first = String(profile.first_name ?? '').trim();
    const last = String(profile.last_name ?? '').trim();
    const firstInitial = first[0] || '';
    const lastInitial = last[0] || '';
    return (firstInitial + lastInitial).toUpperCase() || null;
  }, [profile.first_name, profile.last_name]);

  const authorUserId = profile.user ?? profile.id;

  const travelCountText = useMemo(() => {
    const n = travelsTotal;
    if (n === 1) return '1 путешествие';
    if (n >= 2 && n < 5) return `${n} путешествия`;
    return `${n} путешествий`;
  }, [travelsTotal]);

  const hiddenTravelsCount = Math.max(travelsTotal - travels.length, 0);

  return (
    <View style={styles.section}>
      <View style={styles.authorRow}>
        <Pressable
          style={styles.authorInfo}
          onPress={() => onOpenProfile(authorUserId)}
          accessibilityRole="button"
          accessibilityLabel={`Открыть профиль ${fullName}`}
          {...Platform.select({ web: { cursor: 'pointer' } })}
        >
          <View style={styles.avatar}>
            {profile.avatar && !avatarError ? (
              <Image
                source={{ uri: optimizeImageUrl(profile.avatar, { width: 96, height: 96, quality: 70, format: 'auto', fit: 'cover' }) ?? profile.avatar }}
                style={styles.avatarImage}
                onError={() => setAvatarError(true)}
              />
            ) : initials ? (
              <Text style={styles.avatarInitials}>{initials}</Text>
            ) : (
              <Feather name="user" size={20} color={colors.primaryDark} />
            )}
          </View>
          <View style={styles.authorTextBlock}>
            <Text style={styles.authorName} numberOfLines={1}>{fullName}</Text>
            <Text style={styles.authorSub}>
              {isLoadingTravels ? 'Загрузка...' : travelCountText}
            </Text>
          </View>
        </Pressable>

        <View style={styles.authorActions}>
          <Pressable
            style={[styles.actionButton, globalFocusStyles.focusable]}
            onPress={() => onMessage(authorUserId)}
            accessibilityRole="button"
            accessibilityLabel={`Написать ${fullName}`}
            {...Platform.select({ web: { cursor: 'pointer' } })}
          >
            <Feather name="mail" size={16} color={colors.primaryDark} />
          </Pressable>
          <Pressable
            style={[styles.actionButtonDanger, globalFocusStyles.focusable]}
            onPress={() => onUnsubscribe(authorUserId)}
            accessibilityRole="button"
            accessibilityLabel={`Отписаться от ${fullName}`}
            {...Platform.select({ web: { cursor: 'pointer' } })}
          >
            <Feather name="user-minus" size={16} color={colors.danger} />
          </Pressable>
        </View>
      </View>

      {isLoadingTravels ? (
        <View style={styles.travelsLoading}>
          <SkeletonLoader width="100%" height={180} borderRadius={12} />
        </View>
      ) : travels.length === 0 ? (
        <Text style={styles.noTravels}>Нет опубликованных путешествий</Text>
      ) : (
        <ScrollView
          testID="subscription-travels-rail"
          horizontal
          nestedScrollEnabled
          directionalLockEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.travelsScroll}
          {...Platform.select({ web: { style: WEB_HORIZONTAL_SCROLL_STYLE } })}
        >
          {travels.slice(0, 10).map((travel) => {
            const travelUrl = resolveTravelUrl(travel);
            return (
              <View key={travel.id} style={styles.travelCardWrap}>
                <TabTravelCard
                  item={{
                    id: travel.id,
                    title: travel.name || travel.title || 'Без названия',
                    imageUrl: travel.travel_image_thumb_small_url || travel.travel_image_thumb_url || travel.imageUrl || null,
                    city: travel.cityName || travel.city || null,
                    country: travel.countryName || travel.country || null,
                  }}
                  onPress={() => onOpenTravel(travelUrl)}
                  layout="grid"
                  style={styles.travelCard}
                  contentMinHeight={isCompact ? 58 : undefined}
                  imageHeight={isCompact ? 112 : undefined}
                  webTouchAction="pan-x pan-y"
                />
              </View>
            );
          })}
          {hiddenTravelsCount > 0 && (
            <Pressable
              style={[styles.showMoreCard, globalFocusStyles.focusable]}
              onPress={() => onOpenProfile(authorUserId)}
              accessibilityRole="button"
              accessibilityLabel="Показать все путешествия"
              {...Platform.select({ web: { cursor: 'pointer' } })}
            >
              <Feather name="arrow-right" size={24} color={colors.primaryDark} />
              <Text style={styles.showMoreText}>Ещё {hiddenTravelsCount}</Text>
            </Pressable>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>, isCompact: boolean) =>
  StyleSheet.create({
    section: {
      marginHorizontal: isCompact ? 10 : 16,
      marginBottom: isCompact ? 10 : 16,
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      ...(Platform.OS === 'web' ? WEB_CARD_SHADOW_STYLE : Platform.OS === 'android' ? { elevation: 2 } : {}),
    },
    authorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: isCompact ? 12 : 14,
      paddingVertical: isCompact ? 10 : 14,
      gap: isCompact ? 8 : 12,
    },
    authorInfo: { flexDirection: 'row', alignItems: 'center', gap: isCompact ? 8 : 10, flex: 1, minWidth: 0 },
    avatar: {
      width: isCompact ? 42 : 48,
      height: isCompact ? 42 : 48,
      borderRadius: isCompact ? 21 : 24,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.primary, overflow: 'hidden',
    },
    avatarImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    avatarInitials: {
      fontSize: 16, fontWeight: '700' as const, color: colors.primaryText, letterSpacing: 0.5,
    },
    authorTextBlock: { flex: 1, minWidth: 0 },
    authorName: { fontSize: isCompact ? 15 : 16, fontWeight: '700', color: colors.text },
    authorSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    authorActions: { flexDirection: 'row', gap: isCompact ? 6 : 8 },
    actionButton: {
      width: isCompact ? 38 : 40,
      height: isCompact ? 38 : 40,
      borderRadius: isCompact ? 19 : 20,
      backgroundColor: colors.primaryLight,
      alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.primaryAlpha30,
      ...(Platform.OS === 'web' ? WEB_CURSOR_POINTER_STYLE : {}),
    },
    actionButtonDanger: {
      width: isCompact ? 38 : 40,
      height: isCompact ? 38 : 40,
      borderRadius: isCompact ? 19 : 20,
      backgroundColor: colors.dangerLight,
      alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.danger,
      ...(Platform.OS === 'web' ? WEB_CURSOR_POINTER_STYLE : {}),
    },
    travelsLoading: { paddingHorizontal: 14, paddingBottom: 14 },
    noTravels: { paddingHorizontal: 14, paddingBottom: 14, fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
    travelsScroll: {
      paddingHorizontal: isCompact ? 12 : 14,
      paddingBottom: isCompact ? 12 : 14,
      gap: isCompact ? 10 : 12,
      ...(Platform.OS === 'web' ? ({ minWidth: 'max-content' } as any) : {}),
    },
    travelCardWrap: { width: isCompact ? 168 : 240 },
    travelCard: { width: '100%' },
    showMoreCard: {
      width: isCompact ? 96 : 120,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.primarySoft,
      alignItems: 'center', justifyContent: 'center', gap: 8,
      ...(Platform.OS === 'web' ? WEB_CURSOR_POINTER_STYLE : {}),
    },
    showMoreText: { fontSize: 13, fontWeight: '600', color: colors.primaryText },
  });

export default React.memo(AuthorCard);
