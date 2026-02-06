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

export default function CTASection({ travel, onFavoriteToggle }: CTASectionProps) {
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

  const handleViewAuthorTravels = useCallback(() => {
    const userId = (travel as any).userIds ?? (travel as any).userId;
    if (userId) {
      router.push(`/search?user_id=${userId}` as any);
    }
  }, [travel, router]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: DESIGN_TOKENS.spacing.xl,
      marginBottom: 32,
      shadowColor: colors.text,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 2,
    },
    containerMobile: {
      padding: DESIGN_TOKENS.spacing.md,
      marginBottom: DESIGN_TOKENS.spacing.xl,
      borderRadius: 12,
    },
    content: {
      gap: DESIGN_TOKENS.spacing.md,
    },
    textSection: {
      marginBottom: 8,
    },
    title: {
      fontSize: DESIGN_TOKENS.typography.sizes.lg,
      fontWeight: '700',
      color: colors.text,
      marginBottom: DESIGN_TOKENS.spacing.xs,
      fontFamily: 'Georgia',
      letterSpacing: -0.3,
    },
    titleMobile: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
    },
    subtitle: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    subtitleMobile: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      lineHeight: 18,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
      paddingVertical: 14,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.primarySoft,
      minHeight: 44,
      ...Platform.select({
        web: {
          cursor: 'pointer' as any,
        },
        default: {
          shadowColor: colors.text,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 3,
          elevation: 1,
        },
      }),
    },
    actionButtonMobile: {
      paddingVertical: 12,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    },
    actionButtonSecondary: {
      backgroundColor: colors.mutedBackground,
      borderColor: colors.border,
    },
    actionButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    actionButtonText: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: '600',
      color: colors.primary,
    },
    actionButtonTextMobile: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
    },
    actionButtonTextActive: {
      color: colors.surface,
    },
    primaryButton: {
      paddingVertical: 14,
      paddingHorizontal: DESIGN_TOKENS.spacing.xl,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
      ...Platform.select({
        web: {
          cursor: 'pointer' as any,
        },
        default: {
          shadowColor: colors.text,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 2,
        },
      }),
    },
    primaryButtonMobile: {
      paddingVertical: 12,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
    },
    primaryButtonText: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: '700',
      color: colors.surface,
    },
    primaryButtonTextMobile: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
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

        {/* Кнопка "Смотреть все путешествия автора" */}
        {(travel as any).userIds || (travel as any).userId ? (
          <Button
            label="Все путешествия автора"
            onPress={handleViewAuthorTravels}
            variant="secondary"
            size="md"
            icon={<Feather name="user" size={20} color={colors.primary} />}
            style={[
              styles.actionButton,
              isMobile && styles.actionButtonMobile,
              styles.actionButtonSecondary,
            ]}
            labelStyle={[styles.actionButtonText, isMobile && styles.actionButtonTextMobile]}
            accessibilityLabel="Смотреть все путешествия автора"
          />
        ) : null}

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
