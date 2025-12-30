/**
 * Компонент карточки автора для основного контента
 * Показывает информацию об авторе путешествия для установления доверия
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, type ViewProps } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import type { Travel } from '@/src/types/types';
import { openExternalUrl } from '@/src/utils/externalLinks';
import { useUserProfileCached } from '@/src/hooks/useUserProfileCached';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import ImageCardMedia from '@/components/ui/ImageCardMedia';

interface AuthorCardProps {
  travel: Travel;
  onViewAuthorTravels?: () => void;
}

function SafeView({ children, ...rest }: ViewProps) {
  const safeChildren = React.Children.toArray(children).filter((child) => typeof child !== 'string');
  return <View {...rest}>{safeChildren}</View>;
}

export default function AuthorCard({ travel, onViewAuthorTravels }: AuthorCardProps) {
  const router = useRouter();
  const { isPhone, isLargePhone } = useResponsive();
  const isMobile = isPhone || isLargePhone;

  const normalizeMediaUrl = useCallback((raw: string) => {
    const value = String(raw ?? '').trim();
    if (!value) return '';
    const lower = value.toLowerCase();
    if (lower === 'null' || lower === 'undefined') return '';
    if (value.startsWith('http://') || value.startsWith('https://')) return value;

    if (value.startsWith('/')) {
      const base = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/?api\/?$/, '');
      if (base) return `${base}${value}`;
    }

    return value;
  }, []);

  // Извлекаем и очищаем данные об авторе
  const userName = useMemo(() => {
    // 1. Пробуем user объект (самый надежный источник)
    const userObj = travel.user;
    if (userObj) {
      const firstName = userObj.first_name || userObj.name;
      const lastName = userObj.last_name;
      
      if (firstName && typeof firstName === 'string' && firstName.trim()) {
        const cleanFirstName = firstName.trim();
        if (lastName && typeof lastName === 'string' && lastName.trim()) {
          return `${cleanFirstName} ${lastName.trim()}`.trim();
        }
        return cleanFirstName;
      }
    }
    
    // 2. Пробуем прямые поля в travel объекте
    const directName = (travel as any).author_name || (travel as any).authorName || (travel as any).owner_name || (travel as any).ownerName;
    if (directName && typeof directName === 'string' && directName.trim()) {
      const clean = directName.trim();
      // Проверяем на очевидные плейсхолдеры
      if (!/^[.\s\u00B7\u2022]+$|^Автор|^Пользователь|^User/i.test(clean)) {
        return clean;
      }
    }
    
    // 3. Используем поле userName как основной fallback
    const base = (travel as any).userName || '';
    if (typeof base === 'string' && base.trim()) {
      const clean = base.trim();
      // Проверяем на плейсхолдеры, но менее строго
      if (!/^[.\s\u00B7\u2022]{4,}$|^Автор|^Пользователь|^User|^Anonymous/i.test(clean)) {
        return clean;
      }
    }
    
    // 4. Ничего не найдено
    return '';
  }, [travel]);

  const userId = useMemo(() => {
    const direct =
      (travel as any)?.user?.id ??
      (travel as any)?.userId ??
      (travel as any)?.user_id ??
      null;

    if (direct != null) return direct;

    const arr = (travel as any)?.userIds;
    if (Array.isArray(arr) && arr.length > 0) {
      return arr[0];
    }
    return null;
  }, [travel]);

  // Подсчет количества путешествий автора (если доступно)
  const travelsCount = (travel as any).userTravelsCount || null;

  const { profile: authorProfile } = useUserProfileCached(userId, {
    enabled: !!userId,
  });

  const authorCountryName = useMemo(() => {
    const fromProfile =
      (authorProfile as any)?.countryName ||
      (authorProfile as any)?.country_name ||
      (authorProfile as any)?.country ||
      '';
    const fromUserObj =
      ((travel as any)?.user as any)?.countryName ||
      ((travel as any)?.user as any)?.country_name ||
      ((travel as any)?.user as any)?.country ||
      '';

    // Показываем только страну автора (профиль / user), не страны путешествия
    const raw = String(fromProfile || fromUserObj || '').trim();
    if (!raw) return '';
    if (raw.toLowerCase() === 'null' || raw.toLowerCase() === 'undefined') return '';
    return raw;
  }, [authorProfile, travel]);

  const socials = useMemo(() => {
    if (!authorProfile) return [];
    const raw = [
      { key: 'youtube', label: 'YouTube', value: authorProfile.youtube },
      { key: 'instagram', label: 'Instagram', value: authorProfile.instagram },
      { key: 'twitter', label: 'Twitter', value: authorProfile.twitter },
      { key: 'vk', label: 'VK', value: authorProfile.vk },
    ];
    return raw.filter((s) => Boolean(String(s.value ?? '').trim()));
  }, [authorProfile]);

  const handleOpenAuthorProfile = useCallback(() => {
    if (!userId) return;
    router.push(`/user/${userId}` as any);
  }, [router, userId]);

  const handleViewAuthorTravels = useCallback(() => {
    if (onViewAuthorTravels) {
      onViewAuthorTravels();
    } else if (userId) {
      const url = `/search?user_id=${encodeURIComponent(userId)}`;
      router.push(url as any);
    }
  }, [userId, onViewAuthorTravels, router]);

  // Оптимизация аватара
  const travelUserAvatar = (travel as any)?.user?.avatar;

  const avatarUri = useMemo(() => {
    const rawUri = authorProfile?.avatar || travelUserAvatar;
    if (!rawUri) return '';

    const normalizedUri = normalizeMediaUrl(rawUri);
    if (!normalizedUri) return '';

    // Для надёжности отдаём нормализованный URL без доп. опций, чтобы не ломать S3/прокси
    return normalizedUri;
  }, [authorProfile?.avatar, travelUserAvatar, normalizeMediaUrl]);

  const avatarSize = useMemo(
    () => (isMobile ? 64 : Platform.select({ default: 72, web: 96 })!),
    [isMobile]
  );
  const avatarBorderRadius = useMemo(() => Math.round(avatarSize / 2), [avatarSize]);

  // Не показываем если нет данных об авторе
  if (!userName && !authorCountryName && !userId) {
    return null;
  }

  return (
    <SafeView style={[styles.container, isMobile && styles.containerMobile]}>
      <SafeView style={[styles.content, isMobile && styles.contentMobile]}>
        {/* Аватар */}
        <Pressable
          style={styles.avatarSection}
          onPress={handleOpenAuthorProfile}
          accessibilityRole={userId ? 'button' : undefined}
          accessibilityLabel={userId ? `Открыть профиль автора ${userName || 'Аноним'}` : undefined}
          disabled={!userId}
        >
          {avatarUri ? (
            <ImageCardMedia
              src={avatarUri}
              alt={userName || 'Автор'}
              width={avatarSize}
              height={avatarSize}
              borderRadius={avatarBorderRadius}
              fit="cover"
              blurBackground={false}
              priority="low"
              loading="lazy"
              style={[styles.avatar, isMobile && styles.avatarMobile]}
            />
          ) : (
            <SafeView style={[styles.avatarPlaceholder, isMobile && styles.avatarMobile]}>
              <MaterialIcons name="person" size={isMobile ? 32 : 40} color={DESIGN_TOKENS.colors.textSubtle} />
            </SafeView>
          )}
        </Pressable>

        {/* Информация об авторе */}
        <SafeView style={styles.infoSection}>
          <Pressable
            onPress={handleOpenAuthorProfile}
            disabled={!userId}
            accessibilityRole={userId ? 'button' : undefined}
            accessibilityLabel={userId ? `Открыть профиль автора ${userName || 'Аноним'}` : undefined}
            style={({ pressed }) => [pressed && userId ? { opacity: 0.85 } : null]}
          >
            <Text style={[styles.authorName, isMobile && styles.authorNameMobile]}>
              {userName || 'Аноним'}
            </Text>
          </Pressable>
          {authorCountryName && (
            <SafeView style={styles.locationRow}>
              <Feather name="map-pin" size={14} color={DESIGN_TOKENS.colors.textMuted} />
              <Text style={styles.locationText}>{authorCountryName}</Text>
            </SafeView>
          )}

          {socials.length > 0 && (
            <SafeView style={styles.socialsRow}>
              {socials.map((s) => (
                <Pressable
                  key={s.key}
                  onPress={() => openExternalUrl(String(s.value))}
                  accessibilityRole="link"
                  accessibilityLabel={`Открыть ${s.label}`}
                  style={({ pressed }) => [styles.socialChip, pressed && styles.socialChipPressed]}
                >
                  <Text style={styles.socialChipText}>{s.label}</Text>
                </Pressable>
              ))}
            </SafeView>
          )}

          {travelsCount !== null && (
            <SafeView style={styles.statsRow}>
              {/* ✅ УЛУЧШЕНИЕ: Нейтральный серый */}
              <MaterialIcons name="explore" size={16} color={DESIGN_TOKENS.colors.textMuted} />
              <Text style={styles.statsText}>
                {travelsCount} {travelsCount === 1 ? 'путешествие' : travelsCount < 5 ? 'путешествия' : 'путешествий'}
              </Text>
            </SafeView>
          )}
        </SafeView>

        {/* Кнопка "Смотреть все путешествия" */}
        {userId && (
          <Pressable
            style={({ pressed }) => [
              styles.viewButton,
              isMobile && styles.viewButtonMobile,
              pressed && styles.viewButtonPressed,
            ]}
            onPress={handleViewAuthorTravels}
            accessibilityRole="button"
            accessibilityLabel={`Смотреть все путешествия автора ${userName}`}
          >
            <Text style={[styles.viewButtonText, isMobile && styles.viewButtonTextMobile]}>
              Все путешествия
            </Text>
            {/* ✅ УЛУЧШЕНИЕ: Нейтральный серый */}
            <Feather name="arrow-right" size={16} color={DESIGN_TOKENS.colors.textMuted} />
          </Pressable>
        )}
      </SafeView>
    </SafeView>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRadius: DESIGN_TOKENS.radii.lg,
    padding: Platform.select({
      default: DESIGN_TOKENS.spacing.xl,
      web: DESIGN_TOKENS.spacing.xxl,
    }),
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.borderLight,
    ...Platform.select({
      web: {
        boxShadow: DESIGN_TOKENS.shadows.card,
      } as any,
      default: DESIGN_TOKENS.shadowsNative.medium,
    }),
  },
  containerMobile: {
    padding: DESIGN_TOKENS.spacing.lg,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.lg,
  },
  contentMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: DESIGN_TOKENS.spacing.md,
  },
  avatarSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: Platform.select({
      default: 72,
      web: 96,
    }),
    height: Platform.select({
      default: 72,
      web: 96,
    }),
    borderRadius: Platform.select({
      default: 36,
      web: 48,
    }),
    borderWidth: 2,
    borderColor: DESIGN_TOKENS.colors.borderLight,
    ...Platform.select({
      web: {
        boxShadow: DESIGN_TOKENS.shadows.light,
      } as any,
      default: DESIGN_TOKENS.shadowsNative.light,
    }),
  },
  avatarMobile: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 0.5, // ✅ УЛУЧШЕНИЕ: Уменьшено с 2
  },
  avatarPlaceholder: {
    width: Platform.select({
      default: 64, // Мобильные
      web: 80, // Десктоп
    }),
    height: Platform.select({
      default: 64, // Мобильные
      web: 80, // Десктоп
    }),
    borderRadius: Platform.select({
      default: 32, // Мобильные
      web: 40, // Десктоп
    }),
    backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
    borderWidth: 0.5, // ✅ УЛУЧШЕНИЕ: Уменьшено с 3
    borderColor: DESIGN_TOKENS.colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoSection: {
    flex: 1,
    gap: DESIGN_TOKENS.spacing.sm,
  },
  socialsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.xs,
  },
  socialChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: DESIGN_TOKENS.colors.borderLight,
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
      },
    }),
  },
  socialChipPressed: {
    backgroundColor: DESIGN_TOKENS.colors.backgroundTertiary,
    transform: [{ scale: 0.98 }],
  },
  socialChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: DESIGN_TOKENS.colors.textMuted,
  },
  authorName: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: '700',
    color: DESIGN_TOKENS.colors.text,
    fontFamily: 'Georgia',
    letterSpacing: -0.3,
  },
  authorNameMobile: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
  },
  locationText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: DESIGN_TOKENS.colors.textMuted,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    marginTop: 4,
  },
  statsText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: DESIGN_TOKENS.colors.textSubtle,
    fontWeight: '600',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    paddingVertical: Platform.select({
      default: 12,
      web: 14,
    }),
    paddingHorizontal: Platform.select({
      default: 20,
      web: 24,
    }),
    borderRadius: 999,
    backgroundColor: DESIGN_TOKENS.colors.primaryLight,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.borderLight,
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
        transition: 'all 0.2s ease' as any,
        boxShadow: DESIGN_TOKENS.shadows.light,
        ':hover': {
          backgroundColor: DESIGN_TOKENS.colors.primary,
          borderColor: DESIGN_TOKENS.colors.primary,
          boxShadow: DESIGN_TOKENS.shadows.hover,
        } as any,
      },
    }),
  },
  viewButtonMobile: {
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    alignSelf: 'flex-start',
    marginTop: DESIGN_TOKENS.spacing.sm,
  },
  viewButtonPressed: {
    backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary, // ✅ УЛУЧШЕНИЕ: Нейтральный фон
    transform: [{ scale: 0.98 }],
  },
  viewButtonText: {
    fontSize: Platform.select({
      default: 14,
      web: 15,
    }),
    fontWeight: '600',
    color: DESIGN_TOKENS.colors.primary,
  },
  viewButtonTextMobile: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
  },
});
