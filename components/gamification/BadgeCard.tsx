import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
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
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
            backgroundColor: earned ? color : colors.mutedBackground,
            opacity: earned ? 1 : 0.5,
          },
        ]}
      >
        <Feather
          name={icon}
          size={config.iconSize}
          color={earned ? colors.textOnDark : colors.textMuted}
        />
        
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
          { fontSize: config.fontSize, color: earned ? colors.text : colors.textMuted },
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

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
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
        boxShadow: colors.boxShadows.card,
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
    color: colors.text,
    textAlign: 'center',
  },
  name: {
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default memo(BadgeCard);
