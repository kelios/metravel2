import React, { memo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  progress?: number;
  maxProgress?: number;
  earned: boolean;
}

interface BadgeCardProps {
  badge: Badge;
  size?: 'small' | 'medium' | 'large';
}

const BadgeCard = ({ badge, size = 'medium' }: BadgeCardProps) => {
  const { name, description, icon, color, progress = 0, maxProgress = 1, earned } = badge;

  const sizeConfig = {
    small: { iconSize: 32, containerSize: 80, fontSize: 12 },
    medium: { iconSize: 48, containerSize: 120, fontSize: 14 },
    large: { iconSize: 64, containerSize: 160, fontSize: 16 },
  };

  const config = sizeConfig[size];
  const progressPercent = maxProgress > 0 ? (progress / maxProgress) * 100 : 0;

  return (
    <View style={[styles.container, { width: config.containerSize }]}>
      <View
        style={[
          styles.iconContainer,
          {
            width: config.containerSize,
            height: config.containerSize,
            backgroundColor: earned ? color : DESIGN_TOKENS.colors.mutedBackground,
            opacity: earned ? 1 : 0.5,
          },
        ]}
      >
        <Text style={{ fontSize: config.iconSize }}>{icon}</Text>
        
        {!earned && maxProgress > 1 && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${progressPercent}%`,
                    backgroundColor: color,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {progress}/{maxProgress}
            </Text>
          </View>
        )}
      </View>

      <Text
        style={[
          styles.name,
          { fontSize: config.fontSize, color: earned ? DESIGN_TOKENS.colors.text : DESIGN_TOKENS.colors.textMuted },
        ]}
        numberOfLines={1}
      >
        {name}
      </Text>

      {size !== 'small' && (
        <Text style={styles.description} numberOfLines={2}>
          {description}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 8,
  },
  iconContainer: {
    borderRadius: DESIGN_TOKENS.radii.lg,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  progressContainer: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    gap: 4,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 10,
    fontWeight: '600',
    color: DESIGN_TOKENS.colors.text,
    textAlign: 'center',
  },
  name: {
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    fontSize: 12,
    color: DESIGN_TOKENS.colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default memo(BadgeCard);
