import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import type { Travel } from '@/src/types/types';

interface TelegramDiscussionSectionProps {
  travel: Travel;
}

export default function TelegramDiscussionSection({ travel }: TelegramDiscussionSectionProps) {
  const baseUrl = process.env.EXPO_PUBLIC_TELEGRAM_DISCUSSION_URL || '';

  const handleOpen = useCallback(() => {
    if (!baseUrl) return;

    const url = baseUrl;

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } else {
      Linking.openURL(url).catch(() => {});
    }
  }, [baseUrl]);

  const hasUrl = Boolean(baseUrl);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Обсуждение маршрута в Telegram</Text>
      <Text style={styles.subtitle}>
        Задайте вопрос или поделитесь впечатлениями о маршруте в нашем Telegram‑канале.
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
        <MaterialIcons name="telegram" size={20} color="#fff" />
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

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    marginBottom: 14,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: '#229ED9',
    minHeight: 44,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    backgroundColor: '#e5e7eb',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  helperText: {
    marginTop: 10,
    fontSize: 12,
    color: '#9ca3af',
  },
});
