// HeroSection.tsx
import React, { memo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  useWindowDimensions,
  Pressable,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { AIRY_GRADIENTS, AIRY_COLORS } from '@/constants/airyColors';

const palette = DESIGN_TOKENS.colors;
const spacing = DESIGN_TOKENS.spacing;
const radii = DESIGN_TOKENS.radii;

interface StatItem {
  icon: string;
  value: string;
  label: string;
}

interface HeroSectionProps {
  title?: string;
  subtitle?: string;
  stats?: StatItem[];
  popularCategories?: Array<{ id: string | number; name: string; icon?: string }>;
  onCategoryPress?: (categoryId: string | number) => void;
}

function HeroSection({
  title = 'Откройте мир путешествий',
  subtitle = 'Авторские маршруты и идеи для вашего приключения',
  stats = [
    { icon: 'map-pin', value: '500+', label: 'маршрутов' },
    { icon: 'globe', value: '50+', label: 'стран' },
    { icon: 'users', value: '10k+', label: 'путешественников' },
  ],
  popularCategories = [],
  onCategoryPress,
}: HeroSectionProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < DESIGN_TOKENS.breakpoints.mobile;
  const [isExpanded, setIsExpanded] = useState(false); // По умолчанию свернут, чтобы не отвлекать от путешествий
  
  // На десктопе тоже можно свернуть для компактности
  const showCollapseButton = true; // Показываем кнопку сворачивания всегда

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' ? (
        <View
          style={[
            styles.gradientContainer,
            Platform.OS === 'web' ? { backgroundImage: AIRY_GRADIENTS.primary } as any : undefined,
          ]}
        >
          <View style={styles.content}>
            <View style={styles.textSection}>
              {showCollapseButton && (
                <Pressable
                  onPress={() => setIsExpanded(!isExpanded)}
                  style={styles.expandButton}
                  accessibilityRole="button"
                  accessibilityLabel={isExpanded ? "Свернуть" : "Развернуть"}
                >
                  <Text style={styles.expandButtonText}>
                    {isExpanded ? 'Свернуть' : 'О нас'}
                  </Text>
                  <Feather
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={palette.primary}
                  />
                </Pressable>
              )}

              {isExpanded && (
                <>
              <Text
                style={[styles.title, isMobile && styles.titleMobile]}
                accessibilityRole="header"
              >
                {title}
              </Text>
              <Text
                style={[styles.subtitle, isMobile && styles.subtitleMobile]}
              >
                {subtitle}
              </Text>
                </>
              )}

              {isExpanded && (
              <View style={[styles.statsContainer, isMobile && styles.statsContainerMobile]}>
                {stats.map((stat, index) => (
                  <View key={index} style={styles.statItem}>
                    <Feather
                      name={stat.icon as any}
                      size={isMobile ? 18 : 20}
                      color={palette.primary}
                    />
                    <View style={styles.statText}>
                      <Text style={styles.statValue}>{stat.value}</Text>
                      <Text style={styles.statLabel}>{stat.label}</Text>
                    </View>
                  </View>
                ))}
              </View>
              )}
            </View>
          </View>
        </View>
      ) : (
        <LinearGradient
          colors={[AIRY_COLORS.primaryLight, AIRY_COLORS.background]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientContainer}
        >
          <View style={styles.content}>
            <View style={styles.textSection}>
              {showCollapseButton && (
                <Pressable
                  onPress={() => setIsExpanded(!isExpanded)}
                  style={styles.expandButton}
                  accessibilityRole="button"
                  accessibilityLabel={isExpanded ? "Свернуть" : "Развернуть"}
                >
                  <Text style={styles.expandButtonText}>
                    {isExpanded ? 'Свернуть' : 'О нас'}
                  </Text>
                  <Feather
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={palette.primary}
                  />
                </Pressable>
              )}

              {isExpanded && (
                <>
              <Text
                style={[styles.title, isMobile && styles.titleMobile]}
                accessibilityRole="header"
              >
                {title}
              </Text>
              <Text
                style={[styles.subtitle, isMobile && styles.subtitleMobile]}
              >
                {subtitle}
              </Text>
                </>
              )}

              {isExpanded && (
              <View style={[styles.statsContainer, isMobile && styles.statsContainerMobile]}>
                {stats.map((stat, index) => (
                  <View key={index} style={styles.statItem}>
                    <Feather
                      name={stat.icon as any}
                      size={isMobile ? 18 : 20}
                      color={palette.primary}
                    />
                    <View style={styles.statText}>
                      <Text style={styles.statValue}>{stat.value}</Text>
                      <Text style={styles.statLabel}>{stat.label}</Text>
                    </View>
                  </View>
                ))}
              </View>
              )}
            </View>
          </View>
        </LinearGradient>
      )}

      {popularCategories.length > 0 && isExpanded && (
        <View style={styles.categoriesSection}>
          <Text style={styles.categoriesLabel}>Популярные категории:</Text>
          <View style={styles.categoriesContainer}>
            {popularCategories.slice(0, 4).map((category) => (
              <Pressable
                key={category.id}
                style={styles.categoryChip}
                onPress={() => onCategoryPress?.(category.id)}
                accessibilityRole="button"
                accessibilityLabel={`Категория ${category.name}`}
              >
                {category.icon && (
                  <Feather
                    name={category.icon as any}
                    size={14}
                    color={palette.primary}
                    style={styles.categoryIcon}
                  />
                )}
                <Text style={styles.categoryText}>{category.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
  },
  gradientContainer: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        backgroundColor: AIRY_GRADIENTS.primary.split(' ')[0] || '#6b8e7f', // ✅ FIX: Заменено background на backgroundColor
        backgroundImage: AIRY_GRADIENTS.primary, // Для веба
      } as any,
    }),
  },
  content: {
    padding: Platform.select({
      default: spacing.sm,
      web: spacing.lg,
    }),
    ...Platform.select({
      web: {
        maxWidth: 1200,
        marginHorizontal: 'auto',
      },
    }),
  },
  textSection: {
    gap: Platform.select({
      default: spacing.xs,
      web: spacing.md,
    }),
  },
  title: {
    fontSize: Platform.select({
      default: 18,
      web: 48,
    }),
    lineHeight: Platform.select({
      default: 24,
      web: 56,
    }),
    fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
    color: palette.text,
    ...Platform.select({
      web: {
        fontFamily: DESIGN_TOKENS.typography.fontFamily,
      },
    }),
  },
  titleMobile: {
    fontSize: 18,
    lineHeight: 24,
  },
  subtitle: {
    fontSize: Platform.select({
      default: 12,
      web: 20,
    }),
    lineHeight: Platform.select({
      default: 16,
      web: 28,
    }),
    fontWeight: DESIGN_TOKENS.typography.weights.regular as any,
    color: palette.textMuted,
    ...Platform.select({
      web: {
        fontFamily: DESIGN_TOKENS.typography.fontFamily,
      },
    }),
  },
  subtitleMobile: {
    fontSize: 12,
    lineHeight: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: Platform.select({
      default: spacing.md,
      web: spacing.xl,
    }),
    flexWrap: 'wrap',
    marginTop: Platform.select({
      default: spacing.xs,
      web: spacing.sm,
    }),
  },
  statsContainerMobile: {
    gap: spacing.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statText: {
    gap: 2,
  },
  statValue: {
    fontSize: Platform.select({
      default: 14,
      web: 24,
    }),
    fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
    color: palette.text,
    ...Platform.select({
      web: {
        fontFamily: DESIGN_TOKENS.typography.fontFamily,
      },
    }),
  },
  statLabel: {
    fontSize: Platform.select({
      default: 10,
      web: 14,
    }),
    fontWeight: DESIGN_TOKENS.typography.weights.regular as any,
    color: palette.textMuted,
    ...Platform.select({
      web: {
        fontFamily: DESIGN_TOKENS.typography.fontFamily,
      },
    }),
  },
  categoriesSection: {
    marginTop: Platform.select({
      default: spacing.sm,
      web: spacing.lg,
    }),
    paddingHorizontal: Platform.select({
      default: spacing.md,
      web: 0,
    }),
    gap: spacing.sm,
  },
  categoriesLabel: {
    fontSize: Platform.select({
      default: 13,
      web: 14,
    }),
    fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
    color: palette.textMuted,
    ...Platform.select({
      web: {
        fontFamily: DESIGN_TOKENS.typography.fontFamily,
      },
    }),
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: palette.surface,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.border,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s',
      },
    }),
  },
  categoryIcon: {
    marginRight: -2,
  },
  categoryText: {
    fontSize: Platform.select({
      default: 13,
      web: 14,
    }),
    fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
    color: palette.text,
    ...Platform.select({
      web: {
        fontFamily: DESIGN_TOKENS.typography.fontFamily,
      },
    }),
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.xs,
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
        ':hover': {
          opacity: 0.8,
        } as any,
      },
    }),
  },
  expandButtonText: {
    fontSize: 12,
    fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
    color: palette.primary,
  },
});

export default memo(HeroSection);

