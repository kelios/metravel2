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
import { useSafeAreaInsetsSafe as useSafeAreaInsets } from '@/hooks/useSafeAreaInsetsSafe';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { LAYOUT } from '@/constants/layout';
import { useThemedColors } from '@/hooks/useTheme';
import { useFavorites } from '@/context/FavoritesContext';
import { useAuth } from '@/context/AuthContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { showToast } from '@/utils/toast';
import { buildCanonicalUrl } from '@/utils/seo';
import { buildTravelPath } from '@/utils/travelSeo';
import { hapticImpact } from '@/utils/haptics';
import type { Travel } from '@/types/types';

interface TravelStickyActionsProps {
  travel: Travel;
  scrollY: RNAnimated.Value;
  scrollToComments: () => void;
}

const THRESHOLD = 300;

function TravelStickyActions({
  travel,
  scrollY,
  scrollToComments,
}: TravelStickyActionsProps) {
  const colors = useThemedColors();
  const insets = useSafeAreaInsets();
  const { addFavorite, removeFavorite, isFavorite } = useFavorites();
  const { isAuthenticated } = useAuth();
  const { requireAuth } = useRequireAuth({});

  const travelId = travel?.id;
  const isFav = travelId ? isFavorite(travelId, 'travel') : false;

  const [visible, setVisible] = useState(false);
  const translateY = useRef(new RNAnimated.Value(80)).current;
  const lastScrollY = useRef(0);
  const isShown = useRef(false);

  useEffect(() => {
    const listenerId = scrollY.addListener(({ value }) => {
      const scrollingDown = value > lastScrollY.current + 5;
      const scrollingUp = value < lastScrollY.current - 5;
      lastScrollY.current = value;

      if (value < THRESHOLD) {
        if (isShown.current) {
          isShown.current = false;
          setVisible(false);
          RNAnimated.spring(translateY, {
            toValue: 80,
            useNativeDriver: false,
            damping: 20,
            stiffness: 200,
          }).start();
        }
        return;
      }

      if (scrollingUp && !isShown.current) {
        isShown.current = true;
        setVisible(true);
        RNAnimated.spring(translateY, {
          toValue: 0,
          useNativeDriver: false,
          damping: 20,
          stiffness: 200,
        }).start();
      } else if (scrollingDown && isShown.current) {
        isShown.current = false;
        RNAnimated.spring(translateY, {
          toValue: 80,
          useNativeDriver: false,
          damping: 20,
          stiffness: 200,
        }).start(() => setVisible(false));
      }
    });

    return () => scrollY.removeListener(listenerId);
  }, [scrollY, translateY]);

  const handleFavorite = useCallback(async () => {
    if (!travelId) return;
    if (!isAuthenticated) {
      requireAuth();
      return;
    }
    hapticImpact('light');
    try {
      if (isFav) {
        await removeFavorite(travelId, 'travel');
        void showToast({ type: 'info', text1: 'Удалено из «Хочу поехать»', position: 'bottom' });
      } else {
        const url = travel?.slug
          ? `/travels/${travel.slug}`
          : `/travels/${travelId}`;
        await addFavorite({ id: travelId, type: 'travel', title: travel?.name || '', url });
        void showToast({ type: 'success', text1: 'Добавлено в «Хочу поехать»', position: 'bottom' });
      }
    } catch {
      void showToast({ type: 'error', text1: 'Не удалось обновить «Хочу поехать»', position: 'bottom' });
    }
  }, [travelId, isAuthenticated, isFav, addFavorite, removeFavorite, requireAuth, travel?.name, travel?.slug]);

  const handleShare = useCallback(async () => {
    hapticImpact('light');
    const path = buildTravelPath(travel);
    const url = path ? buildCanonicalUrl(path) : '';
    const title = travel?.name || 'Путешествие';

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
        void showToast({ type: 'success', text1: 'Ссылка скопирована', position: 'bottom' });
      } catch {
        void showToast({ type: 'error', text1: 'Не удалось скопировать ссылку', position: 'bottom' });
      }
    } else {
      try {
        await Share.share({ message: `${title}\n${url}` });
      } catch { /* user cancelled */ }
    }
  }, [travel]);

  const styles = useMemo(() => createStyles(colors), [colors]);

  // Native: lift the bar above the bottom tab dock (dock height + safe-area inset),
  // mirroring ConsentBanner. Web keeps its CSS-var driven padding from styles.container.
  const nativeBottomPadding = useMemo(
    () => (insets?.bottom || 0) + (LAYOUT?.tabBarHeight ?? 56) + DESIGN_TOKENS.spacing.xl,
    [insets?.bottom],
  );

  if (!visible && !isShown.current) return null;

  return (
    <RNAnimated.View
      style={[
        styles.container,
        Platform.OS !== 'web' ? { paddingBottom: nativeBottomPadding } : null,
        { transform: [{ translateY }], pointerEvents: 'box-none' },
      ]}
    >
      <View
        style={styles.bar}
        accessibilityRole={Platform.OS === 'web' ? ('toolbar' as any) : 'none'}
        accessibilityLabel="Действия с путешествием"
      >
        <Pressable
          onPress={handleFavorite}
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel={isFav ? 'Удалить из «Хочу поехать»' : 'Добавить в «Хочу поехать»'}
          accessibilityHint="Сохраняет путешествие в «Хочу поехать»"
        >
          <Feather
            name="heart"
            size={20}
            color={isFav ? colors.danger : colors.text}
          />
          <Text style={[styles.label, isFav && { color: colors.danger }]}>
            {isFav ? 'В «Хочу поехать»' : 'Хочу поехать'}
          </Text>
        </Pressable>

        <View style={styles.divider} />

        <Pressable
          onPress={handleShare}
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel="Поделиться"
          accessibilityHint="Открывает диалог отправки ссылки на это путешествие"
        >
          <Feather name="share-2" size={20} color={colors.text} />
          <Text style={styles.label}>Поделиться</Text>
        </Pressable>

        <View style={styles.divider} />

        <Pressable
          onPress={scrollToComments}
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel="К комментариям"
          accessibilityHint="Прокручивает страницу к разделу обсуждения"
        >
          <Feather name="message-circle" size={20} color={colors.text} />
          <Text style={styles.label}>Обсуждение</Text>
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
