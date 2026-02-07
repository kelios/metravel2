import { useMemo, useCallback, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, Pressable, Platform, Image, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';
import { openExternalUrl } from '@/utils/externalLinks';
import { useUserProfileCached } from '@/hooks/useUserProfileCached';
import { useThemedColors } from '@/hooks/useTheme';

export default function PublicUserProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const userId = useMemo(() => {
    const raw = params?.id;
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? String(n) : null;
  }, [params?.id]);

  const { profile, isLoading, error, fullName } = useUserProfileCached(userId, {
    enabled: !!userId,
  });
  const [avatarError, setAvatarError] = useState(false);

  const socials = useMemo(
    () =>
      profile
        ? [
            { key: 'youtube', label: 'YouTube', icon: 'youtube', value: profile.youtube },
            { key: 'instagram', label: 'Instagram', icon: 'instagram', value: profile.instagram },
            { key: 'twitter', label: 'Twitter', icon: 'twitter', value: profile.twitter },
            { key: 'vk', label: 'VK', icon: 'vk', value: profile.vk },
          ].filter((s) => Boolean(String(s.value ?? '').trim()))
        : [],
    [profile]
  );

  const handleViewTravels = useCallback(() => {
    if (!userId) return;
    router.push(`/search?user_id=${encodeURIComponent(userId)}` as any);
  }, [router, userId]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!userId || error || !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorWrap}>
          <Text style={styles.errorTitle}>Профиль недоступен</Text>
          <Text style={styles.errorText}>{!userId ? 'Некорректный id пользователя' : (error as any)?.message || String(error || 'Не удалось загрузить данные профиля')}</Text>
          <Pressable
            style={[styles.backButton, globalFocusStyles.focusable]}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Назад"
            {...Platform.select({ web: { cursor: 'pointer' } })}
          >
            <Feather name="arrow-left" size={16} color={colors.primary} />
            <Text style={styles.backButtonText}>Назад</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View style={styles.avatar}>
              {profile.avatar && !avatarError ? (
                <Image
                  source={{ uri: profile.avatar }}
                  style={styles.avatarImage}
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <Feather name="user" size={28} color={colors.primary} />
              )}
            </View>
            <View style={styles.headerTextBlock}>
              <Text style={styles.userName}>{fullName || 'Пользователь'}</Text>
              <Text style={styles.userSub}>Автор путешествий</Text>
            </View>
          </View>

          {socials.length > 0 && (
            <View style={styles.socialsRow}>
              {socials.map((s) => (
                <Pressable
                  key={s.key}
                  style={[styles.socialChip, globalFocusStyles.focusable]}
                  onPress={() => openExternalUrl(String(s.value))}
                  accessibilityRole="link"
                  accessibilityLabel={`Открыть ${s.label}`}
                  {...Platform.select({ web: { cursor: 'pointer' } })}
                >
                  <Text style={styles.socialChipText}>{s.label}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.actionsRow}>
            <Pressable
              style={[styles.primaryButton, globalFocusStyles.focusable]}
              onPress={handleViewTravels}
              accessibilityRole="button"
              accessibilityLabel="Смотреть путешествия автора"
              {...Platform.select({ web: { cursor: 'pointer' } })}
            >
              <Feather name="map" size={16} color={colors.textOnPrimary} />
              <Text style={styles.primaryButtonText}>Путешествия автора</Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, globalFocusStyles.focusable]}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Назад"
              {...Platform.select({ web: { cursor: 'pointer' } })}
            >
              <Feather name="arrow-left" size={16} color={colors.primary} />
              <Text style={styles.secondaryButtonText}>Назад</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.mutedBackground,
  },
  scrollView: {
    flex: 1,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  headerCard: {
    paddingVertical: 18,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: colors.boxShadows.card } as any)
      : Platform.OS === 'android'
        ? { elevation: 2 }
        : colors.shadows.light),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.primary,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  headerTextBlock: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  userSub: {
    fontSize: 13,
    color: colors.textMuted,
  },
  socialsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  socialChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
  },
  socialChipText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  errorWrap: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  errorText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
});
