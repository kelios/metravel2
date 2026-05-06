import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';

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
  return (
    <View style={[styles.wrap, isWide ? styles.wrapWide : styles.wrapNarrow]}>
      <LinearGradient
        colors={['#2B6FA0', '#5BA8D6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
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
          ]}
        >
          <View style={styles.iconBadge}>
            <Feather name={item.icon} size={22} color="#ffffff" />
          </View>
          <Text style={styles.value}>{item.value}</Text>
          <Text style={styles.label}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginTop: 32,
    borderRadius: 20,
    overflow: 'hidden',
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    ...Platform.select({
      web: { boxShadow: '0 12px 28px rgba(43,111,160,0.3)' },
      ios: {
        shadowColor: '#2B6FA0',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: { elevation: 5 },
    }),
  },
  wrapWide: { padding: 12 },
  wrapNarrow: { padding: 8 },
  cell: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    ...Platform.select({
      web: { cursor: 'pointer', transition: 'background-color 0.2s ease, transform 0.2s ease' } as any,
      default: {},
    }),
  },
  cellHover: Platform.select({
    web: { backgroundColor: 'rgba(255,255,255,0.12)', transform: [{ translateY: -2 }] } as any,
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
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '500',
  },
});

export default StatsBanner;
