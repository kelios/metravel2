import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Animated, Platform, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

interface BadgeNotificationProps {
  badgeName: string;
  badgeIcon: keyof typeof Feather.glyphMap;
  badgeColor: string;
  visible: boolean;
  onDismiss: () => void;
  duration?: number;
}

const BadgeNotification = ({
  badgeName,
  badgeIcon,
  badgeColor,
  visible,
  onDismiss,
  duration = 4000,
}: BadgeNotificationProps) => {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(-100));
  const shouldUseNativeDriver = Platform.OS !== 'web';

  const handleDismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: shouldUseNativeDriver,
      }),
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 200,
        useNativeDriver: shouldUseNativeDriver,
      }),
    ]).start(() => {
      onDismiss();
    });
  }, [fadeAnim, onDismiss, slideAnim, shouldUseNativeDriver]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: shouldUseNativeDriver,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 7,
          useNativeDriver: shouldUseNativeDriver,
        }),
      ]).start();

      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);

      return () => clearTimeout(timer);
    }

    return undefined;
  }, [duration, fadeAnim, handleDismiss, slideAnim, visible, shouldUseNativeDriver]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <Pressable onPress={handleDismiss} style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: badgeColor }]}>
          <Feather name={badgeIcon} size={24} color={colors.textOnDark} />
        </View>
        
        <View style={styles.textContainer}>
          <Text style={styles.title}>Новое достижение!</Text>
          <Text style={styles.badgeName}>{badgeName}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.select({ default: 60, web: 80 }),
    left: 16,
    right: 16,
    zIndex: 9999,
    ...Platform.select({
      web: {
        maxWidth: 400,
        marginLeft: 'auto',
        marginRight: 'auto',
      },
    }),
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      web: {
        boxShadow: colors.boxShadows.modal,
      },
      default: {
        ...colors.shadows.heavy,
      },
    }),
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: DESIGN_TOKENS.radii.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 28,
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  badgeName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
});

export default memo(BadgeNotification);
