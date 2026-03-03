import React, { memo, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { ResponsiveContainer } from '@/components/layout';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';

const STATS = [
  { value: '200', unit: '+', label: 'маршрутов', icon: 'map', desc: 'готовых идей для поездок' },
  { value: '0', unit: ' ₽', label: 'бесплатно', icon: 'gift', desc: 'без подписки и карты' },
  { value: '2', unit: ' мин', label: 'до идеи', icon: 'clock', desc: 'с фильтрами по дистанции' },
] as const;

function HomeTrustBlock() {
  const { isSmallPhone, isPhone, isLargePhone, isTablet } = useResponsive();
  const isMobile = isSmallPhone || isPhone || isLargePhone;
  // SEC-01: планшет показывает row (как desktop), не column как mobile
  const isCompact = isMobile && !isTablet;
  const colors = useThemedColors();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      width: '100%',
      paddingVertical: isCompact ? 20 : 48,
      backgroundColor: colors.background,
    },
    content: {
      borderRadius: DESIGN_TOKENS.radii.xl,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      paddingVertical: isCompact ? 16 : 28,
      paddingHorizontal: isCompact ? 12 : 28,
      flexDirection: isCompact ? 'column' : 'row',
      alignItems: isCompact ? 'stretch' : 'center',
      justifyContent: 'space-between',
      gap: 0,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light,
          backgroundImage: `linear-gradient(135deg, ${colors.surface} 0%, ${colors.primarySoft} 100%)`,
        },
      }),
    },
    statItem: {
      flex: isCompact ? undefined : 1,
      alignItems: 'center',
      paddingVertical: isCompact ? 14 : 16,
      paddingHorizontal: isCompact ? 8 : 16,
      gap: 6,
      borderRadius: DESIGN_TOKENS.radii.lg,
      ...Platform.select({
        web: {
          transition: 'all 0.22s ease',
          cursor: 'default',
        },
      }),
    },
    statItemHover: {
      backgroundColor: colors.primarySoft,
      ...Platform.select({
        web: {
          transform: 'translateY(-3px)',
        },
      }),
    },
    iconOuter: {
      width: isCompact ? 52 : 60,
      height: isCompact ? 52 : 60,
      borderRadius: isCompact ? 26 : 30,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
    },
    iconInner: {
      width: isCompact ? 40 : 46,
      height: isCompact ? 40 : 46,
      borderRadius: isMobile ? 20 : 23,
      backgroundColor: colors.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
    },
    statValueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 0,
    },
    statValue: {
      fontSize: isCompact ? 32 : 44,
      fontWeight: '900',
      color: colors.primary,
      letterSpacing: -1.5,
      lineHeight: isCompact ? 36 : 50,
    },
    statUnit: {
      fontSize: isCompact ? 20 : 28,
      fontWeight: '700',
      color: colors.primary,
      letterSpacing: -0.5,
      lineHeight: isCompact ? 28 : 38,
    },
    statLabel: {
      fontSize: isCompact ? 13 : 14,
      fontWeight: '600',
      color: colors.text,
    },
    statDesc: {
      fontSize: isCompact ? 11 : 12,
      fontWeight: '400',
      color: colors.textMuted,
      textAlign: 'center',
      maxWidth: 120,
    },
    divider: {
      width: isCompact ? '80%' : 1,
      height: isCompact ? 1 : 64,
      backgroundColor: colors.borderLight,
      alignSelf: 'center',
    },
  }), [colors, isCompact, isMobile]);

  return (
    <View style={styles.container} testID="home-trust-block">
      <ResponsiveContainer maxWidth="lg" padding>
        <View style={styles.content}>
          {STATS.map((stat, index) => (
            <React.Fragment key={stat.label}>
              {index > 0 && <View style={styles.divider} />}
              <Pressable
                style={[
                  styles.statItem,
                  hoveredIndex === index && styles.statItemHover,
                ]}
                onHoverIn={() => setHoveredIndex(index)}
                onHoverOut={() => setHoveredIndex(null)}
                accessibilityRole="none"
              >
                <View style={styles.iconOuter}>
                  <View style={styles.iconInner}>
                    <Feather name={stat.icon as any} size={isCompact ? 20 : 24} color={colors.primary} />
                  </View>
                </View>
                <View style={styles.statValueRow}>
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statUnit}>{stat.unit}</Text>
                </View>
                <Text style={styles.statLabel}>{stat.label}</Text>
                <Text style={styles.statDesc}>{stat.desc}</Text>
              </Pressable>
            </React.Fragment>
          ))}
        </View>
      </ResponsiveContainer>
    </View>
  );
}

export default memo(HomeTrustBlock);
