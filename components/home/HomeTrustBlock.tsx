import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { ResponsiveContainer } from '@/components/layout';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';

const STATS = [
  { value: '200+', label: 'маршрутов', icon: 'map' },
  { value: '0 ₽', label: 'бесплатно', icon: 'gift' },
  { value: '2 мин', label: 'до идеи', icon: 'clock' },
] as const;

function HomeTrustBlock() {
  const { isSmallPhone, isPhone, isLargePhone } = useResponsive();
  const isMobile = isSmallPhone || isPhone || isLargePhone;
  const colors = useThemedColors();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      width: '100%',
      paddingVertical: isMobile ? 32 : 48,
      backgroundColor: colors.background,
    },
    content: {
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: isMobile ? 24 : 48,
    },
    statItem: {
      alignItems: 'center',
      gap: 8,
    },
    statIconWrap: {
      width: 48,
      height: 48,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
    },
    statValue: {
      fontSize: isMobile ? 28 : 36,
      fontWeight: '900',
      color: colors.text,
      letterSpacing: -1,
    },
    statLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textMuted,
    },
    divider: {
      width: isMobile ? 60 : 1,
      height: isMobile ? 1 : 60,
      backgroundColor: colors.borderLight,
    },
  }), [colors, isMobile]);

  return (
    <View style={styles.container} testID="home-trust-block">
      <ResponsiveContainer maxWidth="lg" padding>
        <View style={styles.content}>
          {STATS.map((stat, index) => (
            <React.Fragment key={stat.label}>
              {index > 0 && <View style={styles.divider} />}
              <View style={styles.statItem}>
                <View style={styles.statIconWrap}>
                  <Feather name={stat.icon as any} size={22} color={colors.primary} />
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      </ResponsiveContainer>
    </View>
  );
}

export default memo(HomeTrustBlock);
