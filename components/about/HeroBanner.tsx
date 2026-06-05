import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';
import { useThemedColors } from '@/hooks/useTheme';

type Props = {
  isWide: boolean;
};

const PILL_ITEMS = [
  { icon: 'map-pin', label: 'реальные маршруты' },
  { icon: 'camera', label: 'живые фото' },
  { icon: 'users', label: 'сообщество' },
] as const;

export const HeroBanner: React.FC<Props> = ({ isWide }) => {
  const router = useRouter();
  const colors = useThemedColors();
  const styles = React.useMemo(() => createStyles(colors, isWide), [colors, isWide]);

  return (
    <View style={styles.wrap}>
      <View style={styles.copy}>
        <View style={styles.kickerRow}>
          <Feather name="compass" size={14} color={colors.primary} />
          <Text style={styles.kicker}>MeTravel.by</Text>
        </View>
        <Text style={styles.title}>Путешествия, которые хочется повторить</Text>
        <Text style={styles.subtitle}>
          Платформа с маршрутами, местами и историями от людей, которые уже были там и готовы поделиться опытом.
        </Text>

        <View style={styles.pills}>
          {PILL_ITEMS.map((item) => (
            <View key={item.label} style={styles.pill}>
              <Feather name={item.icon} size={13} color={colors.primaryText} />
              <Text style={styles.pillText}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.ctaRow}>
          <Pressable
            onPress={() => router.push('/search' as any)}
            accessibilityRole="link"
            accessibilityLabel="Смотреть маршруты"
            style={({ pressed, hovered }: any) => [
              styles.ctaPrimary,
              hovered && Platform.OS === 'web' && styles.ctaHover,
              pressed && styles.ctaPressed,
              globalFocusStyles.focusable,
            ]}
          >
            <Text style={styles.ctaPrimaryText}>Смотреть маршруты</Text>
            <Feather name="arrow-right" size={16} color={colors.textOnPrimary} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/map' as any)}
            accessibilityRole="link"
            accessibilityLabel="Открыть карту"
            style={({ pressed, hovered }: any) => [
              styles.ctaSecondary,
              hovered && Platform.OS === 'web' && styles.ctaSecondaryHover,
              pressed && styles.ctaPressed,
              globalFocusStyles.focusable,
            ]}
          >
            <Feather name="map" size={16} color={colors.primary} />
            <Text style={styles.ctaSecondaryText}>Открыть карту</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.visual} pointerEvents="none">
        <View style={styles.visualHeader}>
          <View style={styles.visualDot} />
          <Text style={styles.visualLabel}>маршрут выходного дня</Text>
        </View>
        <View style={styles.routeCard}>
          <View style={styles.routeLine} />
          {['Старт', 'Место', 'Вид'].map((label, index) => (
            <View key={label} style={[styles.routePoint, index === 2 && styles.routePointActive]}>
              <View style={styles.pointIcon}>
                <Feather
                  name={index === 0 ? 'flag' : index === 1 ? 'map-pin' : 'camera'}
                  size={14}
                  color={index === 2 ? colors.textOnPrimary : colors.primary}
                />
              </View>
              <Text style={styles.pointLabel}>{label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.visualFooter}>
          <Feather name="heart" size={15} color={colors.brand} />
          <Text style={styles.visualFooterText}>сохраняйте идеи и добавляйте свои</Text>
        </View>
      </View>
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemedColors>, isWide: boolean) =>
  StyleSheet.create({
    wrap: {
      width: '100%',
      borderRadius: DESIGN_TOKENS.radii.xl,
      borderWidth: 1,
      borderColor: colors.borderAccent,
      backgroundColor: colors.surface,
      padding: isWide ? DESIGN_TOKENS.spacing.xl : DESIGN_TOKENS.spacing.lg,
      flexDirection: isWide ? 'row' : 'column',
      alignItems: isWide ? 'center' : 'stretch',
      gap: isWide ? DESIGN_TOKENS.spacing.xl : DESIGN_TOKENS.spacing.lg,
      marginBottom: DESIGN_TOKENS.spacing.lg,
      overflow: 'hidden',
      ...Platform.select({
        web: {
          boxShadow: colors.boxShadows.card,
          backgroundImage: `linear-gradient(135deg, ${colors.surface} 0%, ${colors.primarySoft} 58%, ${colors.brandSoft} 100%)`,
        },
      }),
    },
    copy: {
      flex: isWide ? 1.1 : undefined,
      minWidth: 0,
      gap: DESIGN_TOKENS.spacing.sm,
    },
    kickerRow: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      paddingVertical: DESIGN_TOKENS.spacing.xs,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
    },
    kicker: {
      ...DESIGN_TOKENS.typography.scale.label,
      color: colors.primaryText,
      textTransform: 'uppercase',
    },
    title: {
      fontSize: isWide ? 34 : 25,
      lineHeight: isWide ? 40 : 31,
      fontWeight: '800',
      color: colors.text,
      maxWidth: 680,
    },
    subtitle: {
      ...DESIGN_TOKENS.typography.scale.body,
      color: colors.textMuted,
      maxWidth: 620,
    },
    pills: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.xs,
      marginTop: DESIGN_TOKENS.spacing.xs,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xxs,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      paddingVertical: 7,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pillText: {
      ...DESIGN_TOKENS.typography.scale.caption,
      color: colors.text,
    },
    ctaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.sm,
      marginTop: DESIGN_TOKENS.spacing.sm,
    },
    ctaPrimary: {
      minHeight: DESIGN_TOKENS.touchTarget.minHeight,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
      ...Platform.select({
        web: {
          boxShadow: colors.boxShadows.medium,
          cursor: 'pointer',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        } as any,
      }),
    },
    ctaSecondary: {
      minHeight: DESIGN_TOKENS.touchTarget.minHeight,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderAccent,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
      ...Platform.select({
        web: { cursor: 'pointer', transition: 'background-color 0.2s ease, transform 0.2s ease' } as any,
      }),
    },
    ctaHover: {
      transform: [{ translateY: -1 }],
      ...Platform.select({ web: { boxShadow: colors.boxShadows.hover } as any }),
    },
    ctaSecondaryHover: {
      backgroundColor: colors.primarySoft,
      transform: [{ translateY: -1 }],
    },
    ctaPressed: {
      opacity: 0.88,
      transform: [{ scale: 0.98 }],
    },
    ctaPrimaryText: {
      ...DESIGN_TOKENS.typography.scale.bodyStrong,
      color: colors.textOnPrimary,
    },
    ctaSecondaryText: {
      ...DESIGN_TOKENS.typography.scale.bodyStrong,
      color: colors.primaryText,
    },
    visual: {
      flex: isWide ? 0.9 : undefined,
      minHeight: isWide ? 250 : 220,
      borderRadius: DESIGN_TOKENS.radii.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: DESIGN_TOKENS.spacing.lg,
      justifyContent: 'space-between',
      ...Platform.select({
        web: { boxShadow: colors.boxShadows.light },
      }),
    },
    visualHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    visualDot: {
      width: 8,
      height: 8,
      borderRadius: DESIGN_TOKENS.radii.full,
      backgroundColor: colors.brand,
    },
    visualLabel: {
      ...DESIGN_TOKENS.typography.scale.caption,
      color: colors.textMuted,
      textTransform: 'uppercase',
    },
    routeCard: {
      position: 'relative',
      gap: DESIGN_TOKENS.spacing.md,
      paddingVertical: DESIGN_TOKENS.spacing.md,
    },
    routeLine: {
      position: 'absolute',
      left: 19,
      top: DESIGN_TOKENS.spacing.lg,
      bottom: DESIGN_TOKENS.spacing.lg,
      width: 2,
      backgroundColor: colors.borderAccent,
    },
    routePoint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
      padding: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.backgroundSecondary,
    },
    routePointActive: {
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
    },
    pointIcon: {
      width: 28,
      height: 28,
      borderRadius: DESIGN_TOKENS.radii.full,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    pointLabel: {
      ...DESIGN_TOKENS.typography.scale.bodyStrong,
      color: colors.text,
    },
    visualFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    visualFooterText: {
      ...DESIGN_TOKENS.typography.scale.bodySmall,
      color: colors.textMuted,
      flex: 1,
    },
  });

export default HeroBanner;
