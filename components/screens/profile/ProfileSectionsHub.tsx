import React, { useMemo } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { useRouter } from 'expo-router'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { useResponsive } from '@/hooks/useResponsive'
import { globalFocusStyles } from '@/styles/globalFocus'
import ProfileSectionHeader from '@/components/profile/ProfileSectionHeader'

interface ProfileSectionsHubProps {
  /** id текущего пользователя для ссылки на публичный профиль; без него пункт скрыт. */
  userId?: string | number | null
}

interface HubItem {
  key: string
  title: string
  subtitle: string
  icon: React.ComponentProps<typeof Feather>['name']
  route: string
}

const BASE_ITEMS: HubItem[] = [
  {
    key: 'trips-my',
    title: 'Мои поездки',
    subtitle: 'Черновики и планы',
    icon: 'briefcase',
    route: '/trips/my',
  },
  {
    key: 'trips-plan',
    title: 'Планировщик',
    subtitle: 'Спланировать маршрут',
    icon: 'map',
    route: '/trips/plan',
  },
  {
    key: 'trips-community',
    title: 'Сообщество',
    subtitle: 'Поехали вместе',
    icon: 'users',
    route: '/trips/community',
  },
  {
    key: 'export',
    title: 'Экспорт в PDF',
    subtitle: 'Книга путешествий',
    icon: 'book-open',
    route: '/export',
  },
  {
    key: 'privacy',
    title: 'Приватность',
    subtitle: 'Кто видит контакты',
    icon: 'shield',
    route: '/privacy-settings',
  },
  {
    key: 'security',
    title: 'Журнал безопасности',
    subtitle: 'История входов',
    icon: 'activity',
    route: '/security-journal',
  },
  {
    key: 'settings',
    title: 'Настройки',
    subtitle: 'Профиль и аккаунт',
    icon: 'settings',
    route: '/settings',
  },
]

export function ProfileSectionsHub({ userId }: ProfileSectionsHubProps) {
  const colors = useThemedColors()
  const router = useRouter()
  const { isDesktop, isMobile, isHydrated } = useResponsive()

  // Экспорт в PDF скрыт в мобильной версии сайта (фича только для десктопа).
  // Гейт по isHydrated, чтобы на десктопе не мигала плитка и не было hydration mismatch:
  // до гидрации (SSR + первый клиентский рендер) плитка есть, скрываем её только после
  // гидрации и только на мобильном.
  const hideExport = isHydrated && isMobile

  const items = useMemo<HubItem[]>(() => {
    const base = hideExport ? BASE_ITEMS.filter((item) => item.key !== 'export') : BASE_ITEMS
    if (userId === undefined || userId === null || `${userId}`.length === 0) return base
    return [
      ...base,
      {
        key: 'public-profile',
        title: 'Мой публичный профиль',
        subtitle: 'Как вас видят другие',
        icon: 'user',
        route: `/user/${userId}`,
      },
    ]
  }, [userId, hideExport])

  const styles = useMemo(() => getStyles(colors), [colors])
  // На телефоне (~390px) две колонки обрезают подписи («Мои поезд…», «Кто видит кон…») —
  // раскладываем плитки в одну колонку; тот же гейт мобильной раскладки, что у hideExport.
  const itemWidth = isDesktop ? '31.5%' : hideExport ? '100%' : '48%'

  return (
    <View>
      <ProfileSectionHeader
        title="Все мои разделы"
        subtitle="Быстрый доступ ко всем разделам кабинета"
      />
      <View style={styles.grid} accessibilityRole="menu">
        {items.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => router.push(item.route as never)}
            accessibilityRole="menuitem"
            accessibilityLabel={item.title}
            accessibilityHint={item.subtitle}
            style={({ pressed }) => [
              styles.card,
              { width: itemWidth },
              globalFocusStyles.focusable,
              pressed && styles.cardPressed,
            ]}
          >
            <View style={styles.iconPill}>
              <Feather name={item.icon} size={16} color={colors.primary} />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.subtitle} numberOfLines={2}>
                {item.subtitle}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

const getStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      paddingTop: DESIGN_TOKENS.spacing.sm,
      gap: DESIGN_TOKENS.spacing.xs,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
      padding: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      minHeight: DESIGN_TOKENS.touchTarget.minHeight,
      ...Platform.select({
        web: { cursor: 'pointer' } as object,
        default: {},
      }),
    },
    cardPressed: {
      backgroundColor: colors.backgroundSecondary,
      borderColor: colors.primary,
    },
    iconPill: {
      width: 34,
      height: 34,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textWrap: {
      flex: 1,
    },
    title: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
    },
  })
