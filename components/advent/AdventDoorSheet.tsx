import { lazy, memo, Suspense, useCallback, useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import BottomSheet from '@/components/ui/BottomSheet'
import Button from '@/components/ui/Button'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { formatDate, formatInteger } from '@/i18n/format'
import { translate as i18nT } from '@/i18n'
import { ADVENT_MAIN_DOORS, isoDateToLocalMidnight } from '@/constants/advent'
import type { AdventDoorView } from '@/hooks/useAdventCampaign'
import { buildAdventDoorCtaHref, buildAdventReturnPath } from '@/utils/advent/adventTaskLinks'
import { buildLoginHref, buildRegistrationHref } from '@/utils/authNavigation'
import { openExternalUrl } from '@/utils/externalLinks'
import { sendAnalyticsEvent } from '@/utils/analytics'
import { KIND_ICONS } from './adventDoorVisuals'
import { formatDoorDate } from './AdventDoorTile'
import AdventRiddleTask from './AdventRiddleTask'
import AdventGeoTask from './AdventGeoTask'
import AdventGiftMedia from './AdventGiftMedia'

// Только для дверцы 24 — отдельным чанком, вместе с контуром шеринга.
const AdventYearInReviewCard = lazy(() => import('./AdventYearInReviewCard'))

type Props = {
  door: AdventDoorView | null
  isAuthenticated: boolean
  preview?: boolean
  /** Дверцы, задания которых засчитал сервер по действию на сайте (#2867). */
  creditedDays?: ReadonlySet<number>
  campaignYear: number
  onClose: () => void
  onCompleteTask: (day: number) => void
}

const Section = memo(function Section({ icon, title, children, styles, colors }: {
  icon: keyof typeof Feather.glyphMap
  title: string
  children: React.ReactNode
  styles: ReturnType<typeof createStyles>
  colors: ThemedColors
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <Feather name={icon} size={16} color={colors.primaryDark} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  )
})

/** Подарок, задание и награда одной дверцы; гостю вместо задания — вход с возвратом на `/advent` (#2861). */
function AdventDoorSheet({ door, isAuthenticated, preview, creditedDays, campaignYear, onClose, onCompleteTask }: Props) {
  const router = useRouter()
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  const openInternalOrExternal = useCallback(
    (link: string) => {
      if (link.startsWith('/')) {
        router.push(link as never)
        return
      }
      void openExternalUrl(link)
    },
    [router],
  )

  const handleGiftLink = useCallback(() => {
    if (!door?.gift.link) return
    if (!preview) sendAnalyticsEvent('Advent_GiftLink', { day: door.day })
    openInternalOrExternal(door.gift.link)
  }, [door, openInternalOrExternal, preview])

  const handleCta = useCallback(() => {
    if (!door) return
    const href = preview ? door.task.ctaRoute?.trim() : buildAdventDoorCtaHref(door)
    if (!href) return
    if (!preview) sendAnalyticsEvent('Advent_TaskCta', { day: door.day, type: door.task.type })
    router.push(href as never)
  }, [door, router, preview])

  const handleDone = useCallback(() => {
    if (!door) return
    if (!preview) sendAnalyticsEvent('Advent_TaskDone', { day: door.day, type: door.task.type })
    onCompleteTask(door.day)
  }, [door, onCompleteTask, preview])

  const handleLogin = useCallback(() => {
    if (!door) return
    router.push(buildLoginHref({ redirect: buildAdventReturnPath(door.day), intent: 'advent' }) as never)
  }, [door, router])

  const handleRegister = useCallback(() => {
    if (!door) return
    router.push(buildRegistrationHref({ redirect: buildAdventReturnPath(door.day), intent: 'advent' }) as never)
  }, [door, router])

  const title = door ? `${i18nT('adventStatic:tile.day', { value1: door.day })} · ${formatDoorDate(door.date)}` : ''
  const giftImage = door?.gift.image?.trim()

  const renderTask = () => {
    if (!door) return null
    if (!isAuthenticated) {
      return (
        <View style={styles.guest} testID="advent-guest-block">
          <Text style={styles.guestTitle}>{i18nT('adventStatic:sheet.guest.title')}</Text>
          <Text style={styles.body}>{i18nT('adventStatic:sheet.guest.text')}</Text>
          <View style={styles.buttonRow}>
            <Button label={i18nT('adventStatic:sheet.guest.login')} onPress={handleLogin} testID="advent-guest-login" />
            <Button label={i18nT('adventStatic:sheet.guest.register')} variant="outline" onPress={handleRegister} testID="advent-guest-register" />
          </View>
        </View>
      )
    }
    if (door.state === 'done' && door.doneAt) {
      const doneDate = formatDate(isoDateToLocalMidnight(door.doneAt), { day: 'numeric', month: 'long' })
      // Задание с серверным зачётом (#2940) отмечает только сервер — это всегда автозачёт.
      if (door.task.type !== 'open' && (door.task.serverCredited || creditedDays?.has(door.day))) {
        return (
          <Text style={styles.done} testID="advent-task-credited">
            {i18nT('adventStatic:sheet.taskCredited', { value1: doneDate })}
          </Text>
        )
      }
      return (
        <Text style={styles.done} testID="advent-task-done">
          {door.task.type === 'open'
            ? i18nT('adventStatic:sheet.openedAuto')
            : i18nT('adventStatic:sheet.taskDone', { value1: doneDate })}
        </Text>
      )
    }
    switch (door.task.type) {
      case 'riddle':
        return door.task.riddle ? <AdventRiddleTask questions={door.task.riddle.questions} onComplete={handleDone} /> : null
      case 'geo':
        return door.task.geo ? <AdventGeoTask target={door.task.geo} onComplete={handleDone} /> : null
      case 'route':
        if (door.task.serverCredited) {
          // Ручной отметки нет: сервер засчитает само действие на сайте (#2940).
          return (
            <View style={styles.ctaRow}>
              <Button label={door.task.ctaLabel ?? i18nT('adventStatic:sheet.openLink')} onPress={handleCta} testID="advent-task-cta" />
              <Text style={styles.hint} testID="advent-task-server-credit-hint">
                {i18nT('adventStatic:sheet.serverCreditHint')}
              </Text>
            </View>
          )
        }
        return (
          <View style={styles.buttonRow}>
            <Button label={door.task.ctaLabel ?? i18nT('adventStatic:sheet.openLink')} onPress={handleCta} testID="advent-task-cta" />
            <Button label={i18nT('adventStatic:sheet.markDone')} variant="outline" onPress={handleDone} testID="advent-task-done-button" />
          </View>
        )
      default:
        return (
          <Button label={i18nT('adventStatic:sheet.markDone')} variant="outline" onPress={handleDone} testID="advent-task-done-button" />
        )
    }
  }

  return (
    <BottomSheet visible={!!door} onClose={onClose} title={title} placement="center" keyboardAware>
      {door ? (
        <View style={styles.content} testID={`advent-door-sheet-${door.day}`}>
          {giftImage ? <AdventGiftMedia key={`${campaignYear}:${door.day}:${door.date}:${giftImage}`} src={giftImage} alt={door.gift.title} /> : null}
          <Section icon={KIND_ICONS[door.kind]} title={i18nT('adventStatic:sheet.gift')} styles={styles} colors={colors}>
            <Text style={styles.giftTitle}>{door.gift.title}</Text>
            <Text style={styles.body}>{door.gift.text}</Text>
            {door.gift.link ? (
              <Button
                label={door.gift.linkLabel ?? i18nT('adventStatic:sheet.openLink')}
                variant="soft"
                size="sm"
                icon={<Feather name="arrow-right" size={16} color={colors.primaryDark} />}
                iconPosition="right"
                onPress={handleGiftLink}
                testID="advent-gift-link"
              />
            ) : null}
          </Section>
          {/* Финал основной серии — личные «Итоги года» (#2868); нужен аккаунт. */}
          {door.day === ADVENT_MAIN_DOORS && !door.bonus && isAuthenticated ? (
            <Suspense fallback={null}>
              <AdventYearInReviewCard year={campaignYear} preview={preview} />
            </Suspense>
          ) : null}
          <Section icon="target" title={i18nT('adventStatic:sheet.task')} styles={styles} colors={colors}>
            <Text style={styles.body}>{door.task.text}</Text>
            {renderTask()}
          </Section>
          <Section icon="award" title={i18nT('adventStatic:sheet.reward')} styles={styles} colors={colors}>
            <Text style={styles.body}>
              {i18nT('adventStatic:sheet.rewardXp', { value1: formatInteger(door.reward.xp) })}
              {door.reward.label ? ` · ${door.reward.label}` : ''}
            </Text>
          </Section>
        </View>
      ) : null}
    </BottomSheet>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    content: { gap: DESIGN_TOKENS.spacing.sm },
    section: {
      gap: DESIGN_TOKENS.spacing.xs,
      padding: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.lg,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.xxs },
    sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, color: colors.textMuted },
    giftTitle: { fontSize: 18, fontWeight: '700', color: colors.text, lineHeight: 24 },
    body: { fontSize: 15, lineHeight: 22, color: colors.textSecondary },
    buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN_TOKENS.spacing.xs },
    ctaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: DESIGN_TOKENS.spacing.xs },
    hint: { flexShrink: 1, fontSize: 14, lineHeight: 20, color: colors.textMuted },
    done: { fontSize: 15, lineHeight: 22, color: colors.success, fontWeight: '600' },
    guest: {
      gap: DESIGN_TOKENS.spacing.xs,
      padding: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.primarySoft,
    },
    guestTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  })

export default memo(AdventDoorSheet)
