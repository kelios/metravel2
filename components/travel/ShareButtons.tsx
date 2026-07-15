/**
 * Компонент кнопок "Поделиться"
 * Позволяет поделиться путешествием через различные платформы
 * ✅ РЕДИЗАЙН: Поддержка темной темы + компактный дизайн
 */

import React, { useCallback, useState, useMemo, useRef, useEffect, lazy, Suspense } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Share, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import * as Clipboard from 'expo-clipboard';
import type { Travel } from '@/types/types';
import { ExportStage } from '@/types/pdf-export';
import { METRICS } from '@/constants/layout';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';
import { useThemedColors } from '@/hooks/useTheme';
import { showToast } from '@/utils/toast';
import { openExternalUrlInNewTab } from '@/utils/externalLinks';
import type { ShareButtonsPdfExportState } from '@/components/travel/ShareButtonsPdfExportBridge';
import { devWarn } from '@/utils/logger';
import { translate as i18nT } from '@/i18n'


const ShareButtonsPdfExportBridgeLazy = lazy(() => import('@/components/travel/ShareButtonsPdfExportBridge'));

const INITIAL_PDF_EXPORT_STATE: ShareButtonsPdfExportState = {
  isGenerating: false,
  progress: 0,
  currentStage: ExportStage.ERROR,
  lastSettings: {
    get title() { return i18nT('travel:components.travel.pdfExport.defaultBookTitle') },
    subtitle: '',
    coverType: 'auto',
    template: 'minimal',
    sortOrder: 'date-desc',
    includeToc: true,
    includeGallery: true,
    includeMap: true,
    includeChecklists: false,
    checklistSections: ['clothing', 'food', 'electronics'],
  },
};

interface ShareButtonsProps {
  travel: Travel;
  url?: string;
  variant?: 'default' | 'sticky';
  surface?: 'card' | 'plain';
}

function ShareButtons({ travel, url, variant = 'default', surface = 'card' }: ShareButtonsProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < METRICS.breakpoints.tablet;
  const isSticky = variant === 'sticky';
  const isPlain = surface === 'plain';
  const colors = useThemedColors(); // ✅ РЕДИЗАЙН: Темная тема

  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(copiedTimerRef.current), []);
  const [showExportModal, setShowExportModal] = useState(false);
  const [shouldMountPdfExport, setShouldMountPdfExport] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [{ isGenerating, progress, currentStage }, setPdfExportState] =
    useState<ShareButtonsPdfExportState>(INITIAL_PDF_EXPORT_STATE);

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

  const shareTitle = travel.name || i18nT('travel:components.travel.ShareButtons.defaultShareTitle');
  const shareText = i18nT('travel:components.travel.ShareButtons.posmotrite_eto_puteshestvie_value1_7cccb3c1', { value1: shareTitle });
  const sharePostText = `${shareText} ${shareUrl}`;
  const canUseWebShareApi =
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function';

  const handleShareError = useCallback((label: string, error: unknown) => {
    devWarn(`[ShareButtons] Не удалось выполнить действие «${label}»:`, error);
    void showToast({
      type: 'error',
      text1: i18nT('travel:components.travel.ShareButtons.ne_udalos_otkryt_okno_sharinga_7a6f995b'),
      text2: i18nT('travel:components.travel.ShareButtons.poprobuyte_esche_raz_3c479d0f'),
      visibilityTime: 2500,
    });
  }, []);

  // Базовая функция копирования в буфер обмена
  const copyToClipboard = useCallback(async (text: string, showSuccessAlert: boolean): Promise<boolean> => {
    try {
      if (Platform.OS === 'web' && (navigator as any)?.clipboard) {
        await (navigator as any).clipboard.writeText(text);
      } else {
        await Clipboard.setStringAsync(text);
      }

      if (showSuccessAlert) {
        showToast({ type: 'success', text1: i18nT('travel:components.travel.ShareButtons.ssylka_skopirovana_f7d0a74e'), visibilityTime: 2000 });
      }
      return true;
    } catch (error) {
      devWarn(
        '[ShareButtons]',
        i18nT('travel:components.travel.ShareButtons.ne_udalos_skopirovat_c7f647e7'),
        error,
      );
      showToast({ type: 'error', text1: i18nT('travel:components.travel.ShareButtons.ne_udalos_skopirovat_c7f647e7'), text2: i18nT('travel:components.travel.ShareButtons.poprobuyte_esche_raz_3c479d0f'), visibilityTime: 3000 });
      return false;
    }
  }, []);

  // Копирование чистой ссылки
  const handleCopyLink = useCallback(async () => {
    const success = await copyToClipboard(shareUrl, true);
    if (!success) return;
    clearTimeout(copiedTimerRef.current);
    setCopied(true);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
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
      await openExternalUrlInNewTab(telegramUrl);
    } catch (error) {
      handleShareError('Telegram', error);
    }
  }, [handleShareError, shareUrl, shareText]);

  // Поделиться в VK
  const handleShareVK = useCallback(() => {
    const vkUrl = `https://vk.com/share.php?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareTitle)}`;
    void openExternalUrlInNewTab(vkUrl, {
      windowFeatures: 'width=600,height=400,noopener,noreferrer',
      onError: (error) => handleShareError('VK', error),
    });
  }, [handleShareError, shareUrl, shareTitle]);

  // Поделиться в WhatsApp
  const handleShareWhatsApp = useCallback(async () => {
    const text = encodeURIComponent(`${shareText} ${shareUrl}`);
    const whatsappUrl = `https://wa.me/?text=${text}`;

    try {
      await openExternalUrlInNewTab(whatsappUrl);
    } catch (error) {
      handleShareError('WhatsApp', error);
    }
  }, [handleShareError, shareUrl, shareText]);

  // Нативный Share API (для мобильных)
  const handleNativeShare = useCallback(async () => {
    if (Platform.OS === 'web') {
      if (!canUseWebShareApi) return;

      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
      } catch (error: any) {
        if (error?.name !== 'AbortError') {
          handleShareError(i18nT('travel:components.travel.ShareButtons.sistemnyy_sharing_abf838b2'), error);
        }
      }
      return;
    }

    try {
      await Share.share({
        message: i18nT('travel:components.travel.ShareButtons.value1_value2_79dc3882', { value1: shareText, value2: shareUrl }),
        title: shareTitle,
      });
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        handleShareError(i18nT('travel:components.travel.ShareButtons.sistemnyy_sharing_abf838b2'), error);
      }
    }
  }, [canUseWebShareApi, handleShareError, shareUrl, shareTitle, shareText]);

  // Переключение видимости панели
  const toggleCollapse = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

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
  const handleOpenExport = useCallback(() => {
    setShouldMountPdfExport(true);
    setShowExportModal(true);
  }, []);

  const shareButtons = [
    {
      key: 'copy',
      label: i18nT('travel:components.travel.ShareButtons.ssylka_99fea002'),
      accessibilityLabel: i18nT('travel:components.travel.ShareButtons.kopirovat_ssylku_39dcd42c'),
      icon: 'copy',
      onPress: handleCopyLink,
      color: palette.neutral,
      group: 'quick',
    },
    {
      key: 'copyPost',
      label: i18nT('travel:components.travel.ShareButtons.tekst_1ccce593'),
      accessibilityLabel: i18nT('travel:components.travel.ShareButtons.skopirovat_tekst_dlya_posta_0430e7a3'),
      icon: 'type',
      onPress: handleCopyPostText,
      color: palette.neutral,
      group: 'quick',
    },
    // Экспорт в PDF доступен только в веб-версии
    ...(Platform.OS === 'web'
      ? [{
          key: 'export' as const,
          label: isGenerating ? `PDF ${progress}%` : i18nT('travel:components.travel.ShareButtons.pdf_kniga_e2013fce'),
          accessibilityLabel: isGenerating ? i18nT('travel:components.travel.ShareButtons.sozdanie_knigi_pdf_value1_53c04d94', { value1: progress }) : i18nT('travel:components.travel.ShareButtons.otkryt_eksport_v_pdf_92bdc8ac'),
          icon: 'file-text' as const,
          onPress: handleOpenExport,
          color: palette.export,
          disabled: isGenerating,
          group: 'export',
        }]
      : []),
    {
      key: 'telegram',
      label: i18nT('travel:components.travel.ShareButtons.telegram_dff50f31'),
      accessibilityLabel: i18nT('travel:components.travel.ShareButtons.podelitsya_v_telegram_bebb9d6b'),
      accessibilityHint: i18nT('travel:components.travel.ShareButtons.otkryvaet_dialog_otpravki_v_telegram_2dfd26c8'),
      icon: 'send',
      onPress: handleShareTelegram,
      color: palette.telegram,
      group: 'social',
    },
    {
      key: 'vk',
      label: i18nT('travel:components.travel.ShareButtons.vk_afe88dc2'),
      accessibilityLabel: i18nT('travel:components.travel.ShareButtons.podelitsya_vo_vkontakte_7b669909'),
      accessibilityHint: i18nT('travel:components.travel.ShareButtons.otkryvaet_dialog_otpravki_vo_vkontakte_c704b876'),
      icon: 'users',
      onPress: handleShareVK,
      color: palette.vk,
      group: 'social',
    },
    {
      key: 'whatsapp',
      label: i18nT('travel:components.travel.ShareButtons.whatsapp_b8f961ed'),
      accessibilityLabel: i18nT('travel:components.travel.ShareButtons.podelitsya_v_whatsapp_f5a30242'),
      accessibilityHint: i18nT('travel:components.travel.ShareButtons.otkryvaet_dialog_otpravki_v_whatsapp_a785b9c1'),
      icon: 'message-circle',
      onPress: handleShareWhatsApp,
      color: palette.whatsapp,
      group: 'social',
    },
  ];

  // Для мобильных добавляем нативный Share
  if (Platform.OS !== 'web') {
    shareButtons.unshift({
      key: 'native',
      label: i18nT('travel:components.travel.ShareButtons.podelitsya_aa929e89'),
      accessibilityLabel: i18nT('travel:components.travel.ShareButtons.otkryt_sistemnoe_menyu_podelitsya_4edc3a9d'),
      icon: 'share',
      onPress: handleNativeShare,
      color: palette.export,
      group: 'social',
    });
  }

  const shareGroups = isSticky
    ? []
    : [
        {
          key: 'quick',
          title: i18nT('travel:components.travel.ShareButtons.bystrye_deystviya_d9e8757f'),
          items: shareButtons.filter((button) => button.group === 'quick'),
        },
        {
          key: 'social',
          title: i18nT('travel:components.travel.ShareButtons.sotsseti_109ba488'),
          items: shareButtons.filter((button) => button.group === 'social'),
        },
        {
          key: 'export',
          title: i18nT('travel:components.travel.ShareButtons.eksport_7ed71b16'),
          items: shareButtons.filter((button) => button.group === 'export'),
        },
      ].filter((group) => group.items.length > 0);

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
        accessibilityLabel={i18nT('travel:components.travel.ShareButtons.pokazat_panel_podelitsya_12173feb')}
      >
        <Feather name="share-2" size={22} color={colors.textMuted} />
        {!isSticky && (
          <Text style={[styles.buttonText, { color: colors.text, marginLeft: 8 }]}>
            {i18nT('travel:components.travel.ShareButtons.podelitsya_aa929e89')}</Text>
        )}
      </Pressable>
    );
  }


  return (
    <>
      <View
        style={[
          styles.container,
          isPlain && styles.containerPlain,
          isMobile && styles.containerMobile,
          isSticky && styles.containerSticky,
        ]}
      >
        {!isSticky && (
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>{i18nT('travel:components.travel.ShareButtons.podelitsya_aa929e89')}</Text>
            {isMobile && (
              <Pressable
                onPress={toggleCollapse}
                style={({ pressed }) => [
                  styles.collapseButton,
                  pressed && styles.collapseButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={isCollapsed ? i18nT('travel:components.travel.ShareButtons.pokazat_panel_deystviy_e38a8974') : i18nT('travel:components.travel.ShareButtons.skryt_panel_deystviy_cc7f2001')}
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
            {isSticky ? (
              <View style={[styles.buttonsContainer, styles.buttonsContainerSticky]}>
                {isMobile && (
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
                    accessibilityLabel={i18nT('travel:components.travel.ShareButtons.skryt_panel_deystviy_cc7f2001')}
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
                      styles.buttonSticky,
                      pressed && styles.buttonPressed,
                      button.key === 'copy' && copied && styles.buttonCopied,
                      button.disabled && styles.buttonDisabled,
                      globalFocusStyles.focusable,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={button.accessibilityLabel}
                    accessibilityHint={(button as any).accessibilityHint}
                    android_ripple={{ color: colors.overlayLight }}
                  >
                    <Feather name={button.icon as any} size={20} color={button.color} />
                    {button.key === 'copy' && copied && (
                      <Feather name="check" size={16} color={colors.success} style={{ marginLeft: 2 }} />
                    )}
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.groupsList}>
                {shareGroups.map((group) => (
                  <View key={group.key} style={styles.groupSection}>
                    <Text style={styles.groupTitle}>{group.title}</Text>
                    <View style={[styles.buttonsContainer, isMobile && styles.buttonsContainerMobile]}>
                      {group.items.map((button) => (
                        <Pressable
                          key={button.key}
                          onPress={button.onPress}
                          disabled={button.disabled}
                          style={({ pressed }) => [
                            styles.button,
                            pressed && styles.buttonPressed,
                            button.key === 'copy' && copied && styles.buttonCopied,
                            button.disabled && styles.buttonDisabled,
                            globalFocusStyles.focusable,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={button.accessibilityLabel}
                          accessibilityHint={(button as any).accessibilityHint}
                          android_ripple={{ color: colors.overlayLight }}
                        >
                          <Feather name={button.icon as any} size={18} color={button.color} />
                          <Text style={[styles.buttonText, { color: colors.text }]}>{button.label}</Text>
                          {button.key === 'copy' && copied && (
                            <Feather name="check" size={16} color={colors.success} style={{ marginLeft: 2 }} />
                          )}
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}
            {isGenerating && Platform.OS === 'web' && (
              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { width: `${progress}%` }]} />
                <Text style={styles.progressText}>
                  {currentStage === ExportStage.VALIDATING && i18nT('travel:components.travel.ShareButtons.stageValidating')}
                  {currentStage === ExportStage.TRANSFORMING && i18nT('travel:components.travel.ShareButtons.stageTransforming')}
                  {currentStage === ExportStage.GENERATING_HTML && i18nT('travel:components.travel.ShareButtons.stageGeneratingHtml')}
                  {currentStage === ExportStage.LOADING_IMAGES && i18nT('travel:components.travel.ShareButtons.stageLoadingImages')}
                  {currentStage === ExportStage.RENDERING && i18nT('travel:components.travel.ShareButtons.stageRendering')}
                  {currentStage === ExportStage.COMPLETE && i18nT('travel:components.travel.ShareButtons.stageComplete')}
                </Text>
              </View>
            )}
          </>
        )}
      </View>
      {Platform.OS === 'web' && shouldMountPdfExport && (
        <Suspense fallback={null}>
          <ShareButtonsPdfExportBridgeLazy
            travel={travel}
            visible={showExportModal}
            onClose={() => setShowExportModal(false)}
            onStateChange={setPdfExportState}
          />
        </Suspense>
      )}
    </>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  container: {
    paddingVertical: 20,
    paddingHorizontal: 24,
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  containerPlain: {
    paddingVertical: 0,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  containerMobile: {
    paddingVertical: 16,
    paddingHorizontal: 16,
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
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 0,
    letterSpacing: 0,
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
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(20px)' as any,
      WebkitBackdropFilter: 'blur(20px)' as any,
    } : {}),
    borderRadius: 16,
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
    minHeight: Platform.OS === 'android' ? 48 : 40,
    minWidth: Platform.OS === 'android' ? 48 : 40,
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
  groupsList: {
    gap: DESIGN_TOKENS.spacing.md,
  },
  groupSection: {
    gap: DESIGN_TOKENS.spacing.sm,
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
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
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: DESIGN_TOKENS.radii.sm,
    backgroundColor: colors.backgroundSecondary,
    minHeight: Platform.OS === 'android' ? 48 : 44, // AND-26: M3 touch target
    minWidth: Platform.OS === 'android' ? 48 : 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
        transition: 'background-color 0.15s ease, border-color 0.15s ease' as any,
        ':hover': {
          backgroundColor: colors.backgroundTertiary,
          borderColor: colors.border,
        } as any,
      },
    }),
  },
  buttonSticky: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 999,
    minHeight: Platform.OS === 'android' ? 48 : 40,
    minWidth: Platform.OS === 'android' ? 48 : 40,
  },
  buttonPressed: {
    backgroundColor: colors.backgroundTertiary,
    transform: [{ scale: 0.98 }],
  },
  buttonCopied: {
    backgroundColor: colors.successSoft,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: 0,
  },
  copiedText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.success,
    marginLeft: 2,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  progressContainer: {
    marginTop: 16,
    height: 3,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: DESIGN_TOKENS.radii.pill,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: DESIGN_TOKENS.radii.pill,
    ...Platform.select({
      web: {
        transition: 'width 0.3s ease',
      } as any,
    }),
  },
  progressText: {
    marginTop: 8,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
});

export default React.memo(ShareButtons);
