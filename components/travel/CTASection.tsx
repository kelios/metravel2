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
import { buildTripPlanCreateHref } from '@/utils/tripPlanLinks';
import { translate as i18nT } from '@/i18n'


const JOURNAL_FONT_FAMILY =
  "'Georgia', 'Times New Roman', 'Inter', serif";

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
      devWarn(
        '[CTASection]',
        i18nT('travel:components.travel.CTASection.ne_udalos_sohranit_v_hochu_poehat_2be6e48b'),
        error,
      );
      void showToast({
        type: 'error',
        text1: i18nT('travel:components.travel.CTASection.ne_udalos_sohranit_v_hochu_poehat_2be6e48b'),
        text2: i18nT('travel:components.travel.CTASection.poprobuyte_esche_raz_9521822e'),
        visibilityTime: 2500,
      });
    }
  }, [travel, isAuthenticated, isFavorite, addFavorite, removeFavorite, onFavoriteToggle, requireAuth]);

  const handlePlanTripFromRoute = useCallback(() => {
    if (!isAuthenticated) {
      requireAuth();
      return;
    }
    router.push(buildTripPlanCreateHref(travel) as never);
  }, [isAuthenticated, requireAuth, router, travel]);

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
      borderRadius: DESIGN_TOKENS.radii.sm,
      padding: isMobile ? DESIGN_TOKENS.spacing.lg : DESIGN_TOKENS.spacing.xl,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderStyle: 'solid',
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: `0 3px 0 ${colors.brandSoft}`,
          } as any)
        : {}),
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
      marginBottom: isMobile ? DESIGN_TOKENS.spacing.xs : 2,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: DESIGN_TOKENS.spacing.xs,
      letterSpacing: 0,
      // Serif — только desktop web; mobile web = системный sans, как на устройстве.
      ...(Platform.OS === 'web' && !isMobile
        ? ({
            fontFamily: JOURNAL_FONT_FAMILY,
            fontStyle: 'italic',
          } as any)
        : {}),
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
    planButton: {
      width: '100%',
      justifyContent: 'center',
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
      color: colors.primaryText,
    },
    buttonLabelMobile: {
      fontSize: 14,
    },
  }), [colors, isMobile]);


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
              {i18nT('travel:components.travel.CTASection.hotite_sohranit_eto_puteshestvie_167594b1')}</Text>
            <Text style={[styles.subtitle, isMobile && styles.subtitleMobile]}>
              {i18nT('travel:components.travel.CTASection.voydite_ili_zaregistriruytes_chtoby_dobavlya_d198a0d4')}</Text>
          </View>
          <Button
            label={i18nT('travel:components.travel.CTASection.voyti_registratsiya_6e7ee291')}
            onPress={() => router.push(loginHref as any)}
            variant="primary"
            size="md"
            fullWidth
            style={styles.buttonBase}
            labelStyle={[styles.primaryButtonLabel, isMobile && styles.buttonLabelMobile]}
            accessibilityLabel={i18nT('travel:components.travel.CTASection.voyti_ili_zaregistrirovatsya_otkroetsya_ekra_8e9d3bcd')}
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
            {i18nT('travel:components.travel.CTASection.deystviya_s_marshrutom_29141fd4')}</Text>
          <Text style={[styles.subtitle, isMobile && styles.subtitleMobile]}>
            {i18nT('travel:components.travel.CTASection.organizuyte_poezdku_po_etomu_marshrutu_dobav_0521974b')}</Text>
        </View>

        <Button
          label={i18nT('travel:components.travel.CTASection.organizovat_poezdku_po_marshrutu_e7d6c073')}
          onPress={handlePlanTripFromRoute}
          variant="primary"
          size="md"
          fullWidth
          icon={<Feather name="calendar" size={18} color={colors.textOnPrimary} />}
          style={styles.buttonBase}
          labelStyle={[styles.primaryButtonLabel, isMobile && styles.buttonLabelMobile]}
          accessibilityLabel={i18nT('travel:components.travel.CTASection.organizovat_poezdku_po_etomu_marshrutu_otkro_4447378e')}
          testID="travel-plan-trip-cta"
        />

        <Button
          label={i18nT('travel:components.travel.CTASection.sozdat_avtorskiy_marshrut_94ab9f46')}
          onPress={handleCreateTravel}
          variant="outline"
          size="md"
          fullWidth
          icon={<Feather name="plus-circle" size={18} color={colors.primaryDark} />}
          style={[styles.buttonBase, styles.outlineButton]}
          labelStyle={[
            styles.buttonLabel,
            styles.favoriteButtonLabel,
            isMobile && styles.buttonLabelMobile,
          ]}
          accessibilityLabel={i18nT('travel:components.travel.CTASection.sozdat_avtorskiy_marshrut_otkroetsya_forma_s_8666f051')}
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
          style={styles.planButton}
        />

        <Button
          label={isFavorite ? i18nT('travel:components.travel.CTASection.v_hochu_poehat_dd8f7eaf') : i18nT('travel:components.travel.CTASection.hochu_poehat_8624541b')}
          onPress={handleFavorite}
          variant="outline"
          size="md"
          fullWidth
          icon={
            <Feather
              name="heart"
              size={18}
              color={colors.primaryDark}
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
          accessibilityLabel={isFavorite ? i18nT('travel:components.travel.CTASection.udalit_iz_hochu_poehat_8ca67aa0') : i18nT('travel:components.travel.CTASection.dobavit_v_hochu_poehat_1482c944')}
        />
      </View>
    </View>
  );
}

export default React.memo(CTASection);
