import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import * as Linking from 'expo-linking';
import type { Travel } from '@/src/types/types';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

interface TelegramDiscussionSectionProps {
  travel: Travel;
}

export default function TelegramDiscussionSection({ travel }: TelegramDiscussionSectionProps) {
  const colors = useThemedColors();
  const baseUrl = process.env.EXPO_PUBLIC_TELEGRAM_DISCUSSION_URL || '';
  const travelName = travel?.name;

  // ✅ УЛУЧШЕНИЕ: Мемоизация стилей с динамическими цветами
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleOpen = useCallback(() => {
    if (!baseUrl) return;

    const url = baseUrl;

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } else {
      Linking.openURL(url).catch((error) => {
        // ✅ ИСПРАВЛЕНИЕ: Логируем ошибки открытия Telegram
        if (__DEV__) {
          console.warn('[TelegramDiscussionSection] Не удалось открыть Telegram:', error);
        }
      });
    }
  }, [baseUrl]);

  const hasUrl = Boolean(baseUrl);

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
      {!hasUrl && (
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
    borderRadius: 16,
    padding: DESIGN_TOKENS.spacing.xl,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  title: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: '700',
    color: colors.text,
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  subtitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: 14,
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
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    backgroundColor: colors.disabled,
  },
  buttonText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '600',
    color: colors.textOnPrimary,
  },
  helperText: {
    marginTop: DESIGN_TOKENS.spacing.sm,
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    color: colors.textMuted,
  },
});
