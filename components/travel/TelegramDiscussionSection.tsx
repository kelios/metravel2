import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { Travel } from '@/types/types';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { normalizeExternalUrl, openExternalUrlInNewTab } from '@/utils/externalLinks';
import { translate as i18nT } from '@/i18n'


interface TelegramDiscussionSectionProps {
  travel: Travel;
}

function TelegramDiscussionSection({ travel }: TelegramDiscussionSectionProps) {
  const colors = useThemedColors();
  const baseUrl = process.env.EXPO_PUBLIC_TELEGRAM_DISCUSSION_URL || '';
  const travelName = travel?.name;

  // ✅ УЛУЧШЕНИЕ: Мемоизация стилей с динамическими цветами
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleOpen = useCallback(() => {
    if (!baseUrl) return;

    const url = normalizeExternalUrl(baseUrl);
    if (!url) return;

    void openExternalUrlInNewTab(url, {
      onError: (error) => {
        if (__DEV__) {
          console.warn('[TelegramDiscussionSection] Не удалось открыть Telegram:', error);
        }
      },
    });
  }, [baseUrl]);

  const hasUrl = Boolean(baseUrl);

  // P1-4: Не показываем секцию без URL в production
  if (!baseUrl && !__DEV__) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{i18nT('travel:components.travel.TelegramDiscussionSection.obsuzhdenie_marshruta_v_telegram_a7792961')}</Text>
      <Text style={styles.subtitle}>
        {i18nT('travel:components.travel.TelegramDiscussionSection.zadayte_vopros_ili_podelites_vpechatleniyami_15f6b1d4')}{travelName ? ` «${travelName}»` : ''} {i18nT('travel:components.travel.TelegramDiscussionSection.v_nashem_telegram_kanale_d0dc2fd7')}</Text>
      <Pressable
        onPress={handleOpen}
        disabled={!hasUrl}
        style={({ pressed }) => [
          styles.button,
          !hasUrl && styles.buttonDisabled,
          pressed && hasUrl && styles.buttonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={hasUrl ? i18nT('travel:components.travel.TelegramDiscussionSection.otkryt_obsuzhdenie_v_telegram_ac2c9644') : i18nT('travel:components.travel.TelegramDiscussionSection.skoro_zdes_budet_obsuzhdenie_v_telegram_325d7065')}
        accessibilityHint={hasUrl ? i18nT('travel:components.travel.TelegramDiscussionSection.otkroetsya_vneshnee_prilozhenie_ili_vkladka_f07c5d42') : undefined}
      >
        <Feather name="send" size={18} color={hasUrl ? colors.primary : colors.textMuted} />
        <Text style={styles.buttonText}>
          {hasUrl ? i18nT('travel:components.travel.TelegramDiscussionSection.otkryt_chat_v_telegram_64956452') : i18nT('travel:components.travel.TelegramDiscussionSection.skoro_zdes_budet_chat_v_telegram_98a61847')}
        </Text>
      </Pressable>
      {/* P1-9: Admin hint only in dev mode */}
      {!hasUrl && __DEV__ && (
        <Text style={styles.helperText}>
          {i18nT('travel:components.travel.TelegramDiscussionSection.administratoru_zadayte_expo_public_telegram__c10c2ba6')}</Text>
      )}
    </View>
  );
}

// ✅ УЛУЧШЕНИЕ: Функция создания стилей с динамическими цветами для поддержки тем
const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.md,
    padding: Platform.select({ default: DESIGN_TOKENS.spacing.md, web: DESIGN_TOKENS.spacing.lg }),
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: DESIGN_TOKENS.spacing.xs,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: DESIGN_TOKENS.spacing.xl,
    borderRadius: DESIGN_TOKENS.radii.pill,
    backgroundColor: colors.surface,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.primary,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
      } as any,
    }),
  },
  buttonPressed: {
    backgroundColor: colors.primarySoft,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    borderColor: colors.borderLight,
    backgroundColor: colors.backgroundSecondary,
    ...Platform.select({
      web: {
        cursor: 'not-allowed',
      } as any,
    }),
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primaryText,
  },
  helperText: {
    marginTop: DESIGN_TOKENS.spacing.sm,
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    color: colors.textMuted,
  },
});

export default React.memo(TelegramDiscussionSection);
