import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { Travel } from '@/types/types';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { normalizeExternalUrl, openExternalUrlInNewTab } from '@/utils/externalLinks';

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
      <Text style={styles.title}>Обсуждение маршрута в Telegram</Text>
      <Text style={styles.subtitle}>
        Задайте вопрос или поделитесь впечатлениями о маршруте
        {travelName ? ` «${travelName}»` : ''} в нашем Telegram‑канале.
      </Text>
      <Pressable
        onPress={handleOpen}
        disabled={!hasUrl}
        style={({ pressed }) => [
          styles.button,
          !hasUrl && styles.buttonDisabled,
          pressed && hasUrl && styles.buttonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={hasUrl ? 'Открыть обсуждение в Telegram' : 'Скоро здесь будет обсуждение в Telegram'}
      >
        <Feather name="send" size={20} color={colors.textOnPrimary} />
        <Text style={styles.buttonText}>
          {hasUrl ? 'Открыть обсуждение в Telegram' : 'Скоро здесь будет обсуждение в Telegram'}
        </Text>
      </Pressable>
      {/* P1-9: Admin hint only in dev mode */}
      {!hasUrl && __DEV__ && (
        <Text style={styles.helperText}>
          Администратору: задайте EXPO_PUBLIC_TELEGRAM_DISCUSSION_URL в настройках окружения,
          чтобы включить ссылку на канал.
        </Text>
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
    padding: Platform.select({ default: DESIGN_TOKENS.spacing.lg, web: DESIGN_TOKENS.spacing.xl }),
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  title: {
    fontSize: Platform.select({ default: 17, web: 18 }),
    fontWeight: '600',
    color: colors.text,
    marginBottom: DESIGN_TOKENS.spacing.xs,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: DESIGN_TOKENS.spacing.xl,
    borderRadius: 999,
    backgroundColor: colors.primary,
    minHeight: 44,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      } as any,
    }),
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  buttonDisabled: {
    backgroundColor: colors.disabled,
    ...Platform.select({
      web: {
        cursor: 'not-allowed',
      } as any,
    }),
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textOnPrimary,
  },
  helperText: {
    marginTop: DESIGN_TOKENS.spacing.sm,
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    color: colors.textMuted,
  },
});

export default React.memo(TelegramDiscussionSection);
