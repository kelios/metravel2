/**
 * TravelStickyActions — sticky-bar действий на мобильном (3.6)
 * Появляется после скролла > 300px, скрывается при скролле вниз.
 * Кнопки: ❤ В избранное, ↗ Поделиться, 💬 К комментариям
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
import { useThemedColors } from '@/hooks/useTheme';
import { useFavorites } from '@/context/FavoritesContext';
import { useAuth } from '@/context/AuthContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { showToast } from '@/utils/toast';
import { buildCanonicalUrl } from '@/utils/seo';
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
            useNativeDriver: true,
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
          useNativeDriver: true,
          damping: 20,
          stiffness: 200,
        }).start();
      } else if (scrollingDown && isShown.current) {
        isShown.current = false;
        RNAnimated.spring(translateY, {
          toValue: 80,
          useNativeDriver: true,
          damping: 20,
          stiffness: 200,
        }).start(() => setVisible(false));
      }
    });

    return () => scrollY.removeListener(listenerId);
  }, [scrollY, translateY]);

  const handleFavorite = useCallback(() => {
    if (!travelId) return;
    if (!isAuthenticated) {
      requireAuth();
      return;
    }
    if (isFav) {
      void removeFavorite(travelId, 'travel');
      void showToast({ type: 'info', text1: 'Удалено из избранного', position: 'bottom' });
    } else {
      const url = travel?.slug
        ? `/travels/${travel.slug}`
        : `/travels/${travelId}`;
      void addFavorite({ id: travelId, type: 'travel', title: travel?.name || '', url });
      void showToast({ type: 'success', text1: 'Добавлено в избранное', position: 'bottom' });
    }
  }, [travelId, isAuthenticated, isFav, addFavorite, removeFavorite, requireAuth, travel?.name, travel?.slug]);

  const handleShare = useCallback(async () => {
    const url = travel?.slug
      ? buildCanonicalUrl(`/travels/${travel.slug}`)
      : travelId
        ? buildCanonicalUrl(`/travels/${travelId}`)
        : '';
    const title = travel?.name || 'Путешествие';

    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({ title, url });
          return;
        } catch { /* user cancelled */ }
      }
      await Clipboard.setStringAsync(url);
      void showToast({ type: 'success', text1: 'Ссылка скопирована', position: 'bottom' });
    } else {
      try {
        await Share.share({ message: `${title}\n${url}` });
      } catch { /* user cancelled */ }
    }
  }, [travel, travelId]);

  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!visible && !isShown.current) return null;

  return (
    <RNAnimated.View
      style={[
        styles.container,
        { transform: [{ translateY }] },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.bar}>
        <Pressable
          onPress={handleFavorite}
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel={isFav ? 'Удалить из избранного' : 'Добавить в избранное'}
        >
          <Feather
            name="heart"
            size={20}
            color={isFav ? colors.danger : colors.text}
          />
          <Text style={[styles.label, isFav && { color: colors.danger }]}>
            {isFav ? 'В избранном' : 'Избранное'}
          </Text>
        </Pressable>

        <View style={styles.divider} />

        <Pressable
          onPress={handleShare}
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel="Поделиться"
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
      paddingBottom: Platform.select({ ios: 34, default: 10 }),
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
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
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
      minHeight: 44,
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
