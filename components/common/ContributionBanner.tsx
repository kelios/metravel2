import React, { memo, useMemo } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { useAuthStore } from '@/stores/authStore'
import { ResponsiveContainer } from '@/components/layout'
import Button from '@/components/ui/Button'
import { buildLoginHref } from '@/utils/authNavigation'

export type ContributionBannerVariant =
  | 'home'
  | 'search'
  | 'articles'
  | 'favorites'
  | 'places'
  | 'history'
  | 'about'
  | 'default'

interface ContributionBannerProps {
  variant?: ContributionBannerVariant
}

const COPY: Record<
  ContributionBannerVariant,
  { title: string; subtitle: string; icon: string }
> = {
  home: {
    icon: 'map-pin',
    title: 'Спасибо всем, кто уже поделился!',
    subtitle:
      'Каждое добавленное место делает карту богаче. Если вы бывали где-то интересном — расскажите об этом, и ваш маршрут поможет другим найти своё следующее приключение.',
  },
  search: {
    icon: 'compass',
    title: 'Не нашли нужный маршрут? Добавьте его сами!',
    subtitle:
      'Огромное спасибо всем путешественникам, которые уже поделились своими маршрутами. Ваш опыт — самый честный путеводитель.',
  },
  articles: {
    icon: 'edit-2',
    title: 'Вы тоже можете пополнить карту!',
    subtitle:
      'Все маршруты здесь созданы такими же людьми, как вы. Если вам есть что рассказать о каком-то месте — добавьте его, и это увидят сотни человек.',
  },
  favorites: {
    icon: 'heart',
    title: 'Поделитесь местами, которые вам понравились',
    subtitle:
      'Спасибо, что пользуетесь сервисом! Если сохранённые маршруты вдохновили вас — добавьте своё место. Другие путешественники будут вам очень благодарны.',
  },
  places: {
    icon: 'globe',
    title: 'Знаете интересное место — расскажите о нём!',
    subtitle:
      'Все точки на этой карте добавлены пользователями вручную. Спасибо каждому, кто уже внёс свой вклад. Ваше место тоже ждёт здесь.',
  },
  history: {
    icon: 'clock',
    title: 'Были в интересном месте? Добавьте его!',
    subtitle:
      'Просмотренные маршруты — лучшее напоминание о поездках. Если среди них есть любимые места — поделитесь ими с сообществом. Это бесплатно и занимает несколько минут.',
  },
  about: {
    icon: 'users',
    title: 'Станьте частью сообщества путешественников',
    subtitle:
      'Metravel строится на опыте реальных людей. Спасибо всем, кто уже добавил свои маршруты! Присоединяйтесь — добавьте место, которое хочется рекомендовать другим.',
  },
  default: {
    icon: 'map-pin',
    title: 'Помогите расширить карту',
    subtitle:
      'Если сайт оказался полезным — добавьте своё место. Спасибо всем, кто уже делится маршрутами: именно благодаря вам это работает.',
  },
}

const ADD_PLACE_PATH = '/travel/new'

function ContributionBanner({ variant = 'default' }: ContributionBannerProps) {
  const router = useRouter()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const { isMobile } = useResponsive()
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors, isMobile), [colors, isMobile])

  const copy = COPY[variant]

  const handleAddPlace = () => {
    if (isAuthenticated) {
      router.push(ADD_PLACE_PATH as any)
    } else {
      router.push(buildLoginHref({ redirect: ADD_PLACE_PATH, intent: 'add-place' }) as any)
    }
  }

  const handleRegister = () => {
    router.push(
      (`/registration?redirect=${encodeURIComponent(ADD_PLACE_PATH)}&intent=add-place`) as any,
    )
  }

  return (
    <View style={styles.wrapper}>
      <ResponsiveContainer maxWidth="xl" padding>
        <View style={styles.card}>
          <View style={styles.iconRow}>
            <View style={styles.iconWrap}>
              <Feather
                name={copy.icon as any}
                size={isMobile ? 20 : 22}
                color={colors.primary}
              />
            </View>
          </View>

          <View style={[styles.textBlock, isMobile ? styles.textBlockMobile : styles.textBlockDesktop]}>
            <Text style={styles.title}>{copy.title}</Text>
            <Text style={styles.subtitle}>{copy.subtitle}</Text>
          </View>

          <View style={[styles.buttons, isMobile ? styles.buttonsMobile : styles.buttonsDesktop]}>
            {!isAuthenticated && (
              <Button
                label="Зарегистрироваться"
                onPress={handleRegister}
                variant="primary"
                size={isMobile ? 'md' : 'md'}
                fullWidth={isMobile}
                icon={<Feather name="user-plus" size={16} color={colors.textOnPrimary} />}
                iconPosition="left"
                style={styles.primaryBtn}
                accessibilityLabel="Зарегистрироваться и добавить место"
              />
            )}
            <Button
              label="Добавить место"
              onPress={handleAddPlace}
              variant={isAuthenticated ? 'primary' : 'outline'}
              size={isMobile ? 'md' : 'md'}
              fullWidth={isMobile}
              icon={<Feather name="plus" size={16} color={isAuthenticated ? colors.textOnPrimary : colors.primary} />}
              iconPosition="left"
              style={isAuthenticated ? styles.primaryBtn : styles.outlineBtn}
              accessibilityLabel="Добавить место на карту"
            />
          </View>
        </View>
      </ResponsiveContainer>
    </View>
  )
}

const createStyles = (colors: ThemedColors, isMobile: boolean) =>
  StyleSheet.create({
    wrapper: {
      width: '100%',
      paddingVertical: isMobile ? 12 : 20,
    },
    card: {
      borderRadius: DESIGN_TOKENS.radii.xl,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      backgroundColor: colors.surface,
      paddingHorizontal: isMobile ? 16 : 28,
      paddingVertical: isMobile ? 18 : 24,
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: isMobile ? 'flex-start' : 'center',
      gap: isMobile ? 14 : 20,
      ...Platform.select({
        web: {
          boxShadow: `0 2px 16px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)`,
          backgroundImage: `linear-gradient(135deg, ${colors.surface} 0%, ${colors.primarySoft}66 100%)`,
        },
      }),
    },
    iconRow: {
      flexShrink: 0,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: DESIGN_TOKENS.radii.full,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textBlock: {
      gap: 4,
    },
    textBlockMobile: {
      width: '100%',
    },
    textBlockDesktop: {
      flex: 1,
    },
    title: {
      fontSize: isMobile ? 15 : 17,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.2,
    },
    subtitle: {
      fontSize: isMobile ? 13 : 14,
      color: colors.textMuted,
      lineHeight: isMobile ? 19 : 21,
      fontWeight: '400',
    },
    buttons: {
      flexShrink: 0,
      gap: 10,
    },
    buttonsMobile: {
      width: '100%',
      flexDirection: 'column',
    },
    buttonsDesktop: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    primaryBtn: {
      borderRadius: DESIGN_TOKENS.radii.pill,
    },
    outlineBtn: {
      borderRadius: DESIGN_TOKENS.radii.pill,
    },
  })

export default memo(ContributionBanner)
