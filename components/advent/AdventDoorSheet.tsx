import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'
import { LinearGradient } from 'expo-linear-gradient'

import BottomSheet from '@/components/ui/BottomSheet'
import Button from '@/components/ui/Button'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { ADVENT_ART_COLORS, type AdventPaperPalette } from '@/constants/adventVisuals'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { formatDate, formatInteger } from '@/i18n/format'
import { translate as i18nT } from '@/i18n'
import { ADVENT_MAIN_DOORS, isoDateToLocalMidnight } from '@/constants/advent'
import type { AdventDoorView } from '@/hooks/useAdventCampaign'
import { buildAdventDoorCtaHref, buildAdventReturnPath } from '@/utils/advent/adventTaskLinks'
import { buildLoginHref, buildRegistrationHref } from '@/utils/authNavigation'
import { openExternalUrl } from '@/utils/externalLinks'
import { sendAnalyticsEvent } from '@/utils/analytics'
import { formatDoorDate } from './AdventDoorTile'
import { ADVENT_POSTCARD_DAY } from './adventDoorVisuals'
import AdventCelebration from './AdventCelebration'
import AdventRiddleTask from './AdventRiddleTask'
import AdventGeoTask from './AdventGeoTask'
import AdventGiftMedia from './AdventGiftMedia'
// Открытка дверцы 25 — в чанке маршрута: шеринг и кнопки уже там (AdventShareCard), а новая
// точка import() сдвигала id модулей, на которые ссылается entry (бюджет entry, #3482).
import AdventPostcard from './AdventPostcard'
import AdventSparkles from './AdventSparkles'
import AdventWindowCrop from './AdventWindowCrop'
import { useAdventPaper } from './useAdventPaper'

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

const HEADER_ASPECT = 16 / 9

/**
 * Лист дверцы как подарок (#3482): шапка — та же комната с фасада, тёплая
 * «бумага» с подарком, «маленькое задание на сегодня» и бирка награды.
 * Гостю вместо задания — вход с возвратом к этому окну (#2861).
 */
function AdventDoorSheet({ door, isAuthenticated, preview, creditedDays, campaignYear, onClose, onCompleteTask }: Props) {
  const router = useRouter()
  const colors = useThemedColors()
  const paper = useAdventPaper()
  const styles = useMemo(() => createStyles(colors, paper), [colors, paper])
  // Дверца, задание которой решено в этом листе: отклик и ответ остаются на виду.
  const [solvedDay, setSolvedDay] = useState<number | null>(null)
  const day = door?.day ?? null
  useEffect(() => {
    setSolvedDay(null)
  }, [day])

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
    setSolvedDay(door.day)
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

  const title = door ? i18nT('adventStatic:sheet.titleGift', { value1: formatDoorDate(door.date) }) : ''
  const giftImage = door?.gift.image?.trim()
  const isOpenGift = door?.task.type === 'open'
  const solvedHere = !!door && solvedDay === door.day
  const done = door?.state === 'done'

  const renderTask = () => {
    if (!door) return null
    if (!isAuthenticated) {
      return (
        <View style={styles.guest} testID="advent-guest-block">
          <Text style={styles.guestTitle}>{i18nT('adventStatic:sheet.guest.title')}</Text>
          <Text style={styles.body}>{i18nT('adventStatic:sheet.guest.text')}</Text>
          <View style={styles.buttonRow}>
            <Button label={i18nT('adventStatic:sheet.guest.login')} onPress={handleLogin} style={styles.rowButton} labelNumberOfLines={2} testID="advent-guest-login" />
            <Button label={i18nT('adventStatic:sheet.guest.register')} variant="outline" onPress={handleRegister} style={styles.rowButton} labelNumberOfLines={2} testID="advent-guest-register" />
          </View>
        </View>
      )
    }
    // Решённая здесь загадка или карта не размонтируется: ответ и праздник остаются на месте.
    const keepInteractive = solvedHere && (door.task.type === 'riddle' || door.task.type === 'geo')
    if (done && door.doneAt && !keepInteractive) {
      const doneDate = formatDate(isoDateToLocalMidnight(door.doneAt), { day: 'numeric', month: 'long' })
      if (solvedHere) {
        return <AdventCelebration testID="advent-task-done" text={i18nT('adventStatic:sheet.taskDone', { value1: doneDate })} xp={door.reward.xp} />
      }
      // Задание с серверным зачётом (#2940) отмечает только сервер — это всегда автозачёт.
      if (door.task.serverCredited || creditedDays?.has(door.day)) {
        return (
          <View style={styles.doneRow} testID="advent-task-credited">
            <Feather name="check-circle" size={18} color={paper.success} />
            <Text style={styles.done}>{i18nT('adventStatic:sheet.taskCredited', { value1: doneDate })}</Text>
          </View>
        )
      }
      return (
        <View style={styles.doneRow} testID="advent-task-done">
          <Feather name="check-circle" size={18} color={paper.success} />
          <Text style={styles.done}>{i18nT('adventStatic:sheet.taskDone', { value1: doneDate })}</Text>
        </View>
      )
    }
    switch (door.task.type) {
      case 'riddle':
        return door.task.riddle ? <AdventRiddleTask questions={door.task.riddle.questions} xp={door.reward.xp} onComplete={handleDone} /> : null
      case 'geo':
        return door.task.geo ? <AdventGeoTask target={door.task.geo} xp={door.reward.xp} onComplete={handleDone} /> : null
      case 'route':
        if (door.task.serverCredited) {
          // Ручной отметки нет: сервер засчитает само действие на сайте (#2940).
          return (
            <View style={styles.ctaRow}>
              <Button label={door.task.ctaLabel ?? i18nT('adventStatic:sheet.openLink')} onPress={handleCta} style={styles.rowButton} labelNumberOfLines={2} testID="advent-task-cta" />
              <Text style={styles.hint} testID="advent-task-server-credit-hint">
                {i18nT('adventStatic:sheet.serverCreditHint')}
              </Text>
            </View>
          )
        }
        return (
          <View style={styles.buttonRow}>
            <Button label={door.task.ctaLabel ?? i18nT('adventStatic:sheet.openLink')} onPress={handleCta} style={styles.rowButton} labelNumberOfLines={2} testID="advent-task-cta" />
            <Button label={i18nT('adventStatic:sheet.markDone')} variant="soft" onPress={handleDone} style={styles.rowButton} labelNumberOfLines={2} testID="advent-task-done-button" />
          </View>
        )
      default:
        return <Button label={i18nT('adventStatic:sheet.markDone')} variant="soft" onPress={handleDone} style={styles.rowButton} labelNumberOfLines={2} testID="advent-task-done-button" />
    }
  }

  return (
    <BottomSheet visible={!!door} onClose={onClose} title={title} placement="center" keyboardAware>
      {door ? (
        <View style={styles.content} testID={`advent-door-sheet-${door.day}`}>
          {/* Шапка — та же комната, что на фасаде: окно «приближается» и становится листом. */}
          <View style={styles.header}>
            <AdventWindowCrop
              day={door.bonus ? null : door.day}
              aspectRatio={HEADER_ASPECT}
              testID="advent-sheet-room"
            />
            <LinearGradient
              pointerEvents="none"
              colors={[ADVENT_ART_COLORS.moonlightClear, paper.paper]}
              start={{ x: 0, y: 0.55 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.dayChip}>
              <Feather name="gift" size={13} color={paper.gold} />
              <Text style={styles.dayChipText}>{i18nT('adventStatic:tile.day', { value1: door.day })}</Text>
            </View>
            <AdventSparkles burstKey={door.day} count={10} radius={90} />
          </View>

          <View style={styles.paper}>
            {giftImage ? <AdventGiftMedia key={`${campaignYear}:${door.day}:${door.date}:${giftImage}`} src={giftImage} alt={door.gift.title} /> : null}
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
                style={styles.giftLink}
                labelNumberOfLines={2}
                testID="advent-gift-link"
              />
            ) : null}
            {/* Открытка Рождества доступна всем: это сам подарок дверцы. */}
            {door.day === ADVENT_POSTCARD_DAY && door.bonus ? (
              <AdventPostcard year={campaignYear} preview={preview} />
            ) : null}
            {/* Дверца-подарок без задания: тихая строка вместо пустого «задания». */}
            {isOpenGift ? (
              <Text style={styles.openNote} testID="advent-open-note">
                {door.task.text}
              </Text>
            ) : null}
          </View>

          {/* Финал основной серии — личные «Итоги года» (#2868); нужен аккаунт. */}
          {door.day === ADVENT_MAIN_DOORS && !door.bonus && isAuthenticated ? (
            <Suspense fallback={null}>
              <AdventYearInReviewCard year={campaignYear} preview={preview} />
            </Suspense>
          ) : null}

          {isOpenGift && isAuthenticated ? null : (
            <View style={styles.task} testID="advent-task-section">
              <View style={styles.taskTitleRow}>
                <Feather name="star" size={16} color={paper.gold} />
                <Text style={styles.taskTitle}>{i18nT('adventStatic:sheet.task')}</Text>
              </View>
              {isOpenGift ? null : <Text style={styles.body}>{door.task.text}</Text>}
              {renderTask()}
            </View>
          )}

          <View style={styles.reward} testID="advent-reward-tag">
            <View style={styles.medal}>
              <Feather name="award" size={20} color={paper.paper} />
            </View>
            <View style={styles.rewardText}>
              <Text style={styles.rewardXp}>{i18nT('adventStatic:sheet.rewardXp', { value1: formatInteger(door.reward.xp) })}</Text>
              {door.reward.label ? <Text style={styles.rewardLabel}>{door.reward.label}</Text> : null}
            </View>
            <Text style={[styles.rewardState, done && styles.rewardStateDone]} testID="advent-reward-state">
              {i18nT(done ? 'adventStatic:sheet.rewardReceived' : 'adventStatic:sheet.rewardWaiting')}
            </Text>
          </View>
        </View>
      ) : null}
    </BottomSheet>
  )
}

const createStyles = (colors: ThemedColors, paper: AdventPaperPalette) =>
  StyleSheet.create({
    content: { gap: DESIGN_TOKENS.spacing.sm },
    header: {
      borderRadius: DESIGN_TOKENS.radii.lg,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: ADVENT_ART_COLORS.gold,
      backgroundColor: ADVENT_ART_COLORS.night,
    },
    dayChip: {
      position: 'absolute',
      left: DESIGN_TOKENS.spacing.sm,
      bottom: DESIGN_TOKENS.spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xxs,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      paddingVertical: DESIGN_TOKENS.spacing.xxs,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: paper.paper,
      borderWidth: 1,
      borderColor: paper.edge,
    },
    dayChipText: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: paper.ink },
    paper: {
      gap: DESIGN_TOKENS.spacing.xs,
      padding: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.lg,
      backgroundColor: paper.paper,
      borderWidth: 1,
      borderColor: paper.edge,
    },
    giftTitle: { fontSize: 20, fontWeight: '800', color: paper.ink, lineHeight: 26 },
    body: { fontSize: 15, lineHeight: 22, color: paper.ink },
    openNote: { fontSize: 14, lineHeight: 20, color: paper.inkMuted, fontStyle: 'italic' },
    task: {
      gap: DESIGN_TOKENS.spacing.sm,
      padding: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.lg,
      backgroundColor: paper.paper,
      borderWidth: 1,
      borderColor: paper.edge,
      borderStyle: 'dashed',
    },
    taskTitleRow: { flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.xs },
    taskTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: paper.ink },
    buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN_TOKENS.spacing.xs },
    // Кнопка по ширине подписи, но не шире бумаги: длинная подпись переносится,
    // а не выталкивает лист вбок (приёмка #3482, 320–390 px).
    rowButton: { maxWidth: '100%' },
    giftLink: { alignSelf: 'flex-start', maxWidth: '100%' },
    ctaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: DESIGN_TOKENS.spacing.xs },
    hint: { flexShrink: 1, fontSize: 14, lineHeight: 20, color: paper.inkMuted },
    doneRow: { flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.xs },
    done: { flexShrink: 1, fontSize: 15, lineHeight: 22, color: paper.success, fontWeight: '700' },
    guest: {
      gap: DESIGN_TOKENS.spacing.xs,
      padding: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: paper.tag,
    },
    guestTitle: { fontSize: 15, fontWeight: '700', color: paper.ink },
    reward: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
      padding: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: paper.tag,
      borderWidth: 1,
      borderColor: paper.edge,
    },
    medal: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: paper.gold,
    },
    rewardText: { flex: 1, minWidth: 0 },
    rewardXp: { fontSize: 17, lineHeight: 22, fontWeight: '800', color: paper.gold },
    rewardLabel: { fontSize: 13, lineHeight: 18, color: paper.ink },
    rewardState: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: paper.inkMuted, flexShrink: 0, marginRight: DESIGN_TOKENS.spacing.xs },
    rewardStateDone: { color: paper.success },
  })

export default memo(AdventDoorSheet)
