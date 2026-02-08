import { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Platform, Animated } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';

const STORAGE_KEY_BANNER = 'onboarding_banner_dismissed';
const STORAGE_KEY_ARTICLES_COUNT = 'user_articles_count';
const REMIND_AFTER_DAYS = 3;

interface OnboardingBannerProps {
  userId?: string;
}

const OnboardingBanner = ({ userId }: OnboardingBannerProps) => {
  const [visible, setVisible] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const colors = useThemedColors(); // ✅ РЕДИЗАЙН: Темная тема
  const shouldUseNativeDriver = Platform.OS !== 'web';

  const checkShouldShow = useCallback(async () => {
    try {
      // Проверяем количество статей пользователя
      const articlesData = await AsyncStorage.getItem(STORAGE_KEY_ARTICLES_COUNT);
      const articlesCount = articlesData ? parseInt(articlesData, 10) : 0;

      // Если есть статьи, не показываем баннер
      if (articlesCount > 0) {
        setVisible(false);
        return;
      }

      // Проверяем, когда баннер был закрыт
      const dismissedData = await AsyncStorage.getItem(STORAGE_KEY_BANNER);
      if (dismissedData) {
        const dismissedDate = new Date(dismissedData);
        const now = new Date();
        const daysSinceDismissed = Math.floor(
          (now.getTime() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Если прошло меньше 3 дней, не показываем
        if (daysSinceDismissed < REMIND_AFTER_DAYS) {
          setVisible(false);
          return;
        }
      }

      // Показываем баннер с анимацией
      setVisible(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: shouldUseNativeDriver,
      }).start();
    } catch (error) {
      console.error('Error checking banner visibility:', error);
    }
  }, [fadeAnim, shouldUseNativeDriver]);

  useEffect(() => {
    checkShouldShow();
  }, [userId, checkShouldShow]);

  const handleDismiss = useCallback(async (remind: boolean) => {
    // Анимация скрытия
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: shouldUseNativeDriver,
    }).start(() => {
      setVisible(false);
    });

    try {
      if (remind) {
        // Сохраняем дату закрытия для напоминания через 3 дня
        await AsyncStorage.setItem(STORAGE_KEY_BANNER, new Date().toISOString());
      } else {
        // Если пользователь не хочет напоминаний, устанавливаем далекую дату
        const farFuture = new Date();
        farFuture.setFullYear(farFuture.getFullYear() + 10);
        await AsyncStorage.setItem(STORAGE_KEY_BANNER, farFuture.toISOString());
      }
    } catch (error) {
      console.error('Error dismissing banner:', error);
    }
  }, [fadeAnim, shouldUseNativeDriver]);

  const handleStart = useCallback(() => {
    router.push('/travel/new?mode=quick');
    handleDismiss(false);
  }, [handleDismiss]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      marginHorizontal: 16,
      marginVertical: 12,
      borderRadius: DESIGN_TOKENS.radii.lg,
      overflow: 'hidden',
      ...Platform.select({
        web: {
          maxWidth: 800,
          marginLeft: 'auto',
          marginRight: 'auto',
          boxShadow: DESIGN_TOKENS.shadows.card,
        },
        default: {
          shadowColor: colors.text,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 4,
        },
      }),
    },
    gradient: {
      padding: 20,
      position: 'relative',
    },
    closeButton: {
      position: 'absolute',
      top: 12,
      right: 12,
      zIndex: 10,
      backgroundColor: 'transparent',
      ...Platform.select({
        web: {
          cursor: 'pointer',
          boxShadow: 'none',
        },
      }),
    },
    content: {
      gap: 16,
    },
    iconContainer: {
      alignSelf: 'flex-start',
    },
    icon: {
      fontSize: 48,
    },
    textContainer: {
      gap: 8,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      lineHeight: 28,
    },
    description: {
      fontSize: 15,
      color: colors.textMuted,
      lineHeight: 22,
    },
    badge: {
      fontWeight: '600',
      color: colors.primary,
    },
    progressContainer: {
      marginTop: 8,
      gap: 6,
    },
    progressBar: {
      height: 8,
      backgroundColor: colors.surfaceMuted,
      borderRadius: DESIGN_TOKENS.radii.pill,
      overflow: 'hidden',
    },
    progressFill: {
      width: '0%',
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: DESIGN_TOKENS.radii.pill,
    },
    progressText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
    actions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    button: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      paddingHorizontal: 20,
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        },
      }),
    },
    buttonPrimary: {
      backgroundColor: colors.primary,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light,
        },
        default: {
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 3,
        },
      }),
    },
    buttonSecondary: {
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    buttonTextPrimary: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textOnPrimary,
    },
    buttonTextSecondary: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
  }), [colors]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <LinearGradient
        colors={[colors.primaryLight, colors.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <IconButton
          icon={<Feather name="x" size={18} color={colors.textMuted} />}
          label="Закрыть баннер"
          onPress={() => handleDismiss(true)}
          size="sm"
          style={styles.closeButton}
        />

        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Feather name="star" size={24} color={colors.primary} />
          </View>

          <View style={styles.textContainer}>
            <Text style={styles.title}>Готов поделиться своим путешествием?</Text>
            <Text style={styles.description}>
              Создай первую историю и получи бейдж <Text style={styles.badge}>Первопроходца</Text>
            </Text>

            {/* Прогресс-бар */}
            <View
              style={styles.progressContainer}
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: 0 }}
              accessibilityLabel="Прогресс создания первой истории"
            >
              <View style={styles.progressBar}>
                <View style={styles.progressFill} />
              </View>
              <Text style={styles.progressText}>0% — начни свой путь!</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Button
              label="Начать"
              onPress={handleStart}
              accessibilityLabel="Начать создание статьи"
              icon={<Feather name="edit-3" size={18} color={colors.textOnPrimary} />}
              style={[styles.button, styles.buttonPrimary]}
              labelStyle={styles.buttonTextPrimary}
            />

            <Button
              label="Напомнить позже"
              onPress={() => handleDismiss(true)}
              accessibilityLabel="Напомнить позже"
              variant="secondary"
              style={[styles.button, styles.buttonSecondary]}
              labelStyle={styles.buttonTextSecondary}
            />
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
};


export default memo(OnboardingBanner);

// Утилита для обновления количества статей пользователя
export const updateArticlesCount = async (count: number) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_ARTICLES_COUNT, count.toString());
  } catch (error) {
    console.error('Error updating articles count:', error);
  }
};
