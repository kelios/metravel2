/**
 * Компонент кнопок "Поделиться"
 * Позволяет поделиться путешествием через различные платформы
 * ✅ РЕДИЗАЙН: Поддержка темной темы + компактный дизайн
 */

import React, { useCallback, useState, useMemo, lazy, Suspense } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Alert } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import type { Travel } from '@/src/types/types';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import { useSingleTravelExport } from '@/components/travel/hooks/useSingleTravelExport';
import { ExportStage } from '@/src/types/pdf-export';
import { globalFocusStyles } from '@/styles/globalFocus';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';

const BookSettingsModalLazy = lazy(() => import('@/components/export/BookSettingsModal'));

interface ShareButtonsProps {
  travel: Travel;
  url?: string;
  variant?: 'default' | 'sticky';
}

export default function ShareButtons({ travel, url, variant = 'default' }: ShareButtonsProps) {
  const { isPhone, isLargePhone } = useResponsive();
  const isMobile = isPhone || isLargePhone;
  const isSticky = variant === 'sticky';
  const colors = useThemedColors(); // ✅ РЕДИЗАЙН: Темная тема

  const [copied, setCopied] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const {
    pdfExport,
    lastSettings,
    handleOpenPrintBookWithSettings,
  } = useSingleTravelExport(travel);
  const { isGenerating, progress, currentStage } = pdfExport;

  // Формируем URL для поделиться
  const shareUrl = useMemo(() => {
    if (url) return url;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.location.href;
    }
    const { getSiteBaseUrl } = require('@/utils/seo');
    const travelId = travel.slug || travel.id;
    return `${getSiteBaseUrl()}/travels/${travelId}`;
  }, [url, travel]);

  const shareTitle = travel.name || 'Путешествие на MeTravel';
  const shareText = `Посмотрите это путешествие: ${shareTitle}`;
  const sharePostText = `${shareText} ${shareUrl}`;

  // Базовая функция копирования в буфер обмена
  const copyToClipboard = useCallback(async (text: string, showSuccessAlert: boolean) => {
    try {
      if (Platform.OS === 'web' && (navigator as any)?.clipboard) {
        await (navigator as any).clipboard.writeText(text);
      } else {
        await Clipboard.setStringAsync(text);
      }

      if (showSuccessAlert && Platform.OS !== 'web') {
        Alert.alert('Скопировано', 'Ссылка скопирована в буфер обмена');
      }
    } catch (error) {
      console.error('Error copying link:', error);
      Alert.alert('Ошибка', 'Не удалось скопировать ссылку');
    }
  }, []);

  // Копирование чистой ссылки
  const handleCopyLink = useCallback(async () => {
    await copyToClipboard(shareUrl, true);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [copyToClipboard, shareUrl]);

  // Копирование готового текста поста (текст + ссылка)
  const handleCopyPostText = useCallback(async () => {
    await copyToClipboard(sharePostText, true);
  }, [copyToClipboard, sharePostText]);

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
      Linking.openURL(vkUrl).catch((error) => {
        // ✅ ИСПРАВЛЕНИЕ: Логируем ошибки вместо молчаливого игнорирования
        if (__DEV__) {
          console.warn('[ShareButtons] Не удалось открыть VK:', error);
        }
      });
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

  // Переключение видимости панели
  const toggleCollapse = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  // Обработчик "Сохранить PDF" — переводим на новый HTML-поток печати
  const handleExport = useCallback(
    async (settings: BookSettings) => {
      // Открываем HTML-книгу, дальше пользователь сохраняет через печать браузера
      await handleOpenPrintBookWithSettings(settings);
      setShowExportModal(false);
    },
    [handleOpenPrintBookWithSettings]
  );

  const handlePreview = useCallback(
    async (settings: BookSettings) => {
      // Для превью используем ту же HTML-книгу с печатью
      await handleOpenPrintBookWithSettings(settings);
      setShowExportModal(false);
    },
    [handleOpenPrintBookWithSettings]
  );

  const palette = useMemo(
    () => ({
      neutral: colors.textMuted,
      export: colors.warning ?? colors.accent,
      telegram: colors.accent ?? colors.primary,
      vk: colors.info ?? colors.accentDark ?? colors.primaryDark,
      whatsapp: colors.success ?? colors.primary,
    }),
    [colors],
  );
  const styles = useMemo(() => createStyles(colors), [colors]);

  const shareButtons = [
    {
      key: 'copy',
      label: 'Копировать ссылку',
      icon: 'copy',
      onPress: handleCopyLink,
      color: palette.neutral,
    },
    {
      key: 'copyPost',
      label: 'Текст для поста',
      icon: 'file-text',
      onPress: handleCopyPostText,
      color: palette.neutral,
    },
    // Экспорт в PDF доступен только в веб-версии
    ...(Platform.OS === 'web'
      ? [{
          key: 'export' as const,
          label: isGenerating ? `Создание книги... ${progress}%` : 'Книга / PDF',
          icon: 'file-text' as const,
          onPress: () => setShowExportModal(true),
          color: palette.export,
          disabled: isGenerating,
        }]
      : []),
    {
      key: 'telegram',
      label: 'Telegram',
      icon: 'send',
      onPress: handleShareTelegram,
      color: palette.telegram,
    },
    {
      key: 'vk',
      label: 'VK',
      icon: 'share',
      onPress: handleShareVK,
      color: palette.vk,
    },
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      icon: 'chat',
      onPress: handleShareWhatsApp,
      color: palette.whatsapp,
    },
  ];

  // Для мобильных добавляем нативный Share
  if (Platform.OS !== 'web' && 'share' in navigator) {
    shareButtons.unshift({
      key: 'native',
      label: 'Поделиться',
      icon: 'share',
      onPress: handleNativeShare,
      color: palette.export,
    });
  }

  // Если панель свернута на мобильном, показываем только компактную кнопку
  if (isMobile && isCollapsed) {
    return (
      <Pressable
        onPress={toggleCollapse}
        style={({ pressed }) => [
          styles.collapsedIndicator,
          isSticky && styles.collapsedIndicatorSticky,
          pressed && styles.collapsedIndicatorPressed,
          {
            backgroundColor: colors.surface,
            borderColor: colors.borderLight,
          }
        ]}
        accessibilityRole="button"
        accessibilityLabel="Показать панель действий"
      >
        <Feather name="more-horizontal" size={24} color={colors.textMuted} />
      </Pressable>
    );
  }


  return (
    <>
      <View
        style={[
          styles.container,
          isMobile && styles.containerMobile,
          isSticky && styles.containerSticky,
        ]}
      >
        {!isSticky && (
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Поделиться</Text>
            {isMobile && (
              <Pressable
                onPress={toggleCollapse}
                style={({ pressed }) => [
                  styles.collapseButton,
                  pressed && styles.collapseButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={isCollapsed ? 'Показать панель действий' : 'Скрыть панель действий'}
              >
                <Feather 
                  name={isCollapsed ? 'chevron-down' : 'chevron-up'} 
                  size={24} 
                  color={colors.textMuted}
                />
              </Pressable>
            )}
          </View>
        )}
        {!isCollapsed && (
          <>
            <View
              style={[
                styles.buttonsContainer,
                isMobile && styles.buttonsContainerMobile,
                isSticky && styles.buttonsContainerSticky,
              ]}
            >
              {isMobile && isSticky && (
                <Pressable
                  onPress={toggleCollapse}
                  style={({ pressed }) => [
                    styles.button,
                    styles.buttonSticky,
                    styles.closeButton,
                    pressed && styles.buttonPressed,
                    { backgroundColor: colors.backgroundSecondary }
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Скрыть панель действий"
                >
                  <Feather name="x" size={20} color={colors.textMuted} />
                </Pressable>
              )}
              {shareButtons.map((button) => (
                <Pressable
                  key={button.key}
                  onPress={button.onPress}
                  disabled={button.disabled}
                  style={({ pressed }) => [
                    styles.button,
                    isSticky && styles.buttonSticky,
                    pressed && styles.buttonPressed,
                    button.key === 'copy' && copied && styles.buttonCopied,
                    button.disabled && styles.buttonDisabled,
                    globalFocusStyles.focusable,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={button.label}
                  android_ripple={{ color: colors.overlayLight }}
                >
                  <Feather name={button.icon as any} size={20} color={button.color} />
                  {!isMobile && !isSticky && <Text style={[styles.buttonText, { color: colors.text }]}>{button.label}</Text>}
                  {button.key === 'copy' && copied && (
                    <Text style={styles.copiedText}>✓</Text>
                  )}
                </Pressable>
              ))}
            </View>
            {isGenerating && Platform.OS === 'web' && (
              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { width: `${progress}%` }]} />
                <Text style={styles.progressText}>
                  {currentStage === ExportStage.VALIDATING && 'Проверка данных...'}
                  {currentStage === ExportStage.TRANSFORMING && 'Подготовка путешествия...'}
                  {currentStage === ExportStage.GENERATING_HTML && 'Генерация страниц книги...'}
                  {currentStage === ExportStage.LOADING_IMAGES && 'Загрузка фотографий...'}
                  {currentStage === ExportStage.RENDERING && 'Подготовка к печати...'}
                  {currentStage === ExportStage.COMPLETE && 'Готово! Открываем книгу...'}
                </Text>
              </View>
            )}
          </>
        )}
      </View>
      {Platform.OS === 'web' && (
        <Suspense fallback={null}>
          <BookSettingsModalLazy
            visible={showExportModal}
            onClose={() => setShowExportModal(false)}
            onSave={handleExport}
            onPreview={handlePreview}
            travelCount={1}
            defaultSettings={lastSettings}
            userName={travel.userName || undefined}
            mode="preview"
          />
        </Suspense>
      )}
    </>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  // ✅ РЕДИЗАЙН: Современная карточка с glassmorphism
  container: {
    paddingVertical: 20, // ✅ UX: Увеличено для лучшей читаемости
    paddingHorizontal: 24,
    backgroundColor: colors.surface,
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(20px)' as any,
      WebkitBackdropFilter: 'blur(20px)' as any,
    } : {}),
    borderRadius: 20,
    marginBottom: 20,
    shadowColor: colors.shadows.medium.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  containerMobile: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  containerSticky: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    marginBottom: 0,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  containerCollapsed: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 20, // ✅ UX: Увеличено для лучшей иерархии
    fontWeight: '700',
    color: colors.text,
    marginBottom: 0,
    fontFamily: 'Georgia',
    letterSpacing: -0.3,
  },
  collapseButton: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: colors.backgroundSecondary,
    minHeight: 32,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
        transition: 'all 0.2s ease' as any,
      },
    }),
  },
  collapseButtonPressed: {
    backgroundColor: colors.backgroundTertiary,
    transform: [{ scale: 0.95 }],
  },
  closeButton: {
    backgroundColor: colors.backgroundSecondary,
  },
  collapsedIndicator: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(20px)' as any,
      WebkitBackdropFilter: 'blur(20px)' as any,
    } : {}),
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: colors.shadows.medium.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
        transition: 'all 0.2s ease' as any,
      },
    }),
  },
  collapsedIndicatorSticky: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 999,
    marginBottom: 0,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
    minHeight: 40,
    minWidth: 40,
  },
  collapsedIndicatorPressed: {
    backgroundColor: colors.backgroundTertiary,
    transform: [{ scale: 0.98 }],
  },
  buttonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12, // ✅ UX: Фиксированный отступ
    rowGap: 12,
  },
  buttonsContainerMobile: {
    gap: 10,
    rowGap: 10,
  },
  buttonsContainerSticky: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
    rowGap: 0,
  },
  // ✅ РЕДИЗАЙН: Современные кнопки с улучшенными стилями
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
        transition: 'all 0.2s ease' as any,
      },
    }),
  },
  buttonSticky: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 999,
    minHeight: 40,
    minWidth: 40,
  },
  buttonPressed: {
    backgroundColor: colors.backgroundTertiary,
    transform: [{ scale: 0.98 }],
  },
  buttonCopied: {
    backgroundColor: colors.successSoft,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: -0.1,
  },
  copiedText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.success,
    marginLeft: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  progressContainer: {
    marginTop: 16,
    height: 4,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  progressText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
