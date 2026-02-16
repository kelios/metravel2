/**
 * Компонент CTA секции - призывы к действию
 * Побуждает пользователей к ключевым действиям: добавить в избранное, подписаться, создать путешествие
 */

import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import type { Travel } from '@/types/types';
import { useFavorites } from '@/context/FavoritesContext';
import { useAuth } from '@/context/AuthContext';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import Button from '@/components/ui/Button';
import { useRequireAuth } from '@/hooks/useRequireAuth';

interface CTASectionProps {
  travel: Travel;
  onFavoriteToggle?: () => void;
}

function CTASection({ travel, onFavoriteToggle }: CTASectionProps) {
  const router = useRouter();
  const colors = useThemedColors();
  const { isPhone, isLargePhone } = useResponsive();
  const isMobile = isPhone || isLargePhone;
  const { isAuthenticated } = useAuth();
  const { loginHref, requireAuth } = useRequireAuth({ intent: 'create-book' });
  const { addFavorite, removeFavorite, isFavorite: checkIsFavorite } = useFavorites();

  // Проверяем, в избранном ли путешествие
  const isFavorite = checkIsFavorite(travel.id, 'travel');

  const handleFavorite = useCallback(async () => {
    if (!isAuthenticated) {
      requireAuth();
      return;
    }
    
    try {
      if (isFavorite) {
        await removeFavorite(travel.id, 'travel');
      } else {
        await addFavorite({
          id: travel.id,
          type: 'travel',
          title: travel.name,
          imageUrl: travel.travel_image_thumb_url,
          url: `/travels/${travel.slug || travel.id}`,
          country: (travel as any).countryName,
        });
      }
      onFavoriteToggle?.();
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  }, [travel, isAuthenticated, isFavorite, addFavorite, removeFavorite, onFavoriteToggle, requireAuth]);

  const handleCreateTravel = useCallback(() => {
    if (!isAuthenticated) {
      requireAuth();
      return;
    }
    router.push('/travel/new');
  }, [isAuthenticated, requireAuth, router]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.md,
      padding: Platform.select({ default: DESIGN_TOKENS.spacing.lg, web: DESIGN_TOKENS.spacing.xl }),
      marginBottom: DESIGN_TOKENS.spacing.xl,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    containerMobile: {
      padding: DESIGN_TOKENS.spacing.md,
      marginBottom: DESIGN_TOKENS.spacing.lg,
    },
    content: {
      gap: DESIGN_TOKENS.spacing.md,
    },
    textSection: {
      marginBottom: 8,
    },
    title: {
      fontSize: Platform.select({ default: 18, web: 20 }),
      fontWeight: '700',
      color: colors.text,
      marginBottom: DESIGN_TOKENS.spacing.xs,
      letterSpacing: -0.3,
    },
    titleMobile: {
      fontSize: 17,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    subtitleMobile: {
      fontSize: 13,
      lineHeight: 18,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
      paddingVertical: 12,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.backgroundSecondary,
      minHeight: 44,
      borderWidth: 0,
      borderColor: 'transparent',
      ...(Platform.OS === 'web' ? {
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
      } as any : {}),
    },
    actionButtonMobile: {
      paddingVertical: 11,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    },
    actionButtonSecondary: {
      backgroundColor: colors.backgroundSecondary,
      borderColor: colors.borderLight,
    },
    actionButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    actionButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primaryText,
    },
    actionButtonTextMobile: {
      fontSize: 14,
    },
    actionButtonTextActive: {
      color: colors.surface,
    },
    primaryButton: {
      paddingVertical: 12,
      paddingHorizontal: DESIGN_TOKENS.spacing.xl,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
      ...(Platform.OS === 'web' ? {
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
      } as any : {}),
    },
    primaryButtonMobile: {
      paddingVertical: 11,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
    },
    primaryButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.surface,
    },
    primaryButtonTextMobile: {
      fontSize: 14,
    },
  }), [colors]);


  // Не показываем если пользователь не авторизован (или показываем с призывом зарегистрироваться)
  if (!isAuthenticated) {
    return (
      <View style={[styles.container, isMobile && styles.containerMobile]}>
        <View style={styles.content}>
          <View style={styles.textSection}>
            <Text style={[styles.title, isMobile && styles.titleMobile]}>
              Хотите сохранить это путешествие?
            </Text>
            <Text style={[styles.subtitle, isMobile && styles.subtitleMobile]}>
              Войдите или зарегистрируйтесь, чтобы добавить в избранное и создавать свои маршруты
            </Text>
          </View>
          <Button
            label="Войти / Регистрация"
            onPress={() => router.push(loginHref as any)}
            variant="primary"
            size="md"
            style={[styles.primaryButton, isMobile && styles.primaryButtonMobile]}
            labelStyle={[styles.primaryButtonText, isMobile && styles.primaryButtonTextMobile]}
            accessibilityLabel="Войти или зарегистрироваться"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, isMobile && styles.containerMobile]}>
      <View style={styles.content}>
        {/* Кнопка "Добавить в избранное" */}
        <Button
          label={isFavorite ? 'В избранном' : 'В избранное'}
          onPress={handleFavorite}
          variant={isFavorite ? 'primary' : 'secondary'}
          size="md"
          icon={
            <Feather
              name="heart"
              size={20}
              color={isFavorite ? colors.surface : colors.primary}
            />
          }
          style={[
            styles.actionButton,
            isMobile && styles.actionButtonMobile,
            isFavorite && styles.actionButtonActive,
          ]}
          labelStyle={[
            styles.actionButtonText,
            isMobile && styles.actionButtonTextMobile,
            isFavorite && styles.actionButtonTextActive,
          ]}
          accessibilityLabel={isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}
        />

        {/* P1-5: «Все путешествия автора» убрана — уже есть в AuthorCard */}

        {/* Кнопка "Создать путешествие" */}
        <Button
          label="Создать путешествие"
          onPress={handleCreateTravel}
          variant="secondary"
          size="md"
          icon={<Feather name="plus-circle" size={20} color={colors.primary} />}
          style={[
            styles.actionButton,
            isMobile && styles.actionButtonMobile,
            styles.actionButtonSecondary,
          ]}
          labelStyle={[styles.actionButtonText, isMobile && styles.actionButtonTextMobile]}
          accessibilityLabel="Создать свое путешествие"
        />
      </View>
    </View>
  );
}

export default React.memo(CTASection);
