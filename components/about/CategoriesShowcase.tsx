import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

type Props = {
  isWide: boolean;
};

type FilterParams = Record<string, string | number | Array<string | number> | undefined>;

type Category = {
  icon: FeatherName;
  title: string;
  desc: string;
  colors: [string, string];
  route: string;
  filters?: FilterParams;
};

const CATEGORIES: Category[] = [
  {
    icon: 'shield',
    title: 'Замки и крепости',
    desc: 'Несвиж, Мир, Лида и легенды веков',
    colors: ['#A48A5F', '#6E5230'],
    route: '/search',
    filters: { categoryTravelAddress: [33, 43] },
  },
  {
    icon: 'droplet',
    title: 'Озёра и реки',
    desc: 'Браславы, Нарочь, тихие лесные плёсы',
    colors: ['#5BA8D6', '#1F5C8A'],
    route: '/search',
    filters: { categoryTravelAddress: [84, 110, 113, 193] },
  },
  {
    icon: 'feather',
    title: 'Природа и парки',
    desc: 'Беловежская пуща, заказники, тропы',
    colors: ['#7BB07A', '#2F6B4E'],
    route: '/search',
    filters: { categories: [21, 22, 2] },
  },
  {
    icon: 'smile',
    title: 'Парки и развлечения',
    desc: 'Парки развлечений, зоопарки, арены и семейный отдых',
    colors: ['#FF7E7E', '#C03A4A'],
    route: '/search',
    filters: { categoryTravelAddress: [92, 35, 46, 185, 204] },
  },
  {
    icon: 'layers',
    title: 'Города и архитектура',
    desc: 'Минск, Гродно, Витебск — гулять и любоваться',
    colors: ['#B59CD9', '#5B3F8C'],
    route: '/search',
    filters: { categories: [19, 20] },
  },
  {
    icon: 'image',
    title: 'Музеи и арт',
    desc: 'Музеи, скансены и усадьбы для культурных прогулок',
    colors: ['#F4B860', '#A86A1F'],
    route: '/search',
    filters: { categoryTravelAddress: [76, 77, 136] },
  },
  {
    icon: 'coffee',
    title: 'Гастрономия',
    desc: 'Кафе, рестораны, бары, пивоварни и винодельни',
    colors: ['#E6A972', '#8E5728'],
    route: '/search',
    filters: { categoryTravelAddress: [50, 109, 10, 98, 172, 198] },
  },
  {
    icon: 'map',
    title: 'Готовые маршруты',
    desc: 'На день, выходные, машиной и пешком',
    colors: ['#5DBDB1', '#1F6F66'],
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
  const router = useRouter();

  return (
    <View style={[styles.wrap, { borderTopColor: colors.borderAccent }]}>
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>Что вы найдёте на сайте</Text>
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
              ]}
            >
              <LinearGradient
                colors={cat.colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.card}
              >
                <View style={styles.iconBadge}>
                  <Feather name={cat.icon} size={22} color="#ffffff" />
                </View>
                <Text style={styles.cardTitle}>{cat.title}</Text>
                <Text style={styles.cardDesc}>{cat.desc}</Text>
                <View style={styles.cardCta}>
                  <Text style={styles.cardCtaText}>Смотреть</Text>
                  <Feather name="arrow-right" size={12} color="#ffffff" />
                </View>
              </LinearGradient>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginTop: 48,
    paddingTop: 32,
    borderTopWidth: 2,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    maxWidth: 600,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  gridWide: { justifyContent: 'flex-start' },
  gridNarrow: { justifyContent: 'space-between' },
  cardOuter: {
    borderRadius: 18,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        cursor: 'pointer',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      } as any,
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: { elevation: 4 },
    }),
  },
  cardHover: Platform.select({
    web: {
      transform: [{ translateY: -3 }],
      boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
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
    padding: 18,
    minHeight: 170,
    borderRadius: 18,
    justifyContent: 'flex-end',
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  cardDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.92)',
    lineHeight: 18,
    fontWeight: '500',
    marginBottom: 12,
  },
  cardCta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  cardCtaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
});

export default CategoriesShowcase;
