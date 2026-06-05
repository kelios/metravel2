import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';
import { useThemedColors } from '@/hooks/useTheme';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

type Props = {
  isWide: boolean;
};

const ITEMS: Array<{ icon: FeatherName; value: string; label: string; href: string }> = [
  { icon: 'compass', value: 'Сотни', label: 'маршрутов от путешественников', href: '/search' },
  { icon: 'camera', value: 'Тысячи', label: 'живых фото и впечатлений', href: '/search?sort=popular' },
  { icon: 'map', value: 'Карта', label: 'с точками интереса по всей стране', href: '/map' },
  { icon: 'heart', value: 'Бесплатно', label: 'и без рекламы — просто для души', href: '/search' },
];

export const StatsBanner: React.FC<Props> = ({ isWide }) => {
  const router = useRouter();
  const colors = useThemedColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.wrap, isWide ? styles.wrapWide : styles.wrapNarrow]}>
      {ITEMS.map((item) => (
        <Pressable
          key={item.label}
          onPress={() => router.push(item.href as any)}
          accessibilityRole="link"
          accessibilityLabel={`${item.value} ${item.label}`}
          style={({ pressed, hovered }: any) => [
            styles.cell,
            isWide ? styles.cellWide : styles.cellNarrow,
            hovered && styles.cellHover,
            pressed && styles.cellPressed,
            globalFocusStyles.focusable,
          ]}
        >
          <View style={styles.iconBadge}>
            <Feather name={item.icon} size={19} color={colors.primary} />
          </View>
          <Text style={styles.value}>{item.value}</Text>
          <Text style={styles.label}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  wrap: {
    marginTop: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.lg,
    overflow: 'hidden',
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      web: { boxShadow: colors.boxShadows.card },
      ios: {
        shadowColor: colors.text,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
      },
      android: { elevation: 3 },
    }),
  },
  wrapWide: { padding: DESIGN_TOKENS.spacing.xs },
  wrapNarrow: { padding: DESIGN_TOKENS.spacing.xs },
  cell: {
    padding: DESIGN_TOKENS.spacing.md,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    borderRadius: DESIGN_TOKENS.radii.md,
    gap: DESIGN_TOKENS.spacing.xxs,
    ...Platform.select({
      web: { cursor: 'pointer', transition: 'background-color 0.2s ease, transform 0.2s ease' } as any,
      default: {},
    }),
  },
  cellHover: Platform.select({
    web: { backgroundColor: colors.primarySoft, transform: [{ translateY: -1 }] } as any,
    default: {},
  }) as any,
  cellPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  cellWide: {
    width: '25%',
  },
  cellNarrow: {
    width: '50%',
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryAlpha30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  value: {
    ...DESIGN_TOKENS.typography.scale.h3,
    color: colors.text,
  },
  label: {
    ...DESIGN_TOKENS.typography.scale.bodySmall,
    color: colors.textMuted,
  },
});

export default StatsBanner;
