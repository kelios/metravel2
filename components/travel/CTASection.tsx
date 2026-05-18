/**
 * Компонент CTA секции - призывы к действию
 * Побуждает пользователей к ключевым действиям: добавить в избранное, подписаться, создать путешествие
 */

import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import type { Travel } from '@/types/types';
import { useFavorites } from '@/context/FavoritesContext';
import TravelStatusButton from '@/components/travel/TravelStatusButton';
import { useAuth } from '@/context/AuthContext';
import { METRICS } from '@/constants/layout';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import Button from '@/components/ui/Button';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { showToast } from '@/utils/toast';
import { devWarn } from '@/utils/logger';

interface CTASectionProps {
  travel: Travel;
  onFavoriteToggle?: () => void;
  surface?: 'card' | 'plain';
}

function CTASection({ travel, onFavoriteToggle, surface = 'card' }: CTASectionProps) {
  const router = useRouter();
  const colors = useThemedColors();
  const { width } = useWindowDimensions();
  const isMobile = width < METRICS.breakpoints.tablet;
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
      devWarn('[CTASection] Не удалось переключить избранное:', error);
      void showToast({
        type: 'error',
        text1: 'Не удалось сохранить в избранное',
        text2: 'Попробуйте ещё раз',
        visibilityTime: 2500,
      });
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
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    containerMobile: {
      padding: DESIGN_TOKENS.spacing.md,
    },
    containerPlain: {
      padding: 0,
      borderWidth: 0,
      borderColor: 'transparent',
      backgroundColor: 'transparent',
    },
    content: {
      gap: DESIGN_TOKENS.spacing.md,
    },
    textSection: {
      marginBottom: 8,
    },
    title: {
      fontSize: 18,
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
    buttonBase: {
      width: '100%',
      borderRadius: DESIGN_TOKENS.radii.pill,
    },
    buttonLabel: {
      fontSize: 15,
      fontWeight: '600',
    },
    primaryButtonLabel: {
      fontWeight: '700',
      color: colors.textOnPrimary,
    },
    secondaryButtonLabel: {
      color: colors.text,
    },
    outlineButton: {
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: 'transparent',
    },
    favoriteButtonActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    favoriteButtonLabel: {
      color: colors.primary,
    },
    buttonLabelMobile: {
      fontSize: 14,
    },
  }), [colors]);


  // Не показываем если пользователь не авторизован (или показываем с призывом зарегистрироваться)
  if (!isAuthenticated) {
    return (
      <View
        style={[
          styles.container,
          surface === 'plain' && styles.containerPlain,
          isMobile && surface !== 'plain' && styles.containerMobile,
        ]}
      >
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
            fullWidth
            style={styles.buttonBase}
            labelStyle={[styles.primaryButtonLabel, isMobile && styles.buttonLabelMobile]}
            accessibilityLabel="Войти или зарегистрироваться"
          />
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        surface === 'plain' && styles.containerPlain,
        isMobile && surface !== 'plain' && styles.containerMobile,
      ]}
    >
      <View style={styles.content}>
        <View style={styles.textSection}>
          <Text style={[styles.title, isMobile && styles.titleMobile]}>
            Сохраните маршрут или начните своё путешествие
          </Text>
          <Text style={[styles.subtitle, isMobile && styles.subtitleMobile]}>
            Выберите главное действие: создать свой маршрут, добавить этот в планы или сохранить в избранное.
          </Text>
        </View>

        <Button
          label="Создать путешествие"
          onPress={handleCreateTravel}
          variant="primary"
          size="md"
          fullWidth
          icon={<Feather name="plus-circle" size={18} color={colors.textOnPrimary} />}
          style={styles.buttonBase}
          labelStyle={[styles.primaryButtonLabel, isMobile && styles.buttonLabelMobile]}
          accessibilityLabel="Создать свое путешествие"
        />

        {/* Кнопка "Добавить в план / Мой календарь" */}
        <TravelStatusButton
          travelId={travel.id}
          travelTitle={travel.name}
          travelUrl={`/travels/${travel.slug || travel.id}`}
          travelImageUrl={travel.travel_image_thumb_url}
          travelCountry={(travel as any).countryName}
          travelYear={travel.year}
          travelMonthName={travel.monthName}
        />

        <Button
          label={isFavorite ? 'В избранном' : 'В избранное'}
          onPress={handleFavorite}
          variant="outline"
          size="md"
          fullWidth
          icon={
            <Feather
              name="heart"
              size={18}
              color={colors.primary}
            />
          }
          style={[
            styles.buttonBase,
            styles.outlineButton,
            isFavorite && styles.favoriteButtonActive,
          ]}
          labelStyle={[
            styles.buttonLabel,
            styles.favoriteButtonLabel,
            isMobile && styles.buttonLabelMobile,
          ]}
          accessibilityLabel={isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}
        />
      </View>
    </View>
  );
}

export default React.memo(CTASection);
