import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

type Props = {
  isWide: boolean;
};

type FilterParams = Record<string, string | number | Array<string | number> | undefined>;

type Category = {
  icon: FeatherName;
  title: string;
  desc: string;
  route: string;
  filters?: FilterParams;
};

const CATEGORIES: Category[] = [
  {
    icon: 'shield',
    title: 'Замки и крепости',
    desc: 'Несвиж, Мир, Лида и легенды веков',
    route: '/search',
    filters: { categoryTravelAddress: [33, 43] },
  },
  {
    icon: 'droplet',
    title: 'Озёра и реки',
    desc: 'Браславы, Нарочь, тихие лесные плёсы',
    route: '/search',
    filters: { categoryTravelAddress: [84, 110, 113, 193] },
  },
  {
    icon: 'feather',
    title: 'Природа и парки',
    desc: 'Беловежская пуща, заказники, тропы',
    route: '/search',
    filters: { categories: [21, 22, 2] },
  },
  {
    icon: 'smile',
    title: 'Парки и развлечения',
    desc: 'Парки развлечений, зоопарки, арены и семейный отдых',
    route: '/search',
    filters: { categoryTravelAddress: [92, 35, 46, 185, 204] },
  },
  {
    icon: 'layers',
    title: 'Города и архитектура',
    desc: 'Минск, Гродно, Витебск — гулять и любоваться',
    route: '/search',
    filters: { categories: [19, 20] },
  },
  {
    icon: 'image',
    title: 'Музеи и арт',
    desc: 'Музеи, скансены и усадьбы для культурных прогулок',
    route: '/search',
    filters: { categoryTravelAddress: [76, 77, 136] },
  },
  {
    icon: 'coffee',
    title: 'Гастрономия',
    desc: 'Кафе, рестораны, бары, пивоварни и винодельни',
    route: '/search',
    filters: { categoryTravelAddress: [50, 109, 10, 98, 172, 198] },
  },
  {
    icon: 'map',
    title: 'Готовые маршруты',
    desc: 'На день, выходные, машиной и пешком',
    route: '/search',
  },
];

const buildHref = (route: string, filters?: FilterParams): string => {
  if (!filters) return route;
  const query = Object.entries(filters)
    .map(([key, value]) => {
      if (value === undefined || value === null) return null;
      const v = Array.isArray(value)
        ? value.map((x) => String(x).trim()).filter(Boolean).join(',')
        : String(value).trim();
      return v ? `${key}=${encodeURIComponent(v)}` : null;
    })
    .filter((s): s is string => !!s)
    .join('&');
  return query ? `${route}?${query}` : route;
};

export const CategoriesShowcase: React.FC<Props> = ({ isWide }) => {
  const colors = useThemedColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: colors.primaryText }]}>Что вы найдёте на сайте</Text>
        <Text style={[styles.title, { color: colors.text }]}>Идеи для любого настроения</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Десятки реальных путешествий — от тихих озёр до городских прогулок. Нажмите на карточку, чтобы открыть подборку
        </Text>
      </View>

      <View style={[styles.grid, isWide ? styles.gridWide : styles.gridNarrow]}>
        {CATEGORIES.map((cat) => {
          const href = buildHref(cat.route, cat.filters);
          return (
            <Pressable
              key={cat.title}
              onPress={() => router.push(href as any)}
              accessibilityRole="link"
              accessibilityLabel={`${cat.title}. ${cat.desc}`}
              style={({ pressed, hovered }: any) => [
                styles.cardOuter,
                isWide ? styles.cardWide : styles.cardNarrow,
                hovered && styles.cardHover,
                pressed && styles.cardPressed,
                globalFocusStyles.focusable,
              ]}
            >
              <View style={styles.card}>
                <View style={styles.iconBadge}>
                  <Feather name={cat.icon} size={20} color={colors.primaryDark} />
                </View>
                <Text style={styles.cardTitle}>{cat.title}</Text>
                <Text style={styles.cardDesc}>{cat.desc}</Text>
                <View style={styles.cardCta}>
                  <Text style={styles.cardCtaText}>Смотреть</Text>
                  <Feather name="arrow-right" size={12} color={colors.primaryDark} />
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  wrap: {
    marginTop: DESIGN_TOKENS.spacing.xl,
    paddingTop: DESIGN_TOKENS.spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.borderAccent,
  },
  header: {
    alignItems: 'center',
    marginBottom: DESIGN_TOKENS.spacing.lg,
  },
  eyebrow: {
    ...DESIGN_TOKENS.typography.scale.label,
    textTransform: 'uppercase',
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  title: {
    ...DESIGN_TOKENS.typography.scale.h2,
    textAlign: 'center',
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  subtitle: {
    ...DESIGN_TOKENS.typography.scale.body,
    textAlign: 'center',
    maxWidth: 600,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  gridWide: { justifyContent: 'flex-start' },
  gridNarrow: { justifyContent: 'space-between' },
  cardOuter: {
    borderRadius: DESIGN_TOKENS.radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      web: {
        boxShadow: colors.boxShadows.card,
        cursor: 'pointer',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      } as any,
      ios: {
        shadowColor: colors.text,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
      },
      android: { elevation: 3 },
    }),
  },
  cardHover: Platform.select({
    web: {
      transform: [{ translateY: -2 }],
      boxShadow: colors.boxShadows.hover,
    } as any,
    default: {},
  }) as any,
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  cardWide: {
    width: 'calc(25% - 12px)' as any,
    minWidth: 180,
    flexGrow: 1,
  },
  cardNarrow: {
    width: '48%',
    minWidth: 140,
    flexGrow: 1,
  },
  card: {
    padding: DESIGN_TOKENS.spacing.md,
    minHeight: 142,
    borderRadius: DESIGN_TOKENS.radii.lg,
    justifyContent: 'flex-end',
    gap: DESIGN_TOKENS.spacing.xs,
    ...Platform.select({
      web: {
        backgroundImage: `linear-gradient(180deg, ${colors.surface} 0%, ${colors.backgroundSecondary} 100%)`,
      },
    }),
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryAlpha30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  cardTitle: {
    ...DESIGN_TOKENS.typography.scale.h3,
    color: colors.text,
  },
  cardDesc: {
    ...DESIGN_TOKENS.typography.scale.bodySmall,
    color: colors.textMuted,
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  cardCta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xxs,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: DESIGN_TOKENS.spacing.xxs,
    borderRadius: DESIGN_TOKENS.radii.pill,
    backgroundColor: colors.primarySoft,
  },
  cardCtaText: {
    ...DESIGN_TOKENS.typography.scale.caption,
    color: colors.primaryText,
  },
});

export default CategoriesShowcase;
