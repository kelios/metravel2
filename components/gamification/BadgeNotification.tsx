import React, { memo, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Platform, Pressable } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface BadgeNotificationProps {
  badgeName: string;
  badgeIcon: string;
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
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(-100));

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

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
          <Text style={styles.icon}>{badgeIcon}</Text>
        </View>
        
        <View style={styles.textContainer}>
          <Text style={styles.title}>🎉 Новое достижение!</Text>
          <Text style={styles.badgeName}>{badgeName}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
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
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRadius: DESIGN_TOKENS.radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.border,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
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
    color: DESIGN_TOKENS.colors.textMuted,
  },
  badgeName: {
    fontSize: 16,
    fontWeight: '700',
    color: DESIGN_TOKENS.colors.text,
  },
});

export default memo(BadgeNotification);
