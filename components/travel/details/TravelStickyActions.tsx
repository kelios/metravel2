/**
 * TravelStickyActions — sticky-bar действий на мобильном (3.6)
 * Появляется после скролла > 300px, скрывается при скролле вниз.
 * Кнопки: ❤ Хочу поехать, ↗ Поделиться, 💬 К комментариям
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated as RNAnimated,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import * as Clipboard from 'expo-clipboard';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { asBottomDimension, useScrollBottomPadding } from '@/components/layout/bottomChromeInset';
import { useThemedColors } from '@/hooks/useTheme';
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle';
import { showToast } from '@/utils/toast';
import { buildCanonicalUrl } from '@/utils/seo';
import { buildTravelPath } from '@/utils/travelSeo';
import { hapticImpact } from '@/utils/haptics';
import type { Travel } from '@/types/types';
import { translate as i18nT } from '@/i18n'


interface TravelStickyActionsProps {
  travel: Travel;
  scrollY: RNAnimated.Value;
  scrollToComments: () => void;
}

const THRESHOLD = 300;
// #2118: направление жеста — по накопленному сдвигу от экстремума, а не по паре
// соседних событий: на native события скролла идут каждый кадр, и медленный
// жест вверх даёт < 5 pt за кадр — бар не показывался вовсе (замер iPhone 17 Pro).
const DIRECTION_SLOP = 12;

function TravelStickyActions({
  travel,
  scrollY,
  scrollToComments,
}: TravelStickyActionsProps) {
  const colors = useThemedColors();

  const { toggle, isFavorite } = useFavoriteToggle();

  const travelId = travel?.id;
  const isFav = travelId ? isFavorite(travelId, 'travel') : false;

  const [visible, setVisible] = useState(false);
  const translateY = useRef(new RNAnimated.Value(80)).current;
  const peakY = useRef(0);
  const troughY = useRef(0);
  const isShown = useRef(false);

  useEffect(() => {
    const listenerId = scrollY.addListener(({ value }) => {
      if (isShown.current) {
        troughY.current = Math.min(troughY.current, value);
      } else {
        peakY.current = Math.max(peakY.current, value);
      }
      const scrollingUp = !isShown.current && peakY.current - value >= DIRECTION_SLOP;
      const scrollingDown = isShown.current && value - troughY.current >= DIRECTION_SLOP;

      if (value < THRESHOLD) {
        peakY.current = value;
        if (isShown.current) {
          isShown.current = false;
          setVisible(false);
          RNAnimated.spring(translateY, {
            toValue: 80,
            useNativeDriver: Platform.OS !== 'web',
            damping: 20,
            stiffness: 200,
          }).start();
        }
        return;
      }

      if (scrollingUp && !isShown.current) {
        isShown.current = true;
        troughY.current = value;
        setVisible(true);
        RNAnimated.spring(translateY, {
          toValue: 0,
          useNativeDriver: Platform.OS !== 'web',
          damping: 20,
          stiffness: 200,
        }).start();
      } else if (scrollingDown && isShown.current) {
        isShown.current = false;
        peakY.current = value;
        RNAnimated.spring(translateY, {
          toValue: 80,
          useNativeDriver: Platform.OS !== 'web',
          damping: 20,
          stiffness: 200,
        }).start(({ finished }) => {
          // #2117: прерванная пружина (бар снова показан) не должна сбрасывать
          // visible — иначе следующий hide не меняет state, и бар остаётся
          // отрендеренным на translateY=80 поверх дока.
          if (finished) setVisible(false);
        });
      }
    });

    return () => scrollY.removeListener(listenerId);
  }, [scrollY, translateY]);

  const handleFavorite = useCallback(() => {
    if (!travelId) return;
    // #1438: литеральный слаг (`'null'`) проходил проверку на непустую
    // строку, и в избранное сохранялся адрес в 404 (пустой url хук не добавит).
    void toggle({
      id: travelId,
      type: 'travel',
      title: travel?.name || '',
      url: buildTravelPath({ slug: travel?.slug, id: travelId }) ?? '',
      source: 'travel_sticky_actions',
    });
  }, [travelId, toggle, travel?.name, travel?.slug]);

  const handleShare = useCallback(async () => {
    hapticImpact('light');
    const path = buildTravelPath(travel);
    const url = path ? buildCanonicalUrl(path) : '';
    const title = travel?.name || i18nT('travel:common.travel');

    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({ title, url });
          return;
        } catch (err) {
          // Пользователь отменил системный диалог — это не ошибка,
          // не подменяем действие копированием со «успешным» тостом.
          if (err && (err as { name?: string }).name === 'AbortError') return;
          // Иной сбой share — падаем в копирование ссылки ниже.
        }
      }
      try {
        await Clipboard.setStringAsync(url);
        void showToast({ type: 'success', text1: i18nT('travel:components.travel.details.TravelStickyActions.ssylka_skopirovana_df59dce9'), position: 'bottom' });
      } catch {
        void showToast({ type: 'error', text1: i18nT('travel:components.travel.details.TravelStickyActions.ne_udalos_skopirovat_ssylku_72c7f83a'), position: 'bottom' });
      }
    } else {
      try {
        await Share.share({ message: i18nT('travel:components.travel.details.TravelStickyActions.value1_value2_e777c3b4', { value1: title, value2: url }) });
      } catch { /* user cancelled */ }
    }
  }, [travel]);

  const styles = useMemo(() => createStyles(colors), [colors]);

  // Native: lift the bar above the bottom tab dock (dock height + safe-area inset),
  // mirroring ConsentBanner. Web keeps its CSS-var driven padding from styles.container.
  const nativeBottomPadding = useScrollBottomPadding(DESIGN_TOKENS.spacing.xl);

  if (!visible && !isShown.current) return null;

  return (
    <RNAnimated.View
      style={[
        styles.container,
        Platform.OS !== 'web' ? { paddingBottom: asBottomDimension(nativeBottomPadding) } : null,
        { transform: [{ translateY }] },
      ]}
    >
      <View
        style={styles.bar}
        accessibilityRole={Platform.OS === 'web' ? ('toolbar' as any) : 'none'}
        accessibilityLabel={i18nT('travel:components.travel.details.TravelStickyActions.deystviya_s_puteshestviem_22b82c23')}
      >
        <Pressable
          onPress={handleFavorite}
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel={isFav ? i18nT('travel:components.travel.details.TravelStickyActions.udalit_iz_hochu_poehat_7b137b5b') : i18nT('travel:components.travel.details.TravelStickyActions.dobavit_v_hochu_poehat_aeab2e75')}
          accessibilityHint={i18nT('travel:components.travel.details.TravelStickyActions.sohranyaet_puteshestvie_v_hochu_poehat_b32ec748')}
        >
          <Feather
            name="heart"
            size={20}
            color={isFav ? colors.danger : colors.text}
          />
          <Text style={[styles.label, isFav && { color: colors.danger }]}>
            {isFav ? i18nT('travel:components.travel.details.TravelStickyActions.v_hochu_poehat_71b2c60e') : i18nT('travel:components.travel.details.TravelStickyActions.hochu_poehat_bc0a2495')}
          </Text>
        </Pressable>

        <View style={styles.divider} />

        <Pressable
          onPress={handleShare}
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel={i18nT('travel:components.travel.details.TravelStickyActions.podelitsya_5059e01e')}
          accessibilityHint={i18nT('travel:components.travel.details.TravelStickyActions.otkryvaet_dialog_otpravki_ssylki_na_eto_pute_1a27883a')}
        >
          <Feather name="share-2" size={20} color={colors.text} />
          <Text style={styles.label}>{i18nT('travel:components.travel.details.TravelStickyActions.podelitsya_5059e01e')}</Text>
        </Pressable>

        <View style={styles.divider} />

        <Pressable
          onPress={scrollToComments}
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel={i18nT('travel:components.travel.details.TravelStickyActions.k_kommentariyam_6a5fe41e')}
          accessibilityHint={i18nT('travel:components.travel.details.TravelStickyActions.prokruchivaet_stranitsu_k_razdelu_obsuzhdeni_13f299ed')}
        >
          <Feather name="message-circle" size={20} color={colors.text} />
          <Text style={styles.label}>{i18nT('travel:components.travel.details.TravelStickyActions.obsuzhdenie_12dea2a0')}</Text>
        </Pressable>
      </View>
    </RNAnimated.View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 999,
      // #2117: в StyleSheet, не inline — RN-web компилирует box-none в класс, а
      // inline `pointer-events: box-none` браузер выбрасывает, и полоса над доком
      // перехватывала тапы по нему.
      pointerEvents: 'box-none',
      paddingBottom: Platform.select({
        // Reserve whichever bottom overlay is taller: the bottom dock or the consent
        // banner (set by ConsentBanner via --mt-consent-h). max() keeps the toolbar
        // above the cookie banner without shrinking the existing dock offset.
        web: 'calc(max(var(--mt-dock-h, 0px), var(--mt-consent-h, 0px)) + 10px)' as any,
        ios: 34,
        default: 10,
      }),
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    },
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.pill,
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...Platform.select({
        web: {
          boxShadow: '0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)',
          // Static frost on mobile (this bar is mobile-only). A translucent background
          // keeps the frosted-glass look without a live `backdrop-filter: blur()`, which
          // re-rasterized the scrolling content behind this fixed bar on every frame and
          // caused the mobile scroll jank.
          backgroundColor: colors.surfaceMuted,
        } as any,
        default: {
          shadowColor: colors.text,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
          elevation: 10,
        },
      }),
    },
    button: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      paddingVertical: 6,
      minHeight: Platform.select({ web: 44, android: 48, default: 44 }), // AND-26: M3 touch target
      borderRadius: DESIGN_TOKENS.radii.sm,
    },
    label: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textMuted,
      letterSpacing: 0.1,
    },
    divider: {
      width: 1,
      height: 24,
      backgroundColor: colors.borderLight,
      opacity: 0.6,
    },
  });

export default React.memo(TravelStickyActions);
