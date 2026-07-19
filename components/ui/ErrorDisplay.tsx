import { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import Button from '@/components/ui/Button';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { openExternalUrl } from '@/utils/externalLinks';
import { translate as i18nT } from '@/i18n'


const SUPPORT_URL = 'https://www.instagram.com/metravelby/';

/** AND-10: Detect network-related errors from message text */
function isNetworkRelatedMessage(msg: string): boolean {
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return (
    lower.includes('network') ||
    lower.includes('сет') || // сеть, сетевая
    lower.includes('подключен') ||
    lower.includes('соединен') ||
    lower.includes('timeout') ||
    lower.includes('failed to fetch') ||
    lower.includes('превышено время') ||
    lower.includes('network request failed') ||
    lower.includes('нет интернета') ||
    lower.includes('offline')
  );
}

interface ErrorDisplayProps {
  title?: string;
  message: string;
  details?: string; // Технические детали (опционально)
  onRetry?: () => void;
  onDismiss?: () => void;
  showContact?: boolean; // Показывать ли кнопку связи с поддержкой
  variant?: 'error' | 'warning' | 'info';
  /** AND-10: Сетевая ошибка — показывает специализированную иконку и текст */
  isNetworkError?: boolean;
}

export default function ErrorDisplay({
  title,
  message,
  details,
  onRetry,
  onDismiss,
  showContact = true,
  variant = 'error',
  isNetworkError: isNetworkErrorProp = false,
}: ErrorDisplayProps) {
  const colors = useThemedColors();

  // AND-10: Auto-detect network errors from message text
  const isNetworkError = isNetworkErrorProp || isNetworkRelatedMessage(message);

  // AND-10: При сетевой ошибке переопределяем defaults
  const effectiveTitle = title ?? (isNetworkError ? i18nT('errors:components.ui.ErrorDisplay.net_podklyucheniya_k_internetu_192a0651') : i18nT('errors:components.ui.ErrorDisplay.chto_to_poshlo_ne_tak_ebbcd2c7'));
  const effectiveVariant = isNetworkError ? 'warning' : variant;
  const effectiveMessage = isNetworkError && !message
    ? i18nT('errors:components.ui.ErrorDisplay.proverte_podklyuchenie_k_internetu_i_poprobu_bb53deb7')
    : message;

  const iconName = isNetworkError ? 'wifi-off' :
                   effectiveVariant === 'warning' ? 'alert-triangle' :
                   effectiveVariant === 'info' ? 'info' : 'alert-circle';

  const iconColor = effectiveVariant === 'warning' ? colors.warning :
                    effectiveVariant === 'info' ? colors.info :
                    colors.danger;

  const backgroundColor = effectiveVariant === 'warning' ? colors.warningLight :
                          effectiveVariant === 'info' ? colors.infoLight :
                          colors.dangerLight;

  // ✅ Динамические стили на основе текущей темы
  const styles = useMemo(() => StyleSheet.create({
    container: {
      borderRadius: 12,
      padding: 16,
      margin: 16,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.card,
        },
        default: {
          ...DESIGN_TOKENS.shadowsNative.medium,
        },
      }),
    },
    content: {
      flexDirection: 'column',
    },
    iconContainer: {
      alignItems: 'center',
      marginBottom: 12,
    },
    textContainer: {
      marginBottom: 16,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    message: {
      fontSize: 14,
      color: colors.textMuted,
      lineHeight: 20,
      textAlign: 'center',
    },
    detailsContainer: {
      marginTop: 12,
      padding: 12,
      backgroundColor: colors.mutedBackground,
      borderRadius: 8,
    },
    detailsLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: 4,
    },
    details: {
      fontSize: 11,
      color: colors.textMuted,
      fontFamily: Platform.select({ web: 'monospace', default: undefined }),
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 8,
      alignItems: 'center',
    },
    dismissButton: {
      padding: 8,
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
  }), [colors]);

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.content}>
        {/* Иконка */}
        <View style={styles.iconContainer}>
          <Feather name={iconName as any} size={24} color={iconColor} />
        </View>

        {/* Текст ошибки */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>{effectiveTitle}</Text>
          <Text style={styles.message}>{effectiveMessage}</Text>

          {/* Детали (только в dev режиме) */}
          {details && __DEV__ && (
            <View style={styles.detailsContainer}>
              <Text style={styles.detailsLabel}>{i18nT('errors:components.ui.ErrorDisplay.tehnicheskie_detali_d33f5381')}</Text>
              <Text style={styles.details}>{details}</Text>
            </View>
          )}
        </View>

        {/* Действия */}
        <View style={styles.actions}>
          {onRetry && (
            <Button
              variant="primary"
              size="sm"
              onPress={onRetry}
              label={isNetworkError ? i18nT('errors:components.ui.ErrorDisplay.povtorit_8f1eacea') : i18nT('errors:components.ui.ErrorDisplay.poprobovat_snova_ec1a8f2c')}
              accessibilityLabel={isNetworkError ? i18nT('errors:components.ui.ErrorDisplay.povtorit_popytku_podklyucheniya_12e00eec') : i18nT('errors:components.ui.ErrorDisplay.poprobovat_snova_ec1a8f2c')}
              icon={<Feather name={isNetworkError ? 'wifi' : 'refresh-cw'} size={16} color={colors.textOnPrimary} />}
            />
          )}

          {showContact && (
            <Button
              variant="outline"
              size="sm"
              onPress={() => {
                void openExternalUrl(SUPPORT_URL)
              }}
              label={i18nT('errors:components.ui.ErrorDisplay.svyazatsya_s_podderzhkoy_55a4272f')}
              accessibilityLabel={i18nT('errors:components.ui.ErrorDisplay.svyazatsya_s_podderzhkoy_55a4272f')}
              icon={<Feather name="mail" size={16} color={colors.primary} />}
            />
          )}

          {onDismiss && (
            <Pressable
              style={styles.dismissButton}
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel={i18nT('errors:components.ui.ErrorDisplay.zakryt_uvedomlenie_ob_oshibke_42c95b34')}
              {...Platform.select({
                web: {
                  cursor: 'pointer',
                  // @ts-ignore -- CSS pseudo-selector :hover is web-only, not in RN style types
                  ':hover': {
                    opacity: 0.7,
                  },
                },
              })}
            >
              <Feather name="x" size={20} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

