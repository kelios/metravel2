// HeroSection.tsx
import React, { useState, memo, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import { globalFocusStyles } from '@/styles/globalFocus';

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

const useStyles = (colors: ReturnType<typeof useThemedColors>) => useMemo(() => StyleSheet.create({
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
        backgroundColor: colors.primary,
        backgroundImage: colors.gradients.primary,
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
    color: colors.text,
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
    color: colors.textMuted,
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
    color: colors.text,
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
    color: colors.textMuted,
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
    color: colors.textMuted,
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
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.text,
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
    color: colors.primaryText,
  },
}), [colors]);

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
  const colors = useThemedColors();
  const { isPhone } = useResponsive();
  const isMobile = isPhone;
  const [isExpanded, setIsExpanded] = useState(false);

  const showCollapseButton = true;

  const styles = useStyles(colors);

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' ? (
        <View
          style={[
            styles.gradientContainer,
            Platform.OS === 'web' ? { backgroundImage: colors.gradients.primary } as any : undefined,
          ]}
        >
          <View style={styles.content}>
            <View style={styles.textSection}>
              {showCollapseButton && (
                <Pressable
                  onPress={() => setIsExpanded(!isExpanded)}
                  style={[styles.expandButton, globalFocusStyles.focusable]}
                  accessibilityRole="button"
                  accessibilityLabel={isExpanded ? "Свернуть" : "Развернуть"}
                >
                  <Text style={styles.expandButtonText}>
                    {isExpanded ? 'Свернуть' : 'О нас'}
                  </Text>
                  <Feather
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={colors.primary}
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
                      color={colors.primary}
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
          colors={[colors.primaryLight, colors.background]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientContainer}
        >
          <View style={styles.content}>
            <View style={styles.textSection}>
              {showCollapseButton && (
                <Pressable
                  onPress={() => setIsExpanded(!isExpanded)}
                  style={[styles.expandButton, globalFocusStyles.focusable]}
                  accessibilityRole="button"
                  accessibilityLabel={isExpanded ? "Свернуть" : "Развернуть"}
                >
                  <Text style={styles.expandButtonText}>
                    {isExpanded ? 'Свернуть' : 'О нас'}
                  </Text>
                  <Feather
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={colors.primary}
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
                      color={colors.primary}
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
                style={[styles.categoryChip, globalFocusStyles.focusable]}
                onPress={() => onCategoryPress?.(category.id)}
                accessibilityRole="button"
                accessibilityLabel={`Категория ${category.name}`}
              >
                {category.icon && (
                  <Feather
                    name={category.icon as any}
                    size={14}
                    color={colors.primary}
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


export default memo(HeroSection);
