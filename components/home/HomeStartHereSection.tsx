import React, { memo, useCallback, useMemo } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { useRouter } from 'expo-router'

import { ResponsiveContainer } from '@/components/layout'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import { sendAnalyticsEvent } from '@/utils/analytics'

type StartTile = {
  key: string
  icon: string
  title: string
  subtitle: string
  route: string
  accent: string
}

const TILES: readonly StartTile[] = [
  {
    key: 'catalog',
    icon: 'compass',
    title: 'Найти маршрут',
    subtitle: 'Каталог поездок с фильтрами по формату, сезону и длительности',
    route: '/search',
    accent: '#2F6B4E',
  },
  {
    key: 'map',
    icon: 'map-pin',
    title: 'Смотреть на карте',
    subtitle: 'Что посмотреть рядом — маршруты до 60 км от вас',
    route: '/map?radius=60',
    accent: '#1F5C8A',
  },
  {
    key: 'roulette',
    icon: 'shuffle',
    title: 'Случайная идея',
    subtitle: 'Не знаете, куда поехать? Откроем маршрут наугад',
    route: '/roulette',
    accent: '#A86A1F',
  },
] as const

function StartTileCard({
  tile,
  onPress,
  styles,
}: {
  tile: StartTile
  onPress: (tile: StartTile) => void
  styles: ReturnType<typeof createStyles>
}) {
  return (
    <Pressable
      onPress={() => onPress(tile)}
      accessibilityRole="link"
      accessibilityLabel={`${tile.title}. ${tile.subtitle}`}
      style={({ pressed, hovered }: any) => [
        styles.tile,
        (pressed || hovered) && styles.tileHover,
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${tile.accent}1A` }]}>
        <Feather
          name={tile.icon as any}
          size={22}
          color={tile.accent}
          {...({ 'aria-hidden': true, focusable: false } as any)}
        />
      </View>
      <Text style={styles.tileTitle}>{tile.title}</Text>
      <Text style={styles.tileSubtitle}>{tile.subtitle}</Text>
      <View style={styles.tileArrow}>
        <Text style={[styles.tileArrowText, { color: tile.accent }]}>Открыть</Text>
        <Feather
          name="arrow-right"
          size={15}
          color={tile.accent}
          {...({ 'aria-hidden': true, focusable: false } as any)}
        />
      </View>
    </Pressable>
  )
}

function HomeStartHereSection() {
  const router = useRouter()
  const colors = useThemedColors()
  const { isPhone, isLargePhone } = useResponsive()
  const isMobile = isPhone || isLargePhone
  const styles = useMemo(() => createStyles(colors, isMobile), [colors, isMobile])

  const handlePress = useCallback(
    (tile: StartTile) => {
      sendAnalyticsEvent('HomeClick_StartHere', { tile: tile.key })
      router.push(tile.route as any)
    },
    [router],
  )

  return (
    <ResponsiveContainer maxWidth="xl" padding>
      <View style={styles.header}>
        <Text style={styles.title}>С чего начать</Text>
        <Text style={styles.subtitle}>
          Metravel — реальные маршруты по Беларуси и Европе от тех, кто там был.
          Выберите, как удобнее искать.
        </Text>
      </View>
      <View style={styles.grid}>
        {TILES.map((tile) => (
          <StartTileCard key={tile.key} tile={tile} onPress={handlePress} styles={styles} />
        ))}
      </View>
    </ResponsiveContainer>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>, isMobile: boolean) =>
  StyleSheet.create({
    header: { alignItems: 'center', marginBottom: isMobile ? 20 : 32 },
    title: {
      fontSize: isMobile ? 24 : 32,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: isMobile ? 14 : 16,
      lineHeight: isMobile ? 20 : 24,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 8,
      maxWidth: 560,
    },
    grid: {
      flexDirection: isMobile ? 'column' : 'row',
      gap: isMobile ? 12 : 20,
    },
    tile: {
      flex: isMobile ? undefined : 1,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: isMobile ? 20 : 28,
      gap: 12,
      ...Platform.select({
        web: { transition: 'transform 0.18s ease, box-shadow 0.18s ease' } as any,
      }),
    },
    tileHover: Platform.select({
      web: {
        transform: 'translateY(-3px)',
        boxShadow: '0 14px 32px rgba(0,0,0,0.10)',
        borderColor: colors.primary,
      } as any,
      default: {},
    }) as any,
    iconWrap: {
      width: 52,
      height: 52,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tileTitle: { fontSize: isMobile ? 18 : 20, fontWeight: '700', color: colors.text },
    tileSubtitle: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
    },
    tileArrow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    tileArrowText: { fontSize: 14, fontWeight: '600' },
  })

export default memo(HomeStartHereSection)
