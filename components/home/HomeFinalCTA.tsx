import { memo, useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import { useAuth } from '@/context/AuthContext'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useResponsive } from '@/hooks/useResponsive'
import { sendAnalyticsEvent } from '@/utils/analytics'
import { ResponsiveContainer } from '@/components/layout'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import Button from '@/components/ui/Button'
import { buildLoginHref } from '@/utils/authNavigation'

interface HomeFinalCTAProps {
  travelsCount?: number
}

type CtaState = 'guest' | 'empty' | 'started'

const TRUST_BADGES = [
  { icon: 'check-circle', label: 'Бесплатно' },
  { icon: 'shield', label: 'Без карты' },
  { icon: 'zap', label: 'Мгновенно' },
] as const

function getCtaState(isAuthenticated: boolean, travelsCount: number): CtaState {
  if (!isAuthenticated) return 'guest'
  if (travelsCount === 0) return 'empty'
  return 'started'
}

const CTA_COPY: Record<CtaState, { eyebrow: string; button: string; subtitle: string }> = {
  guest: {
    eyebrow: 'Ваши маршруты в одном месте',
    button: 'Начать бесплатно',
    subtitle:
      'Сохраняйте маршруты с фото и заметками, чтобы быстро находить их снова и при необходимости собрать PDF.',
  },
  empty: {
    eyebrow: 'Первая поездка в подборке',
    button: 'Добавить первую поездку',
    subtitle:
      'Добавьте первую поездку, чтобы все маршруты, фото и заметки были собраны в одном месте.',
  },
  started: {
    eyebrow: 'Подборка уже собирается',
    button: 'Открыть мою книгу',
    subtitle:
      'У вас уже есть сохранённые поездки. Добавляйте новые маршруты и собирайте PDF, когда он понадобится.',
  },
}

function getNextPath(state: CtaState) {
  if (state === 'guest') return buildLoginHref({ redirect: '/', intent: 'create-book' })
  if (state === 'empty') return '/travel/new'
  return '/export'
}

function HomeFinalCTA({ travelsCount = 0 }: HomeFinalCTAProps) {
  const router = useRouter()
  const { isAuthenticated } = useAuth()
  const { isSmallPhone, isPhone, isLargePhone } = useResponsive()
  const isMobile = isSmallPhone || isPhone || isLargePhone
  const colors = useThemedColors()

  const ctaState = getCtaState(isAuthenticated, travelsCount)
  const copy = CTA_COPY[ctaState]

  const handleAction = () => {
    sendAnalyticsEvent('HomeClick_FinalCTA')
    router.push(getNextPath(ctaState) as any)
  }

  const handleOpenSearch = () => {
    sendAnalyticsEvent('HomeClick_FinalCTA_Search')
    router.push('/search' as any)
  }

  const styles = useMemo(() => createStyles(colors, isMobile), [colors, isMobile])

  return (
    <View style={styles.container}>
      <ResponsiveContainer maxWidth="lg" padding>
        <View style={styles.content}>
          <View style={styles.eyebrow}>
            <Feather
              name="star"
              size={12}
              color={colors.primaryText}
              {...({ 'aria-hidden': true, focusable: false } as any)}
            />
            <Text style={styles.eyebrowText}>{copy.eyebrow}</Text>
          </View>

          <View
            style={styles.iconWrap}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            {...({ 'aria-hidden': true } as any)}
          >
            <Feather
              name="book-open"
              size={isMobile ? 28 : 32}
              color={colors.textOnPrimary}
            />
          </View>

          <View
            style={styles.titleRow}
            accessibilityRole="header"
            accessibilityLabel="Соберите свою подборку поездок"
            {...({ 'aria-level': 2 } as any)}
          >
            <Text style={styles.title}>Соберите свою</Text>
            <Text style={styles.titleAccent}>подборку поездок</Text>
          </View>

          <Text style={styles.subtitle}>{copy.subtitle}</Text>

          <View style={styles.buttonsContainer}>
            <Button
              onPress={handleAction}
              label={copy.button}
              variant="primary"
              size="lg"
              fullWidth={isMobile}
              icon={<Feather name="arrow-right" size={18} color={colors.textOnPrimary} />}
              iconPosition="right"
              style={styles.primaryButton}
              labelStyle={styles.primaryButtonText}
              hoverStyle={styles.primaryButtonHover}
              pressedStyle={styles.primaryButtonHover}
              accessibilityLabel={copy.button}
            />
            <Button
              onPress={handleOpenSearch}
              label="Смотреть маршруты"
              variant="secondary"
              size="lg"
              fullWidth={isMobile}
              icon={<Feather name="compass" size={18} color={colors.text} />}
              style={styles.secondaryButton}
              labelStyle={styles.secondaryButtonText}
              hoverStyle={styles.secondaryButtonHover}
              pressedStyle={styles.secondaryButtonHover}
              accessibilityLabel="Смотреть маршруты"
            />
          </View>

          <View style={styles.trustBadgesRow} accessibilityRole="list">
            {TRUST_BADGES.map((badge) => (
              <View key={badge.label} style={styles.trustBadge} {...(Platform.OS === 'web' ? ({ role: 'listitem' } as any) : {})}>
                <Feather
                  name={badge.icon as any}
                  size={13}
                  color={colors.success ?? colors.primary}
                  {...({ 'aria-hidden': true, focusable: false } as any)}
                />
                <Text style={styles.trustBadgeText}>{badge.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </ResponsiveContainer>
    </View>
  )
}

const createStyles = (colors: ThemedColors, isMobile: boolean) =>
  StyleSheet.create({
    container: {
      width: '100%',
      paddingTop: isMobile ? 24 : 56,
      paddingBottom: isMobile ? 44 : 88,
      backgroundColor: colors.backgroundSecondary,
      alignItems: 'center',
      ...Platform.select({
        web: {
          backgroundImage: [
            `radial-gradient(ellipse 55% 45% at 15% 50%, ${colors.primaryAlpha30} 0%, transparent 60%)`,
            `radial-gradient(ellipse 55% 45% at 85% 50%, ${colors.brandAlpha30 ?? colors.primaryAlpha30} 0%, transparent 60%)`,
            `linear-gradient(180deg, ${colors.backgroundSecondary} 0%, ${colors.background} 100%)`,
          ].join(', '),
        },
      }),
    },
    content: {
      width: '100%',
      alignSelf: 'center',
      alignItems: 'center',
      gap: isMobile ? 18 : 28,
      maxWidth: 760,
      borderRadius: DESIGN_TOKENS.radii.xl,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      backgroundColor: colors.surface,
      paddingHorizontal: isMobile ? 20 : 56,
      paddingVertical: isMobile ? 28 : 56,
      ...Platform.select({
        web: {
          boxShadow: '0 8px 48px rgba(0,0,0,0.08), 0 2px 12px rgba(0,0,0,0.05)',
          backgroundImage: `linear-gradient(160deg, ${colors.surface} 0%, ${colors.primarySoft}88 55%, ${colors.backgroundSecondary} 100%)`,
        },
      }),
    },
    eyebrow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderRadius: DESIGN_TOKENS.radii.pill,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 16,
      paddingVertical: 7,
      alignSelf: 'center',
      ...Platform.select({ web: { boxShadow: `0 1px 8px ${colors.primary}14` } }),
    },
    eyebrowText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primaryText,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    iconWrap: {
      width: isMobile ? 64 : 76,
      height: isMobile ? 64 : 76,
      borderRadius: isMobile ? 32 : 38,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
      ...Platform.select({
        web: {
          boxShadow: `0 8px 28px ${colors.primaryAlpha30}, 0 2px 8px ${colors.primaryAlpha30}`,
        },
      }),
    },
    titleRow: { alignItems: 'center', gap: 2 },
    title: {
      fontSize: isMobile ? 26 : 38,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
      letterSpacing: -1.1,
      lineHeight: isMobile ? 32 : 46,
    },
    titleAccent: {
      fontSize: isMobile ? 26 : 38,
      fontWeight: '800',
      color: colors.primaryText,
      textAlign: 'center',
      letterSpacing: -1.1,
      lineHeight: isMobile ? 32 : 46,
    },
    subtitle: {
      fontSize: isMobile ? 14 : 17,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: isMobile ? 22 : 27,
      maxWidth: 560,
      fontWeight: '400',
      letterSpacing: 0.1,
    },
    buttonsContainer: {
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: 'center',
      gap: isMobile ? 10 : 14,
      width: isMobile ? '100%' : undefined,
      marginTop: 4,
    },
    primaryButton: {
      paddingHorizontal: isMobile ? 28 : 56,
      paddingVertical: isMobile ? 16 : 20,
      minHeight: isMobile ? 52 : 62,
      borderRadius: DESIGN_TOKENS.radii.pill,
      width: isMobile ? '100%' : undefined,
      flex: isMobile ? undefined : 1.4,
      ...Platform.select({
        web: {
          boxShadow: `0 4px 20px ${colors.primaryAlpha30}, 0 1px 4px ${colors.primaryAlpha30}`,
          transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        },
      }),
    },
    primaryButtonHover: {
      backgroundColor: colors.primaryDark,
      ...Platform.select({
        web: {
          transform: 'translateY(-3px)',
          boxShadow: `0 12px 36px ${colors.primaryAlpha30}, 0 2px 8px ${colors.primaryAlpha30}`,
        },
      }),
    },
    primaryButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textOnPrimary,
      letterSpacing: 0.1,
    },
    secondaryButton: {
      paddingHorizontal: isMobile ? 22 : 36,
      paddingVertical: isMobile ? 15 : 19,
      minHeight: isMobile ? 50 : 60,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      width: isMobile ? '100%' : undefined,
      flex: isMobile ? undefined : 1,
      ...Platform.select({ web: { transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)' } }),
    },
    secondaryButtonHover: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primaryAlpha30,
      ...Platform.select({
        web: { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.07)' },
      }),
    },
    secondaryButtonText: { fontSize: 15, fontWeight: '600', color: colors.text },
    trustBadgesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: isMobile ? 16 : 24,
      marginTop: 4,
      flexWrap: 'wrap',
    },
    trustBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    trustBadgeText: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textMuted,
      letterSpacing: 0.1,
    },
  })

export default memo(HomeFinalCTA)
