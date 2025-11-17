/**
 * Компонент кнопок "Поделиться"
 * Позволяет поделиться путешествием через различные платформы
 */

import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions, Platform, Alert } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import type { Travel } from '@/src/types/types';

interface ShareButtonsProps {
  travel: Travel;
  url?: string;
}

export default function ShareButtons({ travel, url }: ShareButtonsProps) {
  const { width } = useWindowDimensions();
  const isMobile = width <= 768;
  const router = useRouter();
  const pathname = usePathname();

  const [copied, setCopied] = useState(false);

  // Формируем URL для поделиться
  const shareUrl = useMemo(() => {
    if (url) return url;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.location.href;
    }
    const SITE = process.env.EXPO_PUBLIC_SITE_URL || 'https://metravel.by';
    const travelId = travel.slug || travel.id;
    return `${SITE}/travels/${travelId}`;
  }, [url, travel]);

  const shareTitle = travel.name || 'Путешествие на MeTravel';
  const shareText = `Посмотрите это путешествие: ${shareTitle}`;

  // Копирование ссылки
  const handleCopyLink = useCallback(async () => {
    try {
      if (Platform.OS === 'web' && (navigator as any)?.clipboard) {
        await (navigator as any).clipboard.writeText(shareUrl);
      } else {
        await Clipboard.setStringAsync(shareUrl);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      if (Platform.OS !== 'web') {
        Alert.alert('Скопировано', 'Ссылка скопирована в буфер обмена');
      }
    } catch (error) {
      console.error('Error copying link:', error);
      Alert.alert('Ошибка', 'Не удалось скопировать ссылку');
    }
  }, [shareUrl]);

  // Поделиться в Telegram
  const handleShareTelegram = useCallback(async () => {
    const text = encodeURIComponent(shareText);
    const urlEncoded = encodeURIComponent(shareUrl);
    const telegramUrl = `https://t.me/share/url?url=${urlEncoded}&text=${text}`;

    try {
      const canOpen = await Linking.canOpenURL(telegramUrl);
      if (canOpen) {
        await Linking.openURL(telegramUrl);
      } else {
        // Fallback: открываем в браузере
        if (Platform.OS === 'web') {
          window.open(telegramUrl, '_blank', 'noopener,noreferrer');
        }
      }
    } catch (error) {
      console.error('Error sharing to Telegram:', error);
    }
  }, [shareUrl, shareText]);

  // Поделиться в VK
  const handleShareVK = useCallback(() => {
    const vkUrl = `https://vk.com/share.php?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareTitle)}`;
    if (Platform.OS === 'web') {
      window.open(vkUrl, '_blank', 'width=600,height=400,noopener,noreferrer');
    } else {
      Linking.openURL(vkUrl).catch(() => {});
    }
  }, [shareUrl, shareTitle]);

  // Поделиться в WhatsApp
  const handleShareWhatsApp = useCallback(async () => {
    const text = encodeURIComponent(`${shareText} ${shareUrl}`);
    const whatsappUrl = `https://wa.me/?text=${text}`;

    try {
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        if (Platform.OS === 'web') {
          window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
        }
      }
    } catch (error) {
      console.error('Error sharing to WhatsApp:', error);
    }
  }, [shareUrl, shareText]);

  // Нативный Share API (для мобильных)
  const handleNativeShare = useCallback(async () => {
    if (Platform.OS === 'web') return;

    try {
      // @ts-ignore - для React Native
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
      }
    } catch (error: any) {
      // Пользователь отменил - игнорируем
      if (error.name !== 'AbortError') {
        console.error('Error sharing:', error);
      }
    }
  }, [shareUrl, shareTitle, shareText]);

  const shareButtons = [
    {
      key: 'copy',
      label: 'Копировать ссылку',
      icon: 'content-copy',
      onPress: handleCopyLink,
      color: '#667085',
    },
    {
      key: 'telegram',
      label: 'Telegram',
      icon: 'send',
      onPress: handleShareTelegram,
      color: '#0088cc',
    },
    {
      key: 'vk',
      label: 'VK',
      icon: 'share',
      onPress: handleShareVK,
      color: '#0077ff',
    },
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      icon: 'chat',
      onPress: handleShareWhatsApp,
      color: '#25D366',
    },
  ];

  // Для мобильных добавляем нативный Share
  if (Platform.OS !== 'web' && 'share' in navigator) {
    shareButtons.unshift({
      key: 'native',
      label: 'Поделиться',
      icon: 'share',
      onPress: handleNativeShare,
      color: '#ff9f5a',
    });
  }

  return (
    <View style={[styles.container, isMobile && styles.containerMobile]}>
      <Text style={styles.title}>Поделиться</Text>
      <View style={[styles.buttonsContainer, isMobile && styles.buttonsContainerMobile]}>
        {shareButtons.map((button) => (
          <Pressable
            key={button.key}
            onPress={button.onPress}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              button.key === 'copy' && copied && styles.buttonCopied,
            ]}
            accessibilityRole="button"
            accessibilityLabel={button.label}
            android_ripple={{ color: 'rgba(0,0,0,0.05)' }}
          >
            <MaterialIcons name={button.icon as any} size={20} color={button.color} />
            {!isMobile && <Text style={styles.buttonText}>{button.label}</Text>}
            {button.key === 'copy' && copied && (
              <Text style={styles.copiedText}>✓</Text>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ✅ РЕДИЗАЙН: Современная карточка с glassmorphism
  container: {
    paddingVertical: 24,
    paddingHorizontal: 28,
    backgroundColor: Platform.OS === 'web' ? 'rgba(255, 255, 255, 0.9)' : '#fff',
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(20px)' as any,
      WebkitBackdropFilter: 'blur(20px)' as any,
    } : {}),
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  containerMobile: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: 16,
    fontFamily: 'Georgia',
    letterSpacing: -0.3,
  },
  buttonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  buttonsContainerMobile: {
    gap: 10,
  },
  // ✅ РЕДИЗАЙН: Современные кнопки с улучшенными стилями
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' as any,
        ':hover': {
          backgroundColor: '#fff',
          borderColor: 'rgba(0, 0, 0, 0.12)',
          transform: 'translateY(-2px) scale(1.02)' as any,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' as any,
        } as any,
      },
    }),
  },
  buttonPressed: {
    backgroundColor: '#f3f4f6',
    transform: [{ scale: 0.98 }],
  },
  buttonCopied: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    letterSpacing: -0.1,
  },
  copiedText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#16a34a',
    marginLeft: 6,
  },
});

