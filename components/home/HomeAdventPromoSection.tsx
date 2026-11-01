import { memo, useCallback, useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import { ResponsiveContainer } from '@/components/layout'
import Button from '@/components/ui/Button'
import { ADVENT_MAIN_DOORS, ADVENT_ROUTE } from '@/constants/advent'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useAdventCampaign } from '@/hooks/useAdventCampaign'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { formatInteger } from '@/i18n/format'
import { translate as i18nT } from '@/i18n'
import { sendAnalyticsEvent } from '@/utils/analytics'
import { isPhoneLayout } from '@/utils/phoneLayout'

/**
 * Баннер адвент-календаря на главной (#2866): виден только в окне кампании
 * 01.12–07.01 по местной дате клиента и независимо от выбранного оформления.
 * Живёт в отложенных секциях главной — на LCP не влияет.
 */
function HomeAdventPromoSection({ enabled = true, topGap }: { enabled?: boolean; topGap?: number | string }) {
  const router = useRouter()
  const colors = useThemedColors()
  const { width, isPhone, isLargePhone } = useResponsive()
  const isMobile = isPhoneLayout({ width, isPhone, isLargePhone })
  const styles = useMemo(() => createStyles(colors, isMobile), [colors, isMobile])
  const { isInWindow, todayDoor, nextDoor, openedCount } = useAdventCampaign()

  const handleOpen = useCallback(() => {
    sendAnalyticsEvent('HomeClick_Advent', { day: todayDoor?.day ?? null })
    router.push(ADVENT_ROUTE as never)
  }, [router, todayDoor?.day])

  if (!enabled || !isInWindow) return null

  const door = todayDoor ?? nextDoor
  const doorLine = door
    ? i18nT('adventStatic:home.today', {
        value1: door.day,
        value2: door.secret && door.state === 'locked' ? i18nT('adventStatic:tile.secret') : door.gift.title,
      })
    : null

  return (
    <View style={[styles.band, topGap !== undefined ? { marginTop: topGap as number } : null]} testID="home-advent-promo">
      <ResponsiveContainer maxWidth="xl" padding>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Feather name="gift" size={28} color={colors.primaryDark} />
          </View>
          <View style={styles.textCol}>
            <Text style={styles.title}>{i18nT('adventStatic:page.title')}</Text>
            {doorLine ? <Text style={styles.doorLine}>{doorLine}</Text> : null}
            <Text style={styles.subtitle}>{i18nT('adventStatic:home.subtitle')}</Text>
            <Text style={styles.progress}>
              {i18nT('adventStatic:home.progress', { value1: formatInteger(openedCount), value2: formatInteger(ADVENT_MAIN_DOORS) })}
            </Text>
          </View>
          <View style={styles.ctaCol}>
            <Button
              label={i18nT('adventStatic:home.cta')}
              onPress={handleOpen}
              size={isMobile ? 'sm' : 'md'}
              fullWidth={isMobile}
              testID="home-advent-cta"
            />
          </View>
        </View>
      </ResponsiveContainer>
    </View>
  )
}

const createStyles = (colors: ThemedColors, isMobile: boolean) =>
  StyleSheet.create({
    band: { paddingVertical: isMobile ? DESIGN_TOKENS.spacing.sm : DESIGN_TOKENS.spacing.lg },
    card: {
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: isMobile ? 'stretch' : 'center',
      gap: DESIGN_TOKENS.spacing.md,
      padding: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: DESIGN_TOKENS.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    textCol: { flex: 1, gap: DESIGN_TOKENS.spacing.xxs },
    title: { fontSize: isMobile ? 18 : 20, fontWeight: '700', color: colors.text, lineHeight: 26 },
    doorLine: { fontSize: 15, lineHeight: 22, fontWeight: '600', color: colors.primaryDark },
    subtitle: { fontSize: 14, lineHeight: 20, color: colors.textSecondary },
    progress: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
    ctaCol: { flexShrink: 0, minWidth: isMobile ? undefined : 200 },
  })

export default memo(HomeAdventPromoSection)
