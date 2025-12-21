import React, { memo, useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DESIGN_TOKENS } from '@/constants/designSystem';

const STORAGE_KEY_XP = 'user_experience_points';

interface AuthorLevel {
  level: number;
  name: string;
  icon: string;
  minXP: number;
  maxXP: number;
  color: string;
}

const AUTHOR_LEVELS: AuthorLevel[] = [
  { level: 1, name: 'Новичок', icon: '🌱', minXP: 0, maxXP: 50, color: '#94a3b8' },
  { level: 2, name: 'Путешественник', icon: '✈️', minXP: 50, maxXP: 150, color: '#5D8AA8' },
  { level: 3, name: 'Эксперт', icon: '🎯', minXP: 150, maxXP: 300, color: '#FF9F5A' },
  { level: 4, name: 'Легенда', icon: '🏆', minXP: 300, maxXP: Infinity, color: '#FFD700' },
];

interface AuthorProgressProps {
  userId?: string;
  compact?: boolean;
}

const AuthorProgress = ({ userId, compact = false }: AuthorProgressProps) => {
  const [currentXP, setCurrentXP] = useState(0);
  const [currentLevel, setCurrentLevel] = useState<AuthorLevel>(AUTHOR_LEVELS[0]);

  const loadXP = useCallback(async () => {
    try {
      const xpData = await AsyncStorage.getItem(STORAGE_KEY_XP);
      if (xpData) {
        const xp = parseInt(xpData, 10);
        setCurrentXP(xp);
        updateLevel(xp);
      }
    } catch (error) {
      console.error('Error loading XP:', error);
    }
  }, []);

  useEffect(() => {
    loadXP();
  }, [userId, loadXP]);

  const updateLevel = (xp: number) => {
    const level = AUTHOR_LEVELS.find((l) => xp >= l.minXP && xp < l.maxXP) || AUTHOR_LEVELS[0];
    setCurrentLevel(level);
  };

  const progressInLevel = currentLevel.maxXP === Infinity 
    ? 100 
    : ((currentXP - currentLevel.minXP) / (currentLevel.maxXP - currentLevel.minXP)) * 100;

  const xpToNextLevel = currentLevel.maxXP === Infinity 
    ? 0 
    : currentLevel.maxXP - currentXP;

  const nextLevel = AUTHOR_LEVELS[currentLevel.level];

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactHeader}>
          <Text style={styles.compactIcon}>{currentLevel.icon}</Text>
          <View style={styles.compactInfo}>
            <Text style={styles.compactLevel}>{currentLevel.name}</Text>
            <Text style={styles.compactXP}>{currentXP} XP</Text>
          </View>
        </View>
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${progressInLevel}%`, backgroundColor: currentLevel.color },
              ]}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.levelBadge}>
          <Text style={styles.levelIcon}>{currentLevel.icon}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.levelName}>
            {currentLevel.name} (Ур. {currentLevel.level})
          </Text>
          <Text style={styles.xpText}>{currentXP} XP</Text>
        </View>
      </View>

      <View style={styles.progressSection}>
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${progressInLevel}%`, backgroundColor: currentLevel.color },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {Math.round(progressInLevel)}% до следующего уровня
          </Text>
        </View>

        {nextLevel && currentLevel.maxXP !== Infinity && (
          <View style={styles.nextLevelInfo}>
            <Text style={styles.nextLevelText}>
              До {nextLevel.name}: <Text style={styles.nextLevelXP}>{xpToNextLevel} XP</Text>
            </Text>
          </View>
        )}
      </View>

      <View style={styles.xpGuide}>
        <Text style={styles.xpGuideTitle}>Как получить опыт:</Text>
        <View style={styles.xpGuideList}>
          <XPGuideItem icon="✨" text="Первая статья" xp="+10 XP" />
          <XPGuideItem icon="📝" text="Каждая новая статья" xp="+5 XP" />
          <XPGuideItem icon="📸" text="Добавление фото" xp="+2 XP" />
          <XPGuideItem icon="🗺️" text="Добавление маршрута" xp="+3 XP" />
          <XPGuideItem icon="👍" text="Получение лайка" xp="+1 XP" />
          <XPGuideItem icon="💬" text="Получение комментария" xp="+2 XP" />
        </View>
      </View>
    </View>
  );
};

interface XPGuideItemProps {
  icon: string;
  text: string;
  xp: string;
}

const XPGuideItem = memo(({ icon, text, xp }: XPGuideItemProps) => (
  <View style={styles.xpGuideItem}>
    <Text style={styles.xpGuideIcon}>{icon}</Text>
    <Text style={styles.xpGuideText}>{text}</Text>
    <Text style={styles.xpGuideXP}>{xp}</Text>
  </View>
));

const styles = StyleSheet.create({
  container: {
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRadius: DESIGN_TOKENS.radii.lg,
    padding: 20,
    gap: 20,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.border,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  compactContainer: {
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRadius: DESIGN_TOKENS.radii.md,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.border,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  compactIcon: {
    fontSize: 32,
  },
  compactInfo: {
    flex: 1,
  },
  compactLevel: {
    fontSize: 15,
    fontWeight: '700',
    color: DESIGN_TOKENS.colors.text,
  },
  compactXP: {
    fontSize: 13,
    fontWeight: '500',
    color: DESIGN_TOKENS.colors.textMuted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  levelBadge: {
    width: 64,
    height: 64,
    borderRadius: DESIGN_TOKENS.radii.lg,
    backgroundColor: DESIGN_TOKENS.colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelIcon: {
    fontSize: 36,
  },
  headerInfo: {
    flex: 1,
  },
  levelName: {
    fontSize: 20,
    fontWeight: '700',
    color: DESIGN_TOKENS.colors.text,
    marginBottom: 4,
  },
  xpText: {
    fontSize: 15,
    fontWeight: '600',
    color: DESIGN_TOKENS.colors.textMuted,
  },
  progressSection: {
    gap: 12,
  },
  progressBarContainer: {
    gap: 8,
  },
  progressBar: {
    height: 12,
    backgroundColor: DESIGN_TOKENS.colors.mutedBackground,
    borderRadius: DESIGN_TOKENS.radii.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: DESIGN_TOKENS.radii.pill,
    ...Platform.select({
      web: {
        transition: 'width 0.3s ease',
      },
    }),
  },
  progressText: {
    fontSize: 13,
    fontWeight: '600',
    color: DESIGN_TOKENS.colors.textMuted,
    textAlign: 'center',
  },
  nextLevelInfo: {
    padding: 12,
    backgroundColor: DESIGN_TOKENS.colors.primaryLight,
    borderRadius: DESIGN_TOKENS.radii.md,
  },
  nextLevelText: {
    fontSize: 14,
    fontWeight: '500',
    color: DESIGN_TOKENS.colors.text,
    textAlign: 'center',
  },
  nextLevelXP: {
    fontWeight: '700',
    color: DESIGN_TOKENS.colors.primary,
  },
  xpGuide: {
    gap: 12,
  },
  xpGuideTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: DESIGN_TOKENS.colors.text,
  },
  xpGuideList: {
    gap: 8,
  },
  xpGuideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  xpGuideIcon: {
    fontSize: 18,
    width: 24,
  },
  xpGuideText: {
    flex: 1,
    fontSize: 14,
    color: DESIGN_TOKENS.colors.text,
  },
  xpGuideXP: {
    fontSize: 13,
    fontWeight: '600',
    color: DESIGN_TOKENS.colors.primary,
  },
});

export default memo(AuthorProgress);

// Утилита для добавления опыта
export const addExperience = async (xp: number, reason?: string) => {
  try {
    const xpData = await AsyncStorage.getItem(STORAGE_KEY_XP);
    const currentXP = xpData ? parseInt(xpData, 10) : 0;
    const newXP = currentXP + xp;
    
    await AsyncStorage.setItem(STORAGE_KEY_XP, newXP.toString());
    
    // Здесь можно показать уведомление о получении опыта
    console.info(`+${xp} XP${reason ? ` за ${reason}` : ''}`);
    
    return newXP;
  } catch (error) {
    console.error('Error adding experience:', error);
    return 0;
  }
};

// Утилита для получения текущего опыта
export const getCurrentXP = async (): Promise<number> => {
  try {
    const xpData = await AsyncStorage.getItem(STORAGE_KEY_XP);
    return xpData ? parseInt(xpData, 10) : 0;
  } catch (error) {
    console.error('Error getting XP:', error);
    return 0;
  }
};
